// ReviewStep.jsx — step 3: the explicit "this much will be deducted" confirmation.
// Nothing is charged until the seller ticks the consent box AND presses Pay.
import { AlertTriangle, CheckCircle2, Loader2, Wallet, Info } from "lucide-react";
import { money, fmtDateTime, endIso, groupLines, demandLabel, REASON_TEXT } from "./adsHelpers.js";

export default function ReviewStep({ placement, quote, creativePreview, consent, onConsent, busy, error, onPay, onTopUp, onChangeTime }) {
    if (quote.loading && !quote.data) return <section className="ad-card"><span className="ad-sk" /><span className="ad-sk" /></section>;
    if (quote.error || !quote.data) {
        return (
            <section className="ad-card">
                <p className="ad-err" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {quote.error?.message || "Couldn't price this booking."}</p>
                <button type="button" className="ad-btn ghost" onClick={onChangeTime}>Change time</button>
            </section>
        );
    }

    const q = quote.data;
    const w = q.wallet;
    const rows = groupLines(q.lines);
    const demand = demandLabel(q.lines);
    const bookable = q.bookable !== false;
    const short = w ? Number(w.shortfall) || 0 : 0;
    const canPay = bookable && short === 0 && consent && !busy && !quote.loading;

    return (
        <div className="ad-review">
            <section className="ad-card">
                <h3>{placement.name}</h3>
                <p className="ad-when"><b>{fmtDateTime(q.start)}</b> to <b>{fmtDateTime(q.end || endIso(q.start, q.hours))}</b> IST · {q.hours} hour{q.hours === 1 ? "" : "s"}</p>
                {creativePreview}
                {!bookable && (
                    <div className="ad-note bad" role="alert">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>{REASON_TEXT[q.reason] || "This time can't be booked."} <button type="button" className="ad-link" onClick={onChangeTime}>Pick another time</button></span>
                    </div>
                )}
            </section>

            <section className="ad-card">
                <h3>Price</h3>
                <ul className="ad-lines">
                    {rows.map((r) => (
                        <li key={r.startMs}>
                            <span>{fmtDateTime(new Date(r.startMs).toISOString())} to {fmtDateTime(new Date(r.endMs).toISOString())}<small>{r.hours} h × {money(r.rate)}{r.override ? ` · ${r.override}` : ""}</small></span>
                            <b>{money(r.sum)}</b>
                        </li>
                    ))}
                </ul>
                <dl className="ad-sum">
                    <div><dt>Subtotal</dt><dd>{money(q.subtotal)}</dd></div>
                    <div><dt>GST ({Number(q.gst_percent)}%)</dt><dd>{money(q.gst_amount)}</dd></div>
                    <div className="tot"><dt>Total</dt><dd>{money(q.total)}</dd></div>
                </dl>
                <p className={`ad-demand d-${demand.key}`}><Info size={14} aria-hidden="true" /> {demand.text}</p>
            </section>

            {w && (
                <section className="ad-card">
                    <h3><Wallet size={16} aria-hidden="true" /> Your credits</h3>
                    <dl className="ad-sum">
                        <div><dt>Available now</dt><dd>{money(w.balance)}</dd></div>
                        <div><dt>After this booking</dt><dd>{money(w.balanceAfter)}</dd></div>
                    </dl>
                    {short > 0 ? (
                        <div className="ad-note warn" role="alert">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>You need {money(short)} more credits to book this. We keep {money(w.reserve)} in your wallet so your listings stay visible. After you add credits you'll come straight back here.</span>
                        </div>
                    ) : null}
                </section>
            )}

            {error && <p className="ad-err" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

            {short > 0 ? (
                <button type="button" className="ad-btn primary" onClick={() => onTopUp(short)}>Add {money(short)} to credits</button>
            ) : (
                <>
                    <label className="ad-consent">
                        <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} disabled={!bookable || busy} />
                        <span>I agree that <b>{money(q.total)}</b> (including GST) will be deducted from my credits now. Ads can't be cancelled after booking.</span>
                    </label>
                    <button type="button" className="ad-btn primary" disabled={!canPay} onClick={onPay}>
                        {busy ? <><Loader2 size={16} className="ad-spin" aria-hidden="true" /> Booking…</> : <><CheckCircle2 size={16} aria-hidden="true" /> Pay {money(q.total)} from credits</>}
                    </button>
                </>
            )}
        </div>
    );
}   