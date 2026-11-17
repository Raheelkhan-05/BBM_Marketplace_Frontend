// components/PriceBill.jsx — one bill layout for Cart, cart item details and Buy Now.
import { inr } from "../utils/pricing.js";

const INK = "#0B2533", MUTED = "#4F616C", HAIR = "#E3EEEF";

function Line({ label, value, strong, tone }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-[13px]" style={{ color: tone || MUTED, fontWeight: strong ? 800 : 600 }}>
            <span className="min-w-0">{label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: tone || INK, fontWeight: strong ? 800 : 700 }}>{value}</span>
        </div>
    );
}

/**
 * bill:    from billFromAmounts() / sumBills()
 * qtyText: e.g. "3 Master Packs" or "4 items" (shown in the Amount row)
 */
export default function PriceBill({ bill, qtyText, totalLabel = "Total payable" }) {
    if (!bill) return null;
    return (
        <div className="flex flex-col gap-2">
            <Line label={qtyText ? `Amount (${qtyText})` : "Amount"} value={`₹${inr(bill.gross)}`} />
            {bill.discount > 0 && (
                <Line
                    label={bill.discountPercent > 0 ? `Discount (${bill.discountPercent}% off)` : "Discount"}
                    value={`− ₹${inr(bill.discount)}`} tone="#0A6670" strong
                />
            )}
            <div className="h-px" style={{ background: HAIR }} />
            <Line label="Taxable value" value={`₹${inr(bill.taxable)}`} strong tone={INK} />
            {bill.gst > 0 && (
                <Line label={bill.gstPercent > 0 ? `GST (${bill.gstPercent}%)` : "GST"} value={`+ ₹${inr(bill.gst)}`} />
            )}
            <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3" style={{ background: "#FFF6CC", borderColor: "#F3D86B" }}>
                <span className="text-[14px] font-extrabold" style={{ color: INK }}>{totalLabel}</span>
                <span className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: INK }}>₹{inr(bill.total)}</span>
            </div>
        </div>
    );
}