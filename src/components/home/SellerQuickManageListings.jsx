// components/home/SellerQuickManageListings.jsx
//
// v4 — removed the nested double-box wrapper (outer rounded-[16px] card
// + inner rounded-[20px] overflow box) that was reading as a "boxy"
// panel-within-a-panel. Now a single bordered white container carries
// the mask-image edge fade directly, same pattern as
// CategoryIconExplorer's wrapper: overflow-hidden rounded-[20px] border
// bg-white p-4 px-3 sm:p-6, mask on the container itself. The
// scroll-aware left/right fade overlays and the lightbox stay put,
// just re-parented into that single container instead of a padded
// inner div.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Pencil, Trash2, Check, X, Loader2, ImageIcon, ChevronRight,
    PackageSearch, AlertTriangle, MoreVertical, Maximize2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchMySellerSubmissions, updateSellerProductSubmission, deleteSellerProductSubmission } from "../../utils/api.js";
import ImageLightbox from "../ImageLightbox.jsx";

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

/* ---------------- shared primitives ---------------- */

function Spec({ label, value, tone }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                {label}
            </span>
            <span className="truncate text-[13px] font-bold tabular-nums" style={{ color: tone || C.ink }}>
                {value}
            </span>
        </div>
    );
}

function FieldInput({ label, ...props }) {
    return (
        <label className="block">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                {label}
            </span>
            <input
                {...props}
                className="mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-[13.5px] font-bold focus:outline-none focus:ring-2"
                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}33` }}
            />
        </label>
    );
}

function SectionHeader({ title, subtitle }) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-between pt-1 mb-0">
            <div>
                <h2
                    className="text-left font-extrabold leading-tight tracking-[-0.01em]"
                    style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                >
                    {title}
                </h2>
                {subtitle && (
                    <p className="mt-0.5 max-w-xs text-[12.5px] font-medium leading-relaxed" style={{ color: C.muted }}>
                        {subtitle}
                    </p>
                )}
            </div>
            <button
                onClick={() => navigate("/categories")}
                className="group flex hidden items-center gap-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150"
                style={{ color: C.primary }}
            >
                See all
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
        </div>
    );
}

function useScrollFades(deps) {
    const scrollRef = useRef(null);
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(false);

    const updateFades = () => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setShowLeftFade(scrollLeft > 0);
        setShowRightFade(scrollLeft + clientWidth < scrollWidth - 8);
    };

    useEffect(() => {
        const raf = requestAnimationFrame(updateFades);
        const el = scrollRef.current;
        if (!el) return () => cancelAnimationFrame(raf);
        el.addEventListener("scroll", updateFades, { passive: true });
        window.addEventListener("resize", updateFades);
        return () => {
            cancelAnimationFrame(raf);
            el.removeEventListener("scroll", updateFades);
            window.removeEventListener("resize", updateFades);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { scrollRef, showLeftFade, showRightFade };
}

function useCanHover() {
    const [canHover, setCanHover] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
    useEffect(() => {
        const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
        const handler = (e) => setCanHover(e.matches);
        mq.addEventListener?.("change", handler);
        return () => mq.removeEventListener?.("change", handler);
    }, []);
    return canHover;
}

/* ---------------- mobile action sheet ---------------- */
function ListingActionSheet({ open, name, onEdit, onDelete, onClose }) {
    if (typeof document === "undefined") return null;
    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[90] bg-black/40"
                    />
                    <motion.div
                        key="sheet"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="fixed inset-x-0 bottom-0 z-[91] rounded-t-[20px] bg-white p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-8px_rgba(11,17,22,0.25)]"
                    >
                        <div className="mx-auto mb-3 mt-1 h-1 w-9 rounded-full" style={{ background: C.hair }} />
                        <p className="px-3 pb-2 text-[11px] font-mono font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                            {name}
                        </p>
                        <button
                            onClick={onEdit}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14.5px] font-bold transition-colors duration-150 active:bg-black/[0.04]"
                            style={{ color: C.ink }}
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                                <Pencil className="h-4 w-4" />
                            </span>
                            Edit listing
                        </button>
                        <button
                            onClick={onDelete}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14.5px] font-bold transition-colors duration-150 active:bg-red-50"
                            style={{ color: "#c71f11" }}
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(199,31,17,0.1)" }}>
                                <Trash2 className="h-4 w-4" />
                            </span>
                            Remove listing
                        </button>
                        <button
                            onClick={onClose}
                            className="mt-1 flex w-full items-center justify-center rounded-xl py-3 text-[13.5px] font-bold"
                            style={{ background: C.hairSoft, color: C.muted }}
                        >
                            Cancel
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

/* ---------------- listing card ---------------- */

function ListingCard({
    it, i, canHover, isEditing, isConfirming, form, setForm, saving, deletingId,
    onEdit, onCancelEdit, onSave, onAskDelete, onCancelDelete, onConfirmDelete, onOpenImage,
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const name = it.brand?.name || it.product_name || "Product";
    const brandName = it.brand?.brand_name || it.brand_name;
    const image = it.image || it.brand?.image;
    const stock = it.stock_quantity;
    const lowStock = stock != null && stock <= LOW_STOCK_THRESHOLD;
    const outOfStock = stock != null && stock <= 0;

    const statusColor = outOfStock ? "#c71f11" : lowStock ? "#b45309" : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
            whileHover={{ y: -2 }}
            className="group relative w-[280px] shrink-0 snap-start rounded-2xl border bg-white shadow-[0_1px_2px_rgba(11,17,22,0.03)] transition-shadow duration-200 hover:shadow-[0_10px_24px_-14px_rgba(11,17,22,0.16)] sm:w-[300px]"
            style={{ borderColor: C.hair }}
        >
            {statusColor && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-t-2xl"
                    style={{ background: statusColor }}
                />
            )}
            {it.review_status === "pending_review" && (
                <span
                    className="absolute right-3 top-6 z-10 rounded-full px-2 py-0.5 text-[9.5px] font-bold"
                    style={{ background: "#fef3c7", color: "#b45309" }}
                >
                    Pending review
                </span>
            )}

            <div className="relative p-4">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={(e) => { if (image) { e.stopPropagation(); onOpenImage({ src: image, alt: name }); } }}
                        className="group/img relative shrink-0 overflow-hidden rounded-xl border transition-transform duration-150 active:scale-95"
                        style={{ borderColor: C.hair, background: "#F5F6F7", cursor: image ? "zoom-in" : "default" }}
                        aria-label={image ? `View full image of ${name}` : "No image available"}
                    >
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl">
                            {image ? (
                                <img
                                    src={image}
                                    alt=""
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                                />
                            ) : (
                                <ImageIcon className="h-5 w-5" style={{ color: C.muted }} />
                            )}
                        </span>
                    </button>

                    <div className="flex min-w-0 flex-1 items-start gap-1 pt-0.5">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-bold leading-tight tracking-[-0.005em]" style={{ color: C.ink }}>
                                {name}
                            </p>
                            {brandName && (
                                <p className="mt-0.5 truncate text-[11.5px] font-medium" style={{ color: C.muted }}>
                                    {brandName}
                                </p>
                            )}
                        </div>

                        {!isEditing && !isConfirming && (it.review_status !== "pending_review") && (
                            canHover ? (
                                <div className="flex shrink-0 items-center gap-1 overflow-hidden opacity-0 transition-all duration-200 ease-out max-w-0 group-hover:max-w-[80px] group-hover:opacity-100">
                                    <button
                                        onClick={() => onEdit(it)}
                                        aria-label="Edit listing"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-black/[0.05]"
                                        style={{ color: C.ink }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onAskDelete(it.id)}
                                        aria-label="Delete listing"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-red-50"
                                        style={{ color: "#c71f11" }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setSheetOpen(true)}
                                    aria-label="Listing actions"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 active:bg-black/[0.05]"
                                    style={{ color: C.muted }}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            )
                        )}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 overflow-hidden"
                        >
                            <div className="space-y-2.5 rounded-xl border p-3" style={{ borderColor: C.hair, background: C.hairSoft }}>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <FieldInput
                                        label="Price (₹)"
                                        type="number" min="0" step="0.01"
                                        value={form.price}
                                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                    />
                                    <FieldInput
                                        label={`Stock (${it.unit})`}
                                        type="number" min="0" step="0.01"
                                        placeholder="—"
                                        value={form.stock_quantity}
                                        onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                                    />
                                    <FieldInput
                                        label={`MOQ (${it.unit})`}
                                        type="number" min="0" step="0.01"
                                        value={form.moq}
                                        onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))}
                                    />
                                    <FieldInput
                                        label="Lead time"
                                        type="text"
                                        value={form.lead_time}
                                        onChange={(e) => setForm((f) => ({ ...f, lead_time: e.target.value }))}
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => onSave(it.id)}
                                        disabled={saving}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold text-white transition-opacity duration-150 disabled:opacity-50"
                                        style={{ background: C.secondary }}
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                                    </button>
                                    <button
                                        onClick={onCancelEdit}
                                        className="flex items-center justify-center rounded-lg border bg-white px-3 transition-colors duration-150 hover:bg-black/[0.03]"
                                        style={{ borderColor: C.hair }}
                                    >
                                        <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : isConfirming ? (
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 overflow-hidden rounded-xl p-3"
                            style={{ background: "rgba(199,31,17,0.06)" }}
                        >
                            <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: C.ink }}>
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#c71f11" }} /> Remove this listing?
                            </p>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    onClick={() => onConfirmDelete(it.id)}
                                    disabled={deletingId === it.id}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#c71f11] py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                                >
                                    {deletingId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, remove"}
                                </button>
                                <button
                                    onClick={onCancelDelete}
                                    className="flex items-center justify-center rounded-lg border bg-white px-3 transition-colors duration-150 hover:bg-black/[0.03]"
                                    style={{ borderColor: C.hair }}
                                >
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
                            className="mt-4"
                        >
                            <p className="leading-none">
                                <span className="text-[21px] font-bold tracking-[-0.01em] tabular-nums" style={{ color: C.ink }}>
                                    ₹{it.price}
                                </span>
                                <span className="ml-1 text-[12px] font-semibold" style={{ color: C.muted }}>
                                    /{it.unit}
                                </span>
                            </p>

                            <div className="my-3 h-px w-full" style={{ background: C.hair }} />

                            <div className="flex items-start gap-4">
                                <Spec
                                    label="Stock"
                                    value={stock != null ? `${stock} ${it.unit}` : "—"}
                                    tone={statusColor}
                                />
                                <Spec label="MOQ" value={`${it.moq} ${it.unit}`} />
                                <Spec label="Lead" value={it.lead_time} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ListingActionSheet
                open={sheetOpen}
                name={name}
                onClose={() => setSheetOpen(false)}
                onEdit={() => { setSheetOpen(false); onEdit(it); }}
                onDelete={() => { setSheetOpen(false); onAskDelete(it.id); }}
            />
        </motion.div>
    );
}

/* ---------------- main ---------------- */

export default function SellerQuickManageListings() {
    const { token, profile } = useAuth();
    const navigate = useNavigate();
    const canHover = useCanHover();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ price: "", moq: "", lead_time: "", stock_quantity: "" });
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null); // { src, alt } | null

    const isApprovedSeller = profile?.seller_status === "approved";

    const { scrollRef, showLeftFade, showRightFade } = useScrollFades([items, editingId, confirmDeleteId, loading]);

    useEffect(() => {
        if (!token || !isApprovedSeller) { setLoading(false); return; }
        let cancelled = false;
        fetchMySellerSubmissions(token).then((res) => {
            if (cancelled) return;
            if (res?.success) {
                // Show everything buyers could eventually see: approved + pending.
                // Rejected listings aren't surfaced here — the seller manages
                // those from the full dashboard's Products tab instead.
                setItems((res.items || []).filter((it) => it.review_status !== "rejected"));
            }
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
        <div className="space-y-4">
            <SectionHeader
                title="Manage your listings"
                subtitle="Price, MOQ, lead time & stock — updated live"
            />

            {/* mask-image now reacts to scroll state, so the fade only
                shows on an edge when there's actually more content past
                it — same visual style as before, just conditional */}
            <div
                className="relative overflow-hidden rounded-[20px] p-0"
                style={{
                    borderColor: C.hair,
                    maskImage: `linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)`,
                    WebkitMaskImage: `linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)`,
                }}
            >
                <div
                    ref={scrollRef}
                    className="flex snap-x snap-proximity scroll-ps-3 px-4 gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {loading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-[204px] w-[280px] shrink-0 animate-pulse rounded-2xl sm:w-[300px]"
                                style={{ background: C.hairSoft }}
                            />
                        ))
                        : items.map((it, i) => (
                            <ListingCard
                                key={it.id}
                                it={it}
                                i={i}
                                canHover={canHover}
                                isEditing={editingId === it.id}
                                isConfirming={confirmDeleteId === it.id}
                                form={form}
                                setForm={setForm}
                                saving={saving}
                                deletingId={deletingId}
                                onEdit={startEdit}
                                onCancelEdit={cancelEdit}
                                onSave={saveEdit}
                                onAskDelete={(id) => { setEditingId(null); setConfirmDeleteId(id); }}
                                onCancelDelete={() => setConfirmDeleteId(null)}
                                onConfirmDelete={confirmDelete}
                                onOpenImage={setLightboxImage}
                            />
                        ))}
                </div>

                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-1 left-0 w-5 transition-opacity duration-500 ease-out sm:w-12"
                    style={{
                        opacity: showLeftFade ? 1 : 0,
                        background: "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0) 100%)",
                    }}
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-1 right-0 w-8 transition-opacity duration-500 ease-out sm:w-12"
                    style={{
                        opacity: showRightFade ? 1 : 0,
                        background: "linear-gradient(to left, #ffffff 0%, rgba(255,255,255,0) 100%)",
                    }}
                />

                <AnimatePresence>
                    {lightboxImage && (
                        <ImageLightbox
                            key="listing-lightbox"
                            src={lightboxImage.src}
                            alt={lightboxImage.alt}
                            onClose={() => setLightboxImage(null)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}