// components/home/SellerQuickManageListings.jsx
//
// Shown only to sellers whose shop is approved (mirrors the condition on
// StartSellingBanner, just inverted). Lets a seller adjust price / MOQ /
// lead time / stock on hand inline, or remove a listing, without leaving
// the home page.
//
// Requires the stock_quantity column (see add_stock_quantity_migration.sql)
// and the seller submissions create/update controller to allow it through —
// flagged separately since I haven't seen that file yet.
//
// Same tokens/motion as the rest of the home page: ink #0B1116,
// muted #667077, primary #D2462B, secondary #006F83,
// hairline rgba(11,17,22,0.09), [0.16,1,0.3,1] easing.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, Check, X, Loader2, ImageIcon, ExternalLink, PackageSearch, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchMySellerSubmissions, updateSellerProductSubmission, deleteSellerProductSubmission } from "../../utils/api.js";

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};
const EASE = [0.16, 1, 0.3, 1];
const LOW_STOCK_THRESHOLD = 10;

function Stat({ label, value, warn }) {
    return (
        <div className="rounded-xl px-2.5 py-2" style={{ background: C.hairSoft }}>
            <p className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                {label}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] font-extrabold" style={{ color: warn ? "#b45309" : C.ink }}>
                {value}
            </p>
        </div>
    );
}

