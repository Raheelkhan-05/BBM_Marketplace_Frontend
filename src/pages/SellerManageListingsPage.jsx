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
// SALE-UNIT CONSISTENCY:
// Every quantity-and-price-facing number on this page — MOQ, the row's
// "₹X /unit", "N left" stock label, and the detail modal's MOQ/Stock/
// Pricing rows — is displayed in the listing's SALE unit: Master Pack
// when the listing has an outer pack (units_per_master_pack >= 1), Pack
// otherwise. This matches the convention BuyNowModal.jsx and
// HomeProductFeed.jsx already use (via shared/packUnits.js).
//
// DATA-SOURCE MISMATCH FIX:
// fetchMySellerSubmissions() — the light list endpoint this page uses for
// its rows — does not appear to return `units_per_master_pack` on each
// row, while fetchSellerSubmissionDetail() (used by the detail modal)
// does. Any row missing units_per_master_pack gets it filled in lazily
// via a capped-concurrency background fetch (see the enrichment effect in
// the main component), deduped and cached so each listing is only ever
// fetched once. While a row's sale unit is still unknown, its
// unit-dependent text (MOQ line, price/unit, stock line) renders a
// skeleton instead of guessing.
//
// GST PRICING (simplified):
// GST is always calculated ON TOP of the entered base price — there is no
// "price already includes GST" branch anywhere on this page anymore.
//   final price = base price + (base price * gst% / 100)
// This applies identically in the Quick Update panel and the read-only
// Detail modal, via the shared computeGstAmount()/computeFinalPrice()
// helpers below, so the two surfaces can never disagree with each other.
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
import { useNavigate, useLocation } from "react-router-dom";
import Toast from "../components/Toast.jsx";
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
import { SellerOnboardingForm } from "./SellerOnboardingPage.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import SellerListingForm from "../components/seller/listingForm/SellerListingForm.jsx";
// Same shared convention BuyNowModal.jsx / HomeProductFeed.jsx already use
// for "what unit is this listing actually sold and priced in" — imported
// rather than reimplemented here, so this page can't drift out of sync
// with the buyer-facing pages again.
import { saleUnitLabel, round2 } from "../shared/packUnits.js";

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
const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];
const ENRICH_CONCURRENCY = 4;

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

// Pluralizes a sale-unit label ("Pack" / "Master Pack") against a qty.
function pluralizeUnit(qty, label) {
    return `${label}${Number(qty) === 1 ? "" : "s"}`;
}

