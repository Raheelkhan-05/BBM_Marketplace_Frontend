// src/pages/SalesThreadPage.jsx
// One enquiry thread: a one-way, time-stamped log (notes, files, quotations) that only the salesperson writes.
//
// Loading: the newest page (FIRST_PAGE entries) is fetched first and the view jumps to the bottom. Scrolling up
// loads older entries in batches (OLDER_PAGE) without moving the screen. Live refreshes only ask for what's new.
// The composer is its own component, so typing never re-renders the log.
// Sending is optimistic: the entry shows instantly (local: true) and is saved in the background, in order.
//
// Composer: one full-width bar. "+" opens a menu (Add files, Send quotation, Mark as won, Mark as lost).
// Closing an enquiry always records an outcome: won or lost. A closed enquiry can be reopened.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
    ArrowLeft, ArrowDown, Send, Paperclip, X, FileText, FileSpreadsheet, Download, Receipt, Loader2, ChevronDown,
    Phone, Mail, RotateCw, AlertCircle, BadgeCheck, Plus, Trophy, XCircle, RotateCcw, Bell
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import useRfqLive from "../hooks/useRfqLive.js";
import { useGstLookup } from "../hooks/useSalesSheet.js";
import { fetchThread, updateThread, setThreadStatus, setThreadReminder, addThreadEntry, uploadThreadFile, resendThreadQuote } from "../utils/salesThreadApi.js";
import { cacheGet, cacheSet, threadKey, FIRST_PAGE, OLDER_PAGE } from "../utils/salesThreadCache.js";
import SalesQuoteSheet from "../components/sales/SalesQuoteSheet.jsx";
import {
    ALLOWED_FILES, FILE_ACCEPT, MAX_FILE_BYTES, MAX_FILES, GSTIN_RE, cleanGstin, cleanPhone, cleanEmail,
    clock, dateTime, dayLabel, fileSize, inr, qty, dateShort,
} from "../components/sales/salesThreadFmt.js";
import "../components/sales/sales-threads.css";
import "../components/sales/sales-threads.polish.css";

const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);
// Merge by id. Returns the SAME array when nothing changed, so quiet refreshes cause no re-render.
// clientKey (the React key of an entry we sent ourselves) is preserved so the bubble never re-mounts.
const mergeEntries = (prev, inc) => {
    if (!inc?.length) return prev;
    const m = new Map(prev.map((e) => [e.id, e]));
    let changed = false;
    for (const e of inc) {
        const o = m.get(e.id);
        const n = o?.clientKey && !e.clientKey ? { ...e, clientKey: o.clientKey } : e;
        if (o && JSON.stringify(o) === JSON.stringify(n)) continue;
        m.set(e.id, n); changed = true;
    }
    return changed ? [...m.values()].sort(byTime) : prev;
};
// Like mergeEntries, but first drops our own "sending" copies when the server's version already arrived
// through a live refresh (so the same message is never shown twice).
const sig = (e) => `${e.body || ""}|${(e.attachments || []).map((a) => a.path).join(",")}`;
const mergeIncoming = (prev, inc) => {
    if (!inc?.length) return prev;
    const sending = prev.filter((e) => e.local && !e.failed);
    if (!sending.length) return mergeEntries(prev, inc);
    const have = new Set(inc.filter((e) => e.kind === "note").map(sig));
    return mergeEntries(prev.filter((e) => !(e.local && !e.failed && have.has(sig(e)))), inc);
};
const CH = { whatsapp: "WhatsApp", email: "Email" };
const COMPOSER_MAX = 136;   // about 5 lines, then the textarea scrolls inside itself
// Which side the "+" button sits on. true = left (like ChatGPT, send button on the right); false = mirrored.
const PLUS_ON_LEFT = true;

// Page scroll helpers (the page itself scrolls; Lenis is used when present).
const jump = (y) => {
    try { if (window.lenis?.scrollTo) { window.lenis.scrollTo(y, { immediate: true, force: true }); return; } } catch { /* fall back */ }
    window.scrollTo(0, y);
};
const toBottom = () => jump(document.documentElement.scrollHeight);
const smoothToBottom = () => {
    const y = document.documentElement.scrollHeight - window.innerHeight;
    try { if (window.lenis?.scrollTo) { window.lenis.scrollTo(y, { duration: 0.5 }); return; } } catch { /* fall back */ }
    window.scrollTo({ top: y, behavior: "smooth" });
};
const distFromBottom = () => document.documentElement.scrollHeight - window.scrollY - window.innerHeight;

const stateOf = (t) => (t.status !== "closed" ? { k: "open", l: "Open" }
    : t.outcome === "won" ? { k: "won", l: "Won" }
        : t.outcome === "lost" ? { k: "lost", l: "Lost" } : { k: "closed", l: "Closed" });

function FileIcon({ name }) {
    return /\.(xlsx?|csv)$/i.test(name || "") ? <FileSpreadsheet size={18} /> : <FileText size={18} />;
}

