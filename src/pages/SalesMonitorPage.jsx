// src/pages/SalesMonitorPage.jsx: /sales/monitor
// Activity feed for the company owner / team admins (the "Activity" tab of the full-page monitor).
//   Left (desktop) / chips (mobile): employee filter with live status.
//   Right: summary tiles, search, date range, update type (all / enquiries / orders / customers),
//          long-breaks-only, then the live activity feed (day groups, infinite scroll).
// Enquiries open the full-page chat (/sales/monitor/enquiries/:id), orders open the order page, customers the customers page.
// Filters live in the URL (?actor=&mod=&range=&from=&to=&idle=1&q=), so a view can be bookmarked or shared.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, ClipboardList, Clock, Loader2, Search, Users, X, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import { fetchMonitorPeople, fetchMonitorFeed } from "../utils/salesMonitorApi.js";
import { formatTime, dateKeyOf, dateLabelOf } from "../utils/notificationDisplay.js";
import {
    C, MOD_COLOR, MOD_LABEL, OPEN_LABEL, IDLE_MIN, PRESETS, PRESET_KEYS,
    istDate, rangeFor, statusOf, fmtGap, agoText, dLabel, count,
} from "../components/team/monitor/monitorHelpers.js";
import "../components/sales/sales-threads.css";
import "../components/team/monitor/sales-monitor.css";

const PAGE = 30;
const DEFAULT_PRESET = "7d";
const MODULES = [["", "All updates"], ["enquiry", "Enquiries"], ["order", "Orders"], ["customer", "Customers"]];
const mergeUnique = (prev, inc) => { const s = new Set(prev.map((i) => i.id)); return [...prev, ...inc.filter((i) => !s.has(i.id))]; };

/* ------------------------------ small parts ------------------------------ */
const Avatar = ({ name, size = 34 }) => (
    <span className="sm-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{(name || "?").trim()[0]?.toUpperCase()}</span>
);

const StatusPill = ({ s }) => <span className="sm-pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;

const Stat = ({ value, label, red, onClick, pressed }) => {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag {...(onClick ? { type: "button", onClick, "aria-pressed": pressed } : {})} className={`sm-stat${red ? " red" : ""}${pressed ? " on" : ""}${onClick ? " click" : ""}`}>
            <b>{value}</b><span>{label}</span>
        </Tag>
    );
};

const PersonItem = memo(function PersonItem({ p, now, on, onPick }) {
    const s = statusOf(p, now);
    return (
        <li>
            <button type="button" className={`sm-person${on ? " on" : ""}${s.k === "idle" ? " idle" : ""}`} aria-pressed={on} onClick={() => onPick(p.userId)}>
                <Avatar name={p.name} />
                <span className="sm-person-t">
                    <span className="sm-person-n"><b>{p.name}</b><StatusPill s={s} /></span>
                    <small>
                        {count(p.enquiries, "enquiry", "enquiries")} · {count(p.orders, "order", "orders")}
                        {p.idleCount > 0 && <em> · {count(p.idleCount, "break", "breaks")}</em>}
                    </small>
                    <small>{p.lastAny ? `Last activity ${agoText(now, p.lastAny)}` : "No activity yet"}</small>
                </span>
            </button>
        </li>
    );
});

const PersonChip = memo(function PersonChip({ p, now, on, onPick }) {
    const s = statusOf(p, now);
    return (
        <button type="button" className={`sm-chip person${on ? " on" : ""}`} aria-pressed={on} onClick={() => onPick(p.userId)} title={s.label}>
            <span className="sm-dot" style={{ background: s.fg }} />{p.name}
            {/* {p.idleCount > 0 && <span className="sm-chip-n">{p.idleCount}</span>} */}
        </button>
    );
});