function formatMoney(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// GST is ALWAYS added on top of the entered base price — no
// inclusive/exclusive branching anywhere on this page. These two are the
// single source of truth; both the Quick Update panel and the read-only
// Detail modal call these, so they can never disagree with each other.
//   gstAmount   = basePrice * gst% / 100
//   finalPrice  = basePrice + gstAmount
function computeGstAmount(basePrice, gstPercent) {
    const price = Number(basePrice) || 0;
    const gst = Number(gstPercent) || 0;
    return round2(price * (gst / 100));
}
function computeFinalPrice(basePrice, gstPercent) {
    const price = Number(basePrice) || 0;
    return round2(price + computeGstAmount(price, gstPercent));
}

// Skeleton bar used wherever a sale-unit-dependent value is still
// unresolved (row hasn't been enriched with units_per_master_pack yet) —
// deliberately used INSTEAD OF guessing, so a wrong unit is never shown
// with false confidence.
function TextSkeleton({ width = "3.5rem", height = "0.7rem" }) {
    return <span className="inline-block animate-pulse rounded-full align-middle" style={{ width, height, background: C.hairSoft }} />;
}

/* ---------------- edit listing modal ---------------- */

// Maps a raw seller_product_submissions row (as returned by
// fetchSellerSubmissionDetail) into the shape SellerListingForm's
// `initialValues` expects. Mirrors the field-name translation
// updateSubmission() already does server-side, just in reverse and
// for display instead of for persistence.
function submissionToInitialValues(s) {
    const packSize = Number(s.pack_size) || 1;
    const masterPackSize = Number(s.units_per_master_pack) || 1;
    const hasOuterPackLocal = masterPackSize > 1;

    return {
        productName: s.product_name || s.brand?.name || "",
        brandName: s.brand_name || s.brand?.brand_name || "",
        brandImage: s.brand?.image || null,
        brandNotApplicable: !s.brand_name,
        images: s.images?.length ? s.images : (s.image ? [s.image] : []),
        qualityCertificates: s.quality_certificates || [],
        noteToAdmin: s.note_to_admin || "",

        unit: s.unit || "",
        packSize: String(packSize),
        hasOuterPack: hasOuterPackLocal,
        masterPackSize: hasOuterPackLocal ? String(masterPackSize) : "0",

        hsnCode: s.hsn_code || "",
        gstPercent: s.gst_percent ?? 18,

        basePrice: s.base_price != null ? String(s.base_price) : "",
        priceBasis: s.price_basis || (hasOuterPackLocal ? "per_master_pack" : "per_pack"),
        // GST is always added on top now — the form no longer has an
        // inclusive/exclusive choice, so this is always false regardless
        // of whatever the row previously had stored.
        gstInclusive: false,
        freightIncluded: Boolean(s.freight_included),

        sampleAvailable: Boolean(s.sample_available),
        sampleQuantity: s.sample_quantity != null ? String(s.sample_quantity) : "",
        sampleUnitBasis: s.sample_unit_basis || "per_unit",

        priceSlabs: s.quantity_discounts || [],

        stockType: s.stock_type || "ready_stock",
        stockQuantity: s.stock_quantity != null ? String(s.stock_quantity) : "",
        stockQuantityBasis: "per_pack",
        productionLeadTimeDays: s.production_lead_time_days != null ? String(s.production_lead_time_days) : "",

        moq: s.moq != null ? String(s.moq) : "",

        dispatchDistrict: s.dispatch_district || "",
        dispatchState: s.dispatch_state || "",
        dispatchPincode: s.dispatch_pincode || "",
        dispatchingLocations: s.dispatching_locations || null,

        returnPolicyKey: s.return_policy_key || "",
        warrantyKey: s.warranty_key || "",
    };
}

function EditListingModal({ token, submissionId, onClose, onSaved }) {
    useLockBodyScroll();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [initialValues, setInitialValues] = useState(null);
    const [brandDisplay, setBrandDisplay] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError("");
        fetchSellerSubmissionDetail(token, submissionId).then((res) => {
            if (cancelled) return;
            if (!res?.success) { setError(res?.message || "Couldn't load this listing."); setLoading(false); return; }
            const s = res.submission;
            setInitialValues(submissionToInitialValues(s));
            setBrandDisplay({
                name: s.product_name || s.brand?.name,
                brandName: s.brand_name || s.brand?.brand_name,
                image: s.image || s.brand?.image,
            });
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [token, submissionId]);

    const handleSubmit = async (payload) => {
        setSubmitting(true);
        setSubmitError(null);
        const res = await updateSellerProductSubmission(token, submissionId, payload);
        setSubmitting(false);
        if (!res?.success) { setSubmitError(res?.message || "Couldn't save changes."); return; }
        onSaved(submissionId, res.submission, res.message || "Changes submitted for review.");
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-2.5 sm:p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" style={{ height: "92vh" }}>
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-3.5" style={{ borderColor: C.hairSoft }}>
                    <h3 className="text-[15px] font-extrabold" style={{ color: C.ink }}>Edit listing</h3>
                    <button onClick={onClose} className="shrink-0 rounded-full p-1.5 transition-colors duration-150 hover:bg-black/[0.05]" style={{ color: C.muted }}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0, overscrollBehavior: "contain" }}>
                    {loading && <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>}
                    {!loading && error && <p className="py-8 text-center text-[13px] font-semibold" style={{ color: "#c71f11" }}>{error}</p>}

                    {!loading && !error && submitError && (
                        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{submitError}</p>
                    )}

                    {!loading && !error && initialValues && (
                        <SellerListingForm
                            mode="edit"
                            identityReadOnly
                            brandDisplay={brandDisplay}
                            initialValues={initialValues}
                            onSubmit={handleSubmit}
                            submitting={submitting}
                            submitLabel="Save & resubmit for review"
                            stickyBottomClassName="-bottom-4"
                        />
                    )}
                </div>
            </div>
        </div>
    );
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

// Restock control, split into two clear modes instead of one ambiguous
// "type a number and hope" field:
//  - "Set total": type the exact new stock count directly.
//  - "Quick add": one-tap chips for common restock sizes (+10/+50/+100)
//    plus a custom-quantity field with explicit Add/Remove buttons, so a
//    seller who just received "3 more boxes of 20" doesn't have to do that
//    arithmetic themselves — and always sees a live preview of the
//    resulting total before it's applied.
function StockAdjuster({ value, onChange, saleUnit }) {
    const [mode, setMode] = useState("set");
    const [delta, setDelta] = useState("");

    const current = Number(value) || 0;
    const deltaNum = Number(delta) || 0;

    function applyDelta(amount) {
        onChange(String(Math.max(0, current + amount)));
        setDelta("");
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
                    Stock ({pluralizeUnit(2, saleUnit)})
                </span>
                <div className="flex gap-1 rounded-full p-0.5" style={{ background: "#fff", border: `1px solid ${C.hair}` }}>
                    {[["set", "Set total"], ["add", "Quick add"]].map(([key, label]) => (
                        <button key={key} type="button" onClick={() => { setMode(key); setDelta(""); }}
                            className="rounded-full px-2 py-1 text-[10px] font-bold tracking-wide transition-colors duration-150"
                            style={mode === key ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {mode === "set" ? (
                <input
                    type="number" min="0" step="1" value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border bg-white px-2.5 py-2 text-[13.5px] font-bold focus:outline-none focus:ring-2"
                    style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}33` }}
                />
            ) : (
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 50, 100].map((q) => (
                            <button key={q} type="button" onClick={() => applyDelta(q)}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold"
                                style={{ background: `${C.secondary}14`, color: C.secondary }}>
                                <Plus className="h-3 w-3" /> {q}
                            </button>
                        ))}
                        <input
                            type="number" min="0" step="1" placeholder="Custom qty"
                            value={delta} onChange={(e) => setDelta(e.target.value)}
                            className="w-24 rounded-lg border bg-white px-2 py-1.5 text-[12px] font-bold focus:outline-none"
                            style={{ borderColor: C.hair, color: C.ink }}
                        />
                        <button type="button" onClick={() => applyDelta(deltaNum)} disabled={!deltaNum}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold disabled:opacity-40"
                            style={{ background: `${C.secondary}14`, color: C.secondary }}>
                            <PackagePlus className="h-3 w-3" /> Add
                        </button>
                        <button type="button" onClick={() => applyDelta(-deltaNum)} disabled={!deltaNum}
                            className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold disabled:opacity-40"
                            style={{ background: "rgba(199,31,17,0.08)", color: "#c71f11" }}>
                            Remove
                        </button>
                    </div>
                    <p className="text-[11px] font-semibold" style={{ color: C.muted }}>
                        {current} {pluralizeUnit(current, saleUnit)}
                        {deltaNum > 0 && (
                            <> → <span style={{ color: C.ink, fontWeight: 800 }}>{current + deltaNum}</span> {pluralizeUnit(current + deltaNum, saleUnit)} once applied</>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}

// `item` is the light row object from the list (fast, already on screen —
// and, per the note at the top of this file, may be MISSING
// units_per_master_pack). On open, this fetches the full submission so it
// can edit the real (base price, GST%) inputs instead of a single opaque
// "price" number, AND so it has an authoritative units_per_master_pack to
// label everything with — never trusting the light `item` prop for that.
// `onSave(payload, optimisticPatch)` is called once the seller hits Save;
// the parent applies `optimisticPatch` to the list immediately (so the UI
// updates with zero perceived delay) and only sends `payload` to the
// server in the background, rolling back if it's rejected.
function QuickUpdatePanel({ item, onCancel, onSave }) {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError("");
        fetchSellerSubmissionDetail(token, item.id).then((res) => {
            if (cancelled) return;
            if (!res?.success) { setLoadError(res?.message || "Couldn't load pricing details."); setLoading(false); return; }
            const s = res.submission;
            setForm({
                // Authoritative — always from the detail fetch, NEVER from
                // the light `item` prop. This is the field that was missing
                // on the list payload and caused "Pack" to show for a
                // Master-Pack-sold item.
                unitsPerMasterPack: s.units_per_master_pack ?? 1,

                basePrice: s.base_price != null ? String(s.base_price) : "",
                gstPercent: s.gst_percent ?? 18,
                moq: s.moq != null ? String(s.moq) : "",
                stockType: s.stock_type || "ready_stock",
                stockQuantity: s.stock_quantity != null ? String(s.stock_quantity) : "",
                leadTime: String(
                    s.stock_type === "made_to_order"
                        ? (s.production_lead_time_days ?? "")
                        : (s.dispatch_time_days ?? item.lead_time ?? "")
                ),
            });
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [item.id, item.lead_time, token]);

    // Only ever computed from the fetched, authoritative field — this is
    // the actual fix for the panel previously showing "Pack" for a
    // Master-Pack listing.
    const saleUnit = form ? saleUnitLabel(form.unitsPerMasterPack) : null;

    // GST always added on top of the entered base price — computed off
    // `form` (this panel's own state), via the same shared helpers the
    // Detail modal uses, so both surfaces always agree.
    const gstAmount = form ? computeGstAmount(form.basePrice, form.gstPercent) : 0;
    const finalPrice = form ? computeFinalPrice(form.basePrice, form.gstPercent) : 0;

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    async function save() {
        setError("");
        if (!form) return;
        if (!(Number(form.basePrice) > 0)) return setError("Price must be greater than 0.");
        if (!(Number(form.moq) > 0)) return setError("MOQ must be greater than 0.");
        if (form.stockType === "ready_stock" && form.stockQuantity !== "" && Number(form.stockQuantity) < 0) {
            return setError("Stock can't be negative.");
        }

        setSaving(true);

        const payload = {
            basePrice: Number(form.basePrice),
            gstPercent: Number(form.gstPercent),
            // GST is always added on top now — never stored as inclusive.
            gstInclusive: false,
            moq: Number(form.moq),
            ...(form.stockType === "ready_stock"
                ? {
                    stockQuantity: form.stockQuantity === "" ? null : Number(form.stockQuantity),
                    dispatchTimeDays: form.leadTime === "" ? null : Number(form.leadTime),
                }
                : { productionLeadTimeDays: form.leadTime === "" ? null : Number(form.leadTime) }),
        };

        // Applied to the list row the instant Save is pressed — before the
        // network call even resolves — so there's no visible lag. Also
        // carries units_per_master_pack through explicitly: this listing's
        // authoritative value is now known (we just fetched it), so the row
        // can stop showing a skeleton for its unit-dependent text right
        // away, even if the background enrichment pass hasn't reached it.
        const optimisticPatch = {
            price: Number(form.basePrice),   // keep the row showing the seller's entered base price, consistent with how it displays before any edit
            moq: Number(form.moq),
            lead_time: form.leadTime === "" ? null : Number(form.leadTime),
            units_per_master_pack: form.unitsPerMasterPack,
            ...(form.stockType === "ready_stock"
                ? { stock_quantity: form.stockQuantity === "" ? null : Number(form.stockQuantity) }
                : {}),
        };

        await onSave(payload, optimisticPatch);
        setSaving(false);
    }

    if (loading) {
        return (
            <div className="overflow-hidden px-3 pb-3 sm:px-4">
                <div className="flex items-center justify-center gap-2 rounded-xl border p-4 text-[12px] font-semibold" style={{ borderColor: C.hair, background: C.hairSoft, color: C.muted }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading pricing details…
                </div>
            </div>
        );
    }
    if (loadError || !form) {
        return (
            <div className="overflow-hidden px-3 pb-3 sm:px-4">
                <div className="flex items-center justify-between gap-2 rounded-xl border p-3 text-[12px] font-semibold" style={{ borderColor: C.hair, color: "#c71f11" }}>
                    <span>{loadError || "Something went wrong."}</span>
                    <button onClick={onCancel} className="shrink-0 rounded-lg border bg-white px-2.5 py-1" style={{ borderColor: C.hair, color: C.muted }}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden px-3 pb-3 sm:px-4">
            <div className="flex flex-col gap-3.5 rounded-xl border p-3" style={{ borderColor: C.hair, background: C.hairSoft }}>

                {/* ---- Pricing ---- */}
                <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>
                        <IndianRupee className="h-3.5 w-3.5" style={{ color: C.secondary }} /> Pricing · per {saleUnit}
                    </span>

                    <QuickField
                        label={`Base Price (₹/${saleUnit})`}
                        type="number" min="0" step="0.01"
                        value={form.basePrice}
                        onChange={(e) => setField("basePrice", e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col justify-center gap-0.5 rounded-lg border px-2.5 py-2" style={{ borderColor: C.hair, background: "#fff" }}>
                            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>GST amount - {form.gstPercent}%</span>
                            <span className="text-[13.5px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{formatMoney(gstAmount)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center gap-0.5 rounded-lg border px-2.5 py-2" style={{ borderColor: C.hair, background: "#fff" }}>
                        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>Final price (base + GST)</span>
                        <span className="text-[15px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{formatMoney(finalPrice)}</span>
                    </div>
                </div>

                {/* ---- Quantity & lead time ---- */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    <QuickField
                        label={`MOQ (${saleUnit}s)`}
                        type="number" min="0" step="1"
                        value={form.moq}
                        onChange={(e) => setField("moq", e.target.value.replace(/[^\d.]/g, ""))}
                    />
                    <QuickField
                        label={form.stockType === "made_to_order" ? "Lead time (days)" : "Dispatch time (days)"}
                        type="number" min="0" step="1"
                        value={form.leadTime}
                        onChange={(e) => setField("leadTime", e.target.value.replace(/[^\d]/g, ""))}
                    />
                </div>

                {form.stockType === "ready_stock" && (
                    <StockAdjuster
                        value={form.stockQuantity}
                        onChange={(v) => setField("stockQuantity", v.replace(/[^\d.]/g, ""))}
                        saleUnit={saleUnit}
                    />
                )}

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
    onOpenDetail, onEdit, onQuickEdit, onCancelQuickEdit, onQuickSave,
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

    // Whether this row actually knows its sale unit yet. `units_per_master_pack`
    // is `undefined` on rows the list endpoint hasn't returned it for and the
    // background enrichment pass (see main component) hasn't reached yet —
    // `null` or a real number both count as "known" (null just means "no
    // master pack", same as the detail modal's own convention).
    const saleUnitKnown = it.units_per_master_pack !== undefined;
    const saleUnit = saleUnitKnown ? saleUnitLabel(it.units_per_master_pack) : null;

    const statusColor = !isActive ? C.muted : sState === "out" ? "#c71f11" : sState === "low" ? "#b45309" : C.secondary;
    const stockLabel = sState === "out"
        ? "Out of stock"
        : stock != null
            ? `${stock} ${pluralizeUnit(stock, saleUnit)} left`
            : "Stock not set";

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
                        {brandName ? `${brandName} · ` : ""}
                        MOQ {it.moq} {saleUnitKnown ? pluralizeUnit(it.moq, saleUnit) : <TextSkeleton width="2.5rem" />}
                        {it.lead_time != null && ` · Lead ${it.lead_time}d`}
                    </p>
                    {it.rejection_reason && it.review_status === "rejected" && (
                        <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "#c71f11" }}>Rejected: {it.rejection_reason}</p>
                    )}
                </div>

                {!isExpanded && (
                    <div className="hidden shrink-0 flex-col items-end pl-2 text-right sm:flex">
                        <p className="leading-none">
                            <span className="text-[15.5px] font-bold tracking-[-0.01em] tabular-nums" style={{ color: C.ink }}>₹{formatMoney(it.price)}</span>
                            <span className="ml-0.5 text-[10.5px] font-semibold" style={{ color: C.muted }}>
                                /{saleUnitKnown ? saleUnit : <TextSkeleton width="2.5rem" />}
                            </span>
                        </p>
                        <p className="mt-1 whitespace-nowrap text-[10.5px] font-bold tabular-nums" style={{ color: statusColor }}>
                            {isActive ? (saleUnitKnown || sState === "out" ? stockLabel : <TextSkeleton width="4.5rem" />) : "Hidden from buyers"}
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
                        <QuickUpdatePanel
                            item={it}
                            onCancel={onCancelQuickEdit}
                            onSave={(payload, optimisticPatch) => onQuickSave(it.id, payload, optimisticPatch)}
                        />
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

    // The sale unit this listing is priced, MOQ'd, and stocked in.
    const saleUnit = saleUnitLabel(s?.units_per_master_pack);

    // GST always added on top of the entered base price — same shared
    // helpers the Quick Update panel uses, so the two views can never
    // disagree. No inclusive/exclusive branching, no gst_inclusive_input.
    const gstAmount = s ? computeGstAmount(s.base_price, s.gst_percent) : 0;
    const finalPrice = s ? computeFinalPrice(s.base_price, s.gst_percent) : 0;

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
                                <ReadRow label={`Base Price (/${saleUnit})`} value={s.base_price != null ? `₹${formatMoney(s.base_price)}` : null} />
                                <ReadRow label="GST %" value={s.gst_percent != null ? `${s.gst_percent}%` : null} />
                                <ReadRow label="GST amount" value={`₹${formatMoney(gstAmount)}`} />
                                <ReadRow label={`Final price (/${saleUnit})`} value={`₹${formatMoney(finalPrice)}`} />
                                <ReadRow label="Freight" value={s.freight_included != null ? (s.freight_included ? "Included" : "Extra, buyer pays") : null} />
                                <ReadRow label="Valid till" value={s.price_validity_till} />
                            </SectionBlock>

                            <SectionBlock icon={Boxes} title="Quantity">
                                <ReadRow label="MOQ" value={s.moq != null ? `${s.moq} ${pluralizeUnit(s.moq, saleUnit)}` : null} />
                                <ReadRow label="Sample" value={s.sample_available ? `${s.sample_quantity || ""} ${s.sample_unit_basis ? { per_unit: "unit(s)", per_pack: "pack(s)", per_master_pack: "master pack(s)" }[s.sample_unit_basis] : ""}`.trim() || "Available" : "Not available"} />
                            </SectionBlock>
                            {(s.price_slabs?.length > 0 || s.quantity_discounts?.length > 0) && (
                                <div className="-mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <ReadRowsList rows={s.price_slabs} columns={[{ key: "minQty" }, { key: "maxQty" }, { key: "price" }]} />
                                    <ReadRowsList rows={s.quantity_discounts} columns={[{ key: "minQty" }, { key: "discountPercent" }]} />
                                </div>
                            )}

                            <SectionBlock icon={Archive} title="Packaging">
                                <ReadRow label="Selling unit" value={s.unit} />
                                <ReadRow label="Pack size" value={s.pack_size != null ? `${s.pack_size} ${s.unit || ""}`.trim() : null} />
                                <ReadRow label="Units/master pack" value={s.units_per_master_pack} />
                            </SectionBlock>

                            <SectionBlock icon={Boxes} title="Availability">
                                <ReadRow label="Stock" value={s.stock_quantity != null ? `${s.stock_quantity} ${pluralizeUnit(s.stock_quantity, saleUnit)}` : "Not set"} />
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

    // Separate from `items` on purpose — this state is never touched by
    // reload()/setItems replacing the list, so a background refresh can
    // never wipe out what enrichment already learned. Keyed by listing id.
    const [unitInfoById, setUnitInfoById] = useState({});

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);

    const [editingId, setEditingId] = useState(null);

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [needsRestockOnly, setNeedsRestockOnly] = useState(false);

    const [quickEditId, setQuickEditId] = useState(null);
    const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [viewingId, setViewingId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);

    const location = useLocation();
    const [toastMsg, setToastMsg] = useState(location.state?.toast || null);

    useEffect(() => {
        // Clear the router state so refreshing/back-nav doesn't re-show the toast.
        if (location.state?.toast) {
            window.history.replaceState({}, document.title);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    const isApprovedSeller = profile?.seller_status === "approved";

    const reload = useCallback(({ silent } = {}) => {
        if (!token || !isApprovedSeller) { setLoading(false); return; }
        if (!silent) setLoading(true); else setRefreshing(true);
        fetchMySellerSubmissions(token).then((res) => {
            if (res?.success) { setItems(res.items || []); setLastSynced(new Date()); }
            setLoading(false); setRefreshing(false);
        });
    }, [token, isApprovedSeller]);

    // Single source of truth for "does this row know its sale unit" — prefers
    // units_per_master_pack directly on the item (when the light endpoint
    // happens to include it), falling back to whatever enrichment has
    // separately learned for that id. Since unitInfoById is never cleared by
    // reload, this can't regress once a row's been enriched.
    const enrichedItems = useMemo(() => {
        return items.map((it) => {
            if (it.units_per_master_pack !== undefined) return it;
            const known = unitInfoById[it.id];
            return known ? { ...it, ...known } : it;
        });
    }, [items, unitInfoById]);

    useEffect(() => {
        if (!token) return;

        const pending = items
            .filter((it) => it.units_per_master_pack === undefined
                && unitInfoById[it.id] === undefined
                && !inFlightIdsRef.current.has(it.id))
            .slice(0, ENRICH_CONCURRENCY);

        if (!pending.length) return;

        let cancelled = false;
        pending.forEach((it) => inFlightIdsRef.current.add(it.id));

        Promise.allSettled(
            pending.map((it) =>
                fetchSellerSubmissionDetail(token, it.id)
                    .then((res) => ({ it, res }))
                    .catch(() => ({ it, res: null }))
            )
        ).then((results) => {
            for (const outcome of results) {
                const { it } = outcome.value;
                inFlightIdsRef.current.delete(it.id);
            }
            if (cancelled) return;

            setUnitInfoById((prev) => {
                const next = { ...prev };
                for (const outcome of results) {
                    const { it, res } = outcome.value;
                    const s = res?.submission;
                    next[it.id] = {
                        units_per_master_pack: res?.success && s ? (s.units_per_master_pack ?? 1) : 1,
                        pack_size: res?.success && s ? (s.pack_size ?? it.pack_size) : it.pack_size,
                        unit: res?.success && s ? (s.unit ?? it.unit) : it.unit,
                    };
                }
                return next;
            });
        });

        return () => { cancelled = true; };
    }, [items, unitInfoById, token]);

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

    // ---- Background enrichment: fill in units_per_master_pack for any row
    // the LIST endpoint didn't return it for (see the note at the top of
    // this file). Runs with a small concurrency cap, dedupes via
    // in-flight/done caches so each listing id is only ever fetched once
    // no matter how many times this effect re-fires (e.g. after every
    // patchItem-triggered items update), and only touches rows that are
    // genuinely missing the field — it never re-fetches rows that already
    // have it, including ones already fixed by a previous enrichment pass
    // or by a quick-edit save.
    const inFlightIdsRef = useRef(new Set());

    // One self-contained pass per items-change: grab up to ENRICH_CONCURRENCY
    // rows that are still missing units_per_master_pack, fetch just those,
    // merge whatever comes back, and stop. No persistent worker loop, no
    // manual "how many workers are alive" counter to get out of sync — the
    // natural items→effect→setItems→items cycle re-triggers the next batch
    // on its own, throttled to a handful of requests at a time.


    const stats = useMemo(() => {
        const total = enrichedItems.length;
        const live = enrichedItems.filter((it) => it.is_active !== false && it.review_status === "approved").length;
        const low = enrichedItems.filter((it) => stockState(it.stock_quantity) === "low").length;
        const out = enrichedItems.filter((it) => stockState(it.stock_quantity) === "out").length;
        const pending = enrichedItems.filter((it) => it.review_status === "pending_review").length;
        const rejected = enrichedItems.filter((it) => it.review_status === "rejected").length;
        const paused = enrichedItems.filter((it) => it.is_active === false).length;
        return { total, live, low, out, pending, rejected, paused };
    }, [enrichedItems]);

    const filtered = useMemo(() => {
        let list = enrichedItems;
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
    }, [enrichedItems, statusFilter, needsRestockOnly, query]);

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

    // Quick-update save flow: applies the optimistic values to the row
    // immediately (so the panel closes and the row reflects the new
    // numbers with no wait), then persists in the background. If the
    // server rejects the change, the row is rolled back to its previous
    // state and a toast explains what happened — the seller never has to
    // sit and stare at a spinner to know their edit "took".
    async function handleQuickSave(id, payload, optimisticPatch) {
        const prevItem = items.find((it) => it.id === id);
        patchItem(id, optimisticPatch);
        setUnitInfoById((prev) => ({
            ...prev,
            [id]: { units_per_master_pack: optimisticPatch.units_per_master_pack, pack_size: prevItem?.pack_size, unit: prevItem?.unit },
        }));
        setQuickEditId(null);
        const res = await updateSellerProductSubmission(token, id, payload);
        if (res?.success) {
            patchItem(id, res.submission);
        } else {
            if (prevItem) patchItem(id, prevItem);
            setToastMsg(res?.message || "Couldn't save changes — reverted.");
        }
    }

    if (!isApprovedSeller) {
        if (profile?.seller_status === "pending_review") {
            return (
                <>
                    <div className="min-h-screen" style={{ background: "#FCFBF9" }}>
                        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                                <Clock className="h-6 w-6" />
                            </span>
                            <h2 className="mt-4 text-[19px] font-extrabold" style={{ color: C.ink }}>
                                Your shop is under review
                            </h2>
                            <p className="mt-2 text-[13.5px] font-medium" style={{ color: C.muted }}>
                                We're verifying your details — you'll be able to manage listings once your shop is approved. This usually takes 24–48 hours.
                            </p>
                        </div>
                    </div>
                    <Toast message={toastMsg} show={!!toastMsg} onDone={() => setToastMsg(null)} />
                </>
            );
        }

        // No seller record yet, or previously rejected — show the onboarding
        // form directly, right here, instead of a separate page.
        return (
            <>
                <SellerOnboardingForm />
                <Toast message={toastMsg} show={!!toastMsg} onDone={() => setToastMsg(null)} />
            </>
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
                                    onQuickSave={handleQuickSave}
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
                        onEdit={() => { const id = viewingId; setViewingId(null); setEditingId(id); }}
                    />,
                    document.body
                )}

                {editingId && createPortal(
                    <EditListingModal
                        token={token}
                        submissionId={editingId}
                        onClose={() => setEditingId(null)}
                        onSaved={(id, submission, message) => {
                            patchItem(id, submission);
                            setEditingId(null);
                            setToastMsg(message);
                        }}
                    />,
                    document.body
                )}
            </SmoothScrollProvider>
            <Toast message={toastMsg} show={!!toastMsg} onDone={() => setToastMsg(null)} />
            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}