function FieldInput({ label, ...props }) {
    return (
        <label className="block">
            <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                {label}
            </span>
            <input
                {...props}
                className="mt-1 w-full rounded-lg border bg-white px-2.5 py-1.5 text-[12.5px] font-bold focus:outline-none focus:ring-2"
                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}33` }}
            />
        </label>
    );
}

export default function SellerQuickManageListings() {
    const { token, profile } = useAuth();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ price: "", moq: "", lead_time: "", stock_quantity: "" });
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const isApprovedSeller = profile?.seller_status === "approved";

    useEffect(() => {
        if (!token || !isApprovedSeller) { setLoading(false); return; }
        let cancelled = false;
        fetchMySellerSubmissions(token, "approved").then((res) => {
            if (cancelled) return;
            if (res?.success) setItems(res.items || []);
            setLoading(false);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isApprovedSeller]);

    if (!isApprovedSeller) return null;
    if (!loading && items.length === 0) return null;

    function startEdit(it) {
        setConfirmDeleteId(null);
        setEditingId(it.id);
        setForm({
            price: it.price ?? "",
            moq: it.moq ?? "",
            lead_time: it.lead_time ?? "",
            stock_quantity: it.stock_quantity ?? "",
        });
    }
    function cancelEdit() {
        setEditingId(null);
    }
    async function saveEdit(id) {
        setSaving(true);
        const res = await updateSellerProductSubmission(token, id, {
            price: Number(form.price),
            moq: Number(form.moq),
            lead_time: form.lead_time,
            stock_quantity: form.stock_quantity === "" ? null : Number(form.stock_quantity),
        });
        setSaving(false);
        if (res?.success) {
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...res.submission } : it)));
            setEditingId(null);
        }
    }
    async function confirmDelete(id) {
        setDeletingId(id);
        const res = await deleteSellerProductSubmission(token, id);
        setDeletingId(null);
        if (res?.success) {
            setItems((prev) => prev.filter((it) => it.id !== id));
            setConfirmDeleteId(null);
        }
    }

    return (
        <div className="w-full rounded-[16px] border bg-white pb-6 pt-6 lg:pb-8 lg:pt-5" style={{ borderColor: C.hair }}>
            <div className="flex items-center justify-between px-4 lg:px-8">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                        <PackageSearch className="h-4.5 w-4.5" />
                    </span>
                    <div>
                        <h2 className="font-extrabold leading-tight tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(17px, 1.6vw, 22px)" }}>
                            Manage your listings
                        </h2>
                        <p className="text-[11.5px] font-medium leading-tight" style={{ color: C.muted }}>
                            Price, MOQ, lead time & stock — updated live
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate("/seller/products")}
                    className="hidden shrink-0 items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.03] sm:flex"
                    style={{ borderColor: C.hair, color: C.secondary }}
                >
                    View all <ExternalLink className="h-3 w-3" />
                </button>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[248px] w-[248px] shrink-0 animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />
                    ))
                    : items.map((it, i) => {
                        const isEditing = editingId === it.id;
                        const isConfirming = confirmDeleteId === it.id;
                        const name = it.brand?.name || it.product_name || "Product";
                        const brandName = it.brand?.brand_name || it.brand_name;
                        const image = it.image || it.brand?.image;
                        const stock = it.stock_quantity;
                        const lowStock = stock != null && stock <= LOW_STOCK_THRESHOLD;
                        const outOfStock = stock != null && stock <= 0;

                        return (
                            <motion.div
                                key={it.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                                className="w-[248px] shrink-0 rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(11,17,22,0.03)]"
                                style={{ borderColor: C.hair }}
                            >
                                <div className="flex items-start gap-2.5">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                                        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" style={{ color: C.muted }} />}
                                    </span>
                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <p className="truncate text-[13px] font-extrabold leading-tight" style={{ color: C.ink }}>{name}</p>
                                        {brandName && <p className="truncate text-[10.5px] font-semibold" style={{ color: C.muted }}>{brandName}</p>}
                                    </div>
                                    {!isEditing && !isConfirming && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                onClick={() => startEdit(it)}
                                                aria-label="Edit"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-black/[0.03]"
                                                style={{ borderColor: C.hair }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" style={{ color: C.ink }} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(it.id)}
                                                aria-label="Delete"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-red-50"
                                                style={{ borderColor: "rgba(199,31,17,0.25)" }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" style={{ color: "#c71f11" }} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <AnimatePresence mode="wait">
                                    {isEditing ? (
                                        <motion.div
                                            key="edit"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-3 space-y-2 overflow-hidden"
                                        >
                                            <div className="grid grid-cols-2 gap-2">
                                                <FieldInput
                                                    label="Price (₹)"
                                                    type="number" min="0" step="0.01"
                                                    value={form.price}
                                                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                                />
                                                <FieldInput
                                                    label={`MOQ (${it.unit})`}
                                                    type="number" min="0" step="0.01"
                                                    value={form.moq}
                                                    onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))}
                                                />
                                                <FieldInput
                                                    label={`Stock (${it.unit})`}
                                                    type="number" min="0" step="0.01"
                                                    placeholder="—"
                                                    value={form.stock_quantity}
                                                    onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                                                />
                                                <FieldInput
                                                    label="Lead time"
                                                    type="text"
                                                    value={form.lead_time}
                                                    onChange={(e) => setForm((f) => ({ ...f, lead_time: e.target.value }))}
                                                />
                                            </div>
                                            <div className="flex gap-1.5 pt-0.5">
                                                <button
                                                    onClick={() => saveEdit(it.id)}
                                                    disabled={saving}
                                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50"
                                                    style={{ background: C.secondary }}
                                                >
                                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                                                </button>
                                                <button onClick={cancelEdit} className="flex items-center justify-center rounded-lg border px-2.5" style={{ borderColor: C.hair }}>
                                                    <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ) : isConfirming ? (
                                        <motion.div
                                            key="confirm"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-3 overflow-hidden rounded-xl p-2.5"
                                            style={{ background: "rgba(199,31,17,0.06)" }}
                                        >
                                            <p className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: C.ink }}>
                                                <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#c71f11" }} /> Remove this listing?
                                            </p>
                                            <div className="mt-2 flex gap-1.5">
                                                <button
                                                    onClick={() => confirmDelete(it.id)}
                                                    disabled={deletingId === it.id}
                                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#c71f11] py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50"
                                                >
                                                    {deletingId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, remove"}
                                                </button>
                                                <button onClick={() => setConfirmDeleteId(null)} className="flex items-center justify-center rounded-lg border bg-white px-2.5" style={{ borderColor: C.hair }}>
                                                    <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="view"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-3"
                                        >
                                            {lowStock && (
                                                <span
                                                    className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold"
                                                    style={{ background: outOfStock ? "rgba(199,31,17,0.1)" : "rgba(180,83,9,0.1)", color: outOfStock ? "#c71f11" : "#b45309" }}
                                                >
                                                    <AlertTriangle className="h-2.5 w-2.5" /> {outOfStock ? "Out of stock" : "Low stock"}
                                                </span>
                                            )}
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <Stat label="Price" value={`₹${it.price}/${it.unit}`} />
                                                <Stat label="Stock" value={stock != null ? `${stock} ${it.unit}` : "Not set"} warn={lowStock} />
                                                <Stat label="MOQ" value={`${it.moq} ${it.unit}`} />
                                                <Stat label="Lead time" value={it.lead_time} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
            </div>

            <div className="mt-3 px-4 sm:hidden">
                <button
                    onClick={() => navigate("/seller/products")}
                    className="flex w-full items-center justify-center gap-1 rounded-full border bg-white px-3 py-2 text-[12px] font-bold"
                    style={{ borderColor: C.hair, color: C.secondary }}
                >
                    View all listings <ExternalLink className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}