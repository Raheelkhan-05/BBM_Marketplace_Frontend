// src/components/orderBook/orderBookPrice.js
// Price maths shared by the Punch order sheet and the Quotation sheet (frontend only).
// The salesperson may enter a price
//   - per listing unit (Kg, Pcs ...), per pack, or per master pack, and
//   - including or excluding GST.
// Everything is converted back to what the server already expects, so no backend change is needed.
import { packFacts, unitsPerSale } from "./orderBookPack.js";

// Pack facts of a catalog product row. Accepts the field names the product endpoints may use, so the pack and
// master pack are found whichever endpoint the product came from (picker, quote list ...).
export const productPack = (p) => packFacts({
    packSize: p?.packSize ?? p?.pack_size,
    packsPerMaster: p?.masterPackSize ?? p?.unitsPerMasterPack ?? p?.packsPerMaster ?? p?.units_per_master_pack,
    unit: p?.unit,
});

const r4 = (x) => Math.round(x * 1e4) / 1e4;

// For typed-name products (no pack data): one "pack" = one unit.
export const MANUAL = { pack: 1, per: 0, unitsPerMaster: 0, unit: "" };

export const gstFactor = (pct) => 1 + (Number(pct) || 0) / 100;

// How many listing units are in one price unit. pu = "unit" | "pack" | "master"
export const unitsIn = (f, pu) => (pu === "master" ? f.unitsPerMaster || 1 : pu === "pack" ? f.pack || 1 : 1);

// The "Price per" choices for a catalog product: per unit, per pack, and per master pack when the product has one.
export function priceUnitOptions(f) {
    const o = [
        { value: "unit", label: `Per ${f.unit || "unit"}` },
        { value: "pack", label: f.pack > 1 ? `Per pack (${f.pack} ${f.unit || "units"})` : "Per pack" },
    ];
    if (f.per) o.push({ value: "master", label: `Per master pack (${f.unitsPerMaster} ${f.unit || "units"})` });
    return o;
}

// Start with the same unit the quantity is ordered in.
export function defaultPriceUnit(f, basis) {
    if (basis === "per_master_pack" && f.per) return "master";
    return "pack";
}

export const priceUnitWord = (f, pu) => (pu === "master" ? "master pack" : pu === "pack" ? "pack" : f.unit || "unit");

// Re-express the same real price in another unit and / or GST mode. from / to = { pu, incl }. Returns a string for the input.
export function convertPrice(price, from, to, f, pct) {
    const p = parseFloat(price);
    if (!(p > 0)) return "";
    let v = (p / unitsIn(f, from.pu)) * unitsIn(f, to.pu);
    if (from.incl !== to.incl) v = to.incl ? v * gstFactor(pct) : v / gstFactor(pct);
    return String(r4(v));
}

// Entered price -> price per listing unit, GST included.
export function inclPerUnit({ price, pu, incl, pct, f }) {
    const p = parseFloat(price);
    if (!(p > 0)) return 0;
    return (p / unitsIn(f, pu)) * (incl ? 1 : gstFactor(pct));
}

// Entered price -> price per pack / master pack (the order basis), GST included. basis = null for typed products (per unit).
export function salePrice({ price, pu, incl, pct, f, basis }) {
    const perUnit = inclPerUnit({ price, pu, incl, pct, f });
    return r4(perUnit * (basis ? unitsPerSale(f, basis) : 1));
}