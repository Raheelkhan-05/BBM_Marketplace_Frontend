// src/pages/SellerManageListingsPage.jsx
//
// Full-page listing manager — the standalone counterpart to the compact
// SellerQuickManageListings home-widget. Same visual language as
// HomePage/CategoryStrip/HomeProductFeed (same C tokens, card shapes,
// mask-faded scroll lists, framer-motion), but built for actually running
// a catalog rather than a quick glance from the home feed.
//
// What lives on THIS page vs. the existing edit form:
//  - Quick, high-frequency updates (price, stock on hand, MOQ, lead time,
//    activate/deactivate) happen inline, right on the row — no navigation.
//  - Everything else a listing can have (pack size, master pack, discount
//    slabs, quality certificates, dispatching locations, return/warranty
//    policy, tax & legal, etc.) is already fully editable on the existing
//    /seller/sell/:id/edit screen (SellerListingForm) — this page's
//    "Edit listing" action just routes there instead of re-implementing
//    ~20 fields a second time.
//
// Stock sync: this page re-fetches on window focus/visibility, on the
// existing subscribeUserEvent("submissions_changed", ...) channel, and on
// the app's resync handler — the same mechanisms SellerQuickManageListings
// already relies on. NOTE: placeOrder() in orders.controller.js currently
// only calls notifyUserOrdersChanged() for the seller, not
// notifySellerSubmissionsChanged(). Stock still updates correctly in the
// database the moment an order is placed — but for this page's live badge
// to reflect it the instant it happens (rather than on next focus/visit),
// wire a notifySellerSubmissionsChanged(sellerId) call into placeOrder's
// success path too.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    Search, Pencil, Power, PowerOff, ImageIcon, Package, IndianRupee, Boxes,
    Archive, Truck, FileText, Handshake, ShieldCheck, X, Loader2, ChevronRight,
    RefreshCw, AlertTriangle, CheckCircle2, PackageX, TrendingDown, Plus, Check,
    PackagePlus, Lock, Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLenis } from "../providers/SmoothScrollProvider.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider.jsx";
import {
    fetchMySellerSubmissions, updateSellerProductSubmission,
    setSellerSubmissionActive, fetchSellerSubmissionDetail,
} from "../utils/api.js";
import ImageLightbox from "../components/ImageLightbox.jsx";

// const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

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

/* ============================== helpers ============================== */

function summarizeDispatchLocations(locations) {
    if (!Array.isArray(locations) || !locations.length) return null;
    const country = locations.find((l) => l.type === "country");
    if (!country) return null;
    const excludedStates = country.excludedStates?.length
        ? ` (excl. ${country.excludedStates.length} state${country.excludedStates.length === 1 ? "" : "s"})`
        : "";
    return `${country.name}${excludedStates}`;
}

function stockState(stock) {
    if (stock == null) return "unknown";
    if (Number(stock) <= 0) return "out";
    if (Number(stock) <= LOW_STOCK_THRESHOLD) return "low";
    return "ok";
}

function timeAgo(date) {
    if (!date) return null;
    const secs = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (secs < 10) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
}

/* ============================ small pieces ============================ */

