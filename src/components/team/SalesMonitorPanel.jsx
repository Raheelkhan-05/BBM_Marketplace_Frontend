// components/team/SalesMonitorPanel.jsx: the "Sales" tab inside the Console sheet (team admin / owner only).
// Two steps:
//   1. Overview  : one card per salesperson (status, enquiries worked on, orders punched, long breaks).
//   2. Activity  : the live log of everything one salesperson (or everyone) did. Search and filters live here.
// Long break (decided on the server): between 9:00 AM and 6:00 PM IST, more than 30 min with no activity marks the
// next entry red, per salesperson. A new day starts counting from 9:00 AM.
// Clicking a log: enquiries open the read-only viewer (with a Back button), orders open the Order Book page.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ChevronRight, Users, ClipboardList, Search, X, Clock, ArrowLeft, Activity } from "lucide-react";
import { fetchMonitorPeople, fetchMonitorFeed } from "../../utils/salesMonitorApi.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { formatTime, dateKeyOf, dateLabelOf } from "../../utils/notificationDisplay.js";
import SalesThreadViewer from "./SalesThreadViewer.jsx";

const C = {
    ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)",
    tile: "rgba(20,27,34,0.06)", rail: "rgba(20,27,34,0.14)", red: "#d2462b", green: "#12794A",
};
const MOD_COLOR = { enquiry: "#114072", order: "#22A06B", customer: "#7A3EB1" };
const MOD_LABEL = { enquiry: "Enquiry", order: "Order", customer: "Customer" };
const OPEN_LABEL = { enquiry: "View enquiry", order: "View order", customer: "View customers" };

const IST_MS = 19_800_000, DAY_MS = 86_400_000, WORK_START = 540, WORK_END = 1080, IDLE_MIN = 30;
const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const istDayStart = (ms) => Math.floor((ms + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
const istMinutes = (ms) => { const d = new Date(ms + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const fmtGap = (m) => { const n = Math.max(0, Math.round(m)); return n < 60 ? `${n} min` : `${Math.floor(n / 60)}h ${n % 60 ? `${n % 60}m` : ""}`.trim(); };
const agoText = (now, iso) => { const m = Math.floor((now - Date.parse(iso)) / 60_000); return m < 1 ? "just now" : `${fmtGap(m)} ago`; };
const dLabel = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const count = (v, one, many) => `${v} ${v === 1 ? one : many}`;

const PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Pick dates"]];
function rangeFor(preset, custom) {
    const today = istDate(Date.now());
    if (preset === "yesterday") { const y = addDays(today, -1); return { from: y, to: y }; }
    if (preset === "7d") return { from: addDays(today, -6), to: today };
    if (preset === "30d") return { from: addDays(today, -29), to: today };
    if (preset === "custom") {
        let from = custom.from || today, to = custom.to || custom.from || today;
        if (from > to) [from, to] = [to, from];
        return { from, to };
    }
    return { from: today, to: today };
}

// Live status of a salesperson, always about "right now" (independent of the chosen date range).
function statusOf(p, now) {
    const m = istMinutes(now);
    if (m < WORK_START || m > WORK_END) return { k: "off", label: "Off hours", fg: C.muted, bg: C.tile };
    const open = istDayStart(now) + WORK_START * 60_000;
    const last = p.lastAny ? Date.parse(p.lastAny) : 0;
    const gap = (now - Math.max(last, open)) / 60_000;
    if (gap > IDLE_MIN) {
        return { k: "idle", label: last >= open ? `Idle ${fmtGap(gap)}` : "No activity yet today", fg: C.red, bg: "rgba(210,70,43,.12)" };
    }
    return { k: "active", label: "Active", fg: C.green, bg: "rgba(34,160,107,.14)" };
}

const SCROLL_CLS = "min-h-[min(380px,50dvh)] flex-1 overflow-y-auto px-3 pb-[var(--sheet-pb,24px)] md:min-h-0 md:px-5 md:pb-6";
const HEAD_CLS = "shrink-0 px-5 pb-2 pt-3 md:px-7 md:pb-3 md:pt-4";
const TIME_W = 44, RAIL_W = 12, GAP = 8, DOT = 10, DOT_Y = 17;
const GRID = `${TIME_W}px ${RAIL_W}px minmax(0,1fr)`;
const chipStyle = (on) => (on ? { background: "#000", color: "#fff" } : { background: C.tile, color: C.muted });
const INPUT_RING = { borderColor: C.hair, color: C.ink, "--tw-ring-color": "rgba(11,114,133,.35)" };

const Avatar = ({ name }) => (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: C.secondary }}>
        {(name || "?").trim()[0]?.toUpperCase()}
    </span>
);

function Empty({ Icon, title, text }) {
    return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: C.tile }}><Icon className="h-5 w-5" style={{ color: C.muted }} /></span>
            <p className="text-[13px] font-bold" style={{ color: C.ink }}>{title}</p>
            {text && <p className="max-w-[260px] text-[11.5px] font-medium leading-snug" style={{ color: C.muted }}>{text}</p>}
        </div>
    );
}

