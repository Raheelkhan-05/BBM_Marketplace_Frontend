import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, ShieldPlus, ShieldMinus, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminSearchUsers, adminListAdmins, adminPromoteUser, adminDemoteUser } from "../../utils/api.js";

export default function AdminManageAdminsPage() {
  const { token, profile: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const loadAdmins = useCallback(() => {

    setLoadingAdmins(true);
    adminListAdmins(token).then((res) => {
      if (res?.success) setAdmins(res.admins);
      setLoadingAdmins(false);
    });
  }, [token]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  useEffect(() => {
    // if (!token) return;
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
    //   console.log("token : ",token);
      const res = await adminSearchUsers(token, q.trim());
      if (res?.success) setResults(res.users);
      setSearching(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q, token]);

  const handlePromote = async (userId) => {
    setError(null);
    setBusyId(userId);
    const res = await adminPromoteUser(token, userId);
    if (!res?.success) setError(res?.message || "Couldn't promote user.");
    else { setResults((r) => r.map((u) => (u.id === userId ? { ...u, role: "admin" } : u))); loadAdmins(); }
    setBusyId(null);
  };

  const handleDemote = async (userId) => {
    setError(null);
    setBusyId(userId);
    const res = await adminDemoteUser(token, userId);
    if (!res?.success) setError(res?.message || "Couldn't remove admin access.");
    else loadAdmins();
    setBusyId(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[22px] font-extrabold text-slate-900">Manage Admins</h1>
      <p className="mt-1 text-[13px] font-medium text-slate-500">Search users by name, phone, or email to grant admin access.</p>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="w-full bg-transparent text-[13.5px] font-medium focus:outline-none" />
        {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
      </div>

      {error && <p className="mt-2.5 text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}

      {results.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {results.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-slate-900">{u.name || "Unnamed user"}</p>
                <p className="truncate text-[12px] font-medium text-slate-400">{u.email || u.phone}</p>
              </div>
              {u.role === "admin" ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#047084]/10 px-2.5 py-1 text-[11px] font-bold text-[#047084]">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              ) : (
                <button onClick={() => handlePromote(u.id)} disabled={busyId === u.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#047084]/30 px-3 py-1.5 text-[12px] font-bold text-[#047084]">
                  {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldPlus className="h-3.5 w-3.5" />}
                  Make Admin
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-[14px] font-extrabold text-slate-900">Current Admins</h2>
      <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {loadingAdmins && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#047084]" /></div>}
        {!loadingAdmins && admins.map((a) => {
          const isSelf = a.id === currentAdmin?.id;
          return (
            <motion.div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-slate-900">{a.name || "Unnamed"} {isSelf && <span className="font-medium text-slate-400">(you)</span>}</p>
                <p className="truncate text-[12px] font-medium text-slate-400">{a.email || a.phone}</p>
              </div>
              {!isSelf && (
                <button onClick={() => handleDemote(a.id)} disabled={busyId === a.id || admins.length <= 1}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#c71f11]/25 px-3 py-1.5 text-[12px] font-bold text-[#c71f11] disabled:opacity-40">
                  {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldMinus className="h-3.5 w-3.5" />}
                  Remove
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}