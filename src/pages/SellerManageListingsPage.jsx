// src/pages/SellerManageListingsPage.jsx
//
// ... (all header comments unchanged from the previous version) ...
//
// SECTION-FOCUSED EDIT REFACTOR (latest pass):
// The inline "Quick Update" panel (price wheels, MOQ/stock/lead-time
// mini-form) has been removed entirely — QuickUpdatePanel,
// QuickUpdatePanelSkeleton, QuickField, QuickWheelField, StockAdjuster,
// and the computeGstAmount/computeFinalPrice/computeBasePriceFromFinal
// helpers that only existed to power it are all gone. Tapping the row's
// pencil icon now opens the real EditListingModal directly — no more
// read-only "Listing details" stop in between before you can actually
// change anything.
//
// The status filter chips (All / Live / Paused / Pending / Rejected)
// have been replaced by SECTION_FILTERS, which name the same groupings
// SellerListingForm's sections already use (Identity, Packaging, Tax &
// Pricing, Fulfilment, Dispatch, Policies). These chips no longer filter
// which listings are shown — they set which section of the form opens
// when you tap edit next, so a seller who only needs to touch pricing
// can pick "Tax & Pricing" once and then edit every listing's price
// without wading through the rest of the form each time.
//
// NOTE: this relies on SellerListingForm.jsx accepting a new
// `onlySection` prop (see EditListingModal below) that renders just the
// matching section instead of the whole form when set. That prop isn't
// implemented on SellerListingForm.jsx yet — it needs a small addition
// there so its internal section keys line up with SECTION_FILTERS' keys
// below ("identity" | "packaging" | "pricing" | "fulfilment" |
// "dispatch" | "policies"). Until that lands, passing a non-null
// onlySection is a no-op and the form just renders in full.
//
// BUGFIX (previous pass): submissionToInitialValues() had two unit-conversion
// bugs that only showed up in the Edit form (the read-only Detail modal
// was always correct, which is why the two disagreed):
//   1. stockQuantityBasis was hardcoded to "per_pack" even though
//      stock_quantity is stored in the listing's canonical SALE UNIT
//      (Master Pack when the listing has an outer pack). That mismatched
//      label/number combination is also what SellerListingForm.jsx's
//      unit-basis converter multiplied out incorrectly on save — see the
//      fix there.
//   2. sample_quantity is stored in BASE UNITS regardless of which basis
//      it was entered in, but was being handed to the edit form
//      unconverted and paired with the original entry basis — so the
//      field showed the raw base-unit count mislabeled as Packs/Master
//      Packs, and every re-save would multiply it again.
// Both are fixed below; the Detail modal's Sample row had the same
// display bug and is fixed too.
//
// FIX (previous pass): the live "submissions_changed" listener used to go
// through useAuth().subscribeUserEvent, which was wired to a Supabase
// Realtime broadcast channel that nothing on the backend ever publishes
// to (every real push goes out via this app's Socket.IO server — see
// AuthContext.jsx's removal notes). That meant this page only ever
// appeared to update live because of the tab-visibility resync effect
// further below — never from the actual broadcast. Now subscribes
// directly on the real socket.io-client connection (same one
// useRealtimeNotifications.js already uses successfully).
//
// SCROLL-LOCK FIX (previous pass): useLockBodyScroll() called lenis?.stop()
// and set document.body.style.overflow = "hidden", but background
// scrolling still leaked through with both modals open. Root cause:
// lenis.stop() only pauses LENIS'S OWN smooth-scroll tracking/animation —
// it does not call preventDefault() on the wheel/touch events that drive
// it, so once "stopped", Lenis just steps out of the way and lets the
// browser's native scroll take over on whatever it's controlling
// (window, or an internal transform-based wrapper, depending on how
// SmoothScrollProvider sets it up). document.body.style.overflow =
// "hidden" doesn't help either if the actual scrolling Lenis does isn't
// native body/document scroll to begin with.
//
// Replaced with useLenisScrollLock(): still calls lenis.stop()/start()
// (so Lenis's internal state stays correct and doesn't jump on resume),
// but the actual hijack is a set of window-level, capture-phase
// wheel/touchmove/keydown listeners that call preventDefault() before
// the event ever reaches Lenis or the browser's native scroll handling.
// That blocks scrolling everywhere on the page EXCEPT wherever the
// cursor/touch actually is — an event's target is whatever DOM element
// is literally under the pointer, so checking `event.target.closest(
// "[data-scroll-lock-allow]")` and skipping preventDefault there is
// exactly "scroll the foreground modal if the cursor is inside it,
// otherwise don't scroll the background". Both ListingDetailModal's and
// EditListingModal's own scrollable content areas are marked with
// data-scroll-lock-allow so scrolling inside them still works normally.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import Toast from "../components/Toast.jsx";
import {
    Search, Pencil, Power, PowerOff, ImageIcon, Package, Boxes,
    Archive, Truck, FileText, Handshake, ShieldCheck, X, Loader2, ChevronRight,
    RefreshCw, AlertTriangle, PackageX, TrendingDown,
    Lock, Clock, Wallet
} from "lucide-react";
import { fetchWalletStatus } from "../utils/walletApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { Share2 } from "lucide-react";
import { shareProductLink } from "../utils/share.js";
// NOTE: SmoothScrollProvider itself is NOT imported/used here anymore —
// main.jsx already wraps the whole app in exactly one global instance.
// This page used to ALSO wrap its own content in a second, local
// <SmoothScrollProvider>, which creates a second independent Lenis
// instance (it has no `wrapper`/`content` option, so it defaults to
// controlling `window` scroll directly — same target as the outer one).
// useLenis() resolves to the NEAREST provider in the tree, so
// useLenisScrollLock below was only ever stopping that second, redundant
// instance while the real, page-driving instance from main.jsx kept
// running untouched — which is why background scroll kept leaking
// through no matter what the lock did. Only useLenis (the hook) is
// needed here; it now finds the single global provider from main.jsx.
import { useLenis } from "../providers/SmoothScrollProvider.jsx";
import {
    fetchMySellerSubmissions, updateSellerProductSubmission,
    setSellerSubmissionActive, fetchSellerSubmissionDetail,
} from "../utils/api.js";
import ImageLightbox from "../components/ImageLightbox.jsx";
import { SellerOnboardingForm } from "./SellerOnboardingPage.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import EditListingModal from "../components/seller/listingForm/EditListingModal.jsx";
import SellerListingForm, { unflattenDispatchingLocations } from "../components/seller/listingForm/SellerListingForm.jsx";
// Same shared convention BuyNowModal.jsx / HomeProductFeed.jsx already use
// for "what unit is this listing actually sold and priced in" — imported
// rather than reimplemented here, so this page can't drift out of sync
// with the buyer-facing pages again.
import { saleUnitLabel, round2 } from "../shared/packUnits.js";
import { resizedImageUrl } from "../utils/imageUrl.js";
import { useListings } from "../context/ListingsContext.jsx";

