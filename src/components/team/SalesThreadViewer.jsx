// components/team/SalesThreadViewer.jsx
// Read-only view of one salesperson's enquiry thread, opened from the admin's Sales activity.
// Shows everything the salesperson logged: notes, files, quotations, status and reminder. Refreshes live.
// "Back" returns to the activity list the admin came from.
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ArrowLeft, Loader2, FileText, Download, Receipt, BadgeCheck, AlertCircle, Phone, Mail, Bell, Trophy, XCircle, Eye, User,
} from "lucide-react";
import { fetchMonitorThread } from "../../utils/salesMonitorApi.js";
import { useSocket } from "../../context/SocketContext.jsx";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)", red: "#d2462b", green: "#12794A" };
const Z_VIEWER = 10000;
const CH = { whatsapp: "WhatsApp", email: "Email" };

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "");
const clock = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const dayOf = (iso) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const size = (b) => (!b ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);
const merge = (prev, inc) => {
    const m = new Map(prev.map((e) => [e.id, e]));
    inc.forEach((e) => m.set(e.id, e));
    return [...m.values()].sort(byTime);
};

const stateOf = (t) => (t.status !== "closed" ? { l: "Open", bg: "rgba(30,120,214,.14)", fg: "#0F63B5" }
    : t.outcome === "won" ? { l: "Won", bg: "rgba(34,160,107,.14)", fg: C.green }
        : t.outcome === "lost" ? { l: "Lost", bg: "rgba(210,70,43,.12)", fg: C.red } : { l: "Closed", bg: C.tile, fg: C.muted });

const Attachment = ({ a }) => (
    (a.type || "").startsWith("image/") && a.url
        ? <a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl" aria-label={`Open ${a.name}`}>
            <img src={a.url} alt={a.name} loading="lazy" className="max-h-48 w-full object-cover" />
        </a>
        : <a href={a.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!a.url}
            className="flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2" style={{ borderColor: C.hair }}>
            <FileText className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold" style={{ color: C.ink }}>{a.name}</span>
                <span className="block text-[10.5px] font-semibold" style={{ color: C.muted }}>{size(a.size)}</span>
            </span>
            <Download className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />
        </a>
);

function Quote({ q }) {
    return (
        <div className="rounded-xl border bg-white p-2.5" style={{ borderColor: C.hair }}>
            <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold" style={{ color: C.ink }}>
                <Receipt className="h-4 w-4" style={{ color: C.secondary }} />Quotation sent
                <span className="ml-auto">{inr(q.total)}</span>
            </div>
            <ul className="mt-1.5 space-y-1">
                {(q.items || []).map((i) => (
                    <li key={i.submissionId} className="flex items-start justify-between gap-2 text-[12px] font-medium" style={{ color: C.ink }}>
                        <span className="min-w-0">
                            {i.productName}
                            <span className="block text-[10.5px] font-semibold" style={{ color: C.muted }}>{i.quantity} {i.unit} × {inr(i.unitPriceIncl)}</span>
                        </span>
                        <b className="shrink-0">{inr(i.totalIncl)}</b>
                    </li>
                ))}
            </ul>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(q.delivery || {}).map(([ch, d]) => (
                    <span key={ch} className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                        style={d.status === "sent" ? { background: "rgba(34,160,107,.14)", color: C.green } : { background: "rgba(210,70,43,.12)", color: C.red }}>
                        {d.status === "sent" ? <BadgeCheck className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {CH[ch] || ch} {d.status === "sent" ? "sent" : "failed"}
                    </span>
                ))}
            </div>
            {q.note && <p className="mt-1.5 text-[11.5px] font-medium" style={{ color: C.muted }}>{q.note}</p>}
        </div>
    );
}

