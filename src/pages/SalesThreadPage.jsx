// src/pages/SalesThreadPage.jsx
// One enquiry thread: a one-way, time-stamped log (notes, files, quotations) that only the salesperson writes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
    ArrowLeft, Send, Paperclip, X, FileText, FileSpreadsheet, Download, Receipt, Loader2, ChevronDown,
    Phone, Mail, RotateCw, AlertCircle, BadgeCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import useRfqLive from "../hooks/useRfqLive.js";
import { useGstLookup } from "../hooks/useSalesSheet.js";
import {
    fetchThread, updateThread, setThreadStatus, addThreadEntry, uploadThreadFile, resendThreadQuote,
} from "../utils/salesThreadApi.js";
import SalesQuoteSheet from "../components/sales/SalesQuoteSheet.jsx";
import {
    ALLOWED_FILES, FILE_ACCEPT, MAX_FILE_BYTES, MAX_FILES, GSTIN_RE, cleanGstin, cleanPhone, cleanEmail,
    clock, dateTime, dayLabel, fileSize, inr, qty, dateShort,
} from "../components/sales/salesThreadFmt.js";
import "../components/sales/sales-threads.css";

const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);
const mergeEntries = (prev, inc) => {
    const m = new Map(prev.map((e) => [e.id, e]));
    inc.forEach((e) => m.set(e.id, e));
    return [...m.values()].sort(byTime);
};
const CH = { whatsapp: "WhatsApp", email: "Email" };

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
            <small className="st-q-v">{expired ? "Expired" : "Valid until"} {dateShort(q.validUntil)}</small>
            {q.note && <p className="st-q-n">{q.note}</p>}
        </div>
    );
}

function Entry({ e, busyKey, onRetry }) {
    if (e.kind === "system") return <div className="st-sys"><span>{e.body}</span><time>{clock(e.createdAt)}</time></div>;
    return (
        <div className="st-msg">
            <div className="st-bub">
                {e.kind === "quote" ? <QuoteCard e={e} busyKey={busyKey} onRetry={onRetry} /> : e.body && <p className="st-body">{e.body}</p>}
                {e.attachments?.length > 0 && (
                    <div className="st-atts">{e.attachments.map((a) => <Attachment key={a.path} a={a} />)}</div>
                )}
                <time dateTime={e.createdAt}>{clock(e.createdAt)}</time>
            </div>
        </div>
    );
}

function CustomerCard({ token, thread, onSaved, say }) {
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
        gst.run(g).then((name) => { if (live && name && !String(d.name || "").trim()) setD((s) => ({ ...s, name })); });
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
                    <div className="st-f"><label>GST number</label>
                        <input className="st-in" value={d.gstin || ""} maxLength={15} autoCapitalize="characters" onChange={(e) => setD((s) => ({ ...s, gstin: cleanGstin(e.target.value) }))} />
                        {gst.status === "loading" && <p className="st-hint">Finding the company…</p>}
                        {gst.status === "fail" && <p className="st-hint warn">Couldn't find this GST number. Type the company name.</p>}
                    </div>
                    <div className="st-f"><label>Company name</label>
                        <input className="st-in" value={d.name || ""} onChange={(e) => setD((s) => ({ ...s, name: e.target.value }))} /></div>
                    <div className="st-two">
                        <div className="st-f"><label>Mobile number</label>
                            <input className="st-in" inputMode="tel" value={d.phone || ""} onChange={(e) => setD((s) => ({ ...s, phone: e.target.value.replace(/[^\d+\s-]/g, "") }))} /></div>
                        <div className="st-f"><label>Email</label>
                            <input className="st-in" type="email" value={d.email || ""} onChange={(e) => setD((s) => ({ ...s, email: e.target.value }))} /></div>
                    </div>
                    {err && <p className="st-err" role="alert">{err}</p>}
                    <button type="button" className="st-btn pri" disabled={busy} onClick={save}>{busy ? <Loader2 size={16} className="st-spin" /> : null}Save details</button>
                </div>
            )}
        </section>
    );
}