const EventRow = memo(function EventRow({ e, onOpen }) {
    const color = e.idle ? C.red : (MOD_COLOR[e.module] || C.muted);
    const clickable = e.module === "customer" ? true : !!e.entityId;
    const Card = clickable ? "button" : "div";
    const breakText = e.idle
        ? (e.meta?.gapFrom === "day_start" ? `First activity came ${fmtGap(e.gapMinutes)} after 9:00 AM` : `No activity for ${fmtGap(e.gapMinutes)} before this`)
        : null;
    return (
        <li className="sm-ev-row">
            <time className="sm-ev-time" style={{ color: e.idle ? C.red : C.muted }} title={new Date(e.createdAt).toLocaleString("en-IN")}>{formatTime(e.createdAt)}</time>
            <Card {...(clickable ? { type: "button", onClick: () => onOpen(e), "aria-label": `${e.title}. ${OPEN_LABEL[e.module] || "Open"}` } : {})}
                className={`sm-ev${e.idle ? " idle" : ""}${clickable ? " click" : ""}`} style={{ "--mc": color }}>
                <span className="sm-ev-top">
                    <span className="sm-tag" style={{ background: `color-mix(in srgb, ${MOD_COLOR[e.module] || C.muted} 12%, transparent)`, color: MOD_COLOR[e.module] || C.muted }}>
                        {MOD_LABEL[e.module] || "Sales"}
                    </span>
                    {e.idle && <span className="sm-tag brk"><Clock size={12} />{fmtGap(e.gapMinutes)} break</span>}
                    {clickable && <span className="sm-open" style={{ color: e.idle ? C.red : C.secondary }}>{OPEN_LABEL[e.module]}<ChevronRight size={14} /></span>}
                </span>
                <span className="sm-ev-title" style={{ color: e.idle ? C.red : C.ink }}>{e.title}</span>
                {e.subtitle && <span className="sm-ev-sub">{e.subtitle}</span>}
                {e.preview && <span className="sm-ev-prev">{e.preview}</span>}
                <span className="sm-ev-who" style={{ color: e.idle ? C.red : C.muted }}>
                    <Avatar name={e.actorName} size={18} />{e.actorName || "Unknown"}{breakText && <> · {breakText}</>}
                </span>
            </Card>
        </li>
    );
});

