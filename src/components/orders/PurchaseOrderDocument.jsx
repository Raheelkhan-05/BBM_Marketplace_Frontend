// components/orders/PurchaseOrderDocument.jsx
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { transportLabel } from "../../../shared/transportOptions.js";
import { ItemQuantityLine, displayAmount } from "./OrderDisplayHelpers.jsx";

const C = { ink: "#0B1116", muted: "#667077", hair: "rgba(11,17,22,0.12)", accent: "#0B7285" };

// Standard GST rate. Matches the 18% figure already used elsewhere in this
// codebase (see the "0.25% commission + 18% GST" wallet-deduction line in
// SellerOrderDetailPage / SalesOrderCard). Since order.total_amount is NOT
// currently charged with GST on top (the platform only taxes its own
// commission), this is treated as a back-calculated breakup of the existing
// total for invoicing/documentation purposes — it never changes what the
// buyer actually owes. If you instead want GST added ON TOP as a real extra
// charge, this needs to change (ask before flipping this, since it changes
// amounts shown as due).
const GST_PERCENT = 18;

function fmtDate(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Handles the (min, max) estimated-delivery-date pair the same way the
// backend's own daysFromDistance/estimateDeliveryDate logic produces it.
// Falls back to "Pending confirmation" rather than a blank dash so it's
// clear this isn't a rendering bug — if this keeps showing "Pending
// confirmation" for orders that DO have a delivery estimate elsewhere in
// the app, the order-fetch endpoint backing this page isn't returning
// estimated_delivery_date / estimated_delivery_date_max.
function deliveryDateLabel(order) {
    const minLabel = fmtDate(order.estimated_delivery_date);
    if (!minLabel) return "Pending confirmation";
    const maxLabel = fmtDate(order.estimated_delivery_date_max);
    if (maxLabel && maxLabel !== minLabel) return `${minLabel} – ${maxLabel}`;
    return minLabel;
}

function inr(n) {
    return (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function transportSummary(order) {
    if (order.transport_mode) return { confirmed: true, label: transportLabel(order.transport_mode) };
    if (order.buyer_transport_mode) return { confirmed: false, label: transportLabel(order.buyer_transport_mode), requested: true };
    return { confirmed: false, label: null };
}

// Back-calculates a GST breakup from an amount that already includes GST
// (see GST_PERCENT comment above for why). Returns the pre-tax taxable
// value plus CGST/SGST (intra-state) and IGST (inter-state) components —
// the caller picks whichever pair applies.
function gstBreakup(totalInclGst) {
    const taxable = round2(totalInclGst / (1 + GST_PERCENT / 100));
    const gstAmount = round2(totalInclGst - taxable);
    const half = round2(gstAmount / 2);
    return { taxable, cgst: half, sgst: round2(gstAmount - half), igst: gstAmount };
}

function TotalRow({ label, value, bold, color }) {
    return (
        <div className="flex w-full max-w-[280px] justify-between text-[12.5px] font-semibold" style={{ color: color || C.muted }}>
            <span className={bold ? "font-extrabold" : ""}>{label}</span>
            <span className={`tabular-nums ${bold ? "font-extrabold" : ""}`} style={{ color: bold ? C.ink : (color || C.ink) }}>{value}</span>
        </div>
    );
}

export default function PurchaseOrderDocument({ order, variant = "buyer", vendorOverride = null }) {
    const [downloading, setDownloading] = useState(false);
    if (!order) return null;

    const addr = order.shipping_address_snapshot || {};
    const items = order.items || [];
    const transport = transportSummary(order);
    const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const isBuyerView = variant === "buyer";
    const isSample = order.order_type === "sample";

    // order.seller is populated on the buyer's fetch (live join). On the
    // seller's own order fetch there's no such join (they know their own
    // shop), so vendorOverride — sourced from the logged-in seller's own
    // profile — fills that gap. See SellerOrderDetailPage.jsx for where
    // this comes from.
    const vendor = order.seller || vendorOverride || null;
    const vendorName = vendor?.display_name || (isBuyerView ? "—" : "Your Shop");
    const vendorLocation = [vendor?.city, vendor?.state].filter(Boolean).join(", ");
    const deliverToName = addr.contact_name || order.buyer_contact_name || "";

    const sellerState = vendor?.state || null;
    const buyerState = addr.state || null;
    const isIntraState = !!(sellerState && buyerState && sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase());
    const gst = gstBreakup(Number(order.total_amount) || 0);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const { generateOrderPdf } = await import("../../utils/orderPdf.js");
            await generateOrderPdf(order, { vendor });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.hair }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: C.hair, background: "#fafbfb" }}>
                <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: C.accent }}>
                        {isBuyerView ? "Your Purchase Order" : "Purchase Order Received"}
                    </p>
                    <h3 className="mt-0.5 text-[16px] font-extrabold tracking-wide" style={{ color: C.ink }}>PURCHASE ORDER</h3>
                </div>
                <button onClick={handleDownload} disabled={downloading}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-bold tracking-wide"
                    style={{ borderColor: C.accent, color: C.accent }}>
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download PDF
                </button>
            </div>

            <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b pb-4 sm:grid-cols-4" style={{ borderColor: C.hair }}>
                    <MetaField label="Order No." value={order.order_number} mono />
                    <MetaField label="Date" value={fmtDate(order.created_at) || "—"} />
                    <MetaField label="Delivery Date" value={deliveryDateLabel(order)} />
                    <MetaField label="Transport" value={transport.label ? `${transport.label}${transport.confirmed ? "" : " (requested)"}` : "To be decided"} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 border-b pb-4 sm:grid-cols-2" style={{ borderColor: C.hair }}>
                    <div>
                        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: C.muted }}>Vendor (Seller)</p>
                        <p className="mt-1 text-[14px] font-extrabold tracking-wide" style={{ color: C.ink }}>{vendorName}</p>
                        {vendorLocation && <p className="text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>{vendorLocation}</p>}
                    </div>
                    <div>
                        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: C.muted }}>Deliver To</p>
                        <p className="mt-1 text-[14px] font-extrabold tracking-wide" style={{ color: C.ink }}>{deliverToName}</p>
                        {order.buyer_business_name && (
                            <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                {order.buyer_business_name}{order.buyer_gstin ? ` · ${order.buyer_gstin}` : ""}
                            </p>
                        )}
                        <p className="text-[12px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                            {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                    </div>
                </div>

                {/* Desktop table */}
                <div className="mt-4 hidden overflow-hidden rounded-lg border sm:block" style={{ borderColor: C.hair }}>
                    <table className="w-full text-[12.5px]">
                        <thead>
                            <tr style={{ background: "#f3f5f5" }}>
                                <Th className="w-10">Sr</Th>
                                <Th>Description of Goods</Th>
                                <Th className="w-40">Qty</Th>
                                <Th className="w-24 text-right">Rate</Th>
                                <Th className="w-28 text-right">Amount</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, i) => (
                                <tr key={it.id || i} className="border-t align-top" style={{ borderColor: C.hair }}>
                                    <Td>{i + 1}</Td>
                                    <Td>
                                        <span className="font-bold" style={{ color: C.ink }}>{it.product_name_snapshot}</span>
                                        {it.brand_name_snapshot && <span className="ml-1 font-medium" style={{ color: C.muted }}>({it.brand_name_snapshot})</span>}
                                    </Td>
                                    <Td><ItemQuantityLine item={it} mutedColor={C.muted} /></Td>
                                    <Td className="text-right tabular-nums">{displayAmount(it.unit_price, { isSample })}</Td>
                                    <Td className="text-right tabular-nums font-bold">{displayAmount(it.line_total, { isSample })}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile stacked rows */}
                <div className="mt-4 flex flex-col gap-2 sm:hidden">
                    {items.map((it, i) => (
                        <div key={it.id || i} className="rounded-lg border p-2.5" style={{ borderColor: C.hair }}>
                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>{i + 1}. {it.product_name_snapshot}</p>
                            <div className="mt-1 flex items-center justify-between text-[11.5px] font-semibold" style={{ color: C.muted }}>
                                <span><ItemQuantityLine item={it} mutedColor={C.muted} /> × {displayAmount(it.unit_price, { isSample })}</span>
                                <span className="font-extrabold" style={{ color: C.ink }}>{displayAmount(it.line_total, { isSample })}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex flex-col items-end gap-1">
                    <TotalRow label="Total Qty" value={totalQty} />
                    {isSample ? (
                        <TotalRow label="Total" value={displayAmount(order.total_amount, { isSample })} bold />
                    ) : (
                        <>
                            <TotalRow label="Taxable Value" value={`₹${inr(gst.taxable)}`} />
                            {isIntraState ? (
                                <>
                                    <TotalRow label={`CGST (${GST_PERCENT / 2}%)`} value={`₹${inr(gst.cgst)}`} />
                                    <TotalRow label={`SGST (${GST_PERCENT / 2}%)`} value={`₹${inr(gst.sgst)}`} />
                                </>
                            ) : (
                                <TotalRow label={`IGST (${GST_PERCENT}%)`} value={`₹${inr(gst.igst)}`} />
                            )}
                            <div className="mt-1 flex w-full max-w-[280px] justify-between border-t pt-1.5 text-[14px] font-extrabold" style={{ borderColor: C.hair, color: C.ink }}>
                                <span>Total Payable</span><span className="tabular-nums" style={{ color: C.accent }}>{displayAmount(order.total_amount, { isSample })}</span>
                            </div>
                            <p className="mt-1 max-w-[280px] text-right text-[10.5px] font-medium italic" style={{ color: C.muted }}>
                                GST shown is a breakup of the total at the standard {GST_PERCENT}% rate, for invoicing reference.
                            </p>
                        </>
                    )}
                </div>

                {order.buyer_notes && (
                    <div className="mt-4 border-t pt-3" style={{ borderColor: C.hair }}>
                        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: C.muted }}>Notes</p>
                        <p className="mt-1 text-[12.5px] font-medium italic" style={{ color: C.ink }}>"{order.buyer_notes}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetaField({ label, value, mono }) {
    return (
        <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>{label}</p>
            <p className={`text-[12.5px] font-bold tracking-wide ${mono ? "font-mono" : ""}`} style={{ color: C.ink }}>{value || "—"}</p>
        </div>
    );
}
function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide ${className}`} style={{ color: C.muted }}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-3 py-2 ${className}`} style={{ color: C.ink }}>{children}</td>;
}