export default function SalesThreadPage() {
    const { threadId } = useParams();
    const nav = useNavigate();
    const { token } = useAuth();
    const { say } = useOutletContext();

    const [thread, setThread] = useState(null);
    const [entries, setEntries] = useState([]);
    const [hasOlder, setHasOlder] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [state, setState] = useState("loading"); // loading | ready | missing | error
    const [msg, setMsg] = useState("");
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);
    const [quoting, setQuoting] = useState(false);
    const [busyKey, setBusyKey] = useState("");
    const [statusBusy, setStatusBusy] = useState(false);

    const bottomRef = useRef(null);
    const taRef = useRef(null);
    const fileRef = useRef(null);
    const firstLoad = useRef(true);
    const scrollNext = useRef(true);

    const load = useCallback(async (silent = false) => {
        const res = await fetchThread(token, threadId);
        if (!res.success) {
            if (silent) return;
            if (res.status === 404) setState("missing"); else { setMsg(res.message || "Couldn't load this enquiry."); setState("error"); }
            return;
        }
        setThread(res.thread);
        setEntries((prev) => (firstLoad.current ? res.entries : mergeEntries(prev, res.entries)));
        if (firstLoad.current) { setHasOlder(!!res.hasOlder); firstLoad.current = false; }
        setState("ready");
    }, [token, threadId]);
    const loadRef = useRef(load); loadRef.current = load;

    useEffect(() => { firstLoad.current = true; scrollNext.current = true; setState("loading"); if (token) load(false); }, [token, threadId, load]);
    useRfqLive(() => loadRef.current(true), { enabled: !!token && state === "ready" });

    useLayoutEffect(() => {
        if (scrollNext.current && state === "ready") {
            bottomRef.current?.scrollIntoView({ block: "end" });
            scrollNext.current = false;
        }
    }, [entries, state]);

    const loadOlder = async () => {
        if (loadingOlder || !entries.length) return;
        setLoadingOlder(true);
        const res = await fetchThread(token, threadId, { before: entries[0].createdAt });
        setLoadingOlder(false);
        if (!res.success) return say(res.message || "Couldn't load older updates.");
        setEntries((prev) => mergeEntries(prev, res.entries));
        setHasOlder(!!res.hasOlder);
    };

    // ---- composer ----
    const addFiles = (list) => {
        const picked = Array.from(list || []);
        const room = MAX_FILES - files.length;
        if (picked.length > room) say(`You can attach up to ${MAX_FILES} files.`);
        picked.slice(0, Math.max(room, 0)).forEach((file) => {
            if (!ALLOWED_FILES.test(file.name)) return say(`${file.name}: this file type isn't supported.`);
            if (file.size > MAX_FILE_BYTES) return say(`${file.name} is larger than 15 MB.`);
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setFiles((p) => [...p, { id, name: file.name, size: file.size, status: "uploading" }]);
            uploadThreadFile(token, threadId, file).then((r) => setFiles((p) => p.map((f) => (f.id !== id ? f
                : r.success ? { ...f, status: "done", attachment: r.attachment } : { ...f, status: "error", error: r.message }))));
        });
    };
    const uploading = files.some((f) => f.status === "uploading");
    const ready = files.filter((f) => f.status === "done");
    const canSend = !sending && !uploading && (text.trim() || ready.length);

    const send = async () => {
        if (!canSend) return;
        setSending(true);
        const res = await addThreadEntry(token, threadId, { body: text.trim(), attachments: ready.map((f) => f.attachment) });
        setSending(false);
        if (!res.success) return say(res.message || "Couldn't save your update.");
        scrollNext.current = true;
        setEntries((prev) => mergeEntries(prev, [res.entry]));
        setThread((t) => ({ ...t, lastActivityAt: res.entry.createdAt }));
        setText(""); setFiles([]);
        if (taRef.current) taRef.current.style.height = "auto";
    };
    const onKey = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } };

    // ---- actions ----
    const retry = async (quoteId, channel) => {
        setBusyKey(`${quoteId}:${channel}`);
        const res = await resendThreadQuote(token, threadId, quoteId, [channel]);
        setBusyKey("");
        if (!res.success) return say(res.message || "Couldn't resend the quotation.");
        setEntries((prev) => prev.map((e) => (e.quote?.id === quoteId ? { ...e, quote: res.quote } : e)));
        say(res.message);
    };
    const toggleStatus = async () => {
        const next = thread.status === "open" ? "closed" : "open";
        if (next === "closed" && !window.confirm("Close this enquiry? You can reopen it any time.")) return;
        setStatusBusy(true);
        const res = await setThreadStatus(token, threadId, next);
        setStatusBusy(false);
        if (!res.success) return say(res.message || "Couldn't update the enquiry.");
        setThread((t) => ({ ...t, ...res.thread }));
        scrollNext.current = true;
        load(true);
    };

    if (state === "loading") return <div className="gd"><div className="st-sk tall" style={{ marginTop: 22 }} /><div className="st-sk tall" /></div>;
    if (state !== "ready") {
        return (
            <div className="gd"><div className="st-empty-card" style={{ marginTop: 22 }}>
                <b>{state === "missing" ? "This enquiry isn't available" : msg}</b>
                {state === "missing" ? "It may have been removed, or it belongs to another salesperson." : ""}
                <button type="button" className="st-btn" onClick={() => (state === "missing" ? nav("/sales/enquiries") : load(false))}>{state === "missing" ? "Back to enquiries" : "Try again"}</button>
            </div></div>
        );
    }

    const closed = thread.status === "closed";
    let lastDay = "";

    return (
        <div className="gd st-page">
            <header className="st-head">
                <Link to="/sales/enquiries" className="st-ib" aria-label="Back to enquiries"><ArrowLeft size={18} /></Link>
                <div className="st-head-t">
                    <h1>{thread.displayName}</h1>
                    <p>{thread.productName} · {qty(thread.quantity)} {thread.unit} · Posted {dateTime(thread.createdAt)}</p>
                </div>
                {!closed && <button type="button" className="st-btn pri" onClick={() => setQuoting(true)}><Receipt size={16} />Quote</button>}
            </header>

            <CustomerCard token={token} thread={thread} say={say} onSaved={(t) => setThread((s) => ({ ...s, ...t }))} />

            {thread.specifications && <p className="st-specs"><b>Specifications</b>{thread.specifications}</p>}

            <div className="st-log" aria-live="polite">
                {hasOlder && <button type="button" className="st-btn st-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? <Loader2 size={14} className="st-spin" /> : null}Show earlier updates</button>}
                {entries.map((e) => {
                    const day = dayLabel(e.createdAt);
                    const head = day !== lastDay; lastDay = day;
                    return (
                        <div key={e.id}>
                            {head && <div className="st-day"><span>{day}</span></div>}
                            <Entry e={e} busyKey={busyKey} onRetry={retry} />
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {closed ? (
                <div className="st-compose closed">
                    <span>This enquiry is closed.</span>
                    <button type="button" className="st-btn pri" disabled={statusBusy} onClick={toggleStatus}>{statusBusy ? <Loader2 size={16} className="st-spin" /> : null}Reopen</button>
                </div>
            ) : (
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
                    <div className="st-compose-r">
                        <input ref={fileRef} type="file" multiple hidden accept={FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                        <button type="button" className="st-ib" aria-label="Attach files" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
                        <textarea ref={taRef} className="st-ta" rows={1} value={text} placeholder="Write an update, e.g. called the buyer, waiting for approval…" aria-label="Write an update"
                            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }} onKeyDown={onKey} maxLength={4000} />
                        <button type="button" className="st-send" aria-label="Save update" disabled={!canSend} onClick={send}>
                            {sending ? <Loader2 size={18} className="st-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="st-compose-f">
                        <small>Only you can see this log.</small>
                        <button type="button" className="st-lnk" disabled={statusBusy} onClick={toggleStatus}>Close enquiry</button>
                    </div>
                </div>
            )}

            {quoting && (
                <SalesQuoteSheet token={token} thread={thread} onClose={() => setQuoting(false)}
                    onSent={() => { scrollNext.current = true; load(true); }} />
            )}
        </div>
    );
}