/* ---------------------------------- page ---------------------------------- */
export default function SalesMonitorPage() {
    const nav = useNavigate();
    const loc = useLocation();
    const [sp, setSp] = useSearchParams();
    const spRef = useRef(sp); spRef.current = sp;
    const { token, effectiveLoggedIn, profile } = useAuth();
    const { socket } = useSocket() || {};

    // Same rule as the Console Sales tab. The server enforces it too.
    const teamRole = profile?.team?.role;
    const canMonitor = effectiveLoggedIn && (!teamRole || teamRole === "admin");
    const waitingProfile = effectiveLoggedIn && !profile;

    // ---- filters (initialised from the URL) ----
    const [preset, setPreset] = useState(() => (PRESET_KEYS.includes(sp.get("range")) ? sp.get("range") : DEFAULT_PRESET));
    const [custom, setCustom] = useState(() => ({ from: sp.get("from") || "", to: sp.get("to") || "" }));
    const [qInput, setQInput] = useState(() => sp.get("q") || "");
    const [q, setQ] = useState(() => (sp.get("q") || "").trim());
    const [moduleF, setModuleF] = useState(() => (MODULES.some(([k]) => k === sp.get("mod")) ? sp.get("mod") : ""));
    const [idleOnly, setIdleOnly] = useState(() => sp.get("idle") === "1");
    const [actorId, setActorId] = useState(() => sp.get("actor") || "");

    const [people, setPeople] = useState(null);
    const [peopleErr, setPeopleErr] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const peopleReq = useRef(0);

    // feed
    const [events, setEvents] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    const reqId = useRef(0);
    const newestRef = useRef(null);
    const eventsRef = useRef([]); eventsRef.current = events;

    const { from, to, all } = rangeFor(preset, custom);
    const live = all || to >= istDate(Date.now());

    useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

    // keep the URL in sync with the filters (compared as text so it never loops)
    useEffect(() => {
        const n = new URLSearchParams();
        if (actorId) n.set("actor", actorId);
        if (moduleF) n.set("mod", moduleF);
        if (preset !== DEFAULT_PRESET) n.set("range", preset);
        if (preset === "custom") { if (custom.from) n.set("from", custom.from); if (custom.to) n.set("to", custom.to); }
        if (idleOnly) n.set("idle", "1");
        if (q) n.set("q", q);
        if (n.toString() !== spRef.current.toString()) setSp(n, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actorId, moduleF, preset, custom, idleOnly, q]);

    // ---- people ----
    const loadPeople = useCallback(async (silent) => {
        const id = ++peopleReq.current;
        const res = await fetchMonitorPeople(token, { from, to, all });
        if (id !== peopleReq.current) return;
        if (res.success) { setPeople(res.people); setPeopleErr(""); }
        else if (!silent) setPeopleErr(res.message || "Couldn't load your salespeople.");
    }, [token, from, to, all]);

    useEffect(() => { if (token && canMonitor) loadPeople(false); }, [token, canMonitor, loadPeople]);

    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const onPing = () => { clearTimeout(t); t = setTimeout(() => loadPeople(true), 1200); };
        socket.on("sales:monitor", onPing);
        return () => { clearTimeout(t); socket.off("sales:monitor", onPing); };
    }, [socket, loadPeople]);

    // ---- feed ----
    const filters = useMemo(
        () => ({ actorId, module: moduleF, idleOnly: idleOnly ? "1" : "", q, from, to }),
        [actorId, moduleF, idleOnly, q, from, to],
    );

    const load = useCallback(async (reset, cursor) => {
        const id = ++reqId.current;   // answers that arrive after a newer request are ignored
        reset ? setLoading(true) : setMore(true);
        const res = await fetchMonitorFeed(token, { ...filters, limit: PAGE, before: cursor?.createdAt, beforeId: cursor?.id });
        if (id !== reqId.current) return;
        if (!res.success) setError(res.message || "Couldn't load the activity.");
        else {
            setError("");
            setEvents((prev) => (reset ? res.events : mergeUnique(prev, res.events)));
            setHasMore(!!res.hasMore);
        }
        setLoading(false); setMore(false);
    }, [token, filters]);

    useEffect(() => { if (token && canMonitor) load(true); }, [load, token, canMonitor]);
    useEffect(() => { newestRef.current = events[0]?.createdAt || null; }, [events]);

    // Only what is newer than the newest row on screen: no spinner, no scroll jump.
    const catchUp = useCallback(async () => {
        const after = newestRef.current;
        if (!after) { load(true); return; }
        const res = await fetchMonitorFeed(token, { ...filters, after });
        if (!res.success) return;
        if (res.reset) { load(true); return; }
        if (!res.events.length) return;
        setEvents((prev) => {
            const ids = new Set(res.events.map((e) => e.id));
            const next = [...res.events, ...prev.filter((e) => !ids.has(e.id))];
            if (next.length > 400) { setHasMore(true); return next.slice(0, 400); }
            return next;
        });
    }, [token, filters, load]);

    useEffect(() => {
        if (!socket || !canMonitor) return undefined;
        let t;
        const onPing = () => { clearTimeout(t); t = setTimeout(catchUp, 250); };
        socket.on("sales:monitor", onPing);
        socket.on("connect", onPing);
        return () => { clearTimeout(t); socket.off("sales:monitor", onPing); socket.off("connect", onPing); };
    }, [socket, catchUp, canMonitor]);

    const sentinelRef = useInfiniteScrollSentinel(
        () => { const l = eventsRef.current[eventsRef.current.length - 1]; if (!more && hasMore && l) load(false, { createdAt: l.createdAt, id: l.id }); },
        { lookahead: 600, disabled: loading || more || !hasMore },
    );

    const groups = useMemo(() => {
        const out = [];
        for (const e of events) {
            const key = dateKeyOf(e.createdAt);
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(e);
            else out.push({ key, label: dateLabelOf(e.createdAt), items: [e] });
        }
        return out;
    }, [events]);

    // ---- actions ----
    const pickPerson = useCallback((id) => setActorId((cur) => (cur === id ? "" : id)), []);
    const openItem = useCallback((e) => {
        if (e.module === "enquiry" && e.entityId) nav(`/sales/monitor/enquiries/${e.entityId}`, { state: { from: `${loc.pathname}${loc.search}` } });
        else if (e.module === "order" && e.entityId) nav(`/sell/order-book/${e.entityId}`);
        else if (e.module === "customer") nav("/sell/customers");
    }, [nav, loc.pathname, loc.search]);
    const clearFilters = () => { setActorId(""); setModuleF(""); setIdleOnly(false); setQInput(""); setQ(""); setPreset(DEFAULT_PRESET); };

    const selected = actorId && people ? people.find((p) => p.userId === actorId) : null;
    const scope = selected ? [selected] : (people || []);
    const sum = (k) => scope.reduce((a, p) => a + (p[k] || 0), 0);
    const rangeText = all ? "all activity" : from === to ? dLabel(from) : `${dLabel(from)} – ${dLabel(to)}`;
    const filtered = !!(actorId || moduleF || idleOnly || q);

    /* ------------------------------ early states ------------------------------ */
    if (waitingProfile) {
        return <div className="gd sm-page"><div className="st-list" style={{ marginTop: 22 }}>{[0, 1, 2].map((i) => <div key={i} className="st-sk tall" />)}</div></div>;
    }
    if (!canMonitor) {
        return (
            <div className="gd sm-page">
                <div className="st-empty-card" style={{ marginTop: 22 }}>
                    <Users size={22} />
                    <b>Only the company owner and team admins can see this page</b>
                    <button type="button" className="st-btn" onClick={() => nav("/home")}>Go home</button>
                </div>
            </div>
        );
    }

    /* ---------------------------------- page ---------------------------------- */
    return (
        <div className="gd sm-page">
            <div className="gk-ph sm-ph" style={{ marginTop: 18 }}>
                <div className="sm-ph-l">
                    {/* <button type="button" className="st-ib" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft size={18} /></button> */}
                    <div>
                        <h1>Team activity</h1>
                        <p>Everything your salespeople do: enquiries, orders and customers, live.</p>
                    </div>
                </div>
                {live && socket && (
                    <span className="sm-live"><span className="sm-live-d" />Live</span>
                )}
            </div>

            {/* controls */}
            <div className="sm-controls">
                <label className="st-srch st-srch-l">
                    <Search size={16} aria-hidden="true" />
                    <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search customer, product, order or employee" aria-label="Search activity" autoComplete="off" />
                    {qInput && <button type="button" aria-label="Clear search" onClick={() => setQInput("")}><X size={14} /></button>}
                </label>

                <div className="sm-row" role="group" aria-label="Date range">
                    {PRESETS.map(([k, t]) => (
                        <button key={k} type="button" className={`sm-chip${preset === k ? " on" : ""}`} aria-pressed={preset === k}
                            onClick={() => { if (k === "custom" && !custom.from) setCustom({ from: istDate(Date.now()), to: istDate(Date.now()) }); setPreset(k); }}>{t}</button>
                    ))}
                </div>

                {preset === "custom" && (
                    <div className="sm-dates">
                        {[["from", "From"], ["to", "To"]].map(([k, t]) => (
                            <label key={k}>
                                <span>{t}</span>
                                <input type="date" className="st-in" value={custom[k]} max={istDate(Date.now())} onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))} />
                            </label>
                        ))}
                    </div>
                )}

                <div className="sm-row" role="group" aria-label="Type of update">
                    {MODULES.map(([k, t]) => (
                        <button key={k || "all"} type="button" className={`sm-chip${moduleF === k ? " on" : ""}`} aria-pressed={moduleF === k} onClick={() => setModuleF(k)}>
                            {k && <span className="sm-dot" style={{ background: MOD_COLOR[k] }} />}{t}
                        </button>
                    ))}
                    <button type="button" className={`sm-chip brk${idleOnly ? " on" : ""}`} aria-pressed={idleOnly} onClick={() => setIdleOnly((v) => !v)}>
                        <Clock size={12} />Long breaks only
                    </button>
                </div>
            </div>

            <div className="sm-grid">
                {/* employees */}
                <aside className="sm-side" aria-label="Employees">
                    {!people && !peopleErr && <div className="st-sk tall" />}
                    {peopleErr && !people && (
                        <div className="st-empty-card"><b>{peopleErr}</b><button type="button" className="st-btn" onClick={() => { setPeopleErr(""); loadPeople(false); }}>Try again</button></div>
                    )}
                    {people && people.length === 0 && (
                        <div className="st-empty-card"><Users size={22} /><b>No salespeople yet</b>Invite a salesperson from the Team tab in the Console.</div>
                    )}
                    {people && people.length > 0 && (
                        <>
                            {/* mobile: chips */}
                            <div className="sm-chips" role="group" aria-label="Filter by employee">
                                <button type="button" className={`sm-chip${!actorId ? " on" : ""}`} aria-pressed={!actorId} onClick={() => setActorId("")}>Everyone</button>
                                {people.map((p) => <PersonChip key={p.userId} p={p} now={now} on={actorId === p.userId} onPick={pickPerson} />)}
                            </div>

                            {/* desktop: list */}
                            <div className="sm-plist">
                                <h2 className="sm-h">Employees <span>{people.length}</span></h2>
                                <button type="button" className={`sm-person all${!actorId ? " on" : ""}`} aria-pressed={!actorId} onClick={() => setActorId("")}>
                                    <span className="sm-av all"><Activity size={16} /></span>
                                    <span className="sm-person-t">
                                        <span className="sm-person-n"><b>Everyone</b></span>
                                        <small>{count(people.reduce((a, p) => a + p.total, 0), "update", "updates")} in this period</small>
                                    </span>
                                </button>
                                <ul>{people.map((p) => <PersonItem key={p.userId} p={p} now={now} on={actorId === p.userId} onPick={pickPerson} />)}</ul>
                            </div>
                        </>
                    )}
                </aside>

                {/* feed */}
                <main className="sm-main">
                    {people && people.length > 0 && (
                        <>
                            {/* <div className="sm-stats">
                                <Stat value={sum("total")} label="Updates" />
                                <Stat value={sum("enquiries")} label={sum("enquiries") === 1 ? "Enquiry" : "Enquiries"} />
                                <Stat value={sum("orders")} label={sum("orders") === 1 ? "Order" : "Orders"} />
                                <Stat value={sum("idleCount")} label={`Long break${sum("idleCount") === 1 ? "" : "s"} (${IDLE_MIN}+ min)`} red={sum("idleCount") > 0}
                                    onClick={() => setIdleOnly((v) => !v)} pressed={idleOnly} />
                            </div> */}
                            <p className="gd-note sm-note">
                                {selected ? <><b>{selected.name}</b> · </> : null}Showing {rangeText}
                                {!loading && !error ? ` · ${events.length}${hasMore ? "+" : ""} update${events.length === 1 && !hasMore ? "" : "s"} loaded` : ""}
                                {filtered && <> · <button type="button" className="sm-link" onClick={clearFilters}>Reset filters</button></>}
                            </p>
                        </>
                    )}

                    {loading && events.length === 0 ? (
                        <div className="st-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
                    ) : error ? (
                        <div className="st-empty-card"><b>{error}</b><button type="button" className="st-btn" onClick={() => load(true)}>Try again</button></div>
                    ) : events.length === 0 ? (
                        <div className="st-empty-card">
                            <ClipboardList size={22} />
                            <b>No activity found</b>
                            Try another date range, or clear the search and filters.
                            {filtered && <button type="button" className="st-btn" onClick={clearFilters}>Reset filters</button>}
                        </div>
                    ) : (
                        <div className={loading ? "sm-busy" : undefined}>
                            {groups.map((g) => (
                                <section key={g.key} className="sm-day">
                                    <h3>{g.label}</h3>
                                    <ul className="sm-evs">{g.items.map((e) => <EventRow key={e.id} e={e} onOpen={openItem} />)}</ul>
                                </section>
                            ))}
                            {more && <p className="st-more" aria-live="polite"><Loader2 size={16} className="st-spin" />Loading more…</p>}
                            {hasMore && !loading && <div ref={sentinelRef} style={{ height: 4 }} />}
                            {hasMore && !loading && !more && (
                                <div className="sm-morew"><button type="button" className="st-btn" onClick={() => { const l = events[events.length - 1]; load(false, { createdAt: l?.createdAt, id: l?.id }); }}>Show older activity</button></div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}