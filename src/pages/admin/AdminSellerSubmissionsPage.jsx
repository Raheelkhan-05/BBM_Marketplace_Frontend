import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, X, ImageIcon, Pencil, Save } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
    adminListSellerSubmissions, adminApproveSellerSubmission,
    adminRejectSellerSubmission, adminUpdateSellerSubmission,
} from "../../utils/api.js";
import ImageLightbox from "../../components/ImageLightbox.jsx";

const STATUS_TABS = [
    { key: "pending_review", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];

export default function AdminSellerSubmissionsPage() {
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [status, setStatus] = useState(() =>
        searchParams.get("highlight") ? "all" : "pending_review"
    );
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState("");
    const [lightbox, setLightbox] = useState(null);
    const [editing, setEditing] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    // const [highlightId, setHighlightId] = useState(searchParams.get("highlight"));
    const itemRefs = useRef(new Map());

    useEffect(() => {
        const id = searchParams.get("highlight");
        if (id) {
            setHighlightId(id);
            setStatus("all"); // the item may no longer be in "pending" — see fix #4
        }
    }, [searchParams]);

    useEffect(() => {
        function onVisible() {
            if (document.visibilityState === "visible") load();
        }
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    function load() {
        setLoading(true);
        adminListSellerSubmissions(token, status).then((res) => {
            if (res?.success) setItems(res.items);
            setLoading(false);
        });
    }
    useEffect(() => { if (token) load(); }, [token, status]);


    // Realtime: any submission created/approved/rejected/edited anywhere
    // pings this channel — refetch whatever tab is open.
    useEffect(() => {
        if (!token) return;
        const channel = supabase
            .channel("admin-submissions")
            .on("broadcast", { event: "submissions_changed" }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, status]);

    // Poll for the row instead of assuming it's already rendered — items
    // may still be loading when this fires.
    useEffect(() => {
        if (!highlightId) return;
        let cancelled = false;
        let attempts = 0;
        function tryScroll() {
            if (cancelled) return;
            const el = itemRefs.current.get(highlightId);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => {
                    if (cancelled) return;
                    setHighlightId(null);
                    const next = new URLSearchParams(searchParams);
                    next.delete("highlight");
                    setSearchParams(next, { replace: true });
                }, 2500);
                return;
            }
            attempts += 1;
            if (attempts < 40) setTimeout(tryScroll, 100);
        }
        tryScroll();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightId]);

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

    function openLightbox(it) {
        const gallery = it.images?.length ? it.images : (it.image ? [it.image] : []);
        if (!gallery.length) return;
        setLightbox({ images: gallery });
    }

    return (
        <div className="mx-auto min-h-screen max-w-4xl px-4 pb-24 pt-6 sm:px-6">
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
                        <motion.div
                            key={it.id}
                            ref={(el) => { if (el) itemRefs.current.set(it.id, el); }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3.5 rounded-xl border bg-white p-4 transition-shadow duration-300"
                            style={{
                                borderColor: highlightId === it.id ? "#047084" : "#f1f5f9",
                                boxShadow: highlightId === it.id ? "0 0 0 3px rgba(4,112,132,0.18)" : undefined,
                            }}
                        >
                            <button
                                onClick={() => openLightbox(it)}
                                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-100"
                                aria-label="View image"
                            >
                                {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-6 w-6 text-slate-300" />}
                                {it.images?.length > 1 && (
                                    <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1 text-[8.5px] font-bold text-white">
                                        +{it.images.length - 1}
                                    </span>
                                )}
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-bold text-slate-900">{it.product_name}</p>
                                <p className="text-[12px] font-semibold text-slate-400">
                                    {it.brand_name} · {it.generic_product?.subcategory?.category?.name} / {it.generic_product?.subcategory?.name} / {it.generic_product?.name}
                                </p>
                                <p className="mt-1 text-[12.5px] font-medium text-slate-600">
                                    ₹{it.price} · MOQ {it.moq} {it.unit} · Lead time {it.lead_time} days
                                </p>
                                <p className="text-[11.5px] font-medium text-slate-400">Seller: {it.seller?.display_name || "—"}</p>
                                {it.rejection_reason && <p className="mt-1 text-[11.5px] font-semibold text-[#c71f11]">Rejected: {it.rejection_reason}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col gap-1.5">
                                <button onClick={() => setEditing(it)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600">
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                                {it.review_status === "pending_review" && (
                                    <>
                                        <button onClick={() => approve(it.id)} disabled={busyId === it.id}
                                            className="inline-flex items-center gap-1 rounded-lg bg-[#047084] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
                                            {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                                        </button>
                                        <button onClick={() => { setRejecting(it.id); setReason(""); }}
                                            className="inline-flex items-center gap-1 rounded-lg border border-[#c71f11]/25 px-3 py-1.5 text-[12px] font-bold text-[#c71f11]">
                                            <X className="h-3.5 w-3.5" /> Reject
                                        </button>
                                    </>
                                )}
                            </div>
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

            {lightbox && (
                <ImageLightbox images={lightbox.images} alt="" onClose={() => setLightbox(null)} />
            )}

            {editing && (
                <EditSubmissionModal
                    token={token}
                    item={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                />
            )}
        </div>
    );
}

function EditSubmissionModal({ token, item, onClose, onSaved }) {
    const [productName, setProductName] = useState(item.product_name || "");
    const [brandName, setBrandName] = useState(item.brand_name || "");
    const [price, setPrice] = useState(String(item.price ?? ""));
    const [moq, setMoq] = useState(String(item.moq ?? ""));
    const [unit, setUnit] = useState(item.unit || "");
    const [leadTime, setLeadTime] = useState(item.lead_time || "");
    const [images, setImages] = useState(item.images?.length ? item.images : (item.image ? [item.image] : []));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // NOTE: adding a NEW image file here would need an upload call first
    // (adminUploadCatalogImage, same as CreateSimpleCatalogModal) before
    // pushing the returned url into `images`. Wire that in if admins need
    // to add fresh photos, not just remove/reorder existing ones.
    function removeImageAt(i) {
        setImages((imgs) => imgs.filter((_, idx) => idx !== i));
    }

    async function handleSave() {
        setError("");
        if (!productName.trim() || !brandName.trim()) return setError("Product name and brand name are required.");
        if (!(Number(price) > 0)) return setError("Price must be greater than 0.");
        if (!(Number(moq) > 0)) return setError("MOQ must be greater than 0.");
        if (!unit) return setError("Select a unit.");
        if (!(Number(leadTime) >= 0)) return setError("Lead time must be a valid number of days.");
        if (!images.length) return setError("At least one image is required.");

        setSaving(true);
        try {
            const res = await adminUpdateSellerSubmission(token, item.id, {
                productName: productName.trim(),
                brandName: brandName.trim(),
                price: Number(price),
                moq: Number(moq),
                unit,
                leadTime: Number(leadTime),
                images,
            });
            if (!res?.success) throw new Error(res?.message || "Couldn't save changes.");
            onSaved();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-[16px] font-extrabold text-slate-900">Edit listing</h3>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
                </div>

                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                    <Field label="Product name *" value={productName} onChange={setProductName} />
                    <Field label="Brand name *" value={brandName} onChange={setBrandName} />

                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Images</label>
                        <div className="flex flex-wrap gap-2">
                            {images.map((src, i) => (
                                <div key={src + i} className="relative h-20 w-20">
                                    <img src={src} alt="" className="h-full w-full rounded-lg border border-slate-200 object-cover" />
                                    <button type="button" onClick={() => removeImageAt(i)}
                                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] leading-none text-white">×</button>
                                    {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[8.5px] font-bold text-white">Cover</span>}
                                </div>
                            ))}
                            {images.length === 0 && <p className="text-[12px] font-medium text-slate-400">No images left — this listing needs at least one.</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Price (₹) *" value={price} onChange={(v) => setPrice(v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                        <Field label="MOQ *" value={moq} onChange={(v) => setMoq(v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Unit *</label>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25">
                            <option value="" disabled>Select unit…</option>
                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>

                    <Field label="Lead time (days) *" value={leadTime} type="number" min="0" onChange={(v) => setLeadTime(v.replace(/[^\d]/g, ""))} placeholder="e.g. 7" />

                    {error && <p className="text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save changes
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, inputMode, type = "text", min }) {
    return (
        <div>
            <label className="mb-1.5 block text-[12px] font-bold text-slate-500">{label}</label>
            <input type={type} min={min} value={value} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
        </div>
    );
}