// const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#000000",
    secondary: "#000000",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};
const EASE = [0.16, 1, 0.3, 1];
const LOW_STOCK_THRESHOLD = 10;

// Attribute used to mark "this element is allowed to scroll while a
// modal-scroll-lock is active" — see useLenisScrollLock() below. Kept as
// a constant so the hook and every modal that opts in reference the same
// string instead of retyping it.
const SCROLL_LOCK_ALLOW_ATTR = "data-scroll-lock-allow";

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

// sample_quantity is persisted on the backend in BASE UNITS (Pieces/Kg/
// etc.) regardless of which basis (Unit/Pack/Master Pack) it was
// originally entered in — sample_unit_basis just records which of those
// three to display it back as. This converts a raw base-unit count back
// into that basis, so it's never shown (or, worse, re-saved) as if the
// base-unit number were already a Pack/Master-Pack count.
function baseUnitsToBasisQty(baseUnits, basis, packSize, masterPackSize) {
    const units = Number(baseUnits) || 0;
    const pack = Number(packSize) > 0 ? Number(packSize) : 1;
    const master = Number(masterPackSize) > 0 ? Number(masterPackSize) : 1;
    if (basis === "per_pack") return round2(units / pack);
    if (basis === "per_master_pack") return round2(units / (pack * master));
    return round2(units); // per_unit
}

function formatMoney(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* ---------------- skeletons ---------------- */

// Base shimmer block for skeletons. `w`/`h` are Tailwind width/height
// classes so each call site can shape it to whatever it's standing in for.
function Skeleton({ w = "w-full", h = "h-3", className = "" }) {
    return (
        <span
            className={`inline-block animate-pulse rounded-md ${w} ${h} ${className}`}
            style={{ background: C.hairSoft }}
        />
    );
}

// Mirrors ListingDetailModal's section-by-section layout.
function ListingDetailModalSkeleton() {
    return (
        <div className="flex flex-col gap-5 px-5 py-4">
            <Skeleton w="w-20" h="h-5" className="rounded-full" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: C.hairSoft }}>
                    <Skeleton w="w-24" h="h-2.5" className="mb-2.5" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <Skeleton h="h-3" />
                        <Skeleton h="h-3" />
                        <Skeleton h="h-3" w="w-2/3" />
                        <Skeleton h="h-3" w="w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Mirrors EditListingModal's form field stack while SellerListingForm's
// initial values are still loading.
function EditListingModalSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Skeleton w="w-14" h="h-14" className="rounded-xl" />
                <div className="flex-1"><Skeleton w="w-2/5" h="h-3.5" className="mb-1.5" /><Skeleton w="w-1/4" h="h-2.5" /></div>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                    <Skeleton w="w-24" h="h-2.5" className="mb-1.5" />
                    <Skeleton h="h-9" />
                </div>
            ))}
        </div>
    );
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
    const sampleBasis = s.sample_unit_basis || "per_unit";
    const gstPercent = s.gst_percent ?? 18;

    const wasGstInclusive = !!s.gst_inclusive;
    const rawBasePrice = s.base_price != null ? Number(s.base_price) : null;
    const displayBasePrice = rawBasePrice != null && wasGstInclusive
        ? Math.round(rawBasePrice * (1 + gstPercent / 100) * 100) / 100
        : rawBasePrice;

    return {
        productName: s.product_name || s.brand?.name || "",
        brandName: s.brand_name || s.brand?.brand_name || "",
        brandImage: s.brand?.image || null,
        brandNotApplicable: !s.brand_name,
        images: s.images?.length ? s.images : (s.image ? [s.image] : []),
        qualityCertificates: s.quality_certificates || [],
        noteToAdmin: s.note_to_admin || "",

        genericProductBrandId: s.generic_product_brand_id ?? s.genericProductBrandId ?? null,

        unit: s.unit || "",
        packSize: String(packSize),
        hasOuterPack: hasOuterPackLocal,
        masterPackSize: hasOuterPackLocal ? String(masterPackSize) : "0",

        hsnCode: s.hsn_code || "",
        gstPercent: s.gst_percent ?? 18,

        basePrice: s.base_price != null ? String(s.base_price) : "",
        // priceBasis: s.price_basis || (hasOuterPackLocal ? "per_master_pack" : "per_pack"),
        priceBasis: hasOuterPackLocal ? "per_master_pack" : "per_pack",
        // GST is always added on top now — the form no longer has an
        // inclusive/exclusive choice, so this is always false regardless
        // of whatever the row previously had stored.
        gstInclusive: false,
        freightIncluded: Boolean(s.freight_included),
        marketingCommissionPercent: s.marketing_commission_percent != null ? String(s.marketing_commission_percent) : "",

        sampleAvailable: Boolean(s.sample_available),
        // sample_quantity is stored in BASE UNITS, not in sampleBasis —
        // convert back to sampleBasis here so the edit form shows the
        // real quantity the seller meant (e.g. "2 Packs"), not the raw
        // base-unit count mislabeled as Packs (e.g. "20 Packs"), which
        // would also get re-multiplied on every subsequent save.
        sampleQuantity: s.sample_quantity != null
            ? String(baseUnitsToBasisQty(s.sample_quantity, sampleBasis, packSize, masterPackSize))
            : "",
        sampleUnitBasis: sampleBasis,

        priceSlabs: s.quantity_discounts || [],

        stockType: s.stock_type || "ready_stock",
        // stock_quantity is stored in the listing's canonical SALE UNIT
        // (Master Pack when this listing has an outer pack, Pack
        // otherwise) — the same convention MOQ uses. The number itself
        // needs no conversion; the basis just has to match what it's
        // already denominated in, or the unit-toggle math in
        // SellerListingForm ends up converting a correct number into a
        // wrong one the moment the seller touches the dropdown (or saves
        // without touching it, on a listing whose sale unit is Master
        // Pack but the basis here was left at "per_pack").
        stockQuantity: s.stock_quantity != null ? String(s.stock_quantity) : "",
        stockQuantityBasis: hasOuterPackLocal ? "per_master_pack" : "per_pack",
        productionLeadTimeDays: s.production_lead_time_days != null ? String(s.production_lead_time_days) : "",

        moq: s.moq != null ? String(s.moq) : "",

        dispatchDistrict: s.dispatch_district || "",
        dispatchState: s.dispatch_state || "",
        dispatchPincode: s.dispatch_pincode || "",
        // dispatching_locations is stored/returned as the flat persisted
        // array ({type:"country"|"state", ...}) — the SAME shape the
        // create-mode template-prefill effect in SellerListingForm.jsx
        // already has to unflatten before use. Edit mode needs the exact
        // same conversion, or DispatchingLocationsPicker sees a shape
        // with no .country, fails computeMissing, and silently resets to
        // a blank default the moment its section is opened.
        dispatchingLocations: unflattenDispatchingLocations(s.dispatching_locations),

        returnPolicyKey: s.return_policy_key || "",
        warrantyKey: s.warranty_key || "",
    };
}

