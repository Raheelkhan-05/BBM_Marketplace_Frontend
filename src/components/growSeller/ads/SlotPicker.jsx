// SlotPicker.jsx — step 1 of the Promote flow: pick a DATE (month calendar with availability and price range),
// then the START HOUR (hour grid for that day), then the duration. Everything is IST.
// Unlimited placements (placement.unlimited, e.g. Sponsored product) never show seat counts or "filling up / full" wording.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { fetchAvailability } from "../../../utils/adsApi.js";
import {
    istDateKey, addDays, addMonths, monthOf, monthGrid, monthLabel,
    fmtHour, fmtDay, fmtDateTime, endIso, money,
} from "./adsHelpers.js";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_STATUS = { open: "Available", limited: "Filling up", full: "Fully booked", blocked: "Closed by BBM", closed: "Unavailable" };
const HOUR_STATUS = { open: "Available", full: "Booked", blocked: "Closed", past: "Past", too_far: "Too far ahead" };

export default function SlotPicker({ token, placement, start, hours, onChange, refreshKey = 0 }) {
    const unlimited = !!placement.unlimited;
    const today = istDateKey();
    const lastDay = addDays(today, placement.maxDaysAhead);
    const startDay = start ? istDateKey(new Date(start)) : null;

    const [month, setMonth] = useState(() => monthOf(startDay || today));
    const [day, setDay] = useState(startDay);
    const [mState, setMState] = useState({ loading: true, days: null, error: null });
    const [dState, setDState] = useState({ loading: false, hours: null, error: null });

    // Month calendar
    useEffect(() => {
        if (!token) return undefined;
        const ac = new AbortController();
        setMState((s) => ({ ...s, loading: true, error: null }));
        fetchAvailability(token, placement.key, { month }, ac.signal).then((res) => {
            if (res.aborted) return;
            if (res.success) setMState({ loading: false, days: res.days || [], error: null });
            else setMState({ loading: false, days: null, error: res.message || "Couldn't load availability." });
        });
        return () => ac.abort();
    }, [token, placement.key, month, refreshKey]);

    // Hour grid for the chosen day
    useEffect(() => {
        if (!token || !day) { setDState({ loading: false, hours: null, error: null }); return undefined; }
        const ac = new AbortController();
        setDState((s) => ({ ...s, loading: true, error: null }));
        fetchAvailability(token, placement.key, { day }, ac.signal).then((res) => {
            if (res.aborted) return;
            if (res.success) setDState({ loading: false, hours: res.hours || [], error: null });
            else setDState({ loading: false, hours: null, error: res.message || "Couldn't load the hours." });
        });
        return () => ac.abort();
    }, [token, placement.key, day, refreshKey]);

    const dayMap = useMemo(() => new Map((mState.days || []).map((d) => [String(d.day).slice(0, 10), d])), [mState.days]);
    const cells = useMemo(() => monthGrid(month), [month]);

    const step = placement.minHours >= 24 ? 24 : 1;
    const chips = useMemo(() => {
        const base = [1, 2, 3, 6, 12, 24, 48, 72, 168].filter((v) => v >= placement.minHours && v <= placement.maxHours && v % step === 0);
        return base.includes(placement.minHours) ? base : [placement.minHours, ...base];
    }, [placement.minHours, placement.maxHours, step]);
    const clamp = (n) => Math.min(placement.maxHours, Math.max(placement.minHours, n));

    const pickDay = (key) => { setDay(key); if (start && istDateKey(new Date(start)) !== key) onChange({ start: null, hours }); };
    const pickHour = (h) => { if (h.status === "open") onChange({ start: h.hour_start, hours: clamp(hours || placement.minHours) }); };
    const setHours = (n) => onChange({ start, hours: clamp(n) });

    const startMs = start ? new Date(start).getTime() : null;
    const endMs = start ? startMs + hours * 3600000 : null;

    return (
        <div className="ad-slot">
            {/* 1. date */}
            <section className="ad-card" aria-labelledby="ad-date-h">
                <div className="ad-cal-head">
                    <h3 id="ad-date-h">1. Pick a date</h3>
                    <div className="ad-cal-nav">
                        <button type="button" className="ad-ib" aria-label="Previous month" disabled={month <= monthOf(today)} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={18} /></button>
                        <b>{monthLabel(month)}</b>
                        <button type="button" className="ad-ib" aria-label="Next month" disabled={month >= monthOf(lastDay)} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="ad-week" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
                <div className={`ad-cal${mState.loading ? " is-loading" : ""}`} role="grid" aria-busy={mState.loading}>
                    {cells.map((key, i) => {
                        if (!key) return <span key={`pad${i}`} />;
                        const info = dayMap.get(key);
                        const out = key < today || key > lastDay;
                        const status = out ? "closed" : info?.status || (mState.loading ? "open" : "closed");
                        const disabled = out || !info || status === "full" || status === "blocked" || status === "closed";
                        const price = info?.min_rate != null && !disabled ? Math.round(Number(info.min_rate)) : null;
                        // unlimited placements are never "filling up": show those days as plainly available
                        const shown = unlimited && status === "limited" ? "open" : status;
                        return (
                            <button
                                key={key} type="button" role="gridcell" disabled={disabled}
                                className={`ad-day s-${shown}${day === key ? " sel" : ""}${key === today ? " today" : ""}`}
                                aria-pressed={day === key}
                                aria-label={`${fmtDay(key)}, ${DAY_STATUS[shown] || ""}${price != null ? `, from ${money(price)} per hour` : ""}`}
                                onClick={() => pickDay(key)}
                            >
                                <span>{Number(key.slice(8))}</span>
                                {price != null && <small>₹{price}</small>}
                            </button>
                        );
                    })}
                </div>
                {mState.error && <p className="ad-err" role="alert">{mState.error}</p>}
                <ul className="ad-legend" aria-label="Legend">
                    {unlimited
                        ? <><li><i className="s-open" />Available</li><li><i className="s-full" />Closed</li></>
                        : <><li><i className="s-open" />Available</li><li><i className="s-limited" />Filling up</li><li><i className="s-full" />Full / closed</li></>}
                </ul>
            </section>

            {/* 2. start hour */}
            <section className="ad-card" aria-labelledby="ad-hour-h">
                <h3 id="ad-hour-h">2. Pick a start time <small>(IST)</small></h3>
                {!day && <p className="ad-mute">Choose a date first.</p>}
                {day && (
                    <>
                        <p className="ad-mute">{fmtDay(day)}. Prices are per hour, before GST.</p>
                        {dState.loading && !dState.hours && <div className="ad-hours"><span className="ad-sk" /><span className="ad-sk" /><span className="ad-sk" /></div>}
                        {dState.error && <p className="ad-err" role="alert">{dState.error}</p>}
                        {dState.hours && (
                            <div className={`ad-hours${dState.loading ? " is-loading" : ""}`}>
                                {dState.hours.map((h) => {
                                    const t = new Date(h.hour_start).getTime();
                                    const inRange = startMs != null && t >= startMs && t < endMs;
                                    const hot = !unlimited && Number(h.occupancy) >= 0.66 && h.status === "open";
                                    return (
                                        <button
                                            key={h.hour_start} type="button" disabled={h.status !== "open"}
                                            className={`ad-hr s-${h.status}${inRange ? " in" : ""}${t === startMs ? " sel" : ""}${hot ? " hot" : ""}`}
                                            aria-pressed={t === startMs}
                                            aria-label={`${fmtHour(h.hour_start)}, ${HOUR_STATUS[h.status] || ""}${h.status === "open" ? `, ${money(h.rate)} per hour` : ""}`}
                                            title={h.override_reason || undefined}
                                            onClick={() => pickHour(h)}
                                        >
                                            <b>{fmtHour(h.hour_start)}</b>
                                            {h.status === "open"
                                                ? <small>{money(h.rate)}{!unlimited && placement.lanes > 1 ? ` · ${h.free_lanes} left` : ""}</small>
                                                : <small>{HOUR_STATUS[h.status]}</small>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* 3. duration */}
            <section className="ad-card" aria-labelledby="ad-dur-h">
                <h3 id="ad-dur-h">3. How long?</h3>
                <div className="ad-dur">
                    <button type="button" className="ad-ib" aria-label="Shorter" disabled={!start || hours <= placement.minHours} onClick={() => setHours(hours - step)}><Minus size={16} /></button>
                    <output aria-live="polite"><b>{hours}</b> hour{hours === 1 ? "" : "s"}</output>
                    <button type="button" className="ad-ib" aria-label="Longer" disabled={!start || hours >= placement.maxHours} onClick={() => setHours(hours + step)}><Plus size={16} /></button>
                </div>
                <div className="ad-chips" role="group" aria-label="Quick durations">
                    {chips.map((v) => (
                        <button key={v} type="button" disabled={!start} aria-pressed={hours === v} onClick={() => setHours(v)}>
                            {v % 24 === 0 ? `${v / 24} day${v === 24 ? "" : "s"}` : `${v} h`}
                        </button>
                    ))}
                </div>
                <p className="ad-mute">Min {placement.minHours} h, max {placement.maxHours} h.</p>
                {start && (
                    <p className="ad-when" role="status">
                        <b>{fmtDateTime(start)}</b> to <b>{fmtDateTime(endIso(start, hours))}</b> IST
                    </p>
                )}
                {placement.minHours >= 24 && <p className="ad-mute">This placement runs in whole days.</p>}
                {isLoadingNote(dState, mState)}
            </section>
        </div>
    );
}

function isLoadingNote(d, m) {
    return (d.loading || m.loading) ? <p className="ad-mute"><Loader2 size={14} className="ad-spin" aria-hidden="true" /> Updating availability…</p> : null;
}