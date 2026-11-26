// src/pages/GrowAdsPage.jsx — route: /sell/ads  (seller "Promote" screen in the GROW shell)
//
// Flow: pick a placement (with a map of where it appears) -> 1 Time -> 2 Creative (live preview) -> 3 Review & pay.
// Money safety (unchanged):
//   * nothing is charged until the seller ticks the consent box and presses Pay;
//   * the exact total the seller saw is sent with the booking; if the price moved the server refuses (409)
//     and we show the new price for a fresh confirmation;
//   * a retry of the same request re-uses one idempotency key, so a flaky network can never double-charge;
//   * short credits -> /sell/wallet?amount=<shortfall>&returnTo=/sell/ads?resume=1, and after a verified
//     top-up PaymentReturnPage sends the seller back here with the selection restored.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, ChevronLeft, ImageIcon, MapPin, Megaphone, Package, Sparkles, TrendingUp, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useGrowSeller } from "../context/GrowSellerContext.js";
import { fetchPlacements, fetchQuote, postBooking, fetchMyBookings } from "../utils/adsApi.js";
import SlotPicker from "../components/growSeller/ads/SlotPicker.jsx";
import CreativeStep from "../components/growSeller/ads/CreativeStep.jsx";
import ReviewStep from "../components/growSeller/ads/ReviewStep.jsx";
import AdPlacementPreview, { PlacementMap, placementPosition, placementLabel } from "../components/growSeller/ads/AdPlacementPreview.jsx";
import { SHAPE_BY_KEY } from "../components/home/bannerShapes.js";
import {
    money, fmtDateTime, endIso, newIdemKey, readDraft, writeDraft, clearDraft, emptyCreative,
    creativeReady, toCreativeInput, topUpPath, bookingState, REASON_TEXT,
} from "../components/growSeller/ads/adsHelpers.js";
import "../components/growSeller/ads/grow-ads.css";

const STEPS = [["slot", "Time", CalendarDays], ["creative", "Creative", ImageIcon], ["review", "Review", CheckCircle2]];
const toTop = () => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } };
const sizesOf = (p) => (p.aspectKeys || []).map((k) => SHAPE_BY_KEY[k]?.label || k).join(" + ");

