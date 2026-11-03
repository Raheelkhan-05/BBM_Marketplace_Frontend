// Bill-style breakdown for an Order Book order (same look as PurchaseOrderDocument).
// Order Book prices are entered GST-INCLUSIVE, so taxable value is derived backwards:
//   taxable = lineTotal / (1 + gst%)
import { DEFAULT_GST_PERCENT } from "../../../shared/orderPricing.js";
import { DOC_C as C } from "../orders/OrderDisplayHelpers.jsx";
import { inr, qty } from "./orderBookFmt.js";
import { basisWord, itemPack, packLines } from "./orderBookPack.js";
import { ExternalLink } from "lucide-react";

export function ProductLink({ i, className = "" }) {
    if (!i.submissionId) return <span className={className}>{i.productName}</span>;
    return (
        <a href={`/p/${i.submissionId}`} target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 font-bold tracking-wide hover:underline ${className}`}
            style={{ color: C.accent }} title="Open product page">
            {i.productName}<ExternalLink size={12} aria-hidden="true" />
        </a>
    );
}

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function calc(i) {
    const g = Number(i.details?.gstPercent ?? DEFAULT_GST_PERCENT) || 0;
    const div = 1 + g / 100;
    const q = Number(i.quantity) || 0;
    const packed = !!i.basis;
    const unitsPer = packed && q > 0 && i.totalUnits > 0 ? i.totalUnits / q : null; // pieces in one pack / master pack
    const lineTotal = Number(i.lineTotal) || q * (Number(i.unitPrice) || 0);
    const taxable = r2(lineTotal / div);
    return {
        g, packed, unitsPer, lineTotal,
        taxable,
        gst: r2(lineTotal - taxable),
        rateExcl: (Number(i.unitPrice) || 0) / div,                         // per pack / master pack / unit (excl. GST)
        perPieceExcl: unitsPer ? (Number(i.unitPrice) || 0) / unitsPer / div : null,
        perPieceIncl: unitsPer ? (Number(i.unitPrice) || 0) / unitsPer : null,
    };
}

function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide leading-tight text-white ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-3 py-2.5 tracking-wide ${className}`} style={{ color: C.ink }}>{children}</td>;
}
function Row({ label, value, color, bold }) {
    return (
        <div className="flex w-full max-w-[320px] justify-between text-[12.5px] font-semibold tracking-wide" style={{ color: color || C.muted }}>
            <span className={bold ? "font-extrabold" : ""}>{label}</span>
            <span className="tabular-nums" style={{ color: color || C.ink }}>{value}</span>
        </div>
    );
}

function Desc({ i, c }) {
    const pk = itemPack(i);
    return (
        <>
            <span className="block"><ProductLink i={i} /></span>
            {i.brandName && <span className="mt-0.5 block text-[11px] font-bold tracking-wide" style={{ color: C.accent }}>Brand: {i.brandName}</span>}
            {c.packed && i.totalUnits > 0 && (
                <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: C.muted }}>{qty(i.totalUnits)} {i.baseUnit} in total</span>
            )}
            {pk && packLines(pk).map((t) => <span key={t} className="block text-[11px] font-semibold" style={{ color: C.muted }}>{t}</span>)}
        </>
    );
}

function QtyText({ i, c }) {
    return c.packed
        ? <>{qty(i.quantity)} {basisWord(i.basis, i.quantity)}</>
        : <>{qty(i.quantity)} {i.unit}</>;
}

