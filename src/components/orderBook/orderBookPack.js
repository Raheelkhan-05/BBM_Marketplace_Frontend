// src/components/orderBook/orderBookPack.js
// Pack maths shared by the Punch order sheet and the order detail page.
//   unit        = the listing's own unit (Kg, Pcs, Litre ...)
//   pack        = how many `unit` are in 1 pack
//   per         = how many packs are in 1 master pack (0 = the product has no master pack)
import { qty } from "./orderBookFmt.js";

const pos = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function packFacts({ packSize, packsPerMaster, unit }) {
    const pack = pos(packSize) || 1;
    const per = pos(packsPerMaster) > 1 ? pos(packsPerMaster) : 0;
    return { pack, per, unit: unit || "", unitsPerMaster: per ? r4(pack * per) : 0 };
}

// How many `unit` one pack / one master pack holds.
export const unitsPerSale = (f, basis) => (basis === "per_master_pack" ? f.unitsPerMaster : f.pack);

export function basisWord(basis, count) {
    const one = Number(count) === 1;
    return basis === "per_master_pack" ? (one ? "master pack" : "master packs") : (one ? "pack" : "packs");
}

// "1 pack = 25 Kg", "1 master pack = 40 packs (1,000 Kg)"
export function packLines(f) {
    const out = [`1 pack = ${qty(f.pack)} ${f.unit}`.trim()];
    if (f.per) out.push(`1 master pack = ${qty(f.per)} packs (${qty(f.unitsPerMaster)} ${f.unit})`.trim());
    return out;
}

// The seller's MOQ is stored in the listing's sale unit (master pack when it has one, else pack).
// Returns the smallest whole number of `basis` that covers it.
export function minQty(f, basis, moq) {
    const m = pos(moq);
    if (!m) return 1;
    const base = m * (f.per ? f.unitsPerMaster : f.pack);
    return Math.max(1, Math.ceil(base / unitsPerSale(f, basis)));
}

// Pack facts of a saved order line (new lines carry baseUnit; older lines only have the details snapshot).
export function itemPack(item) {
    const d = item?.details;
    if (!d) return null;
    if (!item.basis && !d.packSize && !d.unitsPerMasterPack) return null;
    return packFacts({ packSize: d.packSize, packsPerMaster: d.unitsPerMasterPack, unit: item.baseUnit || item.unit });
}