export default function GrowAdsPage() {
    const nav = useNavigate();
    const [sp, setSp] = useSearchParams();
    const { token, profile } = useAuth();
    const { say, refreshWallet } = useGrowSeller();
    // Shown on the ad itself ("Ad · <shop>"). Falls back to a neutral label if the profile has neither field.
    const shopName = profile?.shop_name || profile?.display_name || "Your shop";

    const [tab, setTab] = useState("book"); // book | mine
    const [pl, setPl] = useState({ loading: true, list: [], gstPercent: 18, error: null });
    const [flow, setFlow] = useState(null);  // { placementKey, start, hours, bid, creative, step }
    const [saved, setSaved] = useState(() => readDraft());
    const [done, setDone] = useState(null);  // { booking, placement }
    const [picked, setPicked] = useState(null); // product being promoted: { id, name, image, brandName, price, masterPackSize }
    const [quote, setQuote] = useState({ loading: false, data: null, error: null });
    const [quoteTick, setQuoteTick] = useState(0);
    const [availKey, setAvailKey] = useState(0);
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [bookErr, setBookErr] = useState(null);
    const [mine, setMine] = useState({ loading: false, list: [], error: null });

    const placement = useMemo(() => pl.list.find((p) => p.key === flow?.placementKey) || null, [pl.list, flow?.placementKey]);

    /* ---------------- placements ---------------- */
    useEffect(() => {
        if (!token) return undefined;
        const ac = new AbortController();
        fetchPlacements(token, ac.signal).then((res) => {
            if (res.aborted) return;
            if (res.success) setPl({ loading: false, list: res.placements || [], gstPercent: Number(res.gstPercent) || 18, error: null });
            else setPl({ loading: false, list: [], gstPercent: 18, error: res.message || "Couldn't load the placements." });
        });
        return () => ac.abort();
    }, [token]);

    /* ---------------- resume after the wallet top-up ---------------- */
    useEffect(() => {
        if (pl.loading || sp.get("resume") !== "1") return;
        const d = readDraft();
        setSp({}, { replace: true });
        if (!d || !pl.list.some((p) => p.key === d.placementKey)) return;
        const stillFuture = d.start && new Date(d.start).getTime() > Date.now();
        setFlow({
            placementKey: d.placementKey, start: stillFuture ? d.start : null, hours: d.hours, bid: Number(d.bid) || 0,
            creative: d.creative || emptyCreative(), step: stillFuture ? "review" : "slot",
        });
        setTab("book");
        say?.(stillFuture ? "Welcome back. Your booking is ready to confirm." : "That start time has passed. Please pick a new time.");
    }, [pl.loading, pl.list, sp, setSp, say]);

    // Keep the draft fresh so a wallet round trip (or an accidental reload) never loses the selection.
    useEffect(() => { if (flow) writeDraft(flow); }, [flow]);

    /* ---------------- live quote ---------------- */
    const qKey = flow ? `${flow.placementKey}|${flow.start}|${flow.hours}|${flow.bid || 0}` : "";
    useEffect(() => {
        if (!flow?.start || !flow?.hours || !token) { setQuote({ loading: false, data: null, error: null }); return undefined; }
        const ac = new AbortController();
        setQuote((q) => ({ ...q, loading: true, error: null }));
        const t = setTimeout(async () => {
            const res = await fetchQuote(token, flow.placementKey, flow.start, flow.hours, ac.signal, flow.bid || 0);
            if (res.aborted) return;
            if (res.success) setQuote({ loading: false, data: res.quote, error: null });
            else setQuote({ loading: false, data: null, error: res });
        }, 250);
        return () => { clearTimeout(t); ac.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, qKey, quoteTick]);

    /* ---------------- idempotency: one key per distinct request ---------------- */
    const idemRef = useRef(newIdemKey());
    const sig = flow ? `${qKey}|${JSON.stringify(flow.creative)}` : "";
    useEffect(() => { idemRef.current = newIdemKey(); setConsent(false); }, [sig]);
    // A new start time means the "slot taken" style message is no longer relevant.
    useEffect(() => { if (flow?.start) setBookErr(null); }, [flow?.start]);

    /* ---------------- my ads ---------------- */
    const loadMine = useCallback(async () => {
        setMine((m) => ({ ...m, loading: true, error: null }));
        const res = await fetchMyBookings(token);
        if (res.success) setMine({ loading: false, list: res.bookings || [], error: null });
        else setMine({ loading: false, list: [], error: res.message || "Couldn't load your ads." });
    }, [token]);
    useEffect(() => { if (tab === "mine" && token) loadMine(); }, [tab, token, loadMine]);

    /* ---------------- actions ---------------- */
    const patch = (p) => setFlow((f) => (f ? { ...f, ...p } : f));
    const startFlow = (p) => {
        setDone(null); setBookErr(null); setPicked(null);
        setFlow({ placementKey: p.key, start: null, hours: p.minHours, bid: 0, creative: emptyCreative(), step: "slot" });
        setSaved(null); clearDraft(); toTop();
    };
    const resumeSaved = () => {
        const d = saved; if (!d) return;
        const ok = d.start && new Date(d.start).getTime() > Date.now();
        setFlow({ placementKey: d.placementKey, start: ok ? d.start : null, hours: d.hours, bid: Number(d.bid) || 0, creative: d.creative || emptyCreative(), step: ok ? d.step || "slot" : "slot" });
        setSaved(null); toTop();
    };
    const discardSaved = () => { clearDraft(); setSaved(null); };
    const leaveFlow = () => { setFlow(null); setQuote({ loading: false, data: null, error: null }); toTop(); };
    const goStep = (step) => { setBookErr(null); patch({ step }); toTop(); };
    const goTopUp = (shortfall) => { if (flow) writeDraft({ ...flow, step: "review" }); nav(topUpPath(shortfall)); };

    const slotOk = !!flow?.start && quote.data?.bookable === true;
    const creativeOk = creativeReady(placement, flow?.creative);

    const pay = async () => {
        if (busy || !consent || !flow || !placement || !quote.data) return;
        setBusy(true); setBookErr(null);
        const res = await postBooking(token, {
            placementKey: flow.placementKey, start: flow.start, hours: flow.hours,
            expectedTotal: quote.data.total, idempotencyKey: idemRef.current,
            ...(placement.biddable ? { bidPerHour: Math.max(0, Math.floor(Number(flow.bid) || 0)) } : {}),
            creative: toCreativeInput(placement, flow.creative),
        });
        setBusy(false);

        if (res.success) {
            clearDraft(); refreshWallet?.();
            setDone({ booking: res.booking, placement });
            setFlow(null); setAvailKey((k) => k + 1); toTop();
            return;
        }
        switch (res.code) {
            case "INSUFFICIENT_CREDITS":
                setQuoteTick((n) => n + 1); // refresh balance and shortfall; the review step then offers the top-up
                setBookErr(res.message || "You don't have enough credits for this booking.");
                break;
            case "PRICE_CHANGED": {
                const fresh = res.details?.quote;
                if (fresh) setQuote({ loading: false, data: fresh, error: null }); else setQuoteTick((n) => n + 1);
                setConsent(false);
                setBookErr(`The price changed to ${money(res.details?.currentTotal ?? fresh?.total)}. Please check it and confirm again. You have not been charged.`);
                break;
            }
            case "SLOT_TAKEN": case "BLACKED_OUT": case "OUT_OF_WINDOW": case "INVALID_START": case "PLACEMENT_UNAVAILABLE":
                setAvailKey((k) => k + 1); patch({ start: null, step: "slot" });
                setBookErr(REASON_TEXT[res.code] || res.message);
                say?.(REASON_TEXT[res.code] || res.message);
                break;
            default:
                setBookErr(res.message || "Something went wrong. You have not been charged. Please try again.");
        }
    };

    /* ---------------- views ---------------- */
    const rank = quote.data?.bid?.rank ?? null;
    const creativePreview = placement && flow
        ? (
            <>
                {placement.biddable && Number(flow.bid) > 0 && (
                    <p className="ad-bid-sum"><TrendingUp size={14} aria-hidden="true" /> Priority bid: <b>{money(flow.bid)}</b> per hour × {flow.hours} h = <b>{money(Number(flow.bid) * Number(flow.hours))}</b> before GST{rank ? ` · position #${rank}` : ""}</p>
                )}
                <AdPlacementPreview placement={placement} creative={flow.creative} shopName={shopName} picked={picked} rank={rank} />
            </>
        )
        : null;

    if (done) {
        const b = done.booking;
        return (
            <div className="v ad-page">
                <section className="ad-card ad-done" role="status">
                    <CheckCircle2 size={44} aria-hidden="true" />
                    <h1>Your ad is booked</h1>
                    <p>{placementLabel(done.placement).kind} · {placementLabel(done.placement).name}: <b>{fmtDateTime(b.start)}</b> to <b>{fmtDateTime(b.end)}</b> IST.</p>
                    <p>{money(b.amount)} was deducted from your credits{b.balance_after != null ? `. Balance now ${money(b.balance_after)}` : ""}.</p>
                    <div className="ad-actions">
                        <button type="button" className="ad-btn primary" onClick={() => { setDone(null); setTab("mine"); }}>View my ads</button>
                        <button type="button" className="ad-btn ghost" onClick={() => setDone(null)}>Book another</button>
                    </div>
                </section>
            </div>
        );
    }

    if (flow && placement) {
        const idx = STEPS.findIndex((s) => s[0] === flow.step);
        const pos = placementPosition(placement);
        return (
            <div className="v ad-page">
                <div className="ad-top">
                    <button type="button" className="ad-ib" aria-label="Back to placements" onClick={leaveFlow}><ChevronLeft size={20} /></button>
                    <div><h1>{placementLabel(placement).kind} · {placementLabel(placement).name}</h1><p className="ad-mute">{placementLabel(placement).count}</p></div>
                </div>

                <ol className="ad-steps" aria-label="Booking steps">
                    {STEPS.map(([key, label, Icon], i) => (
                        <li key={key} className={i === idx ? "on" : i < idx ? "done" : ""}>
                            <button type="button" disabled={i > idx} onClick={() => goStep(key)} aria-current={i === idx ? "step" : undefined}>
                                <Icon size={16} aria-hidden="true" /> {label}
                            </button>
                        </li>
                    ))}
                </ol>

                {bookErr && flow.step !== "review" && <p className="ad-err" role="alert">{bookErr}</p>}

                {flow.step === "slot" && (
                    <>
                        <section className="ad-card pv-where" aria-label="Where your ad appears">
                            <PlacementMap placement={placement} small />
                            <div>
                                <b>Where your ad appears</b>
                                <p className="pv-pos"><MapPin size={14} aria-hidden="true" /> {pos.title}</p>
                                <p>{pos.where}</p>
                                <span className={`pv-share${placementLabel(placement).exclusive ? "" : " on"}`}>{placementLabel(placement).count}</span>
                            </div>
                        </section>
                        <SlotPicker token={token} placement={placement} start={flow.start} hours={flow.hours} refreshKey={availKey}
                            onChange={({ start, hours }) => patch({ start, hours })} />
                        {placement.biddable && flow.start && (
                            <BidBox placement={placement} value={flow.bid || 0} hours={flow.hours} quote={quote} onChange={(bid) => patch({ bid })} />
                        )}
                        <StickyBar
                            summary={flow.start ? (
                                quote.loading ? "Checking price…"
                                    : quote.data?.bookable ? `${money(quote.data.total)} incl. GST · ${flow.hours} h`
                                        : REASON_TEXT[quote.data?.reason] || quote.error?.message || "Pick a start time"
                            ) : "Pick a date and start time"}
                            sub={flow.start ? `${fmtDateTime(flow.start)} to ${fmtDateTime(endIso(flow.start, flow.hours))}` : null}
                            disabled={!slotOk || quote.loading} label="Next: creative" onClick={() => goStep("creative")} />
                    </>
                )}

                {flow.step === "creative" && (
                    <>
                        <CreativeStep token={token} placement={placement} value={flow.creative}
                            onChange={(creative) => patch({ creative })} onPickProduct={setPicked}
                            shopName={shopName} picked={picked} />
                        <StickyBar summary={creativeOk ? "Looks good" : "Add what is still missing"} disabled={!creativeOk}
                            label="Next: review" onClick={() => goStep("review")} />
                    </>
                )}

                {flow.step === "review" && (
                    <ReviewStep placement={placement} quote={quote} creativePreview={creativePreview}
                        consent={consent} onConsent={setConsent} busy={busy} error={bookErr}
                        onPay={pay} onTopUp={goTopUp} onChangeTime={() => goStep("slot")} />
                )}
            </div>
        );
    }

    /* ---------------- home: placements + my ads ---------------- */
    return (
        <div className="v ad-page">
            <div className="hh"><h1>Promote</h1><div className="live"><i />Put your brand and products in front of buyers on the BBM Home page</div></div>

            <div className="ad-tabs" role="tablist" aria-label="Promote sections">
                <button type="button" role="tab" aria-selected={tab === "book"} className={tab === "book" ? "on" : ""} onClick={() => setTab("book")}>Book a placement</button>
                <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My ads</button>
            </div>

            {tab === "book" && (
                <>
                    {saved && (
                        <section className="ad-card ad-resume" role="status">
                            <Sparkles size={18} aria-hidden="true" />
                            <div><b>You have an unfinished booking</b><small>Pick up where you left off.</small></div>
                            <button type="button" className="ad-btn primary sm" onClick={resumeSaved}>Continue</button>
                            <button type="button" className="ad-ib" aria-label="Discard unfinished booking" onClick={discardSaved}><Trash2 size={16} /></button>
                        </section>
                    )}
                    {pl.loading && <div className="ad-plgrid"><span className="ad-sk tall" /><span className="ad-sk tall" /><span className="ad-sk tall" /></div>}
                    {pl.error && <p className="ad-err" role="alert">{pl.error}</p>}
                    {!pl.loading && !pl.error && !pl.list.length && <p className="ad-mute">No placements are open for booking right now. Please check back soon.</p>}
                    <div className="ad-plgrid">
                        {pl.list.map((p) => {
                            const pos = placementPosition(p);
                            return (
                                <article key={p.key} className="ad-card ad-pl">
                                    <PlacementMap placement={p} />
                                    <span className="ad-kind">{p.kind === "banner" ? <Megaphone size={14} aria-hidden="true" /> : <Package size={14} aria-hidden="true" />}{placementLabel(p).kind}</span>
                                    <h3>{placementLabel(p).name}</h3>
                                    <p className="pv-pos"><MapPin size={14} aria-hidden="true" /> {pos.title}</p>
                                    <p>{pos.where}</p>
                                    <span className={`pv-share${placementLabel(p).exclusive ? "" : " on"}`}>{placementLabel(p).count}</span>
                                    <ul className="ad-facts">
                                        <li>From <b>{money(p.fromRate)}</b>/hour + GST</li>
                                        <li>{p.minHours} h minimum</li>
                                        {p.kind === "banner" && sizesOf(p) ? <li>Image size: <b>{sizesOf(p)}</b></li> : null}
                                    </ul>
                                    <button type="button" className="ad-btn primary" onClick={() => startFlow(p)}>Choose dates</button>
                                </article>
                            );
                        })}
                    </div>
                    {!!pl.list.length && <p className="ad-mute ad-fine">Prices move with demand: the fuller a time slot is, the more it costs. You always see the exact total before you pay, and nothing is charged until you confirm. GST {pl.gstPercent}% is added on top.</p>}
                </>
            )}

            {tab === "mine" && (
                <section aria-live="polite">
                    {mine.loading && <div className="ad-plgrid"><span className="ad-sk tall" /><span className="ad-sk tall" /></div>}
                    {mine.error && <p className="ad-err" role="alert">{mine.error} <button type="button" className="ad-link" onClick={loadMine}>Try again</button></p>}
                    {!mine.loading && !mine.error && !mine.list.length && <p className="ad-mute">You haven't booked any ads yet.</p>}
                    <ul className="ad-mine">
                        {mine.list.map((b) => {
                            const st = bookingState(b);
                            const img = b.creative?.images?.wide || Object.values(b.creative?.images || {})[0];
                            return (
                                <li key={b.id} className="ad-card">
                                    {img ? <img src={img} alt="" loading="lazy" /> : <span className="ad-ph"><Package size={20} aria-hidden="true" /></span>}
                                    <div>
                                        <b>{b.placement?.name || "Ad"}</b>
                                        <small>{fmtDateTime(b.starts_at)} to {fmtDateTime(b.ends_at)} IST</small>
                                        <small>{money(b.amount)} incl. GST</small>
                                        {b.status === "removed" && (
                                            <small className="ad-bad">Reason: {b.removed_reason}. {Number(b.refund_amount) > 0 ? `${money(b.refund_amount)} refunded to your credits.` : "No refund was issued."}</small>
                                        )}
                                    </div>
                                    <span className={`ad-pill s-${st.key}`}>{st.label}</span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}

function StickyBar({ summary, sub, label, disabled, onClick }) {
    return (
        <div className="ad-sticky">
            <div><b>{summary}</b>{sub && <small>{sub}</small>}</div>
            <button type="button" className="ad-btn primary" disabled={disabled} onClick={onClick}>{label}</button>
        </div>
    );
}

// Optional priority bid: extra rupees per hour on top of the slot price. Highest bid is listed first in the shelf.
// Only shown when the server marks the placement `biddable`, so nothing here appears until the backend supports it.
function BidBox({ placement, value, hours, quote, onChange }) {
    const step = Number(placement.bidStep) || 5;
    const max = Number(placement.bidMax) || 1000;
    const b = quote.data?.bid || null; // { per_hour, top_bid, rank, listed }
    const set = (v) => onChange(Math.min(max, Math.max(0, Math.floor(Number(v) || 0))));
    return (
        <section className="ad-card ad-bid" aria-label="Priority bid">
            <h3><TrendingUp size={16} aria-hidden="true" /> Get listed first <small>(optional)</small></h3>
            <p className="ad-mute">Sponsored products are shown highest bid first. Add extra money per hour on top of the slot price to move ahead of other sellers. A bid of ₹0 still gets you listed, after the higher bids.</p>
            <div className="ad-bid-row">
                <label className="ad-field">
                    <span>Extra per hour (₹)</span>
                    <input type="number" inputMode="numeric" min={0} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} />
                </label>
                <div className="ad-bid-chips" role="group" aria-label="Quick bids">
                    {[0, 10, 25, 50, 100].map((v) => (
                        <button key={v} type="button" className={`ad-chip${Number(value) === v ? " on" : ""}`} onClick={() => set(v)}>{v === 0 ? "No bid" : `+₹${v}`}</button>
                    ))}
                </div>
            </div>
            <p className="ad-mute">
                {value > 0 ? <>Adds {money(value * hours)} for {hours} h, plus GST. </> : null}
                {b?.top_bid != null ? <>Highest bid for this time: <b>{money(b.top_bid)}</b>/h. </> : null}
                {b?.rank ? <>At this bid you would be <b>#{b.rank}</b>{b.listed ? ` of ${b.listed}` : ""}. </> : null}
                Positions can change if another seller bids higher before the slot starts.
            </p>
        </section>
    );
}