function Skeleton() {
    const fill = { background: C.tile };
    return (
        <section className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading sales activity">
            <div className={HEAD_CLS}><div className="h-[20px] w-32 animate-pulse rounded-md" style={fill} /></div>
            <div className={`${SCROLL_CLS} overflow-hidden`}>
                <div className="mb-3 h-8 animate-pulse rounded-full" style={fill} />
                <ul className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="h-[128px] animate-pulse rounded-2xl" style={fill} />)}</ul>
            </div>
        </section>
    );
}

/* -------------------------------- stats -------------------------------- */
const Tile = ({ value, label, sub, red }) => (
    <div className="rounded-xl px-2 py-2 text-center" style={{ background: red ? "rgba(210,70,43,.1)" : C.tile }}>
        <div className="text-[18px] font-extrabold leading-none tabular-nums" style={{ color: red ? C.red : C.ink }}>{value}</div>
        <div className="mt-1.5 text-[11.5px] font-bold leading-tight" style={{ color: red ? C.red : C.ink }}>{label}</div>
        <div className="mt-0.5 text-[10.5px] font-medium leading-tight" style={{ color: red ? C.red : C.muted }}>{sub}</div>
    </div>
);

// Enquiries = different enquiries worked on (each counted once). Orders = orders punched. Long breaks = 30+ min gaps.
const Tiles = ({ p }) => (
    <div className="grid grid-cols-3 gap-1.5">
        <Tile value={p.enquiries} label={p.enquiries === 1 ? "Enquiry" : "Enquiries"} sub={p.newEnquiries ? `${p.newEnquiries} new` : "worked on"} />
        <Tile value={p.orders} label={p.orders === 1 ? "Order" : "Orders"} sub="punched" />
        <Tile value={p.idleCount} label={p.idleCount === 1 ? "Long break" : "Long breaks"} sub={`over ${IDLE_MIN} min`} red={p.idleCount > 0} />
    </div>
);

const StatusPill = ({ s }) => (
    <span className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase leading-none tracking-wide" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
);

const PersonCard = memo(function PersonCard({ p, now, onPick }) {
    const s = statusOf(p, now);
    return (
        <li>
            <button type="button" onClick={() => onPick(p.userId)}
                className="block w-full rounded-2xl border p-3 text-left transition-colors hover:bg-black/[0.025] active:bg-black/[0.04]"
                style={{ borderColor: s.k === "idle" ? "rgba(210,70,43,.35)" : C.hair }}>
                <div className="flex items-center gap-3">
                    <Avatar name={p.name} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>{p.name}</span>
                            <StatusPill s={s} />
                        </div>
                        <div className="truncate text-[11.5px] font-medium" style={{ color: C.muted }}>
                            {count(p.total, "update", "updates")} · {p.lastAny ? `Last activity ${agoText(now, p.lastAny)}` : "No activity yet"}
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                </div>
                <div className="mt-2.5"><Tiles p={p} /></div>
                {p.idleCount > 0 && (
                    <p className="mt-2 flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.red }}>
                        <Clock className="h-3 w-3" />Longest break {fmtGap(p.longestGap)}
                    </p>
                )}
            </button>
        </li>
    );
});