function stockState(stock, moq) {
    if (stock == null) return "unknown";
    const moqNum = Number(moq) || 0;
    if (moqNum > 0 ? Number(stock) < moqNum : Number(stock) <= 0) return "out";
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
function WalletSummaryCard({ wallet, onClick }) {
    const isBlocked = wallet?.is_blocked;

    const balance = wallet
        ? `₹${(Number(wallet.balance_due) || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 0,
        })}`
        : "—";

    return (
        <button
            type="button"
            onClick={onClick}
            className="
                flex w-full max-w-[150px] min-w-0
                items-center gap-2.5
                rounded-xl px-3 py-2.5
                text-left
                transition-all duration-150
                hover:opacity-95
                active:scale-[0.98]
                sm:max-w-[190px]
                sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3
            "
            style={{
                background: isBlocked
                    ? "linear-gradient(135deg, #c71f11, #a11a10)"
                    : "linear-gradient(135deg, #047084, #0B7285)",
            }}
        >
            {/* Wallet Icon */}
            <span
                className="
                    flex h-8 w-8 shrink-0
                    items-center justify-center
                    rounded-lg bg-white/15
                    sm:h-9 sm:w-9
                "
            >
                <Wallet
                    className="h-[15px] w-[15px] text-white sm:h-[17px] sm:w-[17px]"
                    strokeWidth={2.2}
                />
            </span>

            {/* Wallet Info */}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-white/70 sm:text-[10px]">
                    {isBlocked ? "Orders paused" : "Wallet balance"}
                </span>

                {/* Amount + Navigation */}
                <span className="mt-1 flex items-center gap-1">
                    <span className="truncate text-[18px] font-black leading-none tracking-tight text-white sm:text-[20px]">
                        {balance}
                    </span>

                    <ChevronRight
                        className="h-4 w-4 shrink-0 text-white/65 sm:h-[17px] sm:w-[17px]"
                        strokeWidth={2.2}
                    />
                </span>
            </span>
        </button>
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

function ActiveToggle({ isActive, busy, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`Listing ${isActive ? "active" : "paused"}`}
            onClick={() => !busy && onChange(!isActive)}
            disabled={busy}
            className="group inline-flex items-center gap-2 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-60"
        >
            {/* Label */}
            <span className="flex min-w-[44px] flex-col items-end leading-none">
                <span
                    className="text-[10px] font-bold tracking-[0.02em]"
                    style={{ color: isActive ? C.secondary : "#7B858C" }}
                >
                    {isActive ? "Live" : "Paused"}
                </span>
            </span>

            {/* Switch */}
            <span
                className="relative flex h-5 w-10 shrink-0 items-center rounded-full p-0.5 transition-all duration-200"
                style={{
                    backgroundColor: isActive ? C.secondary : "#D9DEE2",
                }}
            >
                {busy ? (
                    <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                ) : (
                    <span
                        className="h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
                        style={{
                            transform: isActive ? "translateX(20px)" : "translateX(0px)",
                        }}
                    />
                )}
            </span>
        </button>
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

// Single source of truth for what "status" this listing is in, used to
// pick one badge (never more than one) — the seller should never have to
// reconcile two separate signals (an accent bar + a text pill) that might
// seem to disagree.
function getListingStatus(it, isActive, sState) {
    if (!isActive) return { label: "Paused", bg: C.hairSoft, fg: C.muted };
    if (it.review_status === "pending_review") return { label: "Pending review", bg: "#fef3c7", fg: "#b45309" };
    if (it.review_status === "rejected") return { label: "Rejected", bg: "#fee2e2", fg: "#c71f11" };
    if (sState === "out") return { label: "Out of stock", bg: "#fee2e2", fg: "#c71f11" };
    if (sState === "low") return { label: "Low stock", bg: "#fef3c7", fg: "#b45309" };
    return null; // live + healthy — no badge needed, a clean row IS the good-state signal
}

function RowIconButton({ icon: Icon, label, onClick, tone = C.ink, hoverBg = "rgba(11,17,22,0.05)" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: tone }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}


function ListingRow({
    it, idx, isHighlighted, isConfirmingDeactivate, togglingId,
    onOpenDetail, onEdit,
    onAskDeactivate, onCancelDeactivate, onConfirmDeactivate, onActivate,
    onOpenImage, onShare,
}) {
    const name = it.brand?.name || it.product_name || "Product";
    const brandName = it.brand?.brand_name || it.brand_name;
    const image = it.image || it.brand?.image;

    const gallery = it.images?.length
        ? it.images
        : it.brand?.images?.length
            ? it.brand.images
            : image
                ? [image]
                : [];

    const isActive = it.is_active !== false;
    const stock = it.stock_quantity;
    const sState = stockState(stock, it.moq);
    const isExpanded = isConfirmingDeactivate;
    const isPending = it.review_status === "pending_review";

    const saleUnit = saleUnitLabel(it.units_per_master_pack);
    const status = getListingStatus(it, isActive, sState);

    const stockLabel =
        sState === "out"
            ? "Out of stock"
            : stock != null
                ? `${stock} ${pluralizeUnit(stock, saleUnit)} left`
                : "Stock not set";

    const stockTone =
        sState === "out"
            ? "#c71f11"
            : sState === "low"
                ? "#b45309"
                : C.muted;

    // const handleToggle = (nextActive) => {
    //     if (nextActive) {
    //         onActivate(it.id);
    //     } else {
    //         onAskDeactivate(it.id);
    //     }
    // };

    const handleToggle = (nextActive) => {
        if (nextActive) {
            onActivate(it.id);
        } else {
            onConfirmDeactivate(it.id);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.18,
                delay: Math.min(idx * 0.012, 0.12),
                ease: EASE,
            }}
        >
            <motion.div
                animate={{
                    backgroundColor: isHighlighted
                        ? "rgba(253,243,216,1)"
                        : "rgba(253,243,216,0)",
                }}
                transition={{
                    duration: isHighlighted ? 0.18 : 1.2,
                    ease: "easeOut",
                }}
            >
                <div
                    onClick={() => {
                        if (!isExpanded) onOpenDetail(it);
                    }}
                    className="
                        group
                        px-3 py-2.5
                        sm:px-3.5 sm:py-2.5
                    "
                    style={{
                        opacity: isActive ? 1 : 0.58,
                        cursor: isExpanded ? "default" : "pointer",
                    }}
                >
                    {true && (
                        <>
                            {/* =====================================================
    MOBILE — flex row: image stretches to match the height
    of the text stack, text stack in the middle, icon stack
    on the right. No fixed row heights — everything sizes
    to its own content.
    ===================================================== */}
                            <div className="flex items-stretch gap-2.5 sm:hidden">
                                {/* Image — stretches to match the middle column's height */}
                                <div
                                    className="relative w-16 shrink-0 self-stretch overflow-hidden rounded-lg border"
                                    style={{ borderColor: C.hair, background: C.hairSoft }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (gallery.length) onOpenImage({ images: gallery, index: 0, alt: name });
                                    }}
                                >
                                    {image ? (
                                        <img
                                            src={resizedImageUrl(image, { width: 256 })}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <ImageIcon className="absolute inset-0 m-auto h-4 w-4" style={{ color: C.hair }} />
                                    )}
                                    {gallery.length > 1 && (
                                        <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1 py-0.5 text-[8px] font-bold tracking-wide text-white">
                                            +{gallery.length - 1}
                                        </span>
                                    )}
                                </div>

                                {/* Text stack */}
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <p className="min-w-0 truncate text-[13.5px] font-bold leading-tight tracking-wide" style={{ color: C.ink }}>
                                            {name}
                                        </p>
                                        {status && (
                                            <span
                                                className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                                                style={{ background: status.bg, color: status.fg }}
                                            >
                                                {status.label}
                                            </span>
                                        )}
                                    </div>

                                    <p className="min-w-0 truncate text-[10.5px] font-medium leading-tight tracking-wide" style={{ color: C.muted }}>
                                        {brandName ? `${brandName} · ` : ""}
                                        MOQ {it.moq} {pluralizeUnit(it.moq, saleUnit)}
                                        {it.lead_time != null && ` · ${it.lead_time}d`}
                                    </p>

                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="shrink-0 text-[13px] font-bold tracking-wide tabular-nums" style={{ color: C.ink }}>
                                            ₹{formatMoney(it.price)}
                                            <span className="ml-0.5 text-[9px] font-semibold tracking-wider" style={{ color: C.muted }}>/{saleUnit}</span>
                                        </span>
                                        <span className="h-3 w-px shrink-0" style={{ background: C.hair }} />
                                        <p className="min-w-0 truncate text-[10.5px] font-bold tracking-wide tabular-nums" style={{ color: isActive ? stockTone : C.muted }}>
                                            {isActive ? stockLabel : "Hidden from buyers"}
                                        </p>
                                    </div>
                                </div>

                                {/* Icon stack — toggle on top, share + edit together in one row below */}
                                <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                                    {!isPending ? (
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ActiveToggle isActive={isActive} busy={togglingId === it.id} onChange={handleToggle} />
                                        </div>
                                    ) : <span />}

                                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                        <RowIconButton icon={Share2} label="Share listing" tone={C.muted} onClick={() => onShare?.(it)} />
                                        {!isPending && (
                                            <RowIconButton icon={Pencil} label="Edit listing" tone={C.secondary} onClick={() => onEdit(it.id)} />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Rejection message — mobile only, full width below the grid */}
                            {it.rejection_reason && it.review_status === "rejected" && (
                                <p className="mt-2 ml-[3.05rem] text-[10.5px] font-semibold leading-snug tracking-wide sm:hidden" style={{ color: "#c71f11" }}>
                                    {it.rejection_reason}
                                </p>
                            )}

                            {/* =====================================================
            DESKTOP — unchanged layout, with a Share icon added
            before the live toggle / edit group.
            ===================================================== */}
                            <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
                                {/* Image */}
                                <div
                                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border"
                                    style={{ borderColor: C.hair, background: C.hairSoft }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (gallery.length) onOpenImage({ images: gallery, index: 0, alt: name });
                                    }}
                                >
                                    {image ? (
                                        <img src={resizedImageUrl(image, { width: 70 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageIcon className="m-auto h-4 w-4" style={{ color: C.hair }} />
                                    )}
                                    {gallery.length > 1 && (
                                        <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1 py-0.5 text-[8px] font-bold tracking-wide text-white">
                                            +{gallery.length - 1}
                                        </span>
                                    )}
                                </div>

                                {/* Identity */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <p className="min-w-0 truncate text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>{name}</p>
                                        {status && (
                                            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider" style={{ background: status.bg, color: status.fg }}>
                                                {status.label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 truncate text-[10.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                                        {brandName ? `${brandName} · ` : ""}
                                        MOQ {it.moq} {pluralizeUnit(it.moq, saleUnit)}
                                        {it.lead_time != null && ` · ${it.lead_time}d`}
                                    </p>
                                </div>

                                {/* Price + stock */}
                                <div className="flex shrink-0 items-center gap-3">
                                    <div className="text-right">
                                        <p className="leading-none">
                                            <span className="text-[14px] font-bold tracking-wide tabular-nums" style={{ color: C.ink }}>₹{formatMoney(it.price)}</span>
                                            <span className="ml-0.5 text-[9.5px] font-semibold tracking-wider" style={{ color: C.muted }}>/{saleUnit}</span>
                                        </p>
                                        <p className="mt-1 whitespace-nowrap text-[10px] font-bold tracking-wide tabular-nums" style={{ color: isActive ? stockTone : C.muted }}>
                                            {isActive ? stockLabel : "Hidden from buyers"}
                                        </p>
                                    </div>

                                    <div className="h-7 w-px" style={{ background: C.hair }} />

                                    <div onClick={(e) => e.stopPropagation()}>
                                        <RowIconButton icon={Share2} label="Share listing" tone={C.muted} onClick={() => onShare?.(it)} />
                                    </div>

                                    {!isPending && (
                                        <>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <ActiveToggle isActive={isActive} busy={togglingId === it.id} onChange={handleToggle} />
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <RowIconButton icon={Pencil} label="Edit listing" tone={C.secondary} onClick={() => onEdit(it.id)} />
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0 opacity-40 transition-opacity group-hover:opacity-80" style={{ color: C.ink }} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* =============================================================
                        EXPANDED PANELS
                        ============================================================= */}
                    <AnimatePresence mode="wait">
                        {isConfirmingDeactivate && (
                            <motion.div
                                key="confirm"
                                initial={{
                                    opacity: 0,
                                    height: 0,
                                }}
                                animate={{
                                    opacity: 1,
                                    height: "auto",
                                }}
                                exit={{
                                    opacity: 0,
                                    height: 0,
                                }}
                                transition={{
                                    duration: 0.18,
                                }}
                            >
                                <DeactivateConfirm
                                    busy={
                                        togglingId === it.id
                                    }
                                    onConfirm={() =>
                                        onConfirmDeactivate(
                                            it.id
                                        )
                                    }
                                    onCancel={
                                        onCancelDeactivate
                                    }
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Row separator */}
                <div
                    className="h-px w-full"
                    style={{
                        background: C.hairSoft,
                    }}
                />
            </motion.div>
        </motion.div>
    );
}

/* ============================ detail modal ============================ */

// Hijacks scroll away from Lenis (and native scroll) while a modal is
// mounted, and hands it back to the foreground modal's own content.
//
// HOW THIS WORKS, and the two bugs already found while getting here:
//
// Bug #1 (fixed by removing this page's redundant local
// <SmoothScrollProvider> — see the import comment above): useLenis() was
// resolving to a second, decoy Lenis instance, so lenis.stop() was
// pausing an instance that wasn't actually driving page scroll. The real
// instance (from main.jsx) kept running untouched, which is why
// background scroll kept leaking through no matter what the lock did.
//
// Bug #2: with the duplicate gone, lenis.stop() now DOES
// target the real instance — but Lenis (configured with no `wrapper` in
// SmoothScrollProvider.jsx, so it controls `window` globally) listens
// for wheel/touch events EVERYWHERE on the page and calls
// preventDefault() on them itself, independent of our own listeners.
// That includes wheel events over the modal's own inner scrollable div —
// Lenis has no idea that div is supposed to be exempt, so it was
// swallowing that scroll too, which is why scrolling stopped completely,
// including inside the modal. Lenis's documented escape hatch for this
// is the `data-lenis-prevent` attribute: any element carrying it is left
// alone by Lenis's own listeners. Both modals' scrollable containers now
// carry it (see ListingDetailModal / EditListingModal below).
//
// Our OWN window-level, capture-phase wheel/touchmove/keydown listeners
// are still layered on top as a second, independent safety net — for
// whatever native browser scroll fallback happens on stopped-Lenis
// elements that AREN'T marked data-lenis-prevent (i.e. the actual
// background). They use the exact same selector so the two layers never
// disagree about what's "inside" vs "outside" the modal.
//
// Every decision point below logs to the console (grouped/throttled so a
// scroll gesture doesn't spam thousands of lines) — open devtools while
// reproducing and check for:
//   [useLenisScrollLock] lenis instance: <object|null>
//   [useLenisScrollLock] marked allow-list elements found: <N>
//   [useLenisScrollLock] wheel target=... allowed=true/false
// If `lenis instance` logs null, useLenis() still isn't finding the
// provider. If "marked allow-list elements found" is 0, the attribute
// isn't rendering where expected. If wheel events over the modal log
// allowed=false, the selector/DOM nesting is the remaining problem.
const SCROLL_LOCK_ALLOW_SELECTOR = "[data-lenis-prevent], [data-scroll-lock-allow]";

let __scrollLockLastLogAt = 0;
function scrollLockLog(...args) {
    const now = Date.now();
    if (now - __scrollLockLastLogAt < 200) return; // throttle — wheel fires very fast
    __scrollLockLastLogAt = now;
    // eslint-disable-next-line no-console
    console.log("[useLenisScrollLock]", ...args);
}

function useLenisScrollLock() {
    const lenis = useLenis();

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log("[useLenisScrollLock] MOUNT — lenis instance:", lenis, "stop() available:", typeof lenis?.stop === "function");
        // eslint-disable-next-line no-console
        console.log("[useLenisScrollLock] allow-list elements currently in DOM:", document.querySelectorAll(SCROLL_LOCK_ALLOW_SELECTOR).length);

        if (lenis) {
            // eslint-disable-next-line no-console
            console.log("[useLenisScrollLock] calling lenis.stop()");
            lenis.stop();
        } else {
            // eslint-disable-next-line no-console
            console.warn("[useLenisScrollLock] no lenis instance from context — only the window-level event blocking below will apply, and Lenis itself (if it exists elsewhere) is NOT stopped.");
        }

        const isInsideAllowedArea = (e) => !!e.target?.closest?.(SCROLL_LOCK_ALLOW_SELECTOR);

        const blockScroll = (e) => {
            const allowed = isInsideAllowedArea(e);
            scrollLockLog(e.type, "target=", e.target?.tagName, e.target?.className || "", "allowed=", allowed);
            if (!allowed) e.preventDefault();
        };

        const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
        const blockKeyScroll = (e) => {
            if (!SCROLL_KEYS.includes(e.key)) return;
            const allowed = isInsideAllowedArea(e);
            // eslint-disable-next-line no-console
            console.log("[useLenisScrollLock] keydown", e.key, "target=", e.target?.tagName, "allowed=", allowed);
            if (allowed) return;
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
            e.preventDefault();
        };

        window.addEventListener("wheel", blockScroll, { passive: false, capture: true });
        window.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
        window.addEventListener("keydown", blockKeyScroll, { passive: false, capture: true });

        return () => {
            // eslint-disable-next-line no-console
            console.log("[useLenisScrollLock] UNMOUNT — restoring scroll, lenis.start() available:", typeof lenis?.start === "function");
            if (lenis) lenis.start();

            window.removeEventListener("wheel", blockScroll, { capture: true });
            window.removeEventListener("touchmove", blockScroll, { capture: true });
            window.removeEventListener("keydown", blockKeyScroll, { capture: true });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lenis]);
}

function ListingDetailModal({ token, submissionId, onClose, onEdit }) {
    useLenisScrollLock();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [initialValues, setInitialValues] = useState(null);
    const [brandDisplay, setBrandDisplay] = useState(null);
    const [statusMeta, setStatusMeta] = useState(null); // review_status / is_active / rejection_reason for the banner

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
            setStatusMeta({
                reviewStatus: s.review_status,
                isActive: s.is_active !== false,
                rejectionReason: s.rejection_reason,
            });
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [token, submissionId]);

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-2.5 sm:p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" style={{ height: "92vh" }}>
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-3.5" style={{ borderColor: C.hairSoft }}>
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>Listing details</h3>
                        <p className="text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                            What you submitted for this product — tap Edit to make changes.
                        </p>
                    </div>
                    <button onClick={onClose} className="shrink-0 rounded-full p-1.5 transition-colors duration-150 hover:bg-black/[0.05]" style={{ color: C.muted }}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div
                    className="flex-1 overflow-y-auto px-5 py-4"
                    style={{ minHeight: 0, overscrollBehavior: "contain" }}
                    data-scroll-lock-allow=""
                    data-lenis-prevent=""
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {loading ? (
                            <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                <EditListingModalSkeleton />
                            </motion.div>
                        ) : error ? (
                            <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="py-8 text-center text-[13px] font-semibold" style={{ color: "#c71f11" }}>
                                {error}
                            </motion.p>
                        ) : initialValues ? (
                            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                                {/* Status banner — same badge language ListingRow already uses,
                                    so "what state is this listing in" reads consistently
                                    across the list and this detail view. */}
                                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{
                                        background: statusMeta.reviewStatus === "approved" ? "#dcfce7" : statusMeta.reviewStatus === "rejected" ? "#fee2e2" : "#fef3c7",
                                        color: statusMeta.reviewStatus === "approved" ? "#15803d" : statusMeta.reviewStatus === "rejected" ? "#b91c1c" : "#a16207",
                                    }}>
                                        {statusMeta.reviewStatus === "approved" ? "Approved" : statusMeta.reviewStatus === "rejected" ? "Rejected" : "Pending review"}
                                    </span>
                                    {!statusMeta.isActive && (
                                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: C.hairSoft, color: C.muted }}>
                                            Hidden from buyers
                                        </span>
                                    )}
                                </div>
                                {statusMeta.rejectionReason && (
                                    <p className="mb-3 rounded-lg px-3 py-2 text-[11.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: "#c71f11" }}>
                                        Rejected: {statusMeta.rejectionReason}
                                    </p>
                                )}

                                <SellerListingForm
                                    mode="edit"
                                    identityReadOnly
                                    readOnly
                                    brandDisplay={brandDisplay}
                                    initialValues={initialValues}
                                    onSubmit={() => { }}
                                    onEdit={onEdit}
                                    onClose={onClose}
                                    stickyBottomClassName="-bottom-4"
                                />
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

/* ============================== main page ============================== */

// These chips no longer filter which listings are shown (that used to be
// status: Live/Paused/Pending/Rejected). Instead they pick which section
// of the full SellerListingForm opens when the pencil icon is next
// tapped — so a seller who only wants to touch pricing across several
// listings can select "Tax & Pricing" once and then edit each listing's
// price without the rest of the form's fields adding noise. Keys must
// line up with whatever SellerListingForm.jsx's `onlySection` prop
// expects internally — see the header comment at the top of this file.
const SECTION_FILTERS = [
    { key: "all", label: "All" },
    // { key: "identity", label: "Identity" },
    { key: "packaging", label: "Packaging" },
    { key: "pricing", label: "Tax & Pricing" },
    { key: "fulfilment", label: "Fulfilment" },
    { key: "dispatch", label: "Dispatch" },
    { key: "policies", label: "Policies" },
];

function getSectionLabel(key) {
    return SECTION_FILTERS.find((s) => s.key === key)?.label || "";
}

export default function SellerManageListingsPage() {
    const { token, profile, registerResyncHandler, refreshProfile } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const { reportRestockCount, reportWallet, markListingsViewed, markWalletTopupViewed, reloadWallet } = useListings();

    const [wallet, setWallet] = useState(null);

    const [highlightedIds, setHighlightedIds] = useState(new Set());

    const [items, setItems] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);

    const [editingId, setEditingId] = useState(null);

    const [query, setQuery] = useState("");
    // Which SellerListingForm section opens when a listing's pencil icon
    // is tapped next — "all" opens the full form, as before.
    const [activeSection, setActiveSection] = useState("all");
    const [needsRestockOnly, setNeedsRestockOnly] = useState(false);

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

    // This is now the ONLY network request the page needs on open — see
    // the "PERFORMANCE FIX" note at the top of this file for what used to
    // fire alongside it.
    const reload = useCallback(({ silent } = {}) => {
        if (!token || !isApprovedSeller) { setLoading(false); return; }
        if (!silent) setLoading(true); else setRefreshing(true);
        fetchMySellerSubmissions(token).then((res) => {
            if (res?.success) { setItems(res.items || []); setLastSynced(new Date()); }
            setLoading(false); setRefreshing(false);
        });
    }, [token, isApprovedSeller]);

    useEffect(() => { reload(); }, [reload]);

    // Listens directly on the real socket.io-client connection, same as
    // useRealtimeNotifications.js already does successfully.
    useEffect(() => {
        if (!socket) return;
        const onSubmissionsChanged = () => reload({ silent: true });
        socket.on("submissions_changed", onSubmissionsChanged);
        return () => socket.off("submissions_changed", onSubmissionsChanged);
    }, [socket, reload]);

    useEffect(() => registerResyncHandler?.(() => reload({ silent: true })), [registerResyncHandler, reload]);

    // Safety net — catches stock/order changes that happened while this
    // tab wasn't focused, in case the realtime channel above missed them.
    useEffect(() => {
        function onVisible() { if (document.visibilityState === "visible") reload({ silent: true }); }
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    }, [reload]);

    // Alongside the existing reload-on-mount effect — same load pattern,
    // just for the wallet snapshot this header chip needs.
    useEffect(() => {
        if (!token || !isApprovedSeller) return;
        fetchWalletStatus(token).then((res) => { if (res?.success) setWallet(res.wallet); });
    }, [token, isApprovedSeller]);

    const stats = useMemo(() => {
        const total = items.length;
        const live = items.filter((it) => it.is_active !== false && it.review_status === "approved").length;
        const low = items.filter((it) => stockState(it.stock_quantity, it.moq) === "low").length;
        const out = items.filter((it) => stockState(it.stock_quantity, it.moq) === "out").length;
        const pending = items.filter((it) => it.review_status === "pending_review").length;
        const rejected = items.filter((it) => it.review_status === "rejected").length;
        const paused = items.filter((it) => it.is_active === false).length;
        return { total, live, low, out, pending, rejected, paused };
    }, [items]);

    const filtered = useMemo(() => {
        let list = items;

        if (needsRestockOnly) list = list.filter((it) => stockState(it.stock_quantity, it.moq) !== "ok");

        const term = query.trim().toLowerCase();
        if (term) {
            list = list.filter((it) => {
                const name = (it.brand?.name || it.product_name || "").toLowerCase();
                const brand = (it.brand?.brand_name || it.brand_name || "").toLowerCase();
                return name.includes(term) || brand.includes(term);
            });
        }
        return list;
    }, [items, needsRestockOnly, query]);

    useEffect(() => {
        markListingsViewed().then((ids) => {
            if (!ids.length) return;
            setHighlightedIds(new Set(ids));
            const t = setTimeout(() => setHighlightedIds(new Set()), 5000);
            return () => clearTimeout(t);
        });
    }, [markListingsViewed]);

    useEffect(() => {
        reportRestockCount(stats.low + stats.out); // stats is already computed above via useMemo
    }, [stats.low, stats.out, reportRestockCount]);

    useEffect(() => {
        if (wallet) reportWallet(wallet);
    }, [wallet, reportWallet]);

    function patchItem(id, patch) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    }

    async function handleShare(it) {
        const name = it.brand?.name || it.product_name || "Product";
        const sellerName = profile?.shop_name || profile?.name || "this seller";
        const result = await shareProductLink({
            submissionId: it.id,
            productName: name,
            sellerName,
        });
        if (result === "copied") setToastMsg("Link copied to clipboard.");
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

    // Opens the real edit form directly for a listing — used by the row's
    // pencil icon and by the (read-only) detail modal's own Edit action,
    // so both paths always land on the editable form, never a
    // read-only stop first.
    function openEditModal(id) {
        setViewingId(null);
        setEditingId(id);
    }

    if (!isApprovedSeller) {
        if (profile?.seller_status === "pending_review") {
            // This branch is now effectively dead for brand-new sellers
            // (nothing sets "pending_review" anymore), but harmless to
            // leave in case older rows or a manual admin action still use
            // that status.
            return (
                <>
                    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
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
        // form directly. On submit, the seller is now auto-approved
        // server-side; refreshProfile() pulls that updated status into
        // AuthContext so this same component re-renders as the real
        // dashboard below instead of the onboarding form.
        return (
            <>
                <SellerOnboardingForm onSubmitted={() => refreshProfile?.()} />
                <Toast message={toastMsg} show={!!toastMsg} onDone={() => setToastMsg(null)} />
            </>
        );
    }

    return (
        <div className="min-h-screen bg-[#FFFFFF] text-slate-900 antialiased">
            {/* No local <SmoothScrollProvider> here anymore — see import
                comment above. This page just renders under the single
                global instance main.jsx already provides. */}
            <main className="mx-auto max-w-7xl px-2.5 pb-24 pt-5 sm:px-4 lg:px-6">

                <div className="grid grid-cols-2 items-end gap-3 sm:gap-6 ps-2">
                    {/* Left */}
                    <div className="min-w-0">
                        <h1
                            className="text-[22px] font-black leading-tight tracking-tight sm:text-[28px]"
                            style={{ color: C.ink }}
                        >
                            My Products
                        </h1>

                        <p
                            className="mt-1 text-[12px] font-semibold leading-tight tracking-wide sm:text-[13px]"
                            style={{ color: C.muted }}
                        >
                            {stats.total} listing{stats.total === 1 ? "" : "s"}
                            <span className="mx-1">·</span>
                            {stats.live} live
                        </p>
                    </div>

                    {/* Right */}
                    <div className="flex justify-end">
                        <WalletSummaryCard
                            wallet={wallet}
                            onClick={async () => {
                                await markWalletTopupViewed();
                                navigate("/seller/wallet");
                            }}
                        />
                    </div>
                </div>

                {/* search + filters */}
                <div className="mt-4 flex flex-col gap-3">

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your listings by product or brand…"
                            className="w-full rounded-full border bg-white tracking-wide py-2.5 pl-10 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2"
                            style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }}
                        />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {SECTION_FILTERS.map((f) => (
                            <FilterChip
                                key={f.key}
                                label={f.label}
                                active={activeSection === f.key}
                                onClick={() => setActiveSection(f.key)}
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
                                isHighlighted={highlightedIds.has(it.id)}
                                isConfirmingDeactivate={confirmDeactivateId === it.id}
                                togglingId={togglingId}
                                onOpenDetail={(item) => openEditModal(item.id)}
                                onEdit={openEditModal}
                                onAskDeactivate={(id) => setConfirmDeactivateId(id)}
                                onCancelDeactivate={() => setConfirmDeactivateId(null)}
                                onConfirmDeactivate={confirmDeactivate}
                                onActivate={activateListing}
                                onOpenImage={setLightboxImage}
                                onShare={handleShare}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </main>

            {lightboxImage && createPortal(
                <ImageLightbox images={lightboxImage.images} initialIndex={lightboxImage.index} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />,
                document.body
            )}

            {editingId && createPortal(
                <EditListingModal
                    token={token}
                    submissionId={editingId}
                    focusSection={activeSection === "all" ? null : activeSection}
                    onClose={() => setEditingId(null)}
                    onSaved={(id, submission, message) => {
                        patchItem(id, submission);
                        setEditingId(null);
                        setToastMsg(message);
                    }}
                />,
                document.body
            )}

            <Toast message={toastMsg} show={!!toastMsg} onDone={() => setToastMsg(null)} />
            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}