// Change the price of every selected listing by X% (up or down), with a live preview.
// The server is the source of truth: it skips rejected listings, listings with no price and
// prices that would fall under the ₹1 per unit minimum, and reports each skip with a reason.
import { useMemo, useState } from "react";
import { Sheet } from "./ui.jsx";
import { BulkResult } from "./BulkResult.jsx";
import { bulkChangePrice } from "../../utils/sellerListingApi.js";
import { violatesMinUnitPrice } from "../../../shared/customPricing.js";
import { inr, toTitleCase } from "./sellerHelpers.js";

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const MAX = { up: 500, down: 90 };
const QUICK = [1, 2, 5, 10];

export default function BulkPriceSheet({ items, token, onClose, onApplied }) {
    const [dir, setDir] = useState("up");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);

    const pct = Number(text);
    const valid = text.trim() !== "" && Number.isFinite(pct) && pct > 0 && pct <= MAX[dir];
    const signed = dir === "up" ? pct : -pct;

    const plan = useMemo(() => {
        if (!valid) return null;
        const rows = [];
        let skip = 0;
        for (const it of items) {
            const base = Number(it.base_price);
            if (it.review_status === "rejected" || !(base > 0)) { skip++; continue; }
            const next = r2(base * (1 + signed / 100));
            if (!(next > 0) || next === r2(base) || violatesMinUnitPrice(next, it.pack_size, it.units_per_master_pack)) { skip++; continue; }
            const gst = Number(it.gst_percent) || 0;
            rows.push({ it, from: Number(it.price), to: r2(next * (1 + gst / 100)) });
        }
        return { rows, skip };
    }, [items, valid, signed]);

    async function apply() {
        if (!valid || !plan?.rows.length || busy) return;
        setBusy(true); setErr("");
        const res = await bulkChangePrice(token, items.map((it) => it.id), signed);
        setBusy(false);
        if (!res.success && !res.partial) { setErr(res.message); return; }
        setResult(res);
        onApplied?.(res);
    }

    const n = items.length;
    return (
        <Sheet title="Change prices" sub={`${n} listing${n === 1 ? "" : "s"} selected`} onClose={onClose}>
            {result ? (
                <BulkResult items={items} done={result.updated.length} verb="repriced" skipped={result.skipped}
                    error={result.success ? "" : result.message} onClose={onClose} />
            ) : (
                <>
                    <div className="f">
                        <label>Change by</label>
                        <div className="seg" role="group" aria-label="Increase or decrease">
                            <button type="button" aria-pressed={dir === "up"} onClick={() => setDir("up")}>Increase</button>
                            <button type="button" aria-pressed={dir === "down"} onClick={() => setDir("down")}>Decrease</button>
                        </div>
                    </div>

                    <div className="f">
                        <label htmlFor="bulk-pct">Percentage</label>
                        <div className="inp">
                            <input id="bulk-pct" inputMode="decimal" autoComplete="off" placeholder={`Up to ${MAX[dir]}`} value={text}
                                onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d{0,2}$/.test(v)) setText(v); }} />
                            <span className="suf">%</span>
                        </div>
                        <div className="qk">
                            {QUICK.map((q) => (
                                <button key={q} type="button" aria-pressed={text === String(q)} onClick={() => setText(String(q))}>{q}%</button>
                            ))}
                        </div>
                        {text.trim() !== "" && !valid && (
                            <p className="sub2" style={{ color: "var(--red)" }}>Enter a value above 0 and up to {MAX[dir]}%.</p>
                        )}
                    </div>

                    {plan && (
                        <>
                            <div className="pvw" aria-live="polite">
                                {plan.rows.slice(0, 5).map(({ it, from, to }) => (
                                    <div key={it.id}>
                                        <span>{toTitleCase(it.brand?.name || it.product_name || "Product")}</span>
                                        <b><s>₹{inr(from)}</s>₹{inr(to)}</b>
                                    </div>
                                ))}
                                {plan.rows.length > 5 && <div><span>and {plan.rows.length - 5} more</span></div>}
                                {!plan.rows.length && <div><span>No selected listing can be repriced by this amount.</span></div>}
                            </div>
                            <p className="sub2">Prices shown include GST. {plan.skip > 0 ? `${plan.skip} will be skipped (rejected, no price, or below the ₹1 per unit minimum). ` : ""}Custom buyer prices set as a percentage follow the new price automatically.</p>
                        </>
                    )}

                    {err && <div className="note warn" style={{ marginTop: 14 }}><span>{err}</span></div>}

                    <div className="sfoot"><button className="bt go blk" type="button" disabled={!plan?.rows.length || busy} onClick={apply}>
                        {busy ? "Updating…" : plan?.rows.length
                            ? `${dir === "up" ? "Increase" : "Decrease"} ${plan.rows.length} price${plan.rows.length === 1 ? "" : "s"} by ${pct}%`
                            : "Enter a percentage"}
                    </button></div>
                </>
            )}
        </Sheet>
    );
}