/* ------------------------------ timeline row ------------------------------ */
const Row = memo(function Row({ e, isLast, onOpen }) {
    const color = e.idle ? C.red : (MOD_COLOR[e.module] || C.muted);
    const clickable = e.module === "customer" ? true : !!e.entityId;
    const Card = clickable ? "button" : "div";
    const breakText = e.idle
        ? (e.meta?.gapFrom === "day_start" ? `First activity came ${fmtGap(e.gapMinutes)} after 9:00 AM` : `No activity for ${fmtGap(e.gapMinutes)} before this`)
        : null;
    return (
        <div className="grid" style={{ gridTemplateColumns: GRID, columnGap: GAP }}>
            <time className="select-none text-right text-[10.5px] font-semibold tabular-nums leading-none"
                style={{ color: e.idle ? C.red : C.muted, paddingTop: DOT_Y - 6 }} title={new Date(e.createdAt).toLocaleString("en-IN")}>
                {formatTime(e.createdAt)}
            </time>

            <div className="relative" aria-hidden="true">
                <span className="absolute left-1/2 top-0 w-[2px] -translate-x-1/2 rounded-full" style={{ background: C.rail, height: isLast ? DOT_Y : "100%" }} />
                <span className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
                    style={{
                        top: DOT_Y - DOT / 2, width: DOT, height: DOT, boxSizing: "border-box", borderColor: color, background: color,
                        boxShadow: e.idle ? "0 0 0 3px rgba(210,70,43,.22)" : "none",
                    }} />
            </div>

            <div className="min-w-0 pb-1">
                <Card {...(clickable ? { type: "button", onClick: () => onOpen(e), "aria-label": `${e.title}. ${OPEN_LABEL[e.module] || "Open"}` } : {})}
                    className={`block w-full rounded-xl px-2.5 py-2 text-left ${clickable ? "cursor-pointer transition-colors duration-150 active:bg-black/[0.05]" : ""}`}
                    style={e.idle ? { background: "rgba(210,70,43,.08)", boxShadow: "inset 0 0 0 1px rgba(210,70,43,.38)" } : undefined}>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md px-1.5 py-[2px] text-[10.5px] font-bold leading-[14px]"
                            style={{ background: `color-mix(in srgb, ${MOD_COLOR[e.module] || C.muted} 12%, transparent)`, color: MOD_COLOR[e.module] || C.muted }}>
                            {MOD_LABEL[e.module] || "Sales"}
                        </span>
                        {e.idle && (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[10.5px] font-bold leading-[14px] text-white" style={{ background: C.red }}>
                                <Clock className="h-3 w-3" />{fmtGap(e.gapMinutes)} break
                            </span>
                        )}
                        {clickable && (
                            <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: e.idle ? C.red : C.secondary }}>
                                {OPEN_LABEL[e.module]}<ChevronRight className="h-3.5 w-3.5" />
                            </span>
                        )}
                    </div>
                    <div className="mt-1 text-[13px] font-semibold leading-snug tracking-wide" style={{ color: e.idle ? C.red : C.ink }}>{e.title}</div>
                    {e.subtitle && <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: C.ink }}>{e.subtitle}</div>}
                    {e.preview && (
                        <div className="mt-1 line-clamp-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium leading-snug tracking-wide" style={{ background: C.tile, color: C.ink }}>{e.preview}</div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] font-semibold tracking-wide" style={{ color: e.idle ? C.red : C.muted }}>
                        <span>{e.actorName || "Unknown"}</span>
                        {breakText && <span>· {breakText}</span>}
                    </div>
                </Card>
            </div>
        </div>
    );
});

