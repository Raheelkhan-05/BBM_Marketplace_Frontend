// shared/orderPricing.js
// Single source of truth for turning an order_item row into a verifiable,
// human-readable breakdown.
//
// Presentation order (matches how a person actually reads an invoice —
// price, then discount, then what's left, then tax, then total):
//   1. Rate            — before discount, GST EXCLUDED
//   2. Gross amount    = rate x qty, GST EXCLUDED
//   3. Discount        — GST EXCLUDED (a discount is on the goods; the
//                          percentage is identical whether applied before
//                          or after GST, so staying excl-GST here never
//                          loses accuracy)
//   4. Taxable value   = Gross amount − Discount, GST EXCLUDED
//   5. GST             — introduced exactly ONCE, at the listing's rate
//   6. Total Payable   = Taxable value + GST
//
// Steps 1–4 never leave the GST-excluded unit system, so "Gross − Discount
// = Taxable value" is checkable by eye without doing tax math in your
// head. GST appears exactly once, as its own step.
//
// gst_percent_snapshot only exists on orders placed after this migration —
// older orders have it as null. DEFAULT_GST_PERCENT is the fallback for
// those, so a historic order never shows 0% GST (every listing on the
// platform charges GST — 0% was never a real state, just a missing column).

export const DEFAULT_GST_PERCENT = 18;

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function saleQtyOf(item) {
    return Number(item.pack_quantity_snapshot) || Number(item.quantity) || 0;
}

export function resolveGstPercent(item) {
    const v = item?.gst_percent_snapshot;
    return v != null && v !== "" ? Number(v) : DEFAULT_GST_PERCENT;
}

// base_price_applied = slab rate BEFORE discount, GST-INCLUSIVE, per sale unit
// unit_price          = FINAL rate AFTER discount, GST-INCLUSIVE, per sale unit
// line_total           = FINAL amount AFTER discount, GST-INCLUSIVE (what was actually charged)
// discount_percent    = % taken off (0 for no discount / custom-priced buyers)
export function computeItemBreakdown(item) {
    const saleQty = saleQtyOf(item);
    const gstPercent = resolveGstPercent(item);
    const gstFactor = 1 + gstPercent / 100;

    const rateInclBeforeDiscount = Number(item.base_price_applied ?? item.unit_price) || 0;
    const discountPercent = Number(item.discount_percent) || 0;

    // Anchor to what was ACTUALLY charged rather than re-deriving it from
    // unit_price x qty, so Total Payable can never drift from the real
    // charge even if rounding happens elsewhere in the pipeline.
    const netPayableIncl = item.line_total != null
        ? round2(Number(item.line_total))
        : round2((Number(item.unit_price) || 0) * saleQty);

    // Steps 1–4: GST-excluded, one unit system throughout.
    const rate = round2(rateInclBeforeDiscount / gstFactor);              // step 1
    const grossAmount = round2(rate * saleQty);                          // step 2
    const taxableValue = round2(netPayableIncl / gstFactor);             // derived from the real charge
    const discountAmount = round2(Math.max(grossAmount - taxableValue, 0)); // step 3

    // Step 5: GST, introduced exactly once.
    const gstAmount = round2(netPayableIncl - taxableValue);

    return {
        saleQty, gstPercent,
        rate, discountPercent,
        grossAmount, discountAmount, taxableValue, gstAmount,
        totalPayable: netPayableIncl,                                      // step 6
    };
}

export function computeOrderBreakdown(order) {
    const rows = (order?.items || []).map((it) => ({ item: it, breakdown: computeItemBreakdown(it) }));
    const totals = rows.reduce((acc, { breakdown: b }) => ({
        grossAmount: acc.grossAmount + b.grossAmount,
        discountAmount: acc.discountAmount + b.discountAmount,
        taxableValue: acc.taxableValue + b.taxableValue,
        gstAmount: acc.gstAmount + b.gstAmount,
        totalPayable: acc.totalPayable + b.totalPayable,
    }), { grossAmount: 0, discountAmount: 0, taxableValue: 0, gstAmount: 0, totalPayable: 0 });
    Object.keys(totals).forEach((k) => (totals[k] = round2(totals[k])));

    // One blended GST% for the CGST/SGST/IGST labels — safe as long as
    // every item on the order shares a rate, true for the overwhelming
    // majority (single seller, one GST slab). If items genuinely differ,
    // this label uses the first item's rate; the gstAmount TOTAL is always
    // the real per-item sum, never recomputed from this label.
    const gstPercent = rows[0]?.breakdown.gstPercent ?? DEFAULT_GST_PERCENT;

    return { rows, totals, gstPercent };
}