function StatTile({ icon: Icon, label, value, tone = "ink" }) {
    const toneColor = { ink: C.ink, primary: C.primary, secondary: C.secondary, muted: C.muted }[tone];
    return (
        <div className="flex items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-3" style={{ borderColor: C.hair }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${toneColor}14`, color: toneColor }}>
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <p className="text-[16px] font-extrabold leading-none tabular-nums" style={{ color: C.ink }}>{value}</p>
                <p className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</p>
            </div>
        </div>
    );
}

function FilterChip({ label, active, onClick, count }) {
    return (
        <motion.button
            onClick={onClick}
            whileTap={{ scale: 0.96 }}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-150"
            style={{
                background: active ? C.primary : "#fff",
                color: active ? "#fff" : C.ink,
                border: `1.5px solid ${active ? C.primary : C.hair}`,
            }}
        >
            {label}
            {count != null && (
                <span
                    className="rounded-full px-1.5 py-[1px] text-[10px] font-extrabold tabular-nums"
                    style={{ background: active ? "rgba(255,255,255,0.25)" : C.hairSoft, color: active ? "#fff" : C.muted }}
                >
                    {count}
                </span>
            )}
        </motion.button>
    );
}

function ReadRow({ label, value }) {
    if (value === "" || value === null || value === undefined) return null;
    return (
        <div className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
            <span className="shrink-0 font-semibold" style={{ color: C.muted }}>{label}</span>
            <span className="text-right font-bold" style={{ color: C.ink }}>{String(value)}</span>
        </div>
    );
}

function ReadRowsList({ rows, columns }) {
    if (!rows?.length) return null;
    return (
        <div className="mt-1 flex flex-col gap-1">
            {rows.map((row, i) => (
                <div key={i} className="rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: C.hairSoft, color: C.ink }}>
                    {columns.map((c) => row[c.key]).filter(Boolean).join(" — ")}
                </div>
            ))}
        </div>
    );
}

function SectionBlock({ icon: Icon, title, children }) {
    return (
        <div className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: C.hairSoft }}>
            <div className="mb-1.5 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: C.secondary }} />
                <span className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>{title}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4">{children}</div>
        </div>
    );
}

function QuickField({ label, ...props }) {
    return (
        <label className="block">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>{label}</span>
            <input
                {...props}
                className="mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-[13.5px] font-bold focus:outline-none focus:ring-2"
                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}33` }}
            />
        </label>
    );
}

/* ---------------- inline "quick update" panel (price / stock / MOQ / lead time) ---------------- */