function Attachment({ a }) {
    if ((a.type || "").startsWith("image/") && a.url) {
        return <a className="st-img" href={a.url} target="_blank" rel="noreferrer" aria-label={`Open ${a.name}`}><img src={a.url} alt={a.name} loading="lazy" /></a>;
    }
    return (
        <a className="st-file" href={a.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!a.url}>
            <FileIcon name={a.name} />
            <span><b>{a.name}</b><small>{fileSize(a.size)}</small></span>
            <Download size={14} aria-hidden="true" />
        </a>
    );
}

function QuoteCard({ e, busyKey, onRetry }) {
    const q = e.quote;
    if (!q) return <p className="st-body">{e.body}</p>;
    const expired = new Date(q.validUntil).getTime() <= Date.now();
    const neverExpires = new Date(q.validUntil).getFullYear() >= 9000;
    return (
        <div className="st-q">
            <p className="st-q-h"><Receipt size={16} /><b>Quotation sent</b><span>{inr(q.total)}</span></p>
            <ul>
                {q.items.map((i) => (
                    <li key={i.submissionId}>
                        <span>{i.productName}<small>{qty(i.quantity)} {i.unit} × {inr(i.unitPriceIncl, 4)}</small></span>
                        <b>{inr(i.totalIncl)}</b>
                    </li>
                ))}
            </ul>
            <div className="st-q-d">
                {Object.entries(q.delivery || {}).map(([ch, d]) => (
                    <span key={ch} className={`st-dl ${d.status === "sent" ? "ok" : "bad"}`} title={d.error || ""}>
                        {d.status === "sent" ? <BadgeCheck size={13} /> : <AlertCircle size={13} />}{CH[ch] || ch} {d.status === "sent" ? "sent" : "failed"}
                        {d.status !== "sent" && !expired && (
                            <button type="button" disabled={busyKey === `${q.id}:${ch}`} onClick={() => onRetry(q.id, ch)} aria-label={`Retry ${CH[ch] || ch}`}>
                                {busyKey === `${q.id}:${ch}` ? <Loader2 size={12} className="st-spin" /> : <RotateCw size={12} />}Retry
                            </button>
                        )}
                    </span>
                ))}
            </div>
            {!neverExpires && <small className="st-q-v">{expired ? "Expired" : "Valid until"} {dateShort(q.validUntil)}</small>}
            {q.note && <p className="st-q-n">{q.note}</p>}
        </div>
    );
}

