// src/pages/SalesMonitorThreadPage.jsx: /sales/monitor/enquiries/:threadId
// The enquiry group chat as a full page for owners / admins (the page version of components/team/SalesThreadViewer.jsx).
// Header shows who created the enquiry and, if somebody else touched it last, who updated it.
// Live over the socket, optimistic sending, @ tagging, files, typing indicator, read tracking.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Paperclip, Send, X, Receipt, Phone, Mail, Bell, Trophy, XCircle, PhoneCall, AlertCircle, BadgeCheck, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchChatThread, postChatMessage, markChatRead, uploadChatFile } from "../utils/salesChatApi.js";
import useChatSocket from "../hooks/useChatSocket.js";
import useMentions from "../hooks/useMentions.js";
import { ALLOWED_FILES, FILE_ACCEPT, MAX_FILE_BYTES, MAX_FILES, clock, dayLabel, dateTime, inr, qty } from "../components/sales/salesThreadFmt.js";
import { Attachment, BodyText, OtherBubble, TypingLine, ParticipantStack, MentionList } from "../components/team/chat/ChatBits.jsx";
import ParticipantsSheet from "../components/team/chat/ParticipantsSheet.jsx";
import "../components/sales/sales-threads.css";
import "../components/sales/sales-threads.polish.css";
import "../components/sales/sales-threads.cold.css";
import "../components/sales/sales-chat.css";
import "../components/team/monitor/monitor-lists.css";

const CH = { whatsapp: "WhatsApp", email: "Email" };
const COMPOSER_MAX = 136;

const byTime = (a, b) => (Number(!!a.local) - Number(!!b.local))
    || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);
const merge = (prev, inc) => {
    if (!inc?.length) return prev;
    const m = new Map(prev.map((e) => [e.id, e]));
    inc.forEach((e) => { const o = m.get(e.id); m.set(e.id, o?.clientKey && !e.clientKey ? { ...e, clientKey: o.clientKey } : e); });
    return [...m.values()].sort(byTime);
};
const sig = (e) => `${e.body || ""}|${(e.attachments || []).map((a) => a.path).join(",")}`;
const mergeIncoming = (prev, inc) => {
    const have = new Set((inc || []).filter((e) => e.kind === "note").map(sig));
    return merge(prev.filter((e) => !(e.local && !e.failed && have.has(sig(e)))), inc);
};
const stateOf = (t) => (t.status !== "closed" ? { k: "open", l: "Open" } : t.outcome === "won" ? { k: "won", l: "Won" } : t.outcome === "lost" ? { k: "lost", l: "Lost" } : { k: "closed", l: "Closed" });

// page scrolling
const jump = (y) => {
    try { if (window.lenis?.scrollTo) { window.lenis.scrollTo(y, { immediate: true, force: true }); return; } } catch { /* fall back */ }
    window.scrollTo(0, y);
};
const toBottom = () => jump(document.documentElement.scrollHeight);
const distFromBottom = () => document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
const smoothToBottom = () => {
    const y = document.documentElement.scrollHeight - window.innerHeight;
    try { if (window.lenis?.scrollTo) { window.lenis.scrollTo(y, { duration: 0.5 }); return; } } catch { /* fall back */ }
    window.scrollTo({ top: y, behavior: "smooth" });
};

function Quote({ q }) {
    return (
        <div className="st-q">
            <p className="st-q-h"><Receipt size={16} /><b>Quotation sent</b><span>{inr(q.total)}</span></p>
            <ul>{(q.items || []).map((i) => (
                <li key={i.submissionId}><span>{i.productName}<small>{qty(i.quantity)} {i.unit} × {inr(i.unitPriceIncl, 4)}</small></span><b>{inr(i.totalIncl)}</b></li>
            ))}</ul>
            <div className="st-q-d">{Object.entries(q.delivery || {}).map(([ch, d]) => (
                <span key={ch} className={`st-dl ${d.status === "sent" ? "ok" : "bad"}`}>
                    {d.status === "sent" ? <BadgeCheck size={13} /> : <AlertCircle size={13} />}{CH[ch] || ch} {d.status === "sent" ? "sent" : "failed"}
                </span>
            ))}</div>
            {q.note && <p className="st-q-n">{q.note}</p>}
        </div>
    );
}