function QuickUpdatePanel({ item, onCancel, onSaved }) {
    const { token } = useAuth();
    const [form, setForm] = useState({
        price: item.price ?? "",
        moq: item.moq ?? "",
        lead_time: item.lead_time ?? "",
        stock_quantity: item.stock_quantity ?? "",
    });
    const [addQty, setAddQty] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    function applyAddToStock() {
        const delta = Number(addQty);
        if (!(delta > 0)) return;
        setForm((f) => ({ ...f, stock_quantity: (Number(f.stock_quantity) || 0) + delta }));
        setAddQty("");
    }

    async function save() {
        setError("");
        if (!(Number(form.price) > 0)) return setError("Price must be greater than 0.");
        if (!(Number(form.moq) > 0)) return setError("MOQ must be greater than 0.");
        setSaving(true);
        const res = await updateSellerProductSubmission(token, item.id, {
            price: Number(form.price),
            moq: Number(form.moq),
            lead_time: form.lead_time,
            stock_quantity: form.stock_quantity === "" ? null : Number(form.stock_quantity),
        });
        setSaving(false);
        if (res?.success) onSaved(res.submission);
        else setError(res?.message || "Couldn't save changes.");
    }

    return (
        <div className="overflow-hidden px-3 pb-3 sm:px-4">
            <div className="flex flex-col gap-2.5 rounded-xl border p-3" style={{ borderColor: C.hair, background: C.hairSoft }}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <QuickField label="Price (₹)" type="number" min="0" step="0.01"
                        value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                    <QuickField label={`Stock (${item.unit || "units"})`} type="number" min="0" step="0.01" placeholder="—"
                        value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} />
                    <QuickField label={`MOQ (${item.unit || "units"})`} type="number" min="0" step="0.01"
                        value={form.moq} onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))} />
                    <QuickField label="Lead time (days)" type="number" min="0" step="1"
                        value={form.lead_time} onChange={(e) => setForm((f) => ({ ...f, lead_time: e.target.value }))} />
                </div>

                {/* Add-to-stock helper — types a quantity to add on top of
                    whatever's already in the Stock field above, rather than
                    making the seller do the arithmetic themselves. */}
                <div className="flex items-center gap-2">
                    <PackagePlus className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                    <span className="text-[11px] font-semibold" style={{ color: C.muted }}>Restocked more?</span>
                    <input
                        type="number" min="0" step="0.01" placeholder={`+ qty (${item.unit || "units"})`}
                        value={addQty} onChange={(e) => setAddQty(e.target.value)}
                        className="w-28 rounded-lg border bg-white px-2 py-1.5 text-[12px] font-bold focus:outline-none"
                        style={{ borderColor: C.hair, color: C.ink }}
                    />
                    <button type="button" onClick={applyAddToStock}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold"
                        style={{ background: `${C.secondary}14`, color: C.secondary }}>
                        <Plus className="h-3 w-3" /> Add to stock
                    </button>
                </div>

                <p className="text-[10.5px] font-medium leading-relaxed" style={{ color: C.muted }}>
                    Need to change pack size, master pack, quality certificates, dispatch locations, or return/warranty policy?
                    Use <span className="font-bold" style={{ color: C.ink }}>Edit listing</span> for the full form.
                </p>

                {error && <p className="text-[11.5px] font-semibold" style={{ color: "#c71f11" }}>{error}</p>}

                <div className="flex gap-2 pt-0.5">
                    <button onClick={save} disabled={saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold text-white transition-opacity duration-150 disabled:opacity-50 sm:flex-none sm:px-6"
                        style={{ background: C.secondary }}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {item.review_status === "rejected" ? "Resubmit" : "Save"}
                    </button>
                    <button onClick={onCancel}
                        className="flex items-center justify-center rounded-lg border bg-white px-3 transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: C.hair }}>
                        <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------------- deactivate confirm ---------------- */

function DeactivateConfirm({ busy, onConfirm, onCancel }) {
    return (
        <div className="overflow-hidden px-3 pb-3 sm:px-4">
            <div className="rounded-xl p-3" style={{ background: "rgba(199,31,17,0.06)" }}>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: C.ink }}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#c71f11" }} />
                        Deactivate this listing? Buyers won't see it until you reactivate.
                    </p>
                    <div className="flex shrink-0 gap-2">
                        <button onClick={onConfirm} disabled={busy}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#c71f11] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, deactivate"}
                        </button>
                        <button onClick={onCancel}
                            className="flex items-center justify-center rounded-lg border bg-white px-3 transition-colors duration-150 hover:bg-black/[0.03]"
                            style={{ borderColor: C.hair }}>
                            <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ============================== list row ============================== */

function ListingRow({
    it, idx, isQuickEditing, isConfirmingDeactivate, togglingId,
    onOpenDetail, onEdit, onQuickEdit, onCancelQuickEdit, onSaved,
    onAskDeactivate, onCancelDeactivate, onConfirmDeactivate, onActivate,
    onOpenImage,
}) {
    const name = it.brand?.name || it.product_name || "Product";
    const brandName = it.brand?.brand_name || it.brand_name;
    const image = it.image || it.brand?.image;
    const gallery = it.images?.length ? it.images : (it.brand?.images?.length ? it.brand.images : (image ? [image] : []));
    const isActive = it.is_active !== false;
    const stock = it.stock_quantity;
    const sState = stockState(stock);
    const isExpanded = isQuickEditing || isConfirmingDeactivate;

    const statusColor = !isActive ? C.muted : sState === "out" ? "#c71f11" : sState === "low" ? "#b45309" : C.secondary;
    const stockLabel = sState === "out" ? "Out of stock" : stock != null ? `${stock} ${it.unit || ""} left` : "Stock not set";

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(idx * 0.02, 0.2), ease: EASE }}
        >
            <div
                onClick={() => { if (!isExpanded) onOpenDetail(it); }}
                className="group relative flex items-center gap-3 px-3 py-3.5 sm:px-4 transition-opacity duration-200"
                style={{ opacity: isActive ? 1 : 0.55, cursor: isExpanded ? "default" : "pointer" }}
            >
                <span
                    aria-hidden
                    className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
                    style={{ background: statusColor, opacity: !isActive || sState === "low" || sState === "out" ? 1 : 0 }}
                />

                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: C.hair, background: C.hairSoft }}
                    onClick={(e) => { e.stopPropagation(); if (gallery.length) onOpenImage({ images: gallery, index: 0, alt: name }); }}
                >
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-5 w-5" style={{ color: C.hair }} />}
                    {gallery.length > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1 text-[8.5px] font-bold text-white">+{gallery.length - 1}</span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-bold leading-tight" style={{ color: C.ink }}>{name}</p>
                        {!isActive && <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide" style={{ background: C.hairSoft, color: C.muted }}>Deactivated</span>}
                        {isActive && it.review_status === "pending_review" && <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold" style={{ background: "#fef3c7", color: "#b45309" }}>Pending</span>}
                        {isActive && it.review_status === "rejected" && <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold" style={{ background: "#fee2e2", color: "#c71f11" }}>Rejected</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] font-medium" style={{ color: C.muted }}>
                        {brandName ? `${brandName} · ` : ""}MOQ {it.moq} {it.unit} · Lead {it.lead_time}
                    </p>
                    {it.rejection_reason && it.review_status === "rejected" && (
                        <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "#c71f11" }}>Rejected: {it.rejection_reason}</p>
                    )}
                </div>

                {!isExpanded && (
                    <div className="hidden shrink-0 flex-col items-end pl-2 text-right sm:flex">
                        <p className="leading-none">
                            <span className="text-[15.5px] font-bold tracking-[-0.01em] tabular-nums" style={{ color: C.ink }}>₹{it.price}</span>
                            <span className="ml-0.5 text-[10.5px] font-semibold" style={{ color: C.muted }}>/{it.unit}</span>
                        </p>
                        <p className="mt-1 whitespace-nowrap text-[10.5px] font-bold tabular-nums" style={{ color: statusColor }}>
                            {isActive ? stockLabel : "Hidden from buyers"}
                        </p>
                    </div>
                )}

                {!isExpanded && it.review_status !== "pending_review" && (
                    <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1 pl-1">
                        <button onClick={() => onQuickEdit(it.id)} aria-label="Quick update"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-black/[0.05]" style={{ color: C.ink }}>
                            <Pencil className="h-4 w-4" />
                        </button>
                        {isActive ? (
                            <button onClick={() => onAskDeactivate(it.id)} aria-label="Deactivate listing"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-red-50" style={{ color: "#c71f11" }}>
                                <PowerOff className="h-4 w-4" />
                            </button>
                        ) : (
                            <button onClick={() => onActivate(it.id)} disabled={togglingId === it.id} aria-label="Activate listing"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-black/[0.05] disabled:opacity-50" style={{ color: C.secondary }}>
                                {togglingId === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                            </button>
                        )}
                        <ChevronRight className="ml-0.5 h-4 w-4 shrink-0" style={{ color: C.hair }} />
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isQuickEditing && (
                    <motion.div key="quick" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                        <QuickUpdatePanel item={it} onCancel={onCancelQuickEdit} onSaved={(sub) => onSaved(it.id, sub)} />
                    </motion.div>
                )}
                {isConfirmingDeactivate && (
                    <motion.div key="confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                        <DeactivateConfirm busy={togglingId === it.id} onConfirm={() => onConfirmDeactivate(it.id)} onCancel={onCancelDeactivate} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="h-px w-full" style={{ background: C.hairSoft }} />
        </motion.div>
    );
}

/* ============================ detail modal ============================ */

function useLockBodyScroll() {
    const lenis = useLenis();
    useEffect(() => {
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        lenis?.stop();
        return () => { document.body.style.overflow = overflow; lenis?.start(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lenis]);
}

function ListingDetailModal({ token, submissionId, onClose, onEdit, onImageClick }) {
    useLockBodyScroll();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError("");
        fetchSellerSubmissionDetail(token, submissionId).then((res) => {
            if (cancelled) return;
            if (res?.success) setData(res.submission); else setError(res?.message || "Couldn't load this listing.");
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [token, submissionId]);

    const s = data;
    const images = s?.images?.length ? s.images : (s?.image ? [s.image] : []);
    const name = s?.brand?.name || "Product";
    const brandName = s?.brand?.brand_name;
    const finalPrice = s ? Math.round(Number(s.base_price || 0) * (1 + Number(s.gst_percent || 0) / 100) * 100) / 100 : 0;
    const gp = s?.brand?.generic_product;
    const crumb = [gp?.subcategory?.category?.name, gp?.subcategory?.name, gp?.name].filter(Boolean).join(" › ");

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white" style={{ height: "88vh" }}>
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-3.5" style={{ borderColor: C.hairSoft }}>
                    <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-extrabold" style={{ color: C.ink }}>{name}</h3>
                        {!s?.brand?.brand_not_applicable && brandName && <p className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{brandName}</p>}
                    </div>
                    <button onClick={onClose} className="shrink-0 rounded-full p-1.5 transition-colors duration-150 hover:bg-black/[0.05]" style={{ color: C.muted }}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {loading && <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>}
                {!loading && error && <p className="flex-1 px-5 py-8 text-center text-[13px] font-semibold" style={{ color: "#c71f11" }}>{error}</p>}

                {!loading && s && (
                    <div className="flex-1 overflow-y-auto px-5 py-3.5" style={{ minHeight: 0, overscrollBehavior: "contain" }}>
                        <div className="flex flex-wrap items-center gap-1.5 pb-3">
                            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{
                                background: s.review_status === "approved" ? "#dcfce7" : s.review_status === "rejected" ? "#fee2e2" : "#fef3c7",
                                color: s.review_status === "approved" ? "#15803d" : s.review_status === "rejected" ? "#b91c1c" : "#a16207",
                            }}>
                                {s.review_status === "approved" ? "Approved" : s.review_status === "rejected" ? "Rejected" : "Pending review"}
                            </span>
                            {s.is_active === false && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: C.hairSoft, color: C.muted }}>Hidden from buyers</span>}
                        </div>
                        {s.rejection_reason && <p className="mb-3 rounded-lg px-3 py-2 text-[11.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: "#c71f11" }}>Rejected: {s.rejection_reason}</p>}
                        {crumb && (
                            <div className="mb-3 rounded-lg px-3 py-2" style={{ background: C.hairSoft }}>
                                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Catalog mapping</p>
                                <p className="text-[12px] font-bold break-words" style={{ color: C.ink }}>{crumb}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-1 pt-1">
                            <SectionBlock icon={Package} title="Product">
                                <ReadRow label="Manufacturer" value={s.manufacturer} />
                                <ReadRow label="Model / Part No." value={s.model_no} />
                                <ReadRow label="Grade / Variant" value={s.grade_variant} />
                            </SectionBlock>
                            {(s.specifications?.length > 0 || images.length > 0) && (
                                <div className="-mt-1">
                                    {s.specifications?.length > 0 && <ReadRowsList rows={s.specifications} columns={[{ key: "key" }, { key: "value" }]} />}
                                    {images.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {images.map((src, i) => (
                                                <button key={src + i} onClick={() => onImageClick?.({ images, index: i, alt: name })} className="relative h-14 w-14">
                                                    <img src={src} alt="" className="h-full w-full rounded-md border object-cover" style={{ borderColor: C.hair }} />
                                                    {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-black/60 py-0.5 text-center text-[7.5px] font-bold text-white">Cover</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <SectionBlock icon={IndianRupee} title="Pricing">
                                <ReadRow label="Base price" value={s.base_price != null ? `₹${s.base_price}` : null} />
                                <ReadRow label="GST %" value={s.gst_percent != null ? `${s.gst_percent}%` : null} />
                                <ReadRow label="Final price" value={`₹${finalPrice.toLocaleString("en-IN")}`} />
                                <ReadRow label="Priced as" value={s.price_basis ? { per_unit: "Per unit", per_pack: "Per pack", per_master_pack: "Per master pack" }[s.price_basis] : null} />
                                <ReadRow label="GST" value={s.gst_inclusive_input != null ? (s.gst_inclusive_input ? "Included in entered price" : "Added on top") : null} />
                                <ReadRow label="Freight" value={s.freight_included != null ? (s.freight_included ? "Included" : "Extra, buyer pays") : null} />
                                <ReadRow label="Valid till" value={s.price_validity_till} />
                            </SectionBlock>

                            <SectionBlock icon={Boxes} title="Quantity">
                                <ReadRow label="MOQ" value={s.moq != null ? `${s.moq} ${s.unit || ""}` : null} />
                                <ReadRow label="Sample" value={s.sample_available ? `${s.sample_quantity || ""} ${s.sample_unit_basis ? { per_unit: "unit(s)", per_pack: "pack(s)", per_master_pack: "master pack(s)" }[s.sample_unit_basis] : ""}`.trim() || "Available" : "Not available"} />
                            </SectionBlock>
                            {(s.price_slabs?.length > 0 || s.quantity_discounts?.length > 0) && (
                                <div className="-mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <ReadRowsList rows={s.price_slabs} columns={[{ key: "minQty" }, { key: "maxQty" }, { key: "price" }]} />
                                    <ReadRowsList rows={s.quantity_discounts} columns={[{ key: "minQty" }, { key: "discountPercent" }]} />
                                </div>
                            )}

                            <SectionBlock icon={Archive} title="Packaging">
                                <ReadRow label="Pack size" value={s.pack_size} />
                                <ReadRow label="Units/master pack" value={s.units_per_master_pack} />
                                <ReadRow label="Master pack size" value={s.master_pack_size} />
                                <ReadRow label="Packaging type" value={s.packaging_type} />
                            </SectionBlock>

                            <SectionBlock icon={Boxes} title="Availability">
                                <ReadRow label="Stock" value={s.stock_quantity} />
                                <ReadRow label="Fulfilment" value={s.stock_type === "made_to_order" ? "Made-to-order" : "Ready stock"} />
                            </SectionBlock>

                            <SectionBlock icon={Truck} title="Delivery">
                                <ReadRow label="Dispatch pincode" value={s.dispatch_pincode} />
                                <ReadRow label="Dispatch district" value={s.dispatch_district} />
                                <ReadRow label="Dispatch state" value={s.dispatch_state} />
                                <ReadRow label="Lead time" value={s.stock_type === "made_to_order" ? (s.production_lead_time_days != null ? `${s.production_lead_time_days}d` : null) : (s.dispatch_time_days != null ? `${s.dispatch_time_days}d` : null)} />
                            </SectionBlock>
                            {summarizeDispatchLocations(s.dispatching_locations) && <ReadRow label="Delivers to" value={summarizeDispatchLocations(s.dispatching_locations)} />}
                            <ReadRow label="Seller location" value={s.seller_location} />
                            <ReadRow label="Freight terms" value={s.freight_terms} />

                            <SectionBlock icon={FileText} title="Tax & Legal">
                                <ReadRow label="HSN Code" value={s.hsn_code} />
                                <ReadRow label="GST status" value={s.gst_registration_status} />
                                <ReadRow label="Tax invoice" value={s.tax_invoice_available != null ? (s.tax_invoice_available ? "Yes" : "No") : null} />
                            </SectionBlock>

                            <SectionBlock icon={Handshake} title="Commercial Terms" />
                            <ReadRow label="Warranty" value={s.warranty} />
                            <ReadRow label="Payment terms" value={s.payment_terms} />
                            <ReadRow label="Return policy" value={s.return_policy} />
                            {s.note_to_admin && (
                                <div className="border-t pt-3" style={{ borderColor: C.hairSoft }}>
                                    <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>Your note to admin</p>
                                    <p className="text-[12px] font-medium leading-relaxed" style={{ color: C.ink }}>{s.note_to_admin}</p>
                                </div>
                            )}

                            {(s.quality_certificates?.length > 0 || s.tds_msds_coa?.length > 0 || s.other_certifications?.length > 0) && (
                                <SectionBlock icon={ShieldCheck} title="Quality & Certifications">
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <ReadRowsList rows={s.quality_certificates} columns={[{ key: "name" }, { key: "url" }]} />
                                        <ReadRowsList rows={s.tds_msds_coa} columns={[{ key: "type" }, { key: "url" }]} />
                                        <ReadRowsList rows={s.other_certifications} columns={[{ key: "name" }, { key: "url" }]} />
                                    </div>
                                </SectionBlock>
                            )}
                        </div>
                    </div>
                )}

                {!loading && s && (
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: C.hairSoft }}>
                        <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold" style={{ color: C.muted }}>Close</button>
                        <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-bold text-white transition-opacity duration-150" style={{ background: C.secondary }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit this listing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ============================== main page ============================== */

const STATUS_FILTERS = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "paused", label: "Paused" },
    { key: "pending_review", label: "Pending" },
    { key: "rejected", label: "Rejected" },
];

export default function SellerManageListingsPage() {
    const { token, profile, subscribeUserEvent, registerResyncHandler } = useAuth();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [needsRestockOnly, setNeedsRestockOnly] = useState(false);

    const [quickEditId, setQuickEditId] = useState(null);
    const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [viewingId, setViewingId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);

    const isApprovedSeller = profile?.seller_status === "approved";

    const reload = useCallback(({ silent } = {}) => {
        if (!token || !isApprovedSeller) { setLoading(false); return; }
        if (!silent) setLoading(true); else setRefreshing(true);
        fetchMySellerSubmissions(token).then((res) => {
            if (res?.success) { setItems(res.items || []); setLastSynced(new Date()); }
            setLoading(false); setRefreshing(false);
        });
    }, [token, isApprovedSeller]);

    useEffect(() => { reload(); }, [reload]);
    useEffect(() => subscribeUserEvent?.("submissions_changed", () => reload({ silent: true })), [subscribeUserEvent, reload]);
    useEffect(() => registerResyncHandler?.(() => reload({ silent: true })), [registerResyncHandler, reload]);

    // Safety net — catches stock/order changes that happened while this
    // tab wasn't focused, in case the realtime channel above missed them.
    useEffect(() => {
        function onVisible() { if (document.visibilityState === "visible") reload({ silent: true }); }
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    }, [reload]);

    const stats = useMemo(() => {
        const total = items.length;
        const live = items.filter((it) => it.is_active !== false && it.review_status === "approved").length;
        const low = items.filter((it) => stockState(it.stock_quantity) === "low").length;
        const out = items.filter((it) => stockState(it.stock_quantity) === "out").length;
        const pending = items.filter((it) => it.review_status === "pending_review").length;
        const rejected = items.filter((it) => it.review_status === "rejected").length;
        const paused = items.filter((it) => it.is_active === false).length;
        return { total, live, low, out, pending, rejected, paused };
    }, [items]);

    const filtered = useMemo(() => {
        let list = items;
        if (statusFilter === "live") list = list.filter((it) => it.is_active !== false && it.review_status === "approved");
        else if (statusFilter === "paused") list = list.filter((it) => it.is_active === false);
        else if (statusFilter === "pending_review") list = list.filter((it) => it.review_status === "pending_review");
        else if (statusFilter === "rejected") list = list.filter((it) => it.review_status === "rejected");

        if (needsRestockOnly) list = list.filter((it) => stockState(it.stock_quantity) !== "ok");

        const term = query.trim().toLowerCase();
        if (term) {
            list = list.filter((it) => {
                const name = (it.brand?.name || it.product_name || "").toLowerCase();
                const brand = (it.brand?.brand_name || it.brand_name || "").toLowerCase();
                return name.includes(term) || brand.includes(term);
            });
        }
        return list;
    }, [items, statusFilter, needsRestockOnly, query]);

    function patchItem(id, patch) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    }

    async function activateListing(id) {
        setTogglingId(id);
        const res = await setSellerSubmissionActive(token, id, true);
        setTogglingId(null);
        if (res?.success) patchItem(id, res.submission);
    }
    async function confirmDeactivate(id) {
        setTogglingId(id);
        const res = await setSellerSubmissionActive(token, id, false);
        setTogglingId(null);
        if (res?.success) { patchItem(id, res.submission); setConfirmDeactivateId(null); }
    }

    if (!isApprovedSeller) {
        return (
            <div className="min-h-screen" style={{ background: "#FCFBF9" }}>
                <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                        {profile?.seller_status === "pending_review" ? <Clock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                    </span>
                    <h2 className="mt-4 text-[19px] font-extrabold" style={{ color: C.ink }}>
                        {profile?.seller_status === "pending_review" ? "Your shop is under review" : "Set up your seller shop first"}
                    </h2>
                    <p className="mt-2 text-[13.5px] font-medium" style={{ color: C.muted }}>
                        {profile?.seller_status === "pending_review"
                            ? "You'll be able to manage listings once your shop is approved."
                            : "Managing listings requires an approved seller shop."}
                    </p>
                    <button onClick={() => navigate(profile?.seller_status ? "/seller/status" : "/seller/onboarding")}
                        className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                        {profile?.seller_status ? "Check my shop status" : "Set up my shop"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FCFBF9] text-slate-900 antialiased">
            <SmoothScrollProvider>
                <main className="mx-auto max-w-5xl px-2.5 pb-24 pt-5 sm:px-4 lg:px-6">

                    {/* header */}
                    <div className="flex items-start justify-between gap-3 px-1">
                        <div>
                            <h1 className="font-extrabold leading-tight tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(20px, 2vw, 28px)" }}>
                                Your listings
                            </h1>
                            <p className="mt-1 max-w-md text-[12.5px] font-medium leading-relaxed" style={{ color: C.muted }}>
                                Stock updates the moment an order is placed or cancelled. Prices, MOQ, and lead time update instantly for buyers.
                            </p>
                        </div>
                        <button
                            onClick={() => reload({ silent: true })}
                            disabled={refreshing}
                            className="flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.02] disabled:opacity-60"
                            style={{ borderColor: C.hair, color: C.muted }}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                            {lastSynced ? `Synced ${timeAgo(lastSynced)}` : "Sync"}
                        </button>
                    </div>

                    {/* stats */}
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile icon={Package} label="Listings" value={stats.total} tone="ink" />
                        <StatTile icon={CheckCircle2} label="Live to buyers" value={stats.live} tone="secondary" />
                        <StatTile icon={TrendingDown} label="Low stock" value={stats.low} tone="primary" />
                        <StatTile icon={PackageX} label="Out of stock" value={stats.out} tone="primary" />
                    </div>

                    {/* search + filters */}
                    <div className="mt-5 flex flex-col gap-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search your listings by product or brand…"
                                className="w-full rounded-full border bg-white py-2.5 pl-10 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2"
                                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }}
                            />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {STATUS_FILTERS.map((f) => (
                                <FilterChip
                                    key={f.key}
                                    label={f.label}
                                    active={statusFilter === f.key}
                                    onClick={() => setStatusFilter(f.key)}
                                    count={f.key === "all" ? stats.total : f.key === "live" ? stats.live : f.key === "paused" ? stats.paused : f.key === "pending_review" ? stats.pending : stats.rejected}
                                />
                            ))}
                            <span className="mx-1 h-4 w-px shrink-0" style={{ background: C.hair }} />
                            <FilterChip
                                label="Needs restock"
                                active={needsRestockOnly}
                                onClick={() => setNeedsRestockOnly((v) => !v)}
                                count={stats.low + stats.out}
                            />
                        </div>
                    </div>

                    {/* list */}
                    <div className="mt-4 overflow-hidden rounded-[20px] border bg-white" style={{ borderColor: C.hair }}>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 border-b px-3 py-3.5 sm:px-4" style={{ borderColor: C.hairSoft }}>
                                <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 w-2/5 animate-pulse rounded" style={{ background: C.hairSoft }} />
                                    <div className="h-2.5 w-3/5 animate-pulse rounded" style={{ background: C.hairSoft }} />
                                </div>
                            </div>
                        ))}

                        {!loading && filtered.length === 0 && (
                            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                                <Package className="h-6 w-6" style={{ color: C.hair }} />
                                <p className="text-[13.5px] font-bold" style={{ color: C.ink }}>
                                    {items.length === 0 ? "You haven't listed anything yet" : "Nothing matches these filters"}
                                </p>
                                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>
                                    {items.length === 0 ? "List your first product to start selling." : "Try a different search or filter."}
                                </p>
                                {items.length === 0 && (
                                    <button onClick={() => navigate("/seller/sell")}
                                        className="mt-2 rounded-xl px-4 py-2 text-[12.5px] font-bold text-white" style={{ background: C.secondary }}>
                                        List a product
                                    </button>
                                )}
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {!loading && filtered.map((it, i) => (
                                <ListingRow
                                    key={it.id}
                                    it={it}
                                    idx={i}
                                    isQuickEditing={quickEditId === it.id}
                                    isConfirmingDeactivate={confirmDeactivateId === it.id}
                                    togglingId={togglingId}
                                    onOpenDetail={(item) => setViewingId(item.id)}
                                    onQuickEdit={(id) => { setConfirmDeactivateId(null); setQuickEditId(id); }}
                                    onCancelQuickEdit={() => setQuickEditId(null)}
                                    onSaved={(id, submission) => { patchItem(id, submission); setQuickEditId(null); }}
                                    onAskDeactivate={(id) => { setQuickEditId(null); setConfirmDeactivateId(id); }}
                                    onCancelDeactivate={() => setConfirmDeactivateId(null)}
                                    onConfirmDeactivate={confirmDeactivate}
                                    onActivate={activateListing}
                                    onOpenImage={setLightboxImage}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </main>

                {lightboxImage && createPortal(
                    <ImageLightbox images={lightboxImage.images} initialIndex={lightboxImage.index} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />,
                    document.body
                )}

                {viewingId && createPortal(
                    <ListingDetailModal
                        token={token}
                        submissionId={viewingId}
                        onClose={() => setViewingId(null)}
                        onImageClick={setLightboxImage}
                        onEdit={() => { const id = viewingId; setViewingId(null); navigate(`/seller/sell/${id}/edit`); }}
                    />,
                    document.body
                )}
            </SmoothScrollProvider>
        </div>
    );
}