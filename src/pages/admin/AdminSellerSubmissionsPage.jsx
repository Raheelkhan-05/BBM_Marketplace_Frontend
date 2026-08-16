import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, CheckCircle2, X, ImageIcon, Pencil, Save, ChevronDown,
    Package, IndianRupee, Boxes, Archive, Truck, FileText, Handshake, ShieldCheck, Plus, Trash2,
} from "lucide-react";
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
const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];

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
    const itemRefs = useRef(new Map());

    useEffect(() => {
        const id = searchParams.get("highlight");
        if (id) {
            setHighlightId(id);
            setStatus("all"); // the item may no longer be in "pending"
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
                                    {it.stock_type && <span className="ml-1.5 text-slate-400">· {it.stock_type === "made_to_order" ? "Made-to-order" : "Ready stock"}</span>}
                                </p>
                                <p className="text-[11.5px] font-medium text-slate-400">
                                    Seller: {it.seller?.display_name || "—"}
                                    {it.hsn_code && <span> · HSN {it.hsn_code}</span>}
                                    {it.is_active === false && <span className="ml-1.5 font-bold text-amber-600">· Hidden by seller</span>}
                                </p>
                                {it.rejection_reason && <p className="mt-1 text-[11.5px] font-semibold text-[#c71f11]">Rejected: {it.rejection_reason}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col gap-1.5">
                                <button onClick={() => setEditing(it.id)}
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
                    submissionId={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                />
            )}
        </div>
    );
}

/* =====================================================================
   Full-spec edit modal — mirrors every section of the seller's own
   SellerListingForm so admin can see and correct anything the seller
   filled in. Fetches the full record on open (list rows only carry the
   lighter "hot" columns), so an admin never has to guess a field's
   current value before the record has loaded.
   ===================================================================== */

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25";

function Field({ label, children, required, hint }) {
    return (
        <div>
            <label className="mb-1.5 block text-[12px] font-bold text-slate-500">
                {label} {required && <span className="text-[#c71f11]">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p>}
        </div>
    );
}
function TextInput(props) { return <input {...props} className={inputClass} />; }
function SelectInput({ children, ...props }) { return <select {...props} className={inputClass}>{children}</select>; }
function TextArea(props) { return <textarea rows={props.rows || 3} {...props} className={`${inputClass} resize-none`} />; }
function ToggleRow({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-2.5 text-[13px] font-bold text-slate-700">
            <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" />
            {label}
        </label>
    );
}

function Accordion({ icon: Icon, title, subtitle, defaultOpen, children }) {
    const [open, setOpen] = useState(!!defaultOpen);
    return (
        <div className="overflow-hidden rounded-xl border border-slate-100">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50">
                <Icon className="h-4 w-4 shrink-0 text-[#047084]" />
                <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-extrabold text-slate-900">{title}</span>
                    {subtitle && <span className="block text-[11px] font-medium text-slate-400">{subtitle}</span>}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {open && <div className="flex flex-col gap-3.5 border-t border-slate-100 px-4 py-4">{children}</div>}
        </div>
    );
}

function RowsEditor({ rows, onChange, columns, addLabel }) {
    const update = (i, key, val) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
    const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
    const add = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))]);
    return (
        <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    {columns.map((c) => (
                        <input key={c.key} value={row[c.key] ?? ""} placeholder={c.placeholder}
                            onChange={(e) => update(i, c.key, e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    ))}
                    <button type="button" onClick={() => remove(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 text-[#c71f11]" />
                    </button>
                </div>
            ))}
            <button type="button" onClick={add} className="flex w-fit items-center gap-1 text-[12px] font-bold text-[#047084]">
                <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
        </div>
    );
}

function EditSubmissionModal({ token, submissionId, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [images, setImages] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { adminGetSellerSubmission } = await import("../../utils/api.js");
            const res = await adminGetSellerSubmission(token, submissionId);
            if (cancelled) return;
            if (res?.success) {
                const s = res.submission;
                setForm({
                    productName: s.product_name || "",
                    brandName: s.brand_name || "",
                    manufacturer: s.manufacturer || "",
                    modelNo: s.model_no || "",
                    gradeVariant: s.grade_variant || "",
                    specifications: s.specifications || [],
                    basePrice: s.base_price ?? "",
                    gstPercent: s.gst_percent ?? 18,
                    ratePerPack: s.rate_per_pack ?? "",
                    ratePerMasterPack: s.rate_per_master_pack ?? "",
                    priceValidityTill: s.price_validity_till || "",
                    moq: s.moq ?? "",
                    sampleAvailable: s.sample_available || false,
                    samplePrice: s.sample_price ?? "",
                    priceSlabs: s.price_slabs || [],
                    quantityDiscounts: s.quantity_discounts || [],
                    packSize: s.pack_size ?? "",
                    unit: s.unit || "",
                    unitsPerMasterPack: s.units_per_master_pack ?? "",
                    masterPackSize: s.master_pack_size ?? "",
                    packagingType: s.packaging_type || "",
                    stockQuantity: s.stock_quantity ?? "",
                    stockType: s.stock_type || "ready_stock",
                    dispatchTimeDays: s.dispatch_time_days ?? "",
                    productionLeadTimeDays: s.production_lead_time_days ?? "",
                    sellerLocation: s.seller_location || "",
                    dispatchLocation: s.dispatch_location || "",
                    deliveryTimeline: s.delivery_timeline || "",
                    freightTerms: s.freight_terms || "",
                    hsnCode: s.hsn_code || "",
                    gstRegistrationStatus: s.gst_registration_status || "regular",
                    taxInvoiceAvailable: s.tax_invoice_available ?? true,
                    paymentTerms: s.payment_terms || "",
                    returnPolicy: s.return_policy || "",
                    warranty: s.warranty || "",
                    qualityCertificates: s.quality_certificates || [],
                    tdsMsdsCoa: s.tds_msds_coa || [],
                    otherCertifications: s.other_certifications || [],
                });
                setImages(s.images?.length ? s.images : (s.image ? [s.image] : []));
            } else {
                setError(res?.message || "Couldn't load this listing.");
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [token, submissionId]);

    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const removeImageAt = (i) => setImages((imgs) => imgs.filter((_, idx) => idx !== i));

    const finalPrice = form ? Math.round(Number(form.basePrice || 0) * (1 + Number(form.gstPercent || 0) / 100) * 100) / 100 : 0;

    async function handleSave() {
        setError("");
        if (!form.productName.trim() || !form.brandName.trim()) return setError("Product name and brand name are required.");
        if (!(Number(form.basePrice) > 0)) return setError("Base price must be greater than 0.");
        if (!(Number(form.moq) > 0)) return setError("MOQ must be greater than 0.");
        if (!form.unit) return setError("Select a unit.");
        if (!images.length) return setError("At least one image is required.");

        setSaving(true);
        try {
            const res = await adminUpdateSellerSubmission(token, submissionId, {
                productName: form.productName.trim(),
                brandName: form.brandName.trim(),
                images,
                manufacturer: form.manufacturer,
                modelNo: form.modelNo,
                gradeVariant: form.gradeVariant,
                specifications: form.specifications,
                basePrice: form.basePrice,
                gstPercent: form.gstPercent,
                ratePerPack: form.ratePerPack,
                ratePerMasterPack: form.ratePerMasterPack,
                priceValidityTill: form.priceValidityTill,
                moq: form.moq,
                sampleAvailable: form.sampleAvailable,
                samplePrice: form.samplePrice,
                priceSlabs: form.priceSlabs,
                quantityDiscounts: form.quantityDiscounts,
                packSize: form.packSize,
                unit: form.unit,
                unitsPerMasterPack: form.unitsPerMasterPack,
                masterPackSize: form.masterPackSize,
                packagingType: form.packagingType,
                stockQuantity: form.stockQuantity,
                stockType: form.stockType,
                dispatchTimeDays: form.dispatchTimeDays,
                productionLeadTimeDays: form.productionLeadTimeDays,
                sellerLocation: form.sellerLocation,
                dispatchLocation: form.dispatchLocation,
                deliveryTimeline: form.deliveryTimeline,
                freightTerms: form.freightTerms,
                hsnCode: form.hsnCode,
                gstRegistrationStatus: form.gstRegistrationStatus,
                taxInvoiceAvailable: form.taxInvoiceAvailable,
                paymentTerms: form.paymentTerms,
                returnPolicy: form.returnPolicy,
                warranty: form.warranty,
                qualityCertificates: form.qualityCertificates,
                tdsMsdsCoa: form.tdsMsdsCoa,
                otherCertifications: form.otherCertifications,
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
            <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-[16px] font-extrabold text-slate-900">Edit listing — full commercial spec</h3>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                )}

                {!loading && form && (
                    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
                        <Accordion icon={Package} title="Product" subtitle="Identity, specs & photos" defaultOpen>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Product name" required><TextInput value={form.productName} onChange={(e) => set("productName", e.target.value)} /></Field>
                                <Field label="Brand name" required><TextInput value={form.brandName} onChange={(e) => set("brandName", e.target.value)} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Manufacturer"><TextInput value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
                                <Field label="Model / Part No. / SKU"><TextInput value={form.modelNo} onChange={(e) => set("modelNo", e.target.value)} /></Field>
                            </div>
                            <Field label="Grade / Variant"><TextInput value={form.gradeVariant} onChange={(e) => set("gradeVariant", e.target.value)} /></Field>
                            <Field label="Specifications">
                                <RowsEditor rows={form.specifications} onChange={(rows) => set("specifications", rows)} addLabel="Add specification"
                                    columns={[{ key: "key", placeholder: "Attribute" }, { key: "value", placeholder: "Value" }]} />
                            </Field>
                            <Field label={`Images (${images.length})`} required>
                                <div className="flex flex-wrap gap-2">
                                    {images.map((src, i) => (
                                        <div key={src + i} className="relative h-20 w-20">
                                            <img src={src} alt="" className="h-full w-full rounded-lg border border-slate-200 object-cover" />
                                            <button type="button" onClick={() => removeImageAt(i)}
                                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] leading-none text-white">×</button>
                                            {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[8.5px] font-bold text-white">Cover</span>}
                                        </div>
                                    ))}
                                    {images.length === 0 && <p className="text-[12px] font-medium text-slate-400">No images left — needs at least one.</p>}
                                </div>
                                <p className="mt-1 text-[11px] font-medium text-slate-400">Adding a brand-new photo file isn't supported here yet — remove/reorder only. Upload new photos via the catalog brand-item editor.</p>
                            </Field>
                        </Accordion>

                        <Accordion icon={IndianRupee} title="Pricing" subtitle="Base price, GST & validity" defaultOpen>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Base price (₹, excl. GST)" required>
                                    <TextInput inputMode="decimal" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value.replace(/[^\d.]/g, ""))} />
                                </Field>
                                <Field label="GST %" required>
                                    <SelectInput value={form.gstPercent} onChange={(e) => set("gstPercent", Number(e.target.value))}>
                                        {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </SelectInput>
                                </Field>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12.5px] font-bold text-slate-700">
                                Final price (incl. GST): <span className="text-[#047084]">₹{finalPrice.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Rate per pack (₹)"><TextInput inputMode="decimal" value={form.ratePerPack} onChange={(e) => set("ratePerPack", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                                <Field label="Rate per master pack (₹)"><TextInput inputMode="decimal" value={form.ratePerMasterPack} onChange={(e) => set("ratePerMasterPack", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                            </div>
                            <Field label="Price validity till" required><TextInput type="date" value={form.priceValidityTill} onChange={(e) => set("priceValidityTill", e.target.value)} /></Field>
                        </Accordion>

                        <Accordion icon={Boxes} title="Quantity" subtitle="MOQ, samples & bulk pricing">
                            <Field label="MOQ" required><TextInput inputMode="decimal" value={form.moq} onChange={(e) => set("moq", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                            <ToggleRow label="Sample available" checked={form.sampleAvailable} onChange={(v) => set("sampleAvailable", v)} />
                            {form.sampleAvailable && <Field label="Sample price (₹)"><TextInput inputMode="decimal" value={form.samplePrice} onChange={(e) => set("samplePrice", e.target.value.replace(/[^\d.]/g, ""))} /></Field>}
                            <Field label="Order quantity price slabs">
                                <RowsEditor rows={form.priceSlabs} onChange={(rows) => set("priceSlabs", rows)} addLabel="Add price slab"
                                    columns={[{ key: "minQty", placeholder: "Min qty" }, { key: "maxQty", placeholder: "Max qty" }, { key: "price", placeholder: "₹ price" }]} />
                            </Field>
                            <Field label="Quantity discounts">
                                <RowsEditor rows={form.quantityDiscounts} onChange={(rows) => set("quantityDiscounts", rows)} addLabel="Add discount tier"
                                    columns={[{ key: "minQty", placeholder: "Min qty" }, { key: "discountPercent", placeholder: "Discount %" }]} />
                            </Field>
                        </Accordion>

                        <Accordion icon={Archive} title="Packaging" subtitle="Pack size & unit of measurement">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Pack size" required><TextInput inputMode="decimal" value={form.packSize} onChange={(e) => set("packSize", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                                <Field label="Unit of measurement" required>
                                    <SelectInput value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                                        <option value="" disabled>Select…</option>
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </SelectInput>
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Units per master pack"><TextInput inputMode="decimal" value={form.unitsPerMasterPack} onChange={(e) => set("unitsPerMasterPack", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                                <Field label="Master pack size"><TextInput inputMode="decimal" value={form.masterPackSize} onChange={(e) => set("masterPackSize", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                            </div>
                            <Field label="Packaging type"><TextInput value={form.packagingType} onChange={(e) => set("packagingType", e.target.value)} /></Field>
                        </Accordion>

                        <Accordion icon={Boxes} title="Availability" subtitle="Stock & dispatch readiness">
                            <Field label="Stock available" required><TextInput inputMode="decimal" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                            <Field label="Fulfilment type" required>
                                <SelectInput value={form.stockType} onChange={(e) => set("stockType", e.target.value)}>
                                    <option value="ready_stock">Ready stock</option>
                                    <option value="made_to_order">Made-to-order</option>
                                </SelectInput>
                            </Field>
                            <Field label="Expected dispatch time (days)" required><TextInput inputMode="numeric" value={form.dispatchTimeDays} onChange={(e) => set("dispatchTimeDays", e.target.value.replace(/[^\d]/g, ""))} /></Field>
                            {form.stockType === "made_to_order" && (
                                <Field label="Production lead time (days)" required><TextInput inputMode="numeric" value={form.productionLeadTimeDays} onChange={(e) => set("productionLeadTimeDays", e.target.value.replace(/[^\d]/g, ""))} /></Field>
                            )}
                        </Accordion>

                        <Accordion icon={Truck} title="Delivery" subtitle="Locations, timeline & freight">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Seller location" required><TextInput value={form.sellerLocation} onChange={(e) => set("sellerLocation", e.target.value)} /></Field>
                                <Field label="Dispatch location" required><TextInput value={form.dispatchLocation} onChange={(e) => set("dispatchLocation", e.target.value)} /></Field>
                            </div>
                            <Field label="Delivery timeline" required><TextInput value={form.deliveryTimeline} onChange={(e) => set("deliveryTimeline", e.target.value)} /></Field>
                            <Field label="Freight terms"><TextArea value={form.freightTerms} onChange={(e) => set("freightTerms", e.target.value)} rows={2} /></Field>
                        </Accordion>

                        <Accordion icon={FileText} title="Tax & Legal" subtitle="HSN, GST & invoicing">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="HSN Code" required><TextInput value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} /></Field>
                                <Field label="GST registration status" required>
                                    <SelectInput value={form.gstRegistrationStatus} onChange={(e) => set("gstRegistrationStatus", e.target.value)}>
                                        <option value="regular">Regular</option>
                                        <option value="composition">Composition</option>
                                        <option value="unregistered">Unregistered</option>
                                    </SelectInput>
                                </Field>
                            </div>
                            <ToggleRow label="Tax invoice available" checked={form.taxInvoiceAvailable} onChange={(v) => set("taxInvoiceAvailable", v)} />
                        </Accordion>

                        <Accordion icon={Handshake} title="Commercial Terms" subtitle="Payment, returns & warranty">
                            <Field label="Payment terms" required><TextArea value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} rows={2} /></Field>
                            <Field label="Return / replacement policy" required><TextArea value={form.returnPolicy} onChange={(e) => set("returnPolicy", e.target.value)} rows={3} /></Field>
                            <Field label="Warranty"><TextInput value={form.warranty} onChange={(e) => set("warranty", e.target.value)} /></Field>
                        </Accordion>

                        <Accordion icon={ShieldCheck} title="Quality & Certifications" subtitle="Optional — builds buyer trust">
                            <Field label="Certificates">
                                <RowsEditor rows={form.qualityCertificates} onChange={(rows) => set("qualityCertificates", rows)} addLabel="Add certificate"
                                    columns={[{ key: "name", placeholder: "Certificate name" }, { key: "url", placeholder: "Link to file" }]} />
                            </Field>
                            <Field label="TDS / MSDS / COA">
                                <RowsEditor rows={form.tdsMsdsCoa} onChange={(rows) => set("tdsMsdsCoa", rows)} addLabel="Add document"
                                    columns={[{ key: "type", placeholder: "Document type" }, { key: "url", placeholder: "Link to file" }]} />
                            </Field>
                            <Field label="BIS / ISO / other certification">
                                <RowsEditor rows={form.otherCertifications} onChange={(rows) => set("otherCertifications", rows)} addLabel="Add certification"
                                    columns={[{ key: "name", placeholder: "Certification name" }, { key: "url", placeholder: "Link to file" }]} />
                            </Field>
                        </Accordion>

                        {error && <p className="text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}
                    </div>
                )}

                {!loading && form && (
                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                        <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-slate-500">Cancel</button>
                        <button onClick={handleSave} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}