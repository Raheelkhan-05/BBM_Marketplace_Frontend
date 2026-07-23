import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminGetSeller, adminUpdateSeller, adminApproveSeller, adminRejectSeller } from "../../utils/api.js";

const SECTIONS = [
  { title: "Basics", fields: ["display_name", "business_type", "industry", "year_established", "employee_range"] },
  { title: "Contact", fields: ["contact_person", "designation", "whatsapp_number", "website"] },
  { title: "Address", fields: ["address", "pincode", "city", "state", "country"] },
  { title: "Credentials", fields: ["pan", "iec_code", "udyam_number", "cin"] },
  { title: "Digital Presence", fields: ["linkedin_url", "facebook_url", "instagram_url", "youtube_url"] },
];

export default function AdminSellerDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [seller, setSeller] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminGetSeller(token, id).then((res) => {
      if (res?.success) { setSeller(res.seller); setForm(res.seller); setPhotos(res.photos); setCertifications(res.certifications); }
      setLoading(false);
    });
  }, [id, token]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const res = await adminUpdateSeller(token, id, form);
    if (res?.success) setSeller(res.seller);
    setSaving(false);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    const res = await adminApproveSeller(token, id);
    if (res?.success) setSeller(res.seller);
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    const res = await adminRejectSeller(token, id, rejectReason);
    if (res?.success) { setSeller(res.seller); setRejectOpen(false); }
    setActionLoading(false);
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#047084]" /></div>;
  if (!seller) return <p className="py-16 text-center text-slate-400">Seller not found.</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
      <button onClick={() => navigate("/admin/sellers")} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Back to list
      </button>

      <div className="mt-3 flex items-center gap-3">
        {seller.logo_url && <img src={seller.logo_url} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />}
        <div>
          <h1 className="text-[20px] font-extrabold text-slate-900">{seller.display_name}</h1>
          <p className="text-[12.5px] font-semibold text-slate-400">Status: <span className="uppercase">{seller.status.replace("_", " ")}</span></p>
        </div>
      </div>

      {seller.status === "pending_review" && (
        <div className="mt-5 flex gap-2.5">
          <button onClick={handleApprove} disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white">
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve & Go Live
          </button>
          <button onClick={() => setRejectOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-[#c71f11]/30 px-4 py-2.5 text-[13px] font-bold text-[#c71f11]">
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      )}

      {rejectOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 rounded-xl border border-[#c71f11]/20 bg-[#c71f11]/[0.03] p-4">
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Explain what needs fixing…"
            className="w-full rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] focus:border-[#c71f11] focus:outline-none" />
          <div className="mt-2 flex gap-2">
            <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} className="rounded-lg bg-[#c71f11] px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40">Confirm Reject</button>
            <button onClick={() => setRejectOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-[12.5px] font-bold text-slate-500">Cancel</button>
          </div>
        </motion.div>
      )}

      {seller.status === "approved" && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-emerald-700">
          This shop is live. Edits below save immediately and stay visible to buyers — the seller is notified of changes.
        </p>
      )}

      {SECTIONS.map((sec) => (
        <div key={sec.title} className="mt-6">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-500">{sec.title}</h3>
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <div key={f} className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{f.replace(/_/g, " ")}</label>
                <input value={form[f] ?? ""} onChange={(e) => update(f, e.target.value)}
                  className="rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-semibold focus:border-[#047084] focus:outline-none" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleSave} disabled={saving}
        className="mt-7 flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white"
        style={{ background: "linear-gradient(135deg, #047084, #0a95ab)" }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
      </button>
    </div>
  );
}