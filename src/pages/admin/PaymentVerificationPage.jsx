// pages/admin/PaymentVerificationPage.jsx
//
// Admin review queue for the UPI QR payment flow. Mount this at whatever
// route your other admin review pages live under, e.g. /admin/payments.
// Gate the route itself behind your existing admin-auth check (same as
// your hs_categories / seller review pages) — this component assumes
// `token` already belongs to an authenticated admin.
//
// Talks to:
//   GET  /api/admin/payment-proofs?status=pending|verified|rejected
//   POST /api/admin/payment-proofs/:id/verify   { note? }
//   POST /api/admin/payment-proofs/:id/reject   { note }  (note required)
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, CheckCircle2, XCircle, Clock, ImageOff, ExternalLink,
    ZoomIn, X, AlertCircle, RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { C } from "../../components/seller/listingForm/FormPrimitives.jsx"; // reuse existing tokens

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function apiListProofs(token, status) {
    const res = await fetch(`${API_BASE}/admin/payment-proofs?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try { message = (await res.json())?.message || message; } catch { }
        return { success: false, message };
    }
    return res.json();
}
async function apiVerifyProof(token, id, note) {
    const res = await fetch(`${API_BASE}/admin/payment-proofs/${id}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
    });
    return res.json();
}
async function apiRejectProof(token, id, note) {
    const res = await fetch(`${API_BASE}/admin/payment-proofs/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
    });
    return res.json();
}

const TABS = [
    { value: "pending", label: "Pending review", icon: Clock },
    { value: "verified", label: "Verified", icon: CheckCircle2 },
    { value: "rejected", label: "Rejected", icon: XCircle },
];

function formatDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }) {
    const map = {
        pending: { bg: "#fef3c7", fg: "#a16207", label: "Pending" },
        verified: { bg: "#dcfce7", fg: "#15803d", label: "Verified" },
        rejected: { bg: "rgba(199,31,17,0.08)", fg: C.danger, label: "Rejected" },
    };
    const s = map[status] || map.pending;
    return (
        <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide" style={{ background: s.bg, color: s.fg }}>
            {s.label}
        </span>
    );
}

// Simple click-to-zoom lightbox for the payment screenshot.
function ImageLightbox({ src, onClose }) {
    if (!src) return null;
    return (
        <motion.div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <button className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <X className="h-5 w-5" />
            </button>
            <img src={src} alt="Payment screenshot" className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </motion.div>
    );
}

// Reject requires a reason — small inline form instead of a plain confirm(),
// since that note is what the buyer sees.
function RejectPanel({ onCancel, onConfirm, submitting }) {
    const [note, setNote] = useState("");
    return (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: C.hair, background: C.hairSoft }}>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>
                Reason (shown to the buyer)
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="e.g. UTR doesn't match any received payment, or screenshot amount doesn't match the order total."
                className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] font-medium tracking-wide focus:outline-none focus:ring-2"
                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }} />
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold tracking-wide" style={{ borderColor: C.hair, color: C.muted }}>
                    Cancel
                </button>
                <button onClick={() => onConfirm(note)} disabled={!note.trim() || submitting}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-bold tracking-wide text-white disabled:opacity-50"
                    style={{ background: C.danger }}>
                    {submitting ? "Rejecting…" : "Confirm reject"}
                </button>
            </div>
        </div>
    );
}

function ProofCard({ proof, onVerify, onReject, onZoom, actioning }) {
    const [rejecting, setRejecting] = useState(false);
    const order = proof.order;

    return (
        <div className="flex flex-col gap-3 rounded-2xl border p-4" style={{ borderColor: C.hair }}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold tracking-wide" style={{ color: C.ink }}>{order?.order_number || "—"}</p>
                    <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>
                        {order?.buyer_contact_name} · {order?.buyer_contact_phone}
                    </p>
                    {order?.seller?.display_name && (
                        <p className="text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                            Seller: {order.seller.display_name}
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <StatusPill status={proof.status} />
                    <span className="text-[16px] font-extrabold tabular-nums" style={{ color: C.ink }}>
                        ₹{Number(order?.total_amount ?? proof.amount_claimed ?? 0).toLocaleString("en-IN")}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg p-2.5" style={{ background: C.hairSoft }}>
                <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>UTR / reference</p>
                    <p className="font-mono text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>{proof.utr_number}</p>
                </div>
                <div>
                    <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Submitted</p>
                    <p className="text-[12px] font-bold tracking-wide" style={{ color: C.ink }}>{formatDateTime(proof.created_at)}</p>
                </div>
                {proof.screenshot_url ? (
                    <button onClick={() => onZoom(proof.screenshot_url)}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold tracking-wide"
                        style={{ borderColor: C.hair, color: C.secondary }}>
                        <ZoomIn className="h-3.5 w-3.5" /> View screenshot
                    </button>
                ) : (
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                        <ImageOff className="h-3.5 w-3.5" /> No screenshot
                    </span>
                )}
                {order?.id && (
                    <a href={`/seller/orders/${order.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[11.5px] font-bold tracking-wide" style={{ color: C.muted }}>
                        Order details <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>

            {proof.status === "rejected" && proof.admin_note && (
                <p className="rounded-lg px-2.5 py-2 text-[12px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>
                    Rejected: {proof.admin_note}
                </p>
            )}

            {proof.status === "pending" && (
                rejecting ? (
                    <RejectPanel
                        submitting={actioning === proof.id}
                        onCancel={() => setRejecting(false)}
                        onConfirm={(note) => onReject(proof.id, note)}
                    />
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => onVerify(proof.id)} disabled={actioning === proof.id}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold tracking-wide text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg,#15803d,#22c55e)" }}>
                            {actioning === proof.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Verify & notify seller
                        </button>
                        <button onClick={() => setRejecting(true)} disabled={actioning === proof.id}
                            className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-bold tracking-wide disabled:opacity-50"
                            style={{ borderColor: C.danger, color: C.danger }}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                    </div>
                )
            )}
        </div>
    );
}

export default function PaymentVerificationPage() {
    const { token } = useAuth();
    const [tab, setTab] = useState("pending");
    const [proofs, setProofs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actioning, setActioning] = useState(null); // proof id currently being verified/rejected
    const [zoomSrc, setZoomSrc] = useState(null);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiListProofs(token, tab);
            if (!res?.success) setError(res?.message || "Couldn't load payment proofs.");
            else setProofs(res.proofs || []);
        } catch (err) {
            setError("Couldn't reach the server. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [token, tab]);

    useEffect(() => { load(); }, [load]);

    const handleVerify = async (proofId) => {
        setActioning(proofId);
        const res = await apiVerifyProof(token, proofId, null);
        setActioning(null);
        if (!res?.success) { setError(res?.message || "Couldn't verify this payment."); return; }
        setProofs((prev) => prev.filter((p) => p.id !== proofId)); // leaves the "pending" tab
    };

    const handleReject = async (proofId, note) => {
        setActioning(proofId);
        const res = await apiRejectProof(token, proofId, note);
        setActioning(null);
        if (!res?.success) { setError(res?.message || "Couldn't reject this payment."); return; }
        setProofs((prev) => prev.filter((p) => p.id !== proofId));
    };

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>Admin</p>
                    <h1 className="text-[20px] font-extrabold tracking-wide" style={{ color: C.ink }}>Payment verification</h1>
                </div>
                <button onClick={load} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold tracking-wide" style={{ borderColor: C.hair, color: C.muted }}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
            </div>

            <div className="mb-4 flex gap-1 rounded-xl p-1" style={{ background: C.hairSoft }}>
                {TABS.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => setTab(value)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold tracking-wide transition-colors duration-150"
                        style={tab === value ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                ))}
            </div>

            {error && (
                <p className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>
                    <AlertCircle className="h-3.5 w-3.5" /> {error}
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>
            ) : proofs.length === 0 ? (
                <p className="rounded-2xl border py-14 text-center text-[13px] font-semibold tracking-wide" style={{ borderColor: C.hair, color: C.muted }}>
                    Nothing here right now.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {proofs.map((proof) => (
                        <ProofCard key={proof.id} proof={proof} actioning={actioning}
                            onVerify={handleVerify} onReject={handleReject} onZoom={setZoomSrc} />
                    ))}
                </div>
            )}

            <AnimatePresence>
                {zoomSrc && <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
            </AnimatePresence>
        </div>
    );
}