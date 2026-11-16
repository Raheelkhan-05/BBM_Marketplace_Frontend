// Reply: swipe (touch) / hover button (desktop), quoted block, composer bar, jump-to-original.
import { useRef } from "react";
import { CornerUpLeft, Mic, Image as ImageIcon, FileText, Receipt, X } from "lucide-react";
import { colorFor } from "./ChatBits.jsx";
import { fmtDur } from "./VoiceNote.jsx";
import "../../sales/sales-chat.extras.css";

const ICON = { audio: Mic, image: ImageIcon, file: FileText, quote: Receipt };

// Same shape the server sends in entry.replyTo (used for the instant, local copy).
export function snippetOf(e, ownerId) {
    const att = e.attachments || [];
    const text = String(e.body || "").replace(/\s+/g, " ").trim().slice(0, 140);
    let kind = "text", label = text;
    if (e.kind === "quote") { kind = "quote"; label = text || "Quotation"; }
    else if (!text && att.length) {
        const ty = att[0].type || "";
        if (ty.startsWith("audio/")) { kind = "audio"; label = "Voice note"; }
        else if (ty.startsWith("image/")) { kind = "image"; label = att.length > 1 ? `${att.length} photos` : "Photo"; }
        else { kind = "file"; label = att[0].name || "File"; }
    }
    return {
        id: e.id, authorId: e.authorId || ownerId || null, authorName: e.authorName || "", kind, text: label,
        duration: kind === "audio" ? Number(att[0].duration) || null : null
    };
}

export function jumpToEntry(id) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    try {
        if (window.lenis?.scrollTo && !el.closest("[data-lenis-prevent]")) window.lenis.scrollTo(el, { offset: -180 });
        else el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch { /* ignore */ }
    el.classList.add("rp-flash");
    setTimeout(() => el.classList.remove("rp-flash"), 1400);
}

const Line = ({ r }) => {
    const Icon = ICON[r.kind];
    return <span>{Icon && <Icon size={13} aria-hidden="true" />}{r.text}{r.kind === "audio" && r.duration ? ` · ${fmtDur(r.duration)}` : ""}</span>;
};
const nameOf = (r, who, meId) => (r.authorId && r.authorId === meId ? "You" : who(r.authorId, r.authorName));

export function ReplyQuote({ r, who, meId }) {
    if (!r) return null;
    const name = nameOf(r, who, meId);
    return (
        <button type="button" className="rp-q" style={{ "--rc": colorFor(r.authorId || name) }}
            aria-label={`Replied to ${name}. Go to message`} onClick={(ev) => { ev.stopPropagation(); jumpToEntry(r.id); }}>
            <b>{name}</b><Line r={r} />
        </button>
    );
}

export function ReplyBar({ r, who, meId, onClose }) {
    if (!r) return null;
    const name = nameOf(r, who, meId);
    return (
        <div className="rp-bar" style={{ "--rc": colorFor(r.authorId || name) }}>
            <span className="rp-bar-b"><b>Replying to {name}</b><Line r={r} /></span>
            <button type="button" aria-label="Cancel reply" onClick={onClose}><X size={16} /></button>
        </div>
    );
}

// Desktop: small button in the bubble corner (shown on hover only).
export const ReplyHover = ({ onClick }) => (
    <button type="button" className="rp-hv" aria-label="Reply" title="Reply" onClick={onClick}><CornerUpLeft size={14} /></button>
);

// Mobile: swipe right to reply. Vertical scrolling is never blocked (touch-action: pan-y + direction lock).
export function SwipeRow({ id, onReply, disabled, children }) {
    const inner = useRef(null), icon = useRef(null);
    const s = useRef({ x0: 0, y0: 0, dx: 0, lock: "", pid: null, tick: false });
    const THRESH = 56, MAX = 84;

    const paint = (x) => {
        if (inner.current) inner.current.style.transform = x ? `translateX(${x}px)` : "";
        if (icon.current) {
            const p = Math.min(1, x / THRESH);
            icon.current.style.opacity = String(p);
            icon.current.style.transform = `translateY(-50%) scale(${0.6 + 0.4 * p})`;
            icon.current.classList.toggle("go", x >= THRESH);
        }
    };
    const reset = () => { s.current.pid = null; s.current.lock = ""; inner.current?.classList.remove("drag"); paint(0); };

    const down = (e) => {
        if (disabled || e.pointerType !== "touch") return;
        Object.assign(s.current, { x0: e.clientX, y0: e.clientY, dx: 0, lock: "", pid: e.pointerId, tick: false });
    };
    const move = (e) => {
        const st = s.current; if (st.pid !== e.pointerId) return;
        const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
        if (!st.lock) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { st.pid = null; return; }       // it's a scroll
            if (dx < -10) { st.pid = null; return; }
            if (dx > 10 && dx > Math.abs(dy) * 1.4) { st.lock = "h"; inner.current?.classList.add("drag"); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
            else return;
        }
        const x = Math.max(0, Math.min(MAX, dx * 0.85));
        st.dx = x; paint(x);
        if (x >= THRESH && !st.tick) { st.tick = true; try { navigator.vibrate?.(12); } catch { /* ignore */ } }
        else if (x < THRESH) st.tick = false;
    };
    const up = (e) => {
        const st = s.current; if (st.pid !== e.pointerId) return;
        const fire = st.lock === "h" && st.dx >= THRESH;
        reset();
        if (fire) onReply();
    };

    return (
        <div id={`m-${id}`} className="rp-sw" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={reset}>
            <span ref={icon} className="rp-sw-ic" aria-hidden="true"><CornerUpLeft size={16} /></span>
            <div ref={inner} className="rp-in">{children}</div>
        </div>
    );
}