const Entry = memo(function Entry({ e, busyKey, onRetry, onResend, onDiscard }) {
    if (e.kind === "system") return <div className="st-sys"><span>{e.body}</span><time>{clock(e.createdAt)}</time></div>;
    return (
        <div className={`st-msg${e.clientKey ? " pop" : ""}`}>
            <div className={`st-bub${e.failed ? " failed" : ""}${e.kind === "quote" ? " quote" : ""}`}>
                {e.kind === "quote" ? <QuoteCard e={e} busyKey={busyKey} onRetry={onRetry} /> : e.body && <p className="st-body">{e.body}</p>}
                {e.attachments?.length > 0 && (
                    <div className="st-atts">{e.attachments.map((a) => <Attachment key={a.path} a={a} />)}</div>
                )}
                <time dateTime={e.createdAt}>{clock(e.createdAt)}</time>
                {e.failed && (
                    <div className="st-fail" role="alert">
                        <AlertCircle size={13} /><span>Not sent</span>
                        <button type="button" onClick={() => onResend(e.id)}>Retry</button>
                        <button type="button" onClick={() => onDiscard(e.id)}>Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
});

const Timeline = memo(function Timeline({ entries, busyKey, onRetry, onResend, onDiscard }) {
    const rows = useMemo(() => {
        let last = "";
        return entries.map((e) => { const day = dayLabel(e.createdAt); const head = day !== last; last = day; return { e, day, head }; });
    }, [entries]);
    return rows.map(({ e, day, head }) => (
        <div key={e.clientKey || e.id}>
            {head && <div className="st-day"><span>{day}</span></div>}
            <Entry e={e} busyKey={busyKey} onRetry={onRetry} onResend={onResend} onDiscard={onDiscard} />
        </div>
    ));
});

const CustomerCard = memo(function CustomerCard({ token, thread, onSaved, say }) {
    const [open, setOpen] = useState(false);
    const [d, setD] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const gst = useGstLookup(token);
    const missing = !thread.customerGstin || (!thread.customerPhone && !thread.customerEmail);

    const begin = () => { setD({ name: thread.customerName, gstin: thread.customerGstin, phone: thread.customerPhone, email: thread.customerEmail }); setErr(""); gst.reset(); setOpen(true); };

    useEffect(() => {
        if (!open) return undefined;
        const g = cleanGstin(d.gstin);
        if (!GSTIN_RE.test(g) || g === thread.customerGstin) return undefined;
        let live = true;
        gst.run(g).then((name) => { if (live && name) setD((s) => ({ ...s, name })); });   // the GST records are the reliable name
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [d.gstin, open]);

    const save = async () => {
        const g = cleanGstin(d.gstin);
        if (g && !GSTIN_RE.test(g)) return setErr("Enter all 15 characters of the GST number.");
        if (d.phone?.trim() && !cleanPhone(d.phone)) return setErr("Enter a valid 10-digit mobile number.");
        if (d.email?.trim() && !cleanEmail(d.email)) return setErr("Enter a valid email address.");
        if (!g && !String(d.name || "").trim()) return setErr("Keep either the company name or the GST number.");
        setBusy(true); setErr("");
        const res = await updateThread(token, thread.id, { customerName: d.name || "", customerGstin: g, customerPhone: d.phone || "", customerEmail: d.email || "" });
        setBusy(false);
        if (!res.success) return setErr(res.message || "Couldn't save. Please try again.");
        onSaved(res.thread); setOpen(false); say("Customer details saved.");
    };

    return (
        <section className={`st-cust${missing ? " warn" : ""}`}>
            <button type="button" className="st-cust-h" aria-expanded={open} onClick={() => (open ? setOpen(false) : begin())}>
                <span className="st-cust-s">
                    <span>{thread.customerGstin ? `GSTIN ${thread.customerGstin}` : "GST number missing"}</span>
                    {thread.customerPhone && <span><Phone size={12} />{thread.customerPhone}</span>}
                    {thread.customerEmail && <span><Mail size={12} />{thread.customerEmail}</span>}
                    {!thread.customerPhone && !thread.customerEmail && <span>No phone or email</span>}
                </span>
                <span className="st-cust-a">{open ? "Cancel" : "Edit"}<ChevronDown size={16} className={open ? "up" : ""} /></span>
            </button>
            {missing && !open && <p className="st-hint warn">Add the GST number and a mobile number or email to send quotations.</p>}
            {open && (
                <div className="st-cust-b">
                    <div className="st-f"><label htmlFor="cc-gst">GST number</label>
                        <input id="cc-gst" className="st-in" value={d.gstin || ""} maxLength={15} autoCapitalize="characters" onChange={(e) => setD((s) => ({ ...s, gstin: cleanGstin(e.target.value) }))} />
                        {gst.status === "loading" && <p className="st-hint">Finding the company…</p>}
                        {gst.status === "fail" && <p className="st-hint warn">Couldn't find this GST number. Type the company name.</p>}
                    </div>
                    <div className="st-f"><label htmlFor="cc-name">Company name</label>
                        <input id="cc-name" className="st-in" value={d.name || ""} onChange={(e) => setD((s) => ({ ...s, name: e.target.value }))} /></div>
                    <div className="st-two">
                        <div className="st-f"><label htmlFor="cc-ph">Mobile number</label>
                            <input id="cc-ph" className="st-in" inputMode="tel" value={d.phone || ""} onChange={(e) => setD((s) => ({ ...s, phone: e.target.value.replace(/[^\d+\s-]/g, "") }))} /></div>
                        <div className="st-f"><label htmlFor="cc-em">Email</label>
                            <input id="cc-em" className="st-in" type="email" value={d.email || ""} onChange={(e) => setD((s) => ({ ...s, email: e.target.value }))} /></div>
                    </div>
                    {err && <p className="st-err" role="alert">{err}</p>}
                    <button type="button" className="st-btn pri" disabled={busy} onClick={save}>{busy ? <Loader2 size={16} className="st-spin" /> : null}Save details</button>
                </div>
            )}
        </section>
    );
});

// Won / lost confirmation.
function OutcomeDialog({ kind, open, busy, onCancel, onConfirm, onExited }) {
    useEffect(() => {
        const k = (e) => { if (e.key === "Escape" && !busy && open) onCancel(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [busy, open, onCancel]);
    useEffect(() => {
        if (open) return undefined;
        const t = setTimeout(onExited, 280);   // unmount after the exit animation
        return () => clearTimeout(t);
    }, [open, onExited]);
    const won = kind === "won";
    return createPortal(
        // <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
        <div className={`st-ov${open ? "" : " out"}`} data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && !busy && open) onCancel(); }}>
            <div className="st-sheet st-confirm" role="alertdialog" aria-modal="true" aria-label={`Mark as ${kind}`}>
                <div className="st-sh-b">
                    <div className={`st-okc ${won ? "" : "lost"}`}>{won ? <Trophy size={26} /> : <XCircle size={28} />}</div>
                    <h2 className="st-center st-conf-h">{won ? "Mark this enquiry as won?" : "Mark this enquiry as lost?"}</h2>
                    <p className="st-hint st-center">
                        {won ? "The customer is going ahead. The enquiry will be closed and counted as won." : "The customer isn't going ahead. The enquiry will be closed and counted as lost."}
                        {" "}You can reopen it any time.
                    </p>
                </div>
                <div className="st-sh-f">
                    <button type="button" className="st-btn" disabled={busy} onClick={onCancel}>Cancel</button>
                    <button type="button" className={`st-btn ${won ? "ok" : "bad"}`} disabled={busy} onClick={onConfirm}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}{won ? "Mark as won" : "Mark as lost"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DEFAULT_REMINDER_TIME = "09:00";
const MAX_REMINDER_DAYS = 365;

// Date + optional time (the person's local time) -> { at: Date } or { error }.
function buildReminder(date, time) {
    if (!date) return { error: "Choose a date." };
    const at = new Date(`${date}T${time || DEFAULT_REMINDER_TIME}:00`);
    if (Number.isNaN(at.getTime())) return { error: "Enter a valid date and time." };
    if (at.getTime() <= Date.now()) {
        return { error: time ? "Pick a date and time in the future." : "9:00 AM today has already passed. Pick a later date or set a time." };
    }
    if (at.getTime() > Date.now() + MAX_REMINDER_DAYS * 864e5) return { error: "Reminders can be set up to a year ahead." };
    return { at };
}

function ReminderDialog({ current, open, busy, onCancel, onSave, onExited }) {
    const init = current ? new Date(current) : null;
    const [date, setDate] = useState(init ? ymd(init) : "");
    const [time, setTime] = useState(init ? `${pad2(init.getHours())}:${pad2(init.getMinutes())}` : "");
    const [err, setErr] = useState("");
    const today = ymd(new Date());
    const dayPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

    useEffect(() => {
        const k = (e) => { if (e.key === "Escape" && !busy && open) onCancel(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [busy, open, onCancel]);
    useEffect(() => {
        if (open) return undefined;
        const t = setTimeout(onExited, 280);
        return () => clearTimeout(t);
    }, [open, onExited]);

    const submit = () => {
        const r = buildReminder(date, time);
        if (r.error) return setErr(r.error);
        setErr("");
        onSave(r.at.toISOString());
    };

    return createPortal(
        <div className={`st-ov${open ? "" : " out"}`} data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && !busy && open) onCancel(); }}>
            <div className="st-sheet st-confirm" role="dialog" aria-modal="true" aria-label="Set reminder">
                <div className="st-sh-b">
                    <div className="st-okc rem"><Bell size={26} /></div>
                    <h2 className="st-center st-conf-h">{current ? "Change reminder" : "Set a reminder"}</h2>
                    <p className="st-hint st-center">Leave the time empty to be reminded at 9:00 AM that day.</p>
                    <div className="st-seg" style={{ marginTop: 12 }}>
                        {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([l, n]) => (
                            <button key={l} type="button" aria-pressed={date === dayPlus(n)} onClick={() => { setDate(dayPlus(n)); setErr(""); }}>{l}</button>
                        ))}
                    </div>
                    <div className="st-two">
                        <div className="st-f"><label htmlFor="rm-d">Date</label>
                            <input id="rm-d" className="st-in" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setErr(""); }} /></div>
                        <div className="st-f"><label htmlFor="rm-t">Time (optional)</label>
                            <input id="rm-t" className="st-in" type="time" value={time} onChange={(e) => { setTime(e.target.value); setErr(""); }} /></div>
                    </div>
                    {err && <p className="st-err" role="alert">{err}</p>}
                </div>
                <div className="st-sh-f">
                    <button type="button" className="st-btn" disabled={busy} onClick={onCancel}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}Save reminder
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

// Owns its own state (text, files, menu), so keystrokes never re-render the thread above it.
// Enter sends, Shift+Enter makes a new line. Sending is instant: the parent shows the entry and saves it in the background.
function Composer({ token, threadId, say, onSend, onQuote, onOutcome, onRemind, hasReminder }) {
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [menu, setMenu] = useState(false);
    const taRef = useRef(null);
    const fileRef = useRef(null);
    const wrapRef = useRef(null);

    // Grow with the text up to ~5 lines, then scroll inside the box.
    const fit = useCallback(() => {
        const t = taRef.current; if (!t) return;
        t.style.height = "auto";
        const want = t.scrollHeight;
        t.style.height = `${Math.min(want, COMPOSER_MAX)}px`;
        t.style.overflowY = want > COMPOSER_MAX ? "auto" : "hidden";
    }, []);
    useLayoutEffect(() => { fit(); }, [text, fit]);

    // Close the menu on outside tap / Escape.
    useEffect(() => {
        if (!menu) return undefined;
        const away = (e) => { if (!wrapRef.current?.contains(e.target)) setMenu(false); };
        const esc = (e) => { if (e.key === "Escape") setMenu(false); };
        document.addEventListener("pointerdown", away);
        document.addEventListener("keydown", esc);
        return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
    }, [menu]);

    const addFiles = (list) => {
        const picked = Array.from(list || []);
        if (!picked.length) return;
        const room = MAX_FILES - files.length;
        if (picked.length > room) say(`You can attach up to ${MAX_FILES} files.`);
        picked.slice(0, Math.max(room, 0)).forEach((file) => {
            if (!ALLOWED_FILES.test(file.name)) return say(`${file.name}: this file type isn't supported.`);
            if (file.size > MAX_FILE_BYTES) return say(`${file.name} is larger than 15 MB.`);
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const preview = /^image\/(jpe?g|png|webp|gif)$/i.test(file.type) ? URL.createObjectURL(file) : null;
            setFiles((p) => [...p, { id, name: file.name, size: file.size, status: "uploading", preview }]);
            uploadThreadFile(token, threadId, file).then((r) => setFiles((p) => p.map((f) => (f.id !== id ? f
                : r.success ? { ...f, status: "done", attachment: r.attachment } : { ...f, status: "error", error: r.message }))));
        });
    };

    const uploading = files.some((f) => f.status === "uploading");
    const ready = files.filter((f) => f.status === "done");
    const hasContent = text.trim().length > 0 || ready.length > 0;
    const canSend = !uploading && hasContent;

    const send = () => {
        if (uploading && (text.trim() || ready.length)) return say("Wait for the file to finish uploading.");
        if (!canSend) return;
        const previews = {};
        ready.forEach((f) => { if (f.preview) previews[f.attachment.path] = f.preview; });
        onSend({ body: text.trim(), attachments: ready.map((f) => f.attachment), previews });
        setText(""); setFiles([]);
        taRef.current?.focus();   // keep the keyboard open for the next update
    };
    const onKey = (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent?.isComposing) return;   // Shift+Enter = new line
        e.preventDefault();
        send();
    };
    const run = (fn) => () => { setMenu(false); fn(); };

    return (
        <div className="st-compose">
            {files.length > 0 && (
                <div className="st-pend">
                    {files.map((f) => (
                        <span key={f.id} className={`st-chip ${f.status}`} title={f.error || ""}>
                            {f.status === "uploading" ? <Loader2 size={13} className="st-spin" /> : f.status === "error" ? <AlertCircle size={13} /> : <FileIcon name={f.name} />}
                            <span className="n">{f.name}</span>
                            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}><X size={13} /></button>
                        </span>
                    ))}
                </div>
            )}
            <input ref={fileRef} type="file" multiple hidden accept={FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <div className={`st-bar${PLUS_ON_LEFT ? "" : " flip"}`}>
                <div className="st-plusw" ref={wrapRef}>
                    <button type="button" className="st-plus" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                        <Plus size={20} />
                    </button>
                    <div className={`st-menu${menu ? " show" : ""}`} role="menu" aria-label="Enquiry actions" aria-hidden={!menu}>
                        {/* same buttons as before */}

                        <button type="button" role="menuitem" onClick={run(() => fileRef.current?.click())}><Paperclip size={17} />Add files</button>
                        <button type="button" role="menuitem" onClick={run(onQuote)}><Receipt size={17} />Send quotation</button>
                        <button type="button" role="menuitem" onClick={run(onRemind)}><Bell size={17} />{hasReminder ? "Change reminder" : "Set reminder"}</button>
                        <hr />
                        <button type="button" role="menuitem" className="ok" onClick={run(() => onOutcome("won"))}><Trophy size={17} />Mark as won</button>
                        <button type="button" role="menuitem" className="bad" onClick={run(() => onOutcome("lost"))}><XCircle size={17} />Mark as lost</button>
                    </div>

                </div>
                <textarea ref={taRef} className="st-ta" rows={1} value={text} maxLength={4000} aria-label="Write an update"
                    placeholder="Write an update…"
                    enterKeyHint="send"
                    onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
                    onPaste={(e) => { if (e.clipboardData?.files?.length) { addFiles(e.clipboardData.files); } }} />
                <button type="button" className="st-send" aria-label="Save update" disabled={!canSend} onClick={send}>
                    <Send size={18} />
                </button>
            </div>
            <small className="st-bar-h">Enter to send · Shift+Enter for a new line · Only you can see this log</small>
        </div>
    );
}

export default function SalesThreadPage() {
    const { threadId } = useParams();
    const nav = useNavigate();
    const { token } = useAuth();
    const { say } = useOutletContext();

    // Start from cache when we have it (the list prefetches on hover/touch), so the page paints at once.
    const seed = useRef(token ? cacheGet(threadKey(token, threadId)) : null).current;
    const [thread, setThread] = useState(seed?.thread ?? null);
    const [entries, setEntries] = useState(seed?.entries ?? []);
    const [hasOlder, setHasOlder] = useState(!!seed?.hasOlder);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [state, setState] = useState(seed ? "ready" : "loading"); // loading | ready | missing | error
    const [msg, setMsg] = useState("");
    const [quoting, setQuoting] = useState(false);
    const [busyKey, setBusyKey] = useState("");
    const [statusBusy, setStatusBusy] = useState(false);
    const [ask, setAsk] = useState(null);            // "won" | "lost" while the confirm dialog is open
    const [remind, setRemind] = useState(null);      // { open } while the reminder dialog is shown
    const [remBusy, setRemBusy] = useState(false);
    const [settled, setSettled] = useState(false);   // true once the first jump to the bottom is done
    const [far, setFar] = useState(false);           // scrolled well above the newest entry

    const idRef = useRef(threadId);
    const entriesRef = useRef(entries); entriesRef.current = entries;
    const topRef = useRef(null);
    const settledRef = useRef(false);
    const stickRef = useRef(false);        // scroll to the bottom after the next entries commit
    const anchorRef = useRef(null);        // keeps the screen still when older entries are prepended
    const olderBusy = useRef(false);
    const queueRef = useRef(Promise.resolve());   // saves run one after another, so order is kept

    // mode "fresh": newest page, replaces the list. mode "after": only what's new since the last saved entry we hold.
    const load = useCallback(async (mode) => {
        const mine = threadId;
        const real = entriesRef.current.filter((e) => !e.local);
        const last = real[real.length - 1];
        const useAfter = mode === "after" && !!last;
        const res = await fetchThread(token, mine, useAfter ? { after: last.createdAt } : { limit: FIRST_PAGE });
        if (idRef.current !== mine) return;
        if (!res.success) {
            if (mode === "after") return;
            if (res.status === 404) setState("missing"); else { setMsg(res.message || "Couldn't load this enquiry."); setState("error"); }
            return;
        }
        if (res.reset) return load("fresh");   // too much happened while away: reload the newest page
        setThread(res.thread);
        if (useAfter) {
            if (res.entries?.length && distFromBottom() < 260) stickRef.current = true;   // follow new entries only if already near the end
            setEntries((prev) => mergeIncoming(prev, res.entries));
        } else {
            setEntries((prev) => [...(res.entries || []), ...prev.filter((e) => e.local)]);
            setHasOlder(!!res.hasOlder);
        }
        setState("ready");
    }, [token, threadId]);
    const loadRef = useRef(load); loadRef.current = load;

    useEffect(() => {
        if (idRef.current !== threadId) {   // moved to a different thread inside the same component
            idRef.current = threadId; settledRef.current = false; setSettled(false); setFar(false);
            const c = token ? cacheGet(threadKey(token, threadId)) : null;
            entriesRef.current = c?.entries ?? [];
            setThread(c?.thread ?? null); setEntries(c?.entries ?? []); setHasOlder(!!c?.hasOlder); setState(c ? "ready" : "loading");
        }
        if (token) load(entriesRef.current.length ? "after" : "fresh");
    }, [token, threadId, load]);

    useRfqLive(() => loadRef.current("after"), { enabled: !!token && state === "ready" });

    // keep the cache warm for next time (never cache unsent local entries)
    useEffect(() => {
        if (state === "ready" && thread && token) cacheSet(threadKey(token, threadId), { thread, entries: entries.filter((e) => !e.local), hasOlder });
    }, [state, thread, entries, hasOlder, token, threadId]);

    // ---- scrolling ----
    // 1) older entries were prepended: restore the exact position
    useLayoutEffect(() => {
        const a = anchorRef.current;
        if (!a) return;
        anchorRef.current = null;
        jump(a.y + (document.documentElement.scrollHeight - a.h));
    }, [entries]);

    // 2) first paint of a thread: go to the newest entry. Later: follow smoothly, only when asked (own update / near the end)
    useLayoutEffect(() => {
        if (state !== "ready") return;
        if (!settledRef.current) {
            settledRef.current = true;
            toBottom();
            requestAnimationFrame(() => { toBottom(); setSettled(true); });   // once more after images/fonts settle
            return;
        }
        if (stickRef.current) { stickRef.current = false; smoothToBottom(); }
    }, [entries, state]);

    useEffect(() => {
        if (state !== "ready" || typeof ResizeObserver === "undefined") return undefined;
        let pinned = true;
        const release = () => { pinned = false; };
        const opts = { passive: true };
        window.addEventListener("wheel", release, opts);
        window.addEventListener("touchmove", release, opts);
        window.addEventListener("keydown", release);
        const ro = new ResizeObserver(() => { if (pinned) toBottom(); });
        ro.observe(document.body);
        ro.observe(document.documentElement);
        const t = setTimeout(release, 1500);
        return () => {
            clearTimeout(t);
            ro.disconnect();
            window.removeEventListener("wheel", release, opts);
            window.removeEventListener("touchmove", release, opts);
            window.removeEventListener("keydown", release);
        };
    }, [state, threadId]);

    // "Latest" button: shown once the person has scrolled well above the newest entry.
    useEffect(() => {
        if (state !== "ready") return undefined;
        let raf = 0;
        const check = () => { raf = 0; setFar(distFromBottom() > 420); };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
        window.addEventListener("scroll", onScroll, { passive: true });
        check();
        return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
    }, [state, threadId]);

    // ---- older entries, loaded in bunches as the person scrolls up ----
    const loadOlder = useCallback(async () => {
        const first = entriesRef.current.find((e) => !e.local);
        if (olderBusy.current || !first) return;
        olderBusy.current = true; setLoadingOlder(true);
        const mine = threadId;
        const res = await fetchThread(token, mine, { before: first.createdAt, beforeId: first.id, limit: OLDER_PAGE });
        olderBusy.current = false;
        if (idRef.current !== mine) return;
        setLoadingOlder(false);
        if (!res.success) return say(res.message || "Couldn't load older updates.");
        anchorRef.current = { h: document.documentElement.scrollHeight, y: window.scrollY };
        setEntries((prev) => mergeEntries(prev, res.entries));
        setHasOlder(!!res.hasOlder);
    }, [token, threadId, say]);
    const loadOlderRef = useRef(loadOlder); loadOlderRef.current = loadOlder;

    // Re-created whenever the list changes, so it re-checks if the top is still on screen after a batch lands.
    useEffect(() => {
        const el = topRef.current;
        if (!el || !hasOlder || !settled || state !== "ready" || typeof IntersectionObserver === "undefined") return undefined;
        const io = new IntersectionObserver(([hit]) => { if (hit.isIntersecting) loadOlderRef.current(); }, { rootMargin: "700px 0px 0px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [hasOlder, settled, state, entries.length]);

    // ---- actions ----
    // Save one local entry in the background (queued, so several quick sends stay in order).
    const post = useCallback((tmpId, payload) => {
        queueRef.current = queueRef.current.then(async () => {
            const res = await addThreadEntry(token, threadId, payload);
            if (idRef.current !== threadId) return;
            if (!res.success) {
                setEntries((prev) => prev.map((e) => (e.id === tmpId ? { ...e, failed: true, error: res.message } : e)));
                return;
            }
            setEntries((prev) => {
                const rest = prev.filter((e) => e.id !== tmpId);
                // a live refresh may already have brought the saved copy: then just drop our local one
                if (rest.some((e) => e.id === res.entry.id)) return rest;
                return mergeEntries(rest, [{ ...res.entry, clientKey: tmpId }]);
            });
        }).catch(() => { /* never break the queue */ });
    }, [token, threadId]);

    // Instant: show the entry now, save it behind the scenes.
    const onSend = useCallback(({ body, attachments, previews }) => {
        const now = new Date().toISOString();
        const id = `tmp-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const tmp = {
            id, clientKey: id, local: true, kind: "note", body, createdAt: now,
            attachments: attachments.map((a) => ({ ...a, url: previews?.[a.path] || null })),
            payload: { body, attachments },
        };
        stickRef.current = true;
        setEntries((prev) => mergeEntries(prev, [tmp]));
        setThread((t) => (t ? { ...t, lastActivityAt: now, reminderAt: null } : t));
        post(id, tmp.payload);
    }, [post]);

    const onResend = useCallback((id) => {
        const e = entriesRef.current.find((x) => x.id === id);
        if (!e?.payload) return;
        setEntries((prev) => prev.map((x) => (x.id === id ? { ...x, failed: false, error: undefined } : x)));
        post(id, e.payload);
    }, [post]);
    const onDiscard = useCallback((id) => setEntries((prev) => prev.filter((x) => x.id !== id)), []);

    const retry = useCallback(async (quoteId, channel) => {
        setBusyKey(`${quoteId}:${channel}`);
        const res = await resendThreadQuote(token, threadId, quoteId, [channel]);
        setBusyKey("");
        if (!res.success) return say(res.message || "Couldn't resend the quotation.");
        setThread((t) => (t ? { ...t, reminderAt: null } : t));
        setEntries((prev) => prev.map((e) => (e.quote?.id === quoteId ? { ...e, quote: res.quote } : e)));

        say(res.message);
    }, [token, threadId, say]);

    const pageRef = useRef(null);
    useLayoutEffect(() => {
        const el = pageRef.current;
        if (!el) return undefined;
        const fit = () => {
            const top = el.getBoundingClientRect().top + window.scrollY;
            el.style.setProperty("--st-min", `calc(100dvh - ${Math.max(Math.round(top), 0)}px)`);
        };
        fit();
        window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, [state]);

    // next: "won" | "lost" | "open" (reopen)
    const changeStatus = async (next) => {
        setStatusBusy(true);
        const res = await setThreadStatus(token, threadId, next);
        setStatusBusy(false);
        if (!res.success) { say(res.message || "Couldn't update the enquiry."); return; }
        closeAsk();
        setThread((t) => ({ ...t, ...res.thread }));
        stickRef.current = true;
        load("after");
        say(next === "open" ? "Enquiry reopened." : `Marked as ${next}.`);
    };

    const onCustomerSaved = useCallback((t) => setThread((s) => ({ ...s, ...t })), []);
    const openQuote = useCallback(() => setQuoting(true), []);
    const askOutcome = useCallback((k) => setAsk({ kind: k, open: true }), []);
    const closeAsk = useCallback(() => setAsk((a) => (a ? { ...a, open: false } : a)), []);
    const askGone = useCallback(() => setAsk(null), []);

    const askRemind = useCallback(() => setRemind({ open: true }), []);
    const closeRemind = useCallback(() => setRemind((r) => (r ? { ...r, open: false } : r)), []);
    const remindGone = useCallback(() => setRemind(null), []);

    // iso = set / change, null = remove
    const saveReminder = async (iso) => {
        setRemBusy(true);
        const res = await setThreadReminder(token, threadId, iso);
        setRemBusy(false);
        if (!res.success) { say(res.message || "Couldn't update the reminder."); return; }
        closeRemind();
        setThread((t) => ({ ...t, ...res.thread }));
        if (iso) stickRef.current = true;
        load("after");
        say(iso ? "Reminder set." : "Reminder removed.");
    };

    if (state === "loading") {
        return (
            <div className="gd st-page"><div className="st-sk tall" style={{ marginTop: 22 }} /><div className="st-sk tall" /><div className="st-sk tall" /></div>
        );
    }
    if (state !== "ready" || !thread) {
        return (
            <div className="gd st-page"><div className="st-empty-card" style={{ marginTop: 22 }}>
                <b>{state === "missing" ? "This enquiry isn't available" : msg}</b>
                {state === "missing" ? "It may have been removed, or it belongs to another salesperson." : ""}
                <button type="button" className="st-btn" onClick={() => (state === "missing" ? nav("/sales/enquiries") : (setState("loading"), load("fresh")))}>{state === "missing" ? "Back to RFQs" : "Try again"}</button>
            </div></div>
        );
    }

    const closed = thread.status === "closed";
    const st = stateOf(thread);

    return (
        <div className="gd st-page" ref={pageRef}>
            <header className="st-head">
                <Link to="/sales/enquiries" className="st-ib" aria-label="Back to RFQs"><ArrowLeft size={18} /></Link>
                <div className="st-head-t">
                    <h1>{thread.displayName}</h1>
                    <p>{thread.productName} · {qty(thread.quantity)} {thread.unit}</p>
                    <p className="sub">Posted {dateTime(thread.createdAt)}</p>
                </div>
                <span className={`st-state ${st.k}`}>{st.l}</span>
            </header>

            <CustomerCard token={token} thread={thread} say={say} onSaved={onCustomerSaved} />

            {thread.reminderAt && !closed && (() => {
                const due = new Date(thread.reminderAt).getTime() <= Date.now();
                return (
                    <div className={`st-rem${due ? " due" : ""}`}>
                        <Bell size={16} />
                        <span>{due ? "Reminder due" : "Reminder"} · {dateTime(thread.reminderAt)}</span>
                        <button type="button" onClick={askRemind}>Change</button>
                        <button type="button" disabled={remBusy} onClick={() => saveReminder(null)}>Remove</button>
                    </div>
                );
            })()}

            {thread.specifications && <p className="st-specs"><b>Specifications</b>{thread.specifications}</p>}

            <div className="st-log">
                {hasOlder && (
                    <div className="st-older" ref={topRef}>
                        {loadingOlder
                            ? <span className="st-older-l"><Loader2 size={14} className="st-spin" />Loading earlier updates…</span>
                            : <button type="button" className="st-btn" onClick={loadOlder}>Show earlier updates</button>}
                    </div>
                )}
                <Timeline entries={entries} busyKey={busyKey} onRetry={retry} onResend={onResend} onDiscard={onDiscard} />
            </div>

            {/* Sticky dock: the "Latest" button lives inside it, so it always sits just above the composer, whatever its height. */}
            <div className="st-dock">
                <button type="button" className={`st-jump${far ? " show" : ""}`} onClick={smoothToBottom}
                    aria-label="Jump to the latest update" aria-hidden={!far} tabIndex={far ? 0 : -1}>
                    <ArrowDown size={16} />Latest
                </button>
                {closed ? (
                    <div className={`st-closedbar ${st.k}`}>
                        <span>
                            {st.k === "won" ? <Trophy size={17} /> : st.k === "lost" ? <XCircle size={17} /> : null}
                            {st.k === "won" ? "This enquiry was won." : st.k === "lost" ? "This enquiry was lost." : "This enquiry is closed."}
                        </span>
                        <button type="button" className="st-btn" disabled={statusBusy} onClick={() => changeStatus("open")}>
                            {statusBusy ? <Loader2 size={16} className="st-spin" /> : <RotateCcw size={15} />}Reopen
                        </button>
                    </div>
                ) : (
                    <Composer key={threadId} token={token} threadId={threadId} say={say} onSend={onSend} onQuote={openQuote}
                        onOutcome={askOutcome} onRemind={askRemind} hasReminder={!!thread.reminderAt} />
                )}
            </div>

            {quoting && (
                <SalesQuoteSheet token={token} thread={thread} onClose={() => setQuoting(false)}
                    onSent={() => { stickRef.current = true; load("after"); }} />
            )}

            {ask && <OutcomeDialog kind={ask.kind} open={ask.open} busy={statusBusy}
                onCancel={closeAsk} onConfirm={() => changeStatus(ask.kind)} onExited={askGone} />}

            {remind && <ReminderDialog current={thread.reminderAt} open={remind.open} busy={remBusy}
                onCancel={closeRemind} onSave={saveReminder} onExited={remindGone} />}
        </div>
    );
}