// utils/pricing.js
//
// RULE (matches the server): the stored/charged price is GST-INCLUSIVE.
//   Total payable      = inclusive total (what is charged, never changes)
//   Taxable value      = total / (1 + gst%)         (display only)
//   GST                = total - taxable            (display only, already inside the price)
//   Amount / Discount  = shown on the same ex-GST basis, so the rows always add up:
//                        Amount - Discount = Taxable,  Taxable + GST = Total.
import {
    purchaseQtyToSaleUnitQty, saleUnitQtyToBaseUnits, saleUnitQtyToPacks, hasOuterPack, saleUnitLabel, round2,
} from "../shared/packUnits.js";

export function inr(n) {
    return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Same slab / discount rules as BuyNowModal and the server. */
export function resolveSlab(priceSlabs, saleQty, fallbackPrice) {
    if (!Array.isArray(priceSlabs) || !priceSlabs.length) return fallbackPrice;
    const hit = priceSlabs
        .filter((s) => Number(s.minQty) > 0 && saleQty >= Number(s.minQty) && (!s.maxQty || saleQty <= Number(s.maxQty)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return hit.length ? Number(hit[0].price) : fallbackPrice;
}
export function resolveDiscount(tiers, saleQty) {
    if (!Array.isArray(tiers) || !tiers.length) return 0;
    const hit = tiers
        .filter((d) => Number(d.minQty) > 0 && saleQty >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return hit.length ? Number(hit[0].discountPercent) || 0 : 0;
}

/** Turn inclusive amounts into the ex-GST bill rows. */
export function billFromAmounts({ grossIncl, totalIncl, gstPercent, discountPercent = 0 }) {
    const g = Number(gstPercent) || 0;
    const div = 1 + g / 100;
    const total = round2(totalIncl);
    const taxable = g > 0 ? round2(total / div) : total;
    const gross = g > 0 ? round2(grossIncl / div) : round2(grossIncl);
    return {
        gstPercent: g,
        discountPercent: Number(discountPercent) || 0,
        gross,
        discount: Math.max(0, round2(gross - taxable)),
        taxable,
        gst: round2(total - taxable),
        total,
    };
}

export function sumBills(bills) {
    const s = (k) => round2(bills.reduce((a, b) => a + (Number(b[k]) || 0), 0));
    const gsts = [...new Set(bills.map((b) => b.gstPercent).filter((x) => x > 0))];
    return {
        gstPercent: gsts.length === 1 ? gsts[0] : 0, // 0 = mixed rates, label becomes plain "GST"
        mixedGst: gsts.length > 1,
        discountPercent: 0,
        gross: s("gross"), discount: s("discount"), taxable: s("taxable"), gst: s("gst"), total: s("total"),
    };
}

export const basisUnitLabel = (basis, plural = false) => {
    const base = basis === "per_master_pack" ? "Master Pack" : basis === "per_unit" ? "Unit" : "Pack";
    return plural ? `${base}s` : base;
};

/** Full pricing of ONE cart line (item shape from cart_list). */
export function cartLinePricing(item) {
    const saleQty = purchaseQtyToSaleUnitQty(item.quantity, item.purchase_basis, item.pack_size, item.units_per_master_pack);
    const slabPrice = resolveSlab(item.price_slabs, saleQty, Number(item.price));
    const discountPercent = resolveDiscount(item.quantity_discounts, saleQty);
    const unitPrice = round2(slabPrice * (1 - discountPercent / 100));
    const grossIncl = round2(slabPrice * saleQty);
    const totalIncl = round2(unitPrice * saleQty); // exactly what place_cart_order stores as line_total
    const moq = Number(item.moq) || 0;
    return {
        saleQty, slabPrice, discountPercent, unitPrice, grossIncl, totalIncl,
        moq, meetsMoq: moq ? saleQty >= moq : true,
        baseUnits: saleUnitQtyToBaseUnits(saleQty, item.pack_size, item.units_per_master_pack),
        packs: saleUnitQtyToPacks(saleQty, item.units_per_master_pack),
        bill: billFromAmounts({ grossIncl, totalIncl, gstPercent: item.gst_percent, discountPercent }),
    };
}

/** Smallest / largest quantity the buyer can type, in the line's OWN basis (packs or master packs). */
export function purchaseLimits(item) {
    const perUnit = purchaseQtyToSaleUnitQty(1, item.purchase_basis, item.pack_size, item.units_per_master_pack) || 1;
    const moq = Number(item.moq) || 0;
    const min = Math.max(1, Math.ceil(moq / perUnit - 1e-9));
    const capped = item.stock_type === "ready_stock" && item.available_stock != null;
    const max = capped ? Math.floor(Number(item.available_stock) / perUnit + 1e-9) : null;
    return { min, max, capped, outOfStock: capped && max < min };
}

export { hasOuterPack, saleUnitLabel };