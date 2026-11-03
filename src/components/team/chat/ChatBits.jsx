// src/components/team/chat/ChatBits.jsx
// Small shared pieces of the enquiry chat, used by the salesperson page AND the admin / member viewer.
import { Fragment } from "react";
import { Download, FileText, UserPlus } from "lucide-react";
import { fileSize } from "../../sales/salesThreadFmt.js";
import "../../sales/sales-threads.css";
import "../../sales/sales-chat.css";

const PALETTE = ["#0d6c79", "#7a3eb1", "#b45309", "#114072", "#12794a", "#c23a0b", "#8a3b6e", "#4d6b00"];
export const colorFor = (id = "") => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
export const initialOf = (n) => (String(n || "?").trim()[0] || "?").toUpperCase();

export function Avatar({ name, id, size = 28 }) {
    return (
        <span className="sc-av" style={{ "--sc": colorFor(id || name), width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
            {initialOf(name)}
        </span>
    );
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Message text with "@Name" highlighted for everyone in the chat (stronger when it is me).
export function BodyText({ body, names = [], meName = "" }) {
    const list = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!list.length) return body;
    const parts = String(body).split(new RegExp(`(@(?:${list.map(escRe).join("|")}))(?![\\w])`, "g"));
    return parts.map((p, i) => (i % 2
        ? <span key={i} className={`sc-tag${meName && p === `@${meName}` ? " me" : ""}`}>{p}</span>
        : <Fragment key={i}>{p}</Fragment>));
}

export function Attachment({ a }) {
    if ((a.type || "").startsWith("image/") && a.url) {
        return <a className="st-img" href={a.url} target="_blank" rel="noreferrer" aria-label={`Open ${a.name}`}><img src={a.url} alt={a.name} loading="lazy" /></a>;
    }
    return (
        <a className="st-file" href={a.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!a.url}>
            <FileText size={18} />
            <span><b>{a.name}</b><small>{fileSize(a.size)}</small></span>
            <Download size={14} aria-hidden="true" />
        </a>
    );
}

// A message from someone else: left side, with the sender's name in their own colour.
export function OtherBubble({ name, id, time, quote, children }) {
    return (
        <div className="sc-msg">
            <Avatar name={name} id={id} />
            <div className={`sc-bub${quote ? " quote" : ""}`} style={{ "--sc": colorFor(id || name) }}>
                <span className="sc-nm">{name}</span>
                {children}
                <time>{time}</time>
            </div>
        </div>
    );
}

export function TypingLine({ names }) {
    if (!names?.length) return null;
    const text = names.length === 1 ? `${names[0]} is typing`
        : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : "Several people are typing";
    return (
        <div className="sc-typing" role="status" aria-live="polite">
            <span className="sc-dots" aria-hidden="true"><i /><i /><i /></span>{text}
        </div>
    );
}

// Header button: overlapping avatars + count. Opens the people sheet.
export function ParticipantStack({ people, onClick }) {
    const shown = people.slice(0, 3);
    return (
        <button type="button" className="sc-stack" onClick={onClick} aria-label={`${people.length} people in this chat. Manage`}>
            <span className="sc-stack-av">{shown.map((p) => <Avatar key={p.userId} name={p.name} id={p.userId} size={26} />)}</span>
            <span className="sc-stack-n">{people.length}</span>
            <UserPlus size={15} aria-hidden="true" />
        </button>
    );
}

export function MentionList({ options, idx, onPick }) {
    if (!options.length) return null;
    return (
        <ul className="sc-mn" role="listbox" aria-label="Tag someone">
            {options.map((p, i) => (
                <li key={p.userId} role="option" aria-selected={i === idx}>
                    <button type="button" className={i === idx ? "on" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(p)}>
                        <Avatar name={p.name} id={p.userId} size={24} />
                        <span>{p.name}</span><small>{p.role === "salesperson" ? "Salesperson" : p.role === "admin" ? "Admin" : "Team"}</small>
                    </button>
                </li>
            ))}
        </ul>
    );
}