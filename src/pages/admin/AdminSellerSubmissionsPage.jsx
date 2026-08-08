import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, X, ImageIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminListSellerSubmissions, adminApproveSellerSubmission, adminRejectSellerSubmission } from "../../utils/api.js";

const STATUS_TABS = [
    { key: "pending_review", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];

export default function AdminSellerSubmissionsPage() {
    const { token } = useAuth();
    const [status, setStatus] = useState("pending_review");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState("");

    function load() {
        setLoading(true);
        adminListSellerSubmissions(token, status).then((res) => {
            if (res?.success) setItems(res.items);
            setLoading(false);
        });
    }
    useEffect(() => { if (token) load(); }, [token, status]);

    async function approve(id) {
        setBusyId(id);
        const res = await adminApproveSellerSubmission(token, id);
        setBusyId(null);
        if (res?.success) load();
    }
    async function submitReject() {
        if (!reason.trim()) return;
        setBusyId(rejecting);
        const res = await adminRejectSellerSubmission(token, rejecting, reason.trim());
        setBusyId(null);
        if (res?.success) { setRejecting(null); setReason(""); load(); }
    }

    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
            <h1 className="text-[20px] font-extrabold text-slate-900 sm:text-[22px]">Product Review Requests</h1>
            <p className="text-[12.5px] font-medium text-slate-400">Approve or reject what sellers have submitted</p>

            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
                {STATUS_TABS.map((t) => (
                    <button key={t.key} onClick={() => setStatus(t.key)}
                        className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                        style={{ background: status === t.key ? "#047084" : "#f1f5f9", color: status === t.key ? "white" : "#64748b" }}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-5 flex flex-col gap-3">
                {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
                {!loading && items.length === 0 && <p className="py-14 text-center text-[13px] font-medium text-slate-400">Nothing here.</p>}
                <AnimatePresence initial={false}>
                    {!loading && items.map((it) => (
                        <motion.div key={it.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3.5 rounded-xl border border-slate-100 bg-white p-4">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-100">
                                {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-6 w-6 text-slate-300" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-bold text-slate-900">{it.product_name}</p>
                                <p className="text-[12px] font-semibold text-slate-400">
                                    {it.brand_name} · {it.generic_product?.subcategory?.category?.name} / {it.generic_product?.subcategory?.name} / {it.generic_product?.name}
                                </p>
                                <p className="mt-1 text-[12.5px] font-medium text-slate-600">
                                    ₹{it.price} · MOQ {it.moq} {it.unit} · Lead time {it.lead_time}
                                </p>
                                <p className="text-[11.5px] font-medium text-slate-400">Seller: {it.seller?.display_name || "—"}</p>
                                {it.rejection_reason && <p className="mt-1 text-[11.5px] font-semibold text-[#c71f11]">Rejected: {it.rejection_reason}</p>}
                            </div>
                            {it.review_status === "pending_review" && (
                                <div className="flex shrink-0 flex-col gap-1.5">
                                    <button onClick={() => approve(it.id)} disabled={busyId === it.id}
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#047084] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
                                        {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                                    </button>
                                    <button onClick={() => { setRejecting(it.id); setReason(""); }}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[#c71f11]/25 px-3 py-1.5 text-[12px] font-bold text-[#c71f11]">
                                        <X className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {rejecting && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 sm:items-center" onClick={() => setRejecting(null)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
                        <h3 className="text-[15px] font-bold text-slate-900">Reject this listing</h3>
                        <p className="mt-1 text-[12.5px] text-slate-500">The seller will be notified with this reason.</p>
                        <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…"
                            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#c71f11]/20" />
                        <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setRejecting(null)} className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-500">Cancel</button>
                            <button onClick={submitReject} disabled={!reason.trim() || busyId === rejecting} className="rounded-lg bg-[#c71f11] px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-50">Reject</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}