function Timeline({ token, filters, socket, onOpen }) {
    const [events, setEvents] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    const reqId = useRef(0);
    const newestRef = useRef(null);

    const load = useCallback(async (reset, cursor) => {
        const id = ++reqId.current;   // answers that arrive after a newer request are ignored
        reset ? setLoading(true) : setMore(true);
        const res = await fetchMonitorFeed(token, { ...filters, limit: 30, before: cursor?.createdAt, beforeId: cursor?.id });
        if (id !== reqId.current) return;
        if (!res.success) setError(res.message || "Couldn't load the activity.");
        else {
            setError("");
            setEvents((prev) => (reset ? res.events : [...prev, ...res.events]));
            setHasMore(!!res.hasMore);
        }
        setLoading(false); setMore(false);
    }, [token, filters]);

    useEffect(() => { load(true); }, [load]);
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
            if (next.length > 300) { setHasMore(true); return next.slice(0, 300); }
            return next;
        });
    }, [token, filters, load]);

    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const onPing = () => { clearTimeout(t); t = setTimeout(catchUp, 250); };
        socket.on("sales:monitor", onPing);
        socket.on("connect", onPing);
        return () => { clearTimeout(t); socket.off("sales:monitor", onPing); socket.off("connect", onPing); };
    }, [socket, catchUp]);

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

    if (loading) return <div className="flex justify-center py-10" style={{ color: C.muted }}><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-8">
                <p role="alert" className="text-center text-[13px] font-bold" style={{ color: C.red }}>{error}</p>
                <button type="button" onClick={() => load(true)} className="rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: C.secondary }}>Try again</button>
            </div>
        );
    }
    if (!events.length) return <Empty Icon={ClipboardList} title="No activity found" text="Try another date range, or clear the search and filters." />;

    return (
        <div>
            {groups.map((g) => (
                <div key={g.key} className="mb-1.5">
                    <h4 className="px-1 pb-1.5 pt-3 text-[18px] font-extrabold leading-tight tracking-tight md:text-[19px]" style={{ color: C.ink }}>{g.label}</h4>
                    {g.items.map((e, i) => <Row key={e.id} e={e} isLast={i === g.items.length - 1} onOpen={onOpen} />)}
                </div>
            ))}
            {hasMore && (
                <div className="flex justify-center py-2">
                    <button type="button" disabled={more} onClick={() => { const l = events[events.length - 1]; load(false, { createdAt: l?.createdAt, id: l?.id }); }}
                        className="h-9 rounded-full border px-4 text-[12px] font-bold tracking-wide transition-colors hover:bg-black/[0.03] disabled:opacity-60" style={{ borderColor: C.hair, color: C.ink }}>
                        {more ? "Loading…" : "Show older activity"}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ----------------------------------- panel ----------------------------------- */
export default function SalesMonitorPanel({ token, active, scrollProps }) {
    const navigate = useNavigate();
    const { socket } = useSocket();

    const [view, setView] = useState("overview");        // overview | activity
    const [preset, setPreset] = useState("today");
    const [custom, setCustom] = useState({ from: "", to: "" });
    const [qInput, setQInput] = useState("");
    const [q, setQ] = useState("");
    const [moduleF, setModuleF] = useState("");
    const [idleOnly, setIdleOnly] = useState(false);
    const [actorId, setActorId] = useState("");
    const [people, setPeople] = useState(null);
    const [peopleErr, setPeopleErr] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const [viewer, setViewer] = useState(null);          // { id, who }
    const peopleReq = useRef(0);
    const scrollRef = useRef(null);

    const { from, to } = rangeFor(preset, custom);
    const live = to >= istDate(Date.now());

    useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
    useEffect(() => { if (!active) setViewer(null); }, [active]);
    useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [view, actorId]);

    const loadPeople = useCallback(async (silent) => {
        const id = ++peopleReq.current;
        const res = await fetchMonitorPeople(token, { from, to });
        if (id !== peopleReq.current) return;
        if (res.success) { setPeople(res.people); setPeopleErr(""); }
        else if (!silent) setPeopleErr(res.message || "Couldn't load your salespeople.");
    }, [token, from, to]);

    useEffect(() => { if (active && token) loadPeople(false); }, [active, token, loadPeople]);

    // Counts refresh on live activity (debounced; the server caches and invalidates by version).
    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const onPing = () => { clearTimeout(t); t = setTimeout(() => loadPeople(true), 1200); };
        socket.on("sales:monitor", onPing);
        return () => { clearTimeout(t); socket.off("sales:monitor", onPing); };
    }, [socket, loadPeople]);

    const filters = useMemo(() => ({ actorId, module: moduleF, idleOnly: idleOnly ? "1" : "", q, from, to }), [actorId, moduleF, idleOnly, q, from, to]);

    const openActivity = useCallback((id, opts = {}) => {
        setActorId(id || ""); setQInput(""); setQ(""); setModuleF(""); setIdleOnly(!!opts.idleOnly); setView("activity");
    }, []);
    const backToOverview = useCallback(() => {
        setView("overview"); setActorId(""); setQInput(""); setQ(""); setModuleF(""); setIdleOnly(false);
    }, []);

    const openItem = useCallback((e) => {
        if (e.module === "enquiry" && e.entityId) setViewer({ id: e.entityId, who: e.actorName });
        else if (e.module === "order" && e.entityId) navigate(`/sell/order-book/${e.entityId}`);
        else if (e.module === "customer") navigate("/sell/customers");
    }, [navigate]);

    const selected = actorId && people ? people.find((p) => p.userId === actorId) : null;
    const breaksTotal = people ? people.reduce((a, p) => a + p.idleCount, 0) : 0;
    const rangeText = from === to ? dLabel(from) : `${dLabel(from)} – ${dLabel(to)}`;

    if (!people && !peopleErr) return <Skeleton />;
    if (peopleErr && !people) {
        return (
            <section className="flex min-h-0 flex-1 flex-col" aria-label="Sales activity">
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <p className="text-[13px] font-bold" style={{ color: C.ink }}>{peopleErr}</p>
                    <button type="button" onClick={() => { setPeopleErr(""); loadPeople(false); }} className="rounded-full px-4 py-2 text-[12px] font-bold tracking-wide text-white" style={{ background: C.secondary }}>Try again</button>
                </div>
            </section>
        );
    }

    const title = view === "overview" ? "Sales activity" : (selected?.name || "All activity");

    return (
        <section className="flex min-h-0 flex-1 flex-col" aria-label="Sales activity">
            {/* header */}
            <div className={HEAD_CLS}>
                <div className="flex items-center gap-2">
                    {view === "activity" && (
                        <button type="button" onClick={backToOverview} aria-label="Back to salespeople"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-black/10 active:scale-95" style={{ background: C.tile, color: C.ink }}>
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    )}
                    <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-wide md:text-[16px]" style={{ color: C.ink }}>{title}</h3>
                    {live && socket && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold uppercase leading-none" style={{ background: "rgba(34,160,107,.14)", color: C.green }}>
                            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: C.green }} /><span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: C.green }} /></span>
                            Live
                        </span>
                    )}
                </div>
                {view === "overview" && (
                    <p className="mt-1 text-[12px] font-medium leading-snug" style={{ color: C.muted }}>See what your salespeople are doing. Tap a person for their full activity.</p>
                )}
            </div>

            <div ref={scrollRef} {...scrollProps} className={SCROLL_CLS} style={{ overscrollBehavior: "contain" }}>
                {/* date range (both steps) */}
                <div className="space-y-2 px-1 pb-2 pt-1">
                    <div role="group" aria-label="Date range" className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                        {PRESETS.map(([k, t]) => (
                            <button key={k} type="button" aria-pressed={preset === k}
                                onClick={() => { if (k === "custom" && !custom.from) setCustom({ from: istDate(Date.now()), to: istDate(Date.now()) }); setPreset(k); }}
                                className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold tracking-wide" style={chipStyle(preset === k)}>{t}</button>
                        ))}
                    </div>
                    {preset === "custom" && (
                        <div className="grid grid-cols-2 gap-2">
                            {[["from", "From"], ["to", "To"]].map(([k, t]) => (
                                <label key={k} className="block">
                                    <span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{t}</span>
                                    <input type="date" value={custom[k]} max={istDate(Date.now())} onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                                        className="h-9 w-full rounded-xl border bg-white px-2.5 text-[12.5px] font-semibold outline-none focus:ring-2" style={INPUT_RING} />
                                </label>
                            ))}
                        </div>
                    )}
                    <p className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Showing {rangeText}</p>
                </div>

                {people && people.length === 0 ? (
                    <Empty Icon={Users} title="No salespeople yet" text="Invite a salesperson from the Team tab. Their work will show up here live." />
                ) : view === "overview" ? (
                    <div className="space-y-2 pt-1">
                        <button type="button" onClick={() => openActivity("")}
                            className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-black/[0.025] active:bg-black/[0.04]" style={{ borderColor: C.hair, background: "rgba(11,114,133,0.04)" }}>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.secondary, color: "#fff" }}><Activity className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>All activity</span>
                                <span className="block text-[11.5px] font-medium" style={{ color: C.muted }}>Everything everyone did, newest first</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                        </button>

                        {breaksTotal > 0 && (
                            <button type="button" onClick={() => openActivity("", { idleOnly: true })}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold" style={{ background: "rgba(210,70,43,.1)", color: C.red }}>
                                <Clock className="h-4 w-4 shrink-0" />{count(breaksTotal, "long break", "long breaks")} in this period. Tap to see them.
                                <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                            </button>
                        )}

                        <ul className="space-y-2">{people.map((p) => <PersonCard key={p.userId} p={p} now={now} onPick={openActivity} />)}</ul>

                        <div className="rounded-xl px-3 py-2.5 text-[11.5px] font-medium leading-relaxed" style={{ background: C.tile, color: C.muted }}>
                            <b style={{ color: C.ink }}>Enquiries</b> counts each enquiry once, however many updates were added to it.{" "}
                            <b style={{ color: C.ink }}>Orders</b> are orders punched.{" "}
                            <b style={{ color: C.ink }}>Updates</b> are all actions in total.{" "}
                            A <b style={{ color: C.red }}>long break</b> is {IDLE_MIN}+ minutes without any activity between 9:00 AM and 6:00 PM (IST). Each day starts counting from 9:00 AM.
                        </div>
                    </div>
                ) : (
                    <div>
                        {selected && (
                            <div className="mb-2 rounded-2xl border p-3" style={{ borderColor: C.hair, background: "rgba(11,114,133,0.04)" }}>
                                <div className="flex items-center gap-3">
                                    <Avatar name={selected.name} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{selected.name}</span>
                                            <StatusPill s={statusOf(selected, now)} />
                                        </div>
                                        <div className="truncate text-[11.5px] font-medium" style={{ color: C.muted }}>
                                            {count(selected.total, "update", "updates")} · {selected.lastAny ? `Last activity ${agoText(now, selected.lastAny)}` : "No activity yet"}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2.5"><Tiles p={selected} /></div>
                            </div>
                        )}

                        <div className="space-y-2 px-1 pb-1">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                                <input value={qInput} onChange={(e) => setQInput(e.target.value)}
                                    placeholder="Search customer, product, order…" aria-label="Search activity" autoComplete="off"
                                    className="h-10 w-full rounded-xl border bg-white pl-9 pr-9 text-[13px] font-semibold tracking-wide outline-none focus:ring-2" style={INPUT_RING} />
                                {qInput && (
                                    <button type="button" aria-label="Clear search" onClick={() => setQInput("")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/5" style={{ color: C.muted }}>
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                {[["", "All"], ["enquiry", "Enquiries"], ["order", "Orders"], ["customer", "Customers"]].map(([k, t]) => (
                                    <button key={k || "all"} type="button" aria-pressed={moduleF === k} onClick={() => setModuleF(k)}
                                        className="rounded-full px-3 py-1.5 text-[11.5px] font-bold tracking-wide" style={chipStyle(moduleF === k)}>{t}</button>
                                ))}
                                <button type="button" aria-pressed={idleOnly} onClick={() => setIdleOnly((v) => !v)}
                                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold tracking-wide"
                                    style={idleOnly ? { background: C.red, color: "#fff" } : { background: "rgba(210,70,43,.1)", color: C.red }}>
                                    <Clock className="h-3 w-3" />Long breaks only
                                </button>
                            </div>

                            {!actorId && people && people.length > 1 && (
                                <select value={actorId} onChange={(e) => setActorId(e.target.value)} aria-label="Filter by salesperson"
                                    className="h-9 w-full rounded-xl border bg-white px-3 text-[12.5px] font-semibold tracking-wide outline-none focus:ring-2" style={INPUT_RING}>
                                    <option value="">Everyone</option>
                                    {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                                </select>
                            )}
                        </div>

                        <Timeline token={token} filters={filters} socket={socket} onOpen={openItem} />
                    </div>
                )}
            </div>

            {viewer && <SalesThreadViewer token={token} id={viewer.id} who={viewer.who} onClose={() => setViewer(null)} />}
        </section>
    );
}