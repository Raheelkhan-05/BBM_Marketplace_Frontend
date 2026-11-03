// components/team/EnquiryChatsPanel.jsx: the "Enquiries" tab in the Console, for team members.
// Lists only the enquiry chats this person was added to or tagged in. Opens the same chat viewer as the admin.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { fetchChatInbox } from "../../utils/salesChatApi.js";
import { useSocket } from "../../context/SocketContext.jsx";
import SalesThreadViewer from "./SalesThreadViewer.jsx";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)", red: "#d2462b" };
const SCROLL_CLS = "min-h-[min(380px,50dvh)] flex-1 overflow-y-auto px-3 pb-[var(--sheet-pb,24px)] md:min-h-0 md:px-5 md:pb-6";
const HEAD_CLS = "shrink-0 px-5 pb-2 pt-3 md:px-7 md:pb-3 md:pt-4";
const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const stateOf = (t) => (t.status !== "closed" ? null : t.outcome === "won" ? "Won" : t.outcome === "lost" ? "Lost" : "Closed");

const Row = memo(function Row({ t, onPick }) {
    const tag = stateOf(t);
    return (
        <li>
            <button type="button" onClick={() => onPick(t)} className="block w-full rounded-2xl border p-3 text-left transition-colors hover:bg-black/[0.025] active:bg-black/[0.04]"
                style={{ borderColor: t.unread ? "rgba(11,114,133,.45)" : C.hair }}>
                <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{t.displayName}</span>
                    {tag && <span className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase leading-none" style={{ background: C.tile, color: C.muted }}>{tag}</span>}
                    {t.unread > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: t.mentions ? C.red : C.secondary }}>
                            {t.unread > 99 ? "99+" : t.unread}
                        </span>
                    )}
                </div>
                <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: C.ink }}>
                    {t.hasProduct ? t.productName : "Cold call · no product yet"}
                </div>
                {t.lastPreview && <div className="mt-0.5 truncate text-[12px] font-medium" style={{ color: C.muted }}>{t.lastPreview}</div>}
                <div className="mt-1 text-[11px] font-semibold" style={{ color: C.muted }}>{t.salespersonName || "Salesperson"} · {when(t.lastActivityAt)}</div>
            </button>
        </li>
    );
});

export default function EnquiryChatsPanel({ token, active, scrollProps, openId, onOpenedId }) {
    const { socket } = useSocket() || {};
    const [items, setItems] = useState(null);
    const [error, setError] = useState("");
    const [viewer, setViewer] = useState(null);
    const seq = useRef(0);

    const load = useCallback(async () => {
        const my = ++seq.current;
        const r = await fetchChatInbox(token);
        if (my !== seq.current) return;
        if (r.success) { setItems(r.items || []); setError(""); } else if (!items) setError(r.message || "Couldn't load your enquiries.");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => { if (active && token) load(); }, [active, token, load]);
    useEffect(() => { if (!active) setViewer(null); }, [active]);
    useEffect(() => { if (openId && active) { setViewer({ id: openId, who: "" }); onOpenedId?.(); } }, [openId, active, onOpenedId]);

    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const fire = () => { clearTimeout(t); t = setTimeout(load, 500); };
        const ev = ["salesChat:message", "salesChat:read", "salesChat:participants"];
        ev.forEach((e) => socket.on(e, fire));
        return () => { clearTimeout(t); ev.forEach((e) => socket.off(e, fire)); };
    }, [socket, load]);

    return (
        <section className="flex min-h-0 flex-1 flex-col" aria-label="Enquiries">
            <div className={HEAD_CLS}>
                <h3 className="text-[15px] font-extrabold tracking-wide md:text-[16px]" style={{ color: C.ink }}>Enquiries you're in</h3>
                <p className="mt-1 text-[12px] font-medium leading-snug" style={{ color: C.muted }}>Chats you were added to or tagged in. Open one to read and reply.</p>
            </div>
            <div {...scrollProps} className={SCROLL_CLS} style={{ overscrollBehavior: "contain" }}>
                {items === null && !error ? (
                    <div className="flex justify-center py-10" style={{ color: C.muted }}><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                        <p role="alert" className="text-[13px] font-bold" style={{ color: C.red }}>{error}</p>
                        <button type="button" onClick={load} className="rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: C.secondary }}>Try again</button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: C.tile }}><ClipboardList className="h-5 w-5" style={{ color: C.muted }} /></span>
                        <p className="text-[13px] font-bold" style={{ color: C.ink }}>No enquiries yet</p>
                        <p className="max-w-[260px] text-[11.5px] font-medium leading-snug" style={{ color: C.muted }}>When a salesperson or admin adds you to an enquiry chat, it shows up here.</p>
                    </div>
                ) : (
                    <ul className="space-y-2 pt-1">{items.map((t) => <Row key={t.id} t={t} onPick={(x) => setViewer({ id: x.id, who: x.salespersonName })} />)}</ul>
                )}
            </div>
            {viewer && <SalesThreadViewer token={token} id={viewer.id} who={viewer.who} onClose={() => { setViewer(null); load(); }} />}
        </section>
    );
}