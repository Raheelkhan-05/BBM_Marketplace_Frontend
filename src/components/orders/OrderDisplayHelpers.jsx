// components/orders/OrderDisplayHelpers.jsx
//
// Shared presentational helpers for the four order-facing pages
// (PurchaseOrdersPage, SalesOrdersPage, OrderDetailPage,
// SellerOrderDetailPage) so status/quantity/price/delivery formatting is
// defined once instead of drifting across four separate implementations.
import { Calendar } from "lucide-react";

export const STATUS_STYLE = {
    pending_confirmation: { bg: "#f59e0b14", fg: "#b45309", label: "Awaiting seller" },
    confirmed: { bg: "#006F8314", fg: "#006F83", label: "Confirmed" },
    processing: { bg: "#006F8314", fg: "#006F83", label: "Processing" },
    shipped: { bg: "#7c3aed14", fg: "#7c3aed", label: "Shipped" },
    delivered: { bg: "#05966914", fg: "#059669", label: "Delivered" },
    cancelled: { bg: "#64748b14", fg: "#64748b", label: "Cancelled" },
    rejected: { bg: "#D2462B14", fg: "#D2462B", label: "Rejected" },
};

export function StatusChip({ status, size = "sm" }) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending_confirmation;
    return (
        <span
            className={`shrink-0 rounded-full font-extrabold capitalize tracking-wide ${size === "lg" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10.5px]"}`}
            style={{ background: s.bg, color: s.fg }}
        >
            {s.label}
        </span>
    );
}

export function SampleBadge({ size = "sm" }) {
    return (
        <span className={`flex shrink-0 items-center gap-1 rounded-full font-extrabold tracking-wide ${size === "lg" ? "px-2.5 py-1 text-[10.5px]" : "px-2 py-0.5 text-[9.5px]"}`} style={{ background: "#7c3aed14", color: "#7c3aed" }}>
            Sample
        </span>
    );
}

export function basisLabel(basis) {
    if (basis === "per_pack") return "pack";
    if (basis === "per_master_pack") return "master pack";
    return null;
}

// Renders "12 master packs (600 pcs)" when pack data exists, otherwise
// falls back to the raw unit quantity for orders placed before the
// pack_quantity_snapshot column existed.
export function ItemQuantityLine({ item, mutedColor = "#667077" }) {
    const bLabel = basisLabel(item.purchase_basis);
    if (bLabel && item.pack_quantity_snapshot != null) {
        const packQty = item.pack_quantity_snapshot;
        return (
            <span>
                {packQty} {bLabel}{Number(packQty) === 1 ? "" : "s"}
                <span style={{ color: mutedColor }}> ({item.quantity} {item.unit})</span>
            </span>
        );
    }
    return <span>{item.quantity} {item.unit}</span>;
}

// lead_time_snapshot holds the RPC-computed "DD Mon" estimated delivery
// date string for orders placed after this rollout; older orders may
// still carry the previous free-text lead-time value, in which case we
// just don't render anything.
export function looksLikeDeliveryDate(value) {
    return typeof value === "string" && /^\d{2}\s[A-Za-z]{3}$/.test(value);
}

export function DeliveryEstimate({ date, label = "Estimated delivery", accent = "#006F83" }) {
    if (!looksLikeDeliveryDate(date)) return null;
    return (
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: accent }}>
            <Calendar className="h-3 w-3" /> {label}: {date}
        </p>
    );
}

// A genuinely free sample should read as "Free", not "₹0" — and this
// stays readable even for older orders placed before the DB constraint
// fix that still carry the nominal ₹0.01 floor.
export function displayAmount(amount, { isSample = false } = {}) {
    const n = Number(amount) || 0;
    if (isSample && n <= 0.01) return "Free";
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function StockShortfallNote({ audience = "buyer" }) {
    const text = audience === "seller"
        ? "Ordered quantity exceeded your listed stock at the time of order — let the buyer know if fulfilment will take longer."
        : "This item was short on stock when ordered — it may take a little longer to fulfil.";
    return (
        <p className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold leading-snug" style={{ background: "#fef3c7", color: "#a16207" }}>
            {text}
        </p>
    );
}