const Entry = memo(function Entry({ e, meId, ownerId, who, names, meName, onResend, onDiscard }) {
    if (e.kind === "system") return <div className="st-sys"><span>{e.body}</span><time>{clock(e.createdAt)}</time></div>;
    const author = e.authorId || ownerId;
    const mine = author === meId;
    const isQuote = e.kind === "quote" && e.quote;
    const content = (
        <>
            {isQuote ? <Quote q={e.quote} /> : e.body && <p className="st-body"><BodyText body={e.body} names={names} meName={meName} /></p>}
            {e.attachments?.length > 0 && <div className="st-atts">{e.attachments.map((a) => <Attachment key={a.path} a={a} />)}</div>}
        </>
    );
    if (!mine) return <OtherBubble name={who(author, e.authorName)} id={author} time={clock(e.createdAt)} quote={isQuote}>{content}</OtherBubble>;
    return (
        <div className={`st-msg${e.clientKey ? " pop" : ""}`}>
            <div className={`st-bub${e.failed ? " failed" : ""}${isQuote ? " quote" : ""}`}>
                {content}
                <time dateTime={e.createdAt}>{clock(e.createdAt)}</time>
                {e.failed && (
                    <div className="st-fail" role="alert"><AlertCircle size={13} /><span>Not sent</span>
                        <button type="button" onClick={() => onResend(e.id)}>Retry</button>
                        <button type="button" onClick={() => onDiscard(e.id)}>Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default function SalesMonitorThreadPage() {
    const { threadId: id } = useParams();
    const { token } = useAuth();
    const { socket } = useSocket() || {};
    const loc = useLocation();
    const back = loc.state?.from || "/sales/monitor/enquiries";

    const [thread, setThread] = useState(null);
    const [people, setPeople] = useState([]);
    const [meId, setMeId] = useState("");
    const [canManage, setCanManage] = useState(false);
    const [entries, setEntries] = useState([]);
    const [hasOlder, setHasOlder] = useState(false);
    const [state, setState] = useState("loading");     // loading | ready | missing | error
    const [msg, setMsg] = useState("");
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [note, setNote] = useState("");

    const stickRef = useRef(false), anchorRef = useRef(null), firstRef = useRef(true), settledRef = useRef(false);
    const entriesRef = useRef([]); entriesRef.current = entries;
    const queueRef = useRef(Promise.resolve());
    const taRef = useRef(null), fileRef = useRef(null), pageRef = useRef(null);

    const load = useCallback(async () => {
        const r = await fetchChatThread(token, id, { limit: 30 });
        if (!r.success) {
            if (!firstRef.current) return;
            if (r.status === 404) setState("missing"); else { setMsg(r.message || "Couldn't load this enquiry."); setState("error"); }
            return;
        }
        if (!firstRef.current && distFromBottom() < 260) stickRef.current = true;
        setThread(r.thread); setPeople(r.participants || []); setMeId(r.me || ""); setCanManage(!!r.canManage);
        setEntries((prev) => mergeIncoming(prev, r.entries || []));
        if (firstRef.current) setHasOlder(!!r.hasOlder);
        firstRef.current = false;
        setState("ready");
    }, [token, id]);

    useEffect(() => { firstRef.current = true; settledRef.current = false; setState("loading"); setEntries([]); if (token) load(); }, [load, token]);

    const chat = useChatSocket(id, {
        selfId: meId,
        onMessage: (p) => { if (!p.entry) return; if (distFromBottom() < 260) stickRef.current = true; setEntries((prev) => mergeIncoming(prev, [p.entry])); },
        onParticipants: () => load(),
        onReconnect: () => { if (!firstRef.current) load(); },
    });
    useEffect(() => {
        if (!socket) return undefined;
        let t;
        const ping = () => { clearTimeout(t); t = setTimeout(load, 600); };
        socket.on("sales:monitor", ping);
        return () => { clearTimeout(t); socket.off("sales:monitor", ping); };
    }, [socket, load]);
    useEffect(() => {
        const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 25000);
        return () => clearInterval(t);
    }, [load]);

    // reading = the chat is open and visible. Drives unread badges and stops the 1-hour reminder.
    const inChat = people.some((p) => p.userId === meId);
    useEffect(() => {
        if (state !== "ready" || !inChat) return undefined;
        const fire = () => { if (document.visibilityState === "visible") markChatRead(token, id); };
        const t = setTimeout(fire, 400);
        const beat = setInterval(fire, 20000);
        document.addEventListener("visibilitychange", fire);
        window.addEventListener("focus", fire);
        return () => { clearTimeout(t); clearInterval(beat); document.removeEventListener("visibilitychange", fire); window.removeEventListener("focus", fire); };
    }, [state, inChat, entries.length, token, id]);

    // scrolling: restore position after older entries, jump to the newest on first paint, follow new ones when near the end
    useLayoutEffect(() => {
        if (state !== "ready") return;
        const a = anchorRef.current;
        if (a) { anchorRef.current = null; jump(a.y + (document.documentElement.scrollHeight - a.h)); return; }
        if (!settledRef.current) { settledRef.current = true; toBottom(); requestAnimationFrame(toBottom); setTimeout(toBottom, 250); return; }
        if (stickRef.current) { stickRef.current = false; smoothToBottom(); }
    }, [entries, state]);

    // fill the screen so a short chat still pushes the composer to the bottom
    useLayoutEffect(() => {
        const el = pageRef.current; if (!el) return undefined;
        const fit = () => { const top = el.getBoundingClientRect().top + window.scrollY; el.style.setProperty("--st-min", `calc(100dvh - ${Math.max(Math.round(top), 0)}px)`); };
        fit(); window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, [state]);

    const loadOlder = async () => {
        const first = entriesRef.current.find((e) => !e.local);
        if (!first || loadingOlder) return;
        setLoadingOlder(true);
        const r = await fetchChatThread(token, id, { before: first.createdAt, beforeId: first.id, limit: 30 });
        setLoadingOlder(false);
        if (!r.success) return;
        anchorRef.current = { h: document.documentElement.scrollHeight, y: window.scrollY };
        setEntries((prev) => merge(prev, r.entries || []));
        setHasOlder(!!r.hasOlder);
    };

    /* ----- people / names ----- */
    const nameMap = useMemo(() => new Map(people.map((p) => [p.userId, p.name])), [people]);
    const who = useCallback((uid, fb) => nameMap.get(uid) || fb || "Teammate", [nameMap]);
    const names = useMemo(() => people.map((p) => p.name), [people]);
    const meName = nameMap.get(meId) || "";
    const others = useMemo(() => people.filter((p) => p.userId !== meId), [people, meId]);
    const mn = useMentions({ people: others, text, setText, taRef });

    /* ----- composer ----- */
    useLayoutEffect(() => {
        const t = taRef.current; if (!t) return;
        t.style.height = "auto";
        t.style.height = `${Math.min(t.scrollHeight, COMPOSER_MAX)}px`;
        t.style.overflowY = t.scrollHeight > COMPOSER_MAX ? "auto" : "hidden";
    }, [text, state]);

    const addFiles = (list) => {
        const picked = Array.from(list || []);
        const room = MAX_FILES - files.length;
        if (picked.length > room) setNote(`You can attach up to ${MAX_FILES} files.`);
        picked.slice(0, Math.max(room, 0)).forEach((file) => {
            if (!ALLOWED_FILES.test(file.name)) return setNote(`${file.name}: this file type isn't supported.`);
            if (file.size > MAX_FILE_BYTES) return setNote(`${file.name} is larger than 15 MB.`);
            const fid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const preview = /^image\/(jpe?g|png|webp|gif)$/i.test(file.type) ? URL.createObjectURL(file) : null;
            setFiles((p) => [...p, { id: fid, name: file.name, size: file.size, status: "uploading", preview }]);
            uploadChatFile(token, id, file).then((r) => setFiles((p) => p.map((f) => (f.id !== fid ? f
                : r.success ? { ...f, status: "done", attachment: r.attachment } : { ...f, status: "error", error: r.message }))));
        });
    };
    const uploading = files.some((f) => f.status === "uploading");
    const ready = files.filter((f) => f.status === "done");
    const canSend = !uploading && (text.trim().length > 0 || ready.length > 0);

    const post = useCallback((tmpId, payload) => {
        queueRef.current = queueRef.current.then(async () => {
            const r = await postChatMessage(token, id, payload);
            if (!r.success) { setEntries((prev) => prev.map((e) => (e.id === tmpId ? { ...e, failed: true, error: r.message } : e))); return; }
            setEntries((prev) => {
                const rest = prev.filter((e) => e.id !== tmpId);
                return rest.some((e) => e.id === r.entry.id) ? rest : merge(rest, [{ ...r.entry, clientKey: tmpId }]);
            });
        }).catch(() => { /* never break the queue */ });
    }, [token, id]);

    const send = () => {
        if (!canSend) return;
        const body = text.trim();
        const now = new Date().toISOString();
        const tmpId = `tmp-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const payload = { body, attachments: ready.map((f) => f.attachment), mentions: mn.collect(text) };
        const tmp = {
            id: tmpId, clientKey: tmpId, local: true, kind: "note", authorId: meId, authorName: meName, body, createdAt: now, payload,
            attachments: ready.map((f) => ({ ...f.attachment, url: f.preview || null })),
        };
        stickRef.current = true;
        setEntries((prev) => merge(prev, [tmp]));
        post(tmpId, payload);
        setText(""); setFiles([]); setNote(""); mn.reset(); chat.emitTyping(false);
        taRef.current?.focus();
    };
    const resend = useCallback((tid) => {
        const e = entriesRef.current.find((x) => x.id === tid); if (!e?.payload) return;
        setEntries((prev) => prev.map((x) => (x.id === tid ? { ...x, failed: false, error: undefined } : x)));
        post(tid, e.payload);
    }, [post]);
    const discard = useCallback((tid) => setEntries((prev) => prev.filter((x) => x.id !== tid)), []);

    const onKey = (e) => {
        if (mn.onKeyDown(e)) return;
        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent?.isComposing) return;
        e.preventDefault(); send();
    };
    const onChange = (e) => {
        setText(e.target.value);
        mn.detect(e.target.value, e.target.selectionStart);
        chat.emitTyping(!!e.target.value.trim());
    };

    /* ----- states ----- */
    if (state === "loading") {
        return <div className="gd st-page"><div className="st-sk tall" style={{ marginTop: 22 }} /><div className="st-sk tall" /><div className="st-sk tall" /></div>;
    }
    if (state !== "ready" || !thread) {
        return (
            <div className="gd st-page"><div className="st-empty-card" style={{ marginTop: 22 }}>
                <b>{state === "missing" ? "This enquiry isn't available" : msg}</b>
                <Link to={back} className="st-btn">Back</Link>
                {state === "error" && <button type="button" className="st-btn" onClick={() => { setState("loading"); load(); }}>Try again</button>}
            </div></div>
        );
    }

    const st = stateOf(thread);
    const hasProduct = thread.hasProduct !== false;
    const cold = thread.kind === "cold_call";
    const closed = thread.status === "closed";

    // Creator = the salesperson who owns the enquiry. Last updated by = author of the newest saved message / quote.
    const creatorId = thread.salespersonId;
    const creatorName = thread.salespersonName || who(creatorId, "Salesperson");
    const lastReal = [...entries].reverse().find((e) => e.kind !== "system" && !e.local);
    const lastId = lastReal ? (lastReal.authorId || creatorId) : creatorId;
    const differs = !!lastReal && lastId !== creatorId;

    let lastDay = "";

    return (
        <div className="gd st-page" ref={pageRef}>
            <header className="st-head">
                <Link to={back} className="st-ib" aria-label="Back"><ArrowLeft size={18} /></Link>
                <div className="st-head-t">
                    <h1>{thread.displayName || "Enquiry"}</h1>
                    <p>{hasProduct ? `${thread.productName} · ${qty(thread.quantity)} ${thread.unit}` : "Cold call · no product yet"}</p>
                    <p className="sub">{cold ? "Logged by" : "Created by"} <b>{creatorName}</b> · {dateTime(thread.createdAt)}</p>
                    {differs && <p className="sub">Last updated by <b>{who(lastId, lastReal.authorName)}</b> · {dateTime(lastReal.createdAt)}</p>}
                </div>
                <ParticipantStack people={people} onClick={() => setSheet(true)} />
                <span className={`st-state ${st.k}`}>{st.l}</span>
                {cold && <span className="st-bd cold"><PhoneCall size={12} />Cold call</span>}
            </header>

            <section className="sc-info">
                <div className="sc-info-r">
                    <span>{thread.customerGstin ? `GSTIN ${thread.customerGstin}` : "GST number missing"}</span>
                    {thread.customerPhone && <span><Phone size={12} />{thread.customerPhone}</span>}
                    {thread.customerEmail && <span><Mail size={12} />{thread.customerEmail}</span>}
                </div>
                {thread.specifications && <p><b>Specifications </b>{thread.specifications}</p>}
                {closed && thread.outcome && (
                    <p className={`sc-out ${thread.outcome}`}>{thread.outcome === "won" ? <Trophy size={15} /> : <XCircle size={15} />}This enquiry was {thread.outcome}.</p>
                )}
                {thread.reminderAt && !closed && <p className="sc-out rem"><Bell size={15} />Salesperson reminder · {dateTime(thread.reminderAt)}</p>}
            </section>

            <div className="st-log">
                {hasOlder && (
                    <div className="st-older">
                        <button type="button" className="st-btn" onClick={loadOlder} disabled={loadingOlder}>
                            {loadingOlder && <Loader2 size={14} className="st-spin" />}Show earlier messages
                        </button>
                    </div>
                )}
                {entries.length === 0 && <p className="st-empty">No messages yet. Say hello.</p>}
                {entries.map((e) => {
                    const d = dayLabel(e.createdAt); const head = d !== lastDay; lastDay = d;
                    return (
                        <div key={e.clientKey || e.id}>
                            {head && <div className="st-day"><span>{d}</span></div>}
                            <Entry e={e} meId={meId} ownerId={creatorId} who={who} names={names} meName={meName} onResend={resend} onDiscard={discard} />
                        </div>
                    );
                })}
            </div>

            <div className="st-dock">
                <TypingLine names={chat.typingNames} />
                {closed ? (
                    <p className="sc-closed">This enquiry is closed. The salesperson can reopen it to continue the chat.</p>
                ) : (
                    <div className="st-compose">
                        {files.length > 0 && (
                            <div className="st-pend">{files.map((f) => (
                                <span key={f.id} className={`st-chip ${f.status}`} title={f.error || ""}>
                                    {f.status === "uploading" ? <Loader2 size={13} className="st-spin" /> : f.status === "error" ? <AlertCircle size={13} /> : <FileText size={13} />}
                                    <span className="n">{f.name}</span>
                                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}><X size={13} /></button>
                                </span>
                            ))}</div>
                        )}
                        <input ref={fileRef} type="file" multiple hidden accept={FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                        <MentionList options={mn.options} idx={mn.idx} onPick={mn.pick} />
                        <div className="st-bar">
                            <button type="button" className="st-plus" aria-label="Attach files" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
                            <textarea ref={taRef} className="st-ta" rows={1} value={text} maxLength={4000} aria-label="Write a message"
                                placeholder={others.length ? "Message the team… type @ to tag" : "Write a message…"} enterKeyHint="send"
                                onChange={onChange} onSelect={(e) => mn.detect(e.target.value, e.target.selectionStart)} onKeyDown={onKey}
                                onBlur={() => chat.emitTyping(false)}
                                onPaste={(e) => { if (e.clipboardData?.files?.length) addFiles(e.clipboardData.files); }} />
                            <button type="button" className="st-send" aria-label="Send message" disabled={!canSend} onClick={send}><Send size={18} /></button>
                        </div>
                        {note && <p className="st-err" role="alert">{note}</p>}
                        <small className="st-bar-h">Enter to send · Shift+Enter for a new line · @ to tag someone</small>
                    </div>
                )}
            </div>

            {sheet && (
                <ParticipantsSheet token={token} threadId={id} people={people} meId={meId} canManage={canManage}
                    onClose={() => setSheet(false)} onChanged={(list) => { setPeople(list); load(); }} />
            )}
        </div>
    );
}