const Entry = memo(function Entry({ e }) {
    if (e.kind === "system") {
        return (
            <div className="flex justify-center py-0.5">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: C.tile, color: C.muted }}>
                    {e.body} · {clock(e.createdAt)}
                </span>
            </div>
        );
    }
    return (
        <div className="flex justify-end">
            <div className="w-full max-w-[92%] rounded-2xl rounded-tr-md border p-2.5" style={{ borderColor: C.hair, background: "rgba(11,114,133,0.06)" }}>
                {e.kind === "quote" && e.quote ? <Quote q={e.quote} />
                    : e.body && <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-snug" style={{ color: C.ink }}>{e.body}</p>}
                {e.attachments?.length > 0 && <div className="mt-2 space-y-1.5">{e.attachments.map((a) => <Attachment key={a.path} a={a} />)}</div>}
                <time className="mt-1 block text-right text-[10.5px] font-semibold" style={{ color: C.muted }}>{clock(e.createdAt)}</time>
            </div>
        </div>
    );
});

export default function SalesThreadViewer({ token, id, who, onClose }) {
    const { socket } = useSocket();
    const [thread, setThread] = useState(null);
    const [entries, setEntries] = useState([]);
    const [hasOlder, setHasOlder] = useState(false);
    const [state, setState] = useState("loading"); // loading | ready | missing | error
    const [msg, setMsg] = useState("");
    const [loadingOlder, setLoadingOlder] = useState(false);
    const scrollRef = useRef(null);
    const stickRef = useRef(true);
    const anchorRef = useRef(null);
    const firstRef = useRef(true);
    const entriesRef = useRef([]); entriesRef.current = entries;

    const load = useCallback(async () => {
        const res = await fetchMonitorThread(token, id, { limit: 30 });
        if (!res.success) {
            if (!firstRef.current) return;
            if (res.status === 404) setState("missing"); else { setMsg(res.message || "Couldn't load this enquiry."); setState("error"); }
            return;
        }
        const el = scrollRef.current;
        stickRef.current = firstRef.current || !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        setThread(res.thread);
        setEntries((prev) => merge(prev, res.entries || []));
        if (firstRef.current) setHasOlder(!!res.hasOlder);
        firstRef.current = false;
        setState("ready");
    }, [token, id]);

    useEffect(() => { firstRef.current = true; setState("loading"); setEntries([]); load(); }, [load]);

    // Live: any salesperson activity ping refreshes the newest page (cheap, admin only).
    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const onPing = () => { clearTimeout(t); t = setTimeout(load, 600); };
        socket.on("sales:monitor", onPing);
        return () => { clearTimeout(t); socket.off("sales:monitor", onPing); };
    }, [socket, load]);

    useEffect(() => {
        const k = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [onClose]);

    useLayoutEffect(() => {
        const el = scrollRef.current; if (!el) return;
        if (anchorRef.current) { el.scrollTop = anchorRef.current.top + (el.scrollHeight - anchorRef.current.h); anchorRef.current = null; return; }
        if (stickRef.current) el.scrollTop = el.scrollHeight;
    }, [entries, state]);

    const loadOlder = async () => {
        const first = entriesRef.current[0];
        if (!first || loadingOlder) return;
        setLoadingOlder(true);
        const res = await fetchMonitorThread(token, id, { before: first.createdAt, beforeId: first.id, limit: 30 });
        setLoadingOlder(false);
        if (!res.success) return;
        const el = scrollRef.current;
        anchorRef.current = { h: el?.scrollHeight || 0, top: el?.scrollTop || 0 };
        stickRef.current = false;
        setEntries((prev) => merge(prev, res.entries || []));
        setHasOlder(!!res.hasOlder);
    };

    const st = thread ? stateOf(thread) : null;
    let lastDay = "";

    return createPortal(
        <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6" style={{ zIndex: Z_VIEWER }}>
            <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label="Enquiry details"
                className="relative flex h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl md:h-[min(760px,88dvh)] md:rounded-[24px]">
                {/* header */}
                <div className="shrink-0 border-b px-4 pb-3 pt-3 md:px-5" style={{ borderColor: C.hair }}>
                    <div className="mx-auto mb-2 h-1 w-10 rounded-full md:hidden" style={{ background: C.hair }} />
                    <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={onClose} aria-label="Back to activity"
                            className="inline-flex h-9 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[12.5px] font-bold tracking-wide transition hover:bg-black/10 active:scale-[.98]"
                            style={{ background: C.tile, color: C.ink }}>
                            <ArrowLeft className="h-4 w-4" />Back
                        </button>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "rgba(11,114,133,.1)", color: C.secondary }}>
                            <Eye className="h-3 w-3" />View only · live
                        </span>
                    </div>

                    <div className="mt-3 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="truncate text-[16px] font-extrabold leading-tight" style={{ color: C.ink }}>{thread?.displayName || "Enquiry"}</h2>
                            {st && <span className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase leading-none" style={{ background: st.bg, color: st.fg }}>{st.l}</span>}
                        </div>
                        {thread && <p className="mt-0.5 truncate text-[12.5px] font-semibold" style={{ color: C.muted }}>{thread.productName} · {thread.quantity} {thread.unit}</p>}
                        <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: C.muted }}>
                            <User className="h-3 w-3" />{thread?.salespersonName || who || "Salesperson"}
                            {thread && <span>· Posted {dt(thread.createdAt)}</span>}
                        </p>
                    </div>
                </div>

                {/* body */}
                <div ref={scrollRef} data-lenis-prevent="" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}
                    className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 md:px-5" style={{ overscrollBehavior: "contain" }}>
                    {state === "loading" && (
                        <div className="space-y-2" aria-busy="true">
                            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: C.tile }} />)}
                        </div>
                    )}
                    {(state === "missing" || state === "error") && (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>{state === "missing" ? "This enquiry isn't available" : msg}</p>
                            {state === "error" && <button type="button" onClick={() => { setState("loading"); load(); }} className="rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: C.secondary }}>Try again</button>}
                        </div>
                    )}
                    {state === "ready" && thread && (
                        <>
                            <section className="rounded-2xl border p-3" style={{ borderColor: C.hair }}>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold" style={{ color: C.ink }}>
                                    <span>{thread.customerGstin ? `GSTIN ${thread.customerGstin}` : "GST number missing"}</span>
                                    {thread.customerPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{thread.customerPhone}</span>}
                                    {thread.customerEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{thread.customerEmail}</span>}
                                </div>
                                {thread.specifications && <p className="mt-2 text-[12px] font-medium leading-snug" style={{ color: C.muted }}><b style={{ color: C.ink }}>Specifications </b>{thread.specifications}</p>}
                                {thread.status === "closed" && thread.outcome && (
                                    <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: thread.outcome === "won" ? C.green : C.red }}>
                                        {thread.outcome === "won" ? <Trophy className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                        This enquiry was {thread.outcome}.
                                    </p>
                                )}
                                {thread.reminderAt && thread.status !== "closed" && (
                                    <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: new Date(thread.reminderAt) <= new Date() ? C.red : C.secondary }}>
                                        <Bell className="h-4 w-4" />Reminder · {dt(thread.reminderAt)}
                                    </p>
                                )}
                            </section>

                            {hasOlder && (
                                <div className="flex justify-center">
                                    <button type="button" onClick={loadOlder} disabled={loadingOlder}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12px] font-bold disabled:opacity-60" style={{ borderColor: C.hair, color: C.ink }}>
                                        {loadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Show earlier updates
                                    </button>
                                </div>
                            )}

                            {entries.length === 0 && <p className="py-6 text-center text-[12.5px] font-semibold" style={{ color: C.muted }}>No updates yet.</p>}
                            {entries.map((e) => {
                                const d = dayOf(e.createdAt); const head = d !== lastDay; lastDay = d;
                                return (
                                    <div key={e.id} className="space-y-2.5">
                                        {head && <div className="flex justify-center pt-1"><span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{d}</span></div>}
                                        <Entry e={e} />
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}