export default function OrderBookBill({ o }) {
    const rows = (o.items || []).map((i) => ({ i, c: calc(i) }));

    const showUnit = rows.some(({ c }) => c.packed && c.unitsPer > 1);

    // GST grouped by rate (items can have different rates)
    const byRate = new Map();
    rows.forEach(({ c }) => byRate.set(c.g, r2((byRate.get(c.g) || 0) + c.gst)));
    const taxableTotal = r2(rows.reduce((s, { c }) => s + c.taxable, 0));
    const gstTotal = r2(rows.reduce((s, { c }) => s + c.gst, 0));
    const grand = Number(o.total) || r2(rows.reduce((s, { c }) => s + c.lineTotal, 0));

    return (
        <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.hair }}>
            <div className="border-b px-4 py-3 sm:px-5" style={{ borderColor: C.hair, background: "#fafbfb" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: C.accent }}>Order bill</p>
                <h3 className="mt-0.5 text-[16px] font-extrabold tracking-wide" style={{ color: C.ink }}>{o.orderNo}</h3>
            </div>

            <div className="p-4 sm:p-5">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-lg border sm:block" style={{ borderColor: C.hair }}>
                    <table className="w-full text-[12.5px]">
                        <thead>
                            <tr style={{ background: C.accent }}>
                                <Th className="w-10">Sr</Th>
                                <Th>Description of Goods</Th>
                                <Th>Qty</Th>
                                <Th className="text-right">{showUnit ? "Rate / pack" : "Rate"}<br /><span className="font-normal normal-case opacity-80">(excl. GST)</span></Th>
                                {showUnit && <Th className="text-right">Rate / unit<br /><span className="font-normal normal-case opacity-80">(excl. GST)</span></Th>}
                                <Th className="text-right">Taxable Value</Th>
                                <Th className="text-right">GST</Th>
                                <Th className="text-right">Amount<br /><span className="font-normal normal-case opacity-80">(incl. GST)</span></Th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ i, c }, k) => (
                                <tr key={`${i.submissionId || i.productName}-${k}`} className="border-t align-top" style={{ borderColor: C.hair, background: k % 2 ? "#fafbfb" : "#fff" }}>
                                    <Td>{k + 1}</Td>
                                    <Td><Desc i={i} c={c} /></Td>
                                    <Td><QtyText i={i} c={c} /></Td>
                                    <Td className="text-right tabular-nums">
                                        {inr(c.rateExcl, 2)}
                                        {showUnit && c.packed && <span className="block text-[10.5px]" style={{ color: C.muted }}>per {basisWord(i.basis, 1)}</span>}
                                    </Td>
                                    {showUnit && (
                                        <Td className="text-right tabular-nums">
                                            {c.perPieceExcl != null ? inr(c.perPieceExcl, 2) : "—"}
                                            <span className="block text-[10.5px]" style={{ color: C.muted }}>per {c.packed ? i.baseUnit : i.unit}</span>
                                        </Td>
                                    )}
                                    <Td className="text-right tabular-nums font-bold">{inr(c.taxable)}</Td>
                                    <Td className="text-right tabular-nums">{inr(c.gst)}<span className="block text-[10.5px]" style={{ color: C.muted }}>{qty(c.g)}%</span></Td>
                                    <Td className="text-right tabular-nums font-bold">{inr(c.lineTotal)}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile stacked */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {rows.map(({ i, c }, k) => (
                        <div key={`${i.submissionId || i.productName}-${k}`} className="rounded-lg border p-2.5" style={{ borderColor: C.hair }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 text-[14px]"><Desc i={i} c={c} /></div>
                                <span className="shrink-0 text-[14px] font-extrabold" style={{ color: C.ink }}>{inr(c.lineTotal)}</span>
                            </div>
                            <div className="mt-1.5 flex flex-col gap-0.5 text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                <span>Quantity: <QtyText i={i} c={c} /></span>
                                <span>Rate{showUnit && c.packed ? ` per ${basisWord(i.basis, 1)}` : ""} (excl. GST): {inr(c.rateExcl, 2)}</span>
                                {showUnit && c.perPieceExcl != null && <span>Rate per {i.baseUnit} (excl. GST): {inr(c.perPieceExcl, 2)}</span>}
                                <span>Taxable value: {inr(c.taxable)}</span>
                                <span>GST ({qty(c.g)}%): {inr(c.gst)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-4 flex flex-col items-end gap-1.5 border-t pt-4" style={{ borderColor: C.hair }}>
                    <Row label="Total before GST" value={inr(taxableTotal)} />
                    {[...byRate.entries()].map(([g, amt]) => <Row key={g} label={`GST (${qty(g)}%)`} value={inr(amt)} />)}
                    {byRate.size > 1 && <Row label="Total GST" value={inr(gstTotal)} />}
                    <div className="mt-1 flex w-full max-w-[320px] justify-between border-t pt-2 text-[15px] font-extrabold tracking-wide" style={{ borderColor: C.hair, color: C.ink }}>
                        <span>Total Payable</span>
                        <span className="tabular-nums" style={{ color: C.accent }}>{inr(grand)}</span>
                    </div>
                    <p className="max-w-[320px] text-right text-[11px] font-medium italic" style={{ color: C.muted }}>
                        Prices were entered by the salesperson with GST included; taxable value and GST are worked out from them.
                    </p>
                </div>
            </div>
        </div>
    );
}