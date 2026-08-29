// components/chat/ChatWindow.jsx
//
// The whole message-thread experience — header, banner, bubbles,
// composer — lives in this one file now. It used to be split across
// ChatWindow / MessageBubble / ChatComposer / ConnectionBanner; that made
// sense while each was growing independently, but in practice they only
// ever change together, and the split was hiding a real bug (ChatWindow's
// old inline `deleteMessage` referenced state — `setMessageMap` — that
// only existed inside the messages hook, so every delete threw silently).
import { useEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CreditCard, Loader2, Check, CheckCheck, Clock3, AlertCircle, MoreVertical, Ban, Send, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import useChatMessages, { usePresence, useCredit } from "../../hooks/useChat.js";

import { formatLastSeen } from "../../utils/formatLastSeen.js";

const C = { ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83", hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)" };
const GROUP_GAP_MS = 3 * 60 * 1000; // same-sender messages within this window render as one visual group

function initials(name) {
    return (name || "?").trim().split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function dayLabel(iso) {
    const d = new Date(iso), now = new Date();
    const diffDays = Math.round((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

// ---- header -----------------------------------------------------------

// three dots that bounce in sequence — used both as the tiny inline
// header indicator and inside the typing "bubble" in the thread itself
function TypingDots({ color = C.secondary, size = "h-1.5 w-1.5" }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className={`inline-block rounded-full ${size}`}
                    style={{ background: color }}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
            ))}
        </span>
    );
}

// ChatWindow.jsx — replace CreditBar entirely

function CreditBar({ credit, viewerRole, otherName, onRequest, onToggle, onDecide, requesting }) {
    if (viewerRole === "buyer") {
        const cooldownActive = credit?.status === "rejected" && credit.cooldown_until && new Date(credit.cooldown_until) > new Date();
        if (!credit || credit.status === "revoked" || (credit.status === "rejected" && !cooldownActive)) {
            return (
                <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: C.hair, background: `${C.secondary}08` }}>
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: C.ink }}>
                        <CreditCard className="h-3.5 w-3.5" style={{ color: C.secondary }} /> Buy on credit from {otherName}
                    </span>
                    <button onClick={onRequest} disabled={requesting}
                        className="shrink-0 rounded-lg px-3.5 py-1.5 text-[11.5px] font-bold text-white transition-opacity disabled:opacity-60"
                        style={{ background: C.secondary }}>
                        {requesting ? "Requesting…" : "Request credit"}
                    </button>
                </div>
            );
        }
        if (credit.status === "pending") {
            return (
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.hair, background: "#fef3c7" }}>
                    <Clock3 className="h-3.5 w-3.5 shrink-0" style={{ color: "#a16207" }} />
                    <span className="text-[12px] font-semibold" style={{ color: "#a16207" }}>Credit request pending {otherName}'s approval.</span>
                </div>
            );
        }
        if (credit.status === "approved") {
            return (
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.hair, background: "#EAF7F2" }}>
                    <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#059669" }} />
                    <span className="text-[12px] font-bold" style={{ color: "#059669" }}>Credit approved — you can buy on credit from {otherName}.</span>
                </div>
            );
        }
        if (cooldownActive) {
            return (
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.hair, background: C.hairSoft }}>
                    <span className="text-[12px] font-semibold" style={{ color: C.muted }}>
                        Credit request declined. You can request again after {new Date(credit.cooldown_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                    </span>
                </div>
            );
        }
        return null;
    }

    // seller — the important fix: a pending request now shows here too,
    // pinned at the top, with Approve/Decline right in the bar. This is
    // always visible regardless of how far the seller has scrolled.
    if (viewerRole === "seller" && credit?.status === "pending") {
        return (
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: C.hair, background: "#fef3c7" }}>
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "#a16207" }}>
                    <CreditCard className="h-3.5 w-3.5" /> {otherName} requested to buy on credit
                </span>
                <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => onDecide(credit.id, "approved")}
                        className="rounded-lg px-3 py-1.5 text-[11.5px] font-bold text-white" style={{ background: "#059669" }}>
                        Approve
                    </button>
                    <button onClick={() => onDecide(credit.id, "rejected")}
                        className="rounded-lg border px-3 py-1.5 text-[11.5px] font-bold" style={{ borderColor: C.hair, color: C.muted, background: "#fff" }}>
                        Decline
                    </button>
                </div>
            </div>
        );
    }

    if (viewerRole === "seller" && credit && (credit.status === "approved" || credit.status === "revoked")) {
        const on = credit.status === "approved";
        return (
            <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: C.hair, background: on ? "#EAF7F2" : "#FAFAFA" }}>
                <span className="text-[12.5px] font-bold" style={{ color: C.ink }}>
                    Credit for {otherName}: <span style={{ color: on ? "#059669" : C.muted }}>{on ? "Enabled" : "Off"}</span>
                </span>
                <button onClick={() => onToggle(!on)} className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: on ? "#059669" : "#CBD2D6" }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? "22px" : "2px" }} />
                </button>
            </div>
        );
    }
    return null;
}

function ChatHeader({ meta, otherPresence, otherTyping, onBack }) {
    return (
        <div className="flex items-center gap-3 border-b px-3.5 py-2.5" style={{ borderColor: C.hair, background: "#fff" }}>
            <button onClick={onBack} className="rounded-full p-1.5 transition hover:bg-black/5 sm:hidden">
                <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
            </button>
            <div className="relative shrink-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-[12.5px] font-extrabold text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}>
                    {meta ? initials(meta.otherShopName) : ""}
                </span>
                {otherPresence?.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: "#1FAE5C" }} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {meta ? (
                    <>
                        <p className="truncate text-[14.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{meta.otherShopName}</p>
                        {/* header line swaps to "typing…" (with the same bouncing
                            dots, scaled down) in place of online/last-seen the
                            moment a typing:update event comes in, and reverts the
                            instant it stops — driven straight off `otherTyping`. */}
                        <AnimatePresence mode="wait" initial={false}>
                            {otherTyping ? (
                                <motion.p
                                    key="typing"
                                    initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.12 }}
                                    className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide"
                                    style={{ color: C.secondary }}
                                >
                                    typing
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="status"
                                    initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.12 }}
                                    className="text-[10.5px] font-semibold uppercase tracking-wide"
                                    style={{ color: otherPresence?.online ? C.secondary : C.muted }}
                                >
                                    {otherPresence?.online ? "Online" : formatLastSeen(otherPresence?.lastSeenAt)}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </>
                ) : (
                    <>
                        <div className="h-3 w-28 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                        <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                    </>
                )}
            </div>
        </div>
    );
}

// the actual "bubble" — rendered in the thread like an incoming message,
// so it reads as "they're composing something" rather than just a status
// line tucked under the composer
function TypingBubble() {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className="mb-3 flex justify-start"
        >
            <div className="flex items-center rounded-2xl px-4 py-3" style={{ background: "#fff", border: `1px solid ${C.hair}`, borderBottomLeftRadius: 4, boxShadow: "0 1px 2px rgba(11,17,22,0.04)" }}>
                <TypingDots size="h-1.5 w-1.5" />
            </div>
        </motion.div>
    );
}

// ---- message bubble -----------------------------------------------------

function TickIcon({ status, onRetry }) {
    if (status === "sending") return <Clock3 className="h-3 w-3" style={{ color: "rgba(255,255,255,0.7)" }} />;
    if (status === "failed") return (
        <button onClick={onRetry} className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "#ffd3d3" }} title="Tap to retry">
            <AlertCircle className="h-3 w-3" /> Retry
        </button>
    );
    if (status === "read") return <CheckCheck className="h-3.5 w-3.5" style={{ color: "#6FD3FF" }} />;
    if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />;
    return <Check className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />;
}

const MessageBubble = memo(function MessageBubble({ message, isMine, groupPos, onDelete, onRetry, credit, onCreditDecision }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        if (!menuOpen) return;
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [menuOpen]);

    if (message.message_type === "credit_request") {
        const creditId = message.metadata?.creditRequestId;
        const isCurrent = credit?.id === creditId;
        const status = isCurrent ? credit.status : null;
        const statusStyle = {
            pending: { color: "#a16207", bg: "#fef3c7", label: "Pending" },
            approved: { color: "#059669", bg: "#EAF7F2", label: "Approved" },
            rejected: { color: "#c71f11", bg: "rgba(199,31,17,0.08)", label: "Declined" },
            revoked: { color: C.muted, bg: C.hairSoft, label: "Turned off" },
        }[status] || { color: C.muted, bg: C.hairSoft, label: "Sent" };

        return (
            <div className="mb-3 flex justify-center">
                <div className="flex w-full max-w-[260px] items-center gap-2.5 rounded-2xl border px-3.5 py-3" style={{ borderColor: C.hair, background: "#fff" }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${C.secondary}14`, color: C.secondary }}>
                        <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-bold" style={{ color: C.ink }}>Credit request</p>
                        <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    const time = new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const isDeleted = !!message.deleted_at;
    const isFailed = message.status === "failed";

    // WhatsApp-style corner rounding: only the outer edge of a grouped
    // run gets the "tail" corner, interior bubbles round evenly on both
    // sides so a run of consecutive messages reads as one visual block.
    const tailRadius = isMine
        ? { borderBottomRightRadius: groupPos === "last" || groupPos === "only" ? 4 : 16 }
        : { borderBottomLeftRadius: groupPos === "last" || groupPos === "only" ? 4 : 16 };

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
            className={`group relative flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"} ${groupPos === "last" || groupPos === "only" ? "mb-3" : "mb-0.5"}`}
        >
            {isMine && !isDeleted && (
                <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
                    <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full p-1 hover:bg-black/5">
                        <MoreVertical className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-6 z-10 w-40 overflow-hidden rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: C.hair }}>
                            <button onClick={() => { setMenuOpen(false); onDelete(message.id, "me"); }} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold hover:bg-black/5" style={{ color: C.ink }}>
                                Delete for me
                            </button>
                            <button onClick={() => { setMenuOpen(false); onDelete(message.id, "everyone"); }} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50">
                                Delete for everyone
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug tracking-wide sm:max-w-[65%] ${isDeleted ? "italic" : ""}`}
                style={{
                    ...(isDeleted
                        ? { background: "rgba(11,17,22,0.04)", color: C.muted, border: `1px dashed ${C.hair}` }
                        : isMine
                            ? { background: isFailed ? "linear-gradient(135deg, #99332480, #99332480)" : "linear-gradient(135deg, #006F83 0%, #0B8A93 100%)", color: "#fff", boxShadow: "0 1px 2px rgba(11,17,22,0.08)" }
                            : { background: "#fff", color: C.ink, border: `1px solid ${C.hair}`, boxShadow: "0 1px 2px rgba(11,17,22,0.04)" }),
                    ...tailRadius,
                }}
            >
                {isDeleted ? (
                    <p className="flex items-center gap-1.5"><Ban className="h-3 w-3" /> This message was deleted</p>
                ) : (
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                )}
                <div className={`mt-1 flex items-center gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] font-semibold" style={{ color: isMine && !isDeleted ? "rgba(255,255,255,0.75)" : C.muted }}>{time}</span>
                    {isMine && !isDeleted && <TickIcon status={message.status} onRetry={() => onRetry(message.id)} />}
                </div>
            </div>
        </motion.div>
    );
});

// ---- composer -----------------------------------------------------------

function ChatComposer({ onSend, sending, onTypingChange }) {
    const [value, setValue] = useState("");
    const textareaRef = useRef(null);

    const autoGrow = (e) => {
        setValue(e.target.value);
        onTypingChange?.(e.target.value.length > 0);
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    };
    const submit = () => {
        if (!value.trim()) return;
        onSend(value);
        onTypingChange?.(false);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
    };
    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    };

    return (
        <div className="flex items-end gap-2 border-t px-3 py-2.5 sm:px-4" style={{ borderColor: C.hair, background: "#fff" }}>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={autoGrow}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Type a message…"
                className="max-h-[120px] flex-1 resize-none rounded-2xl border bg-[#FAFAF9] px-3.5 py-2.5 text-[13.5px] font-medium leading-snug tracking-wide outline-none transition-colors placeholder:text-slate-400 focus:border-[#006F83] focus:bg-white"
                style={{ borderColor: C.hair, color: C.ink }}
            />
            <button
                onClick={submit}
                disabled={!value.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                style={{ background: C.secondary }}
            >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
        </div>
    );
}

// ---- skeleton (initial load) ---------------------------------------------

function ThreadSkeleton() {
    const widths = ["55%", "38%", "62%", "44%"];
    return (
        <div className="flex flex-1 flex-col justify-end gap-2 px-4 py-3">
            {widths.map((w, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className="h-9 animate-pulse rounded-2xl" style={{ width: w, background: C.hairSoft }} />
                </div>
            ))}
        </div>
    );
}

// ---- main -----------------------------------------------------------------

export default function ChatWindow({ conversationId, meta, onBack }) {
    const { profile } = useAuth();
    const { token } = useAuth();
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    const presence = usePresence(meta?.otherUserId ? [meta.otherUserId] : []);
    const otherPresence = meta?.otherUserId ? presence[meta.otherUserId] : null;

    const { credit, viewerRole, request, decide, toggle } = useCredit(meta?.otherUserId);
    const [requestingCredit, setRequestingCredit] = useState(false);

    const handleRequestCredit = async () => {
        setRequestingCredit(true);
        await request();
        setRequestingCredit(false);
    };

    const {
        messages, loading, loadingOlder, hasMore, loadOlder,
        send, retry, deleteMessage, sending, otherTyping, notifyTyping, connected,
    } = useChatMessages(conversationId, meta?.otherUserId);

    // reset scroll instantly on thread switch instead of animating from
    // wherever the previous thread happened to be scrolled to
    const prevLenRef = useRef(0);
    const prevConvRef = useRef(conversationId);
    useEffect(() => {
        if (prevConvRef.current !== conversationId) {
            prevConvRef.current = conversationId;
            prevLenRef.current = 0;
            requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
        }
    }, [conversationId]);

    useEffect(() => {
        if (otherTyping) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [otherTyping]);

    useEffect(() => {
        const grew = messages.length > prevLenRef.current;
        prevLenRef.current = messages.length;
        if (grew) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    const onScroll = () => {
        if (scrollRef.current && scrollRef.current.scrollTop < 80 && hasMore && !loadingOlder) loadOlder();
    };

    let lastDay = null;

    return (
        <div className="flex h-full flex-col" style={{ background: "#F7F6F3" }}>
            {!connected && (
                <div className="px-4 py-1.5 text-center text-[11px] font-bold text-white" style={{ background: "#c71f11" }}>
                    Reconnecting…
                </div>
            )}

            <ChatHeader meta={meta} otherPresence={otherPresence} otherTyping={otherTyping} onBack={onBack} />
            <CreditBar
                credit={credit} viewerRole={viewerRole} otherName={meta?.title || "them"}
                onRequest={handleRequestCredit} onToggle={toggle} onDecide={decide} requesting={requestingCredit}
            />
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                {loadingOlder && (
                    <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.muted }} /></div>
                )}
                {loading ? (
                    <ThreadSkeleton />
                ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: C.hairSoft }}>
                            <MessageCircle className="h-5 w-5" style={{ color: C.muted }} />
                        </span>
                        <p className="text-[13px] font-bold" style={{ color: C.ink }}>Say hello 👋</p>
                        <p className="max-w-[220px] text-[11.5px] font-medium" style={{ color: C.muted }}>Your messages with {meta?.title || "them"} start here.</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((m, i) => {
                            const day = dayLabel(m.created_at);
                            const showDay = day !== lastDay;
                            lastDay = day;

                            const prev = messages[i - 1];
                            const next = messages[i + 1];
                            const withinPrevGroup = !showDay && prev && prev.sender_id === m.sender_id && (new Date(m.created_at) - new Date(prev.created_at)) < GROUP_GAP_MS;
                            const withinNextGroup = next && next.sender_id === m.sender_id && dayLabel(next.created_at) === day && (new Date(next.created_at) - new Date(m.created_at)) < GROUP_GAP_MS;
                            const groupPos = withinPrevGroup && withinNextGroup ? "middle" : withinPrevGroup ? "last" : withinNextGroup ? "first" : "only";

                            return (
                                <div key={m.id}>
                                    {showDay && (
                                        <div className="my-3 flex items-center justify-center">
                                            <span className="rounded-full px-3 py-1 text-[10.5px] font-bold tracking-wide" style={{ background: "rgba(11,17,22,0.05)", color: C.muted }}>
                                                {day}
                                            </span>
                                        </div>
                                    )}
                                    <MessageBubble
                                        message={m}
                                        isMine={m.sender_id === profile?.id}
                                        groupPos={groupPos}
                                        onDelete={deleteMessage}
                                        onRetry={retry}
                                        credit={credit}
                                        onCreditDecision={decide}
                                    />
                                </div>
                            );
                        })}
                    </AnimatePresence>
                )}
                <AnimatePresence>
                    {otherTyping && <TypingBubble key="typing-bubble" />}
                </AnimatePresence>
                <div ref={bottomRef} />
            </div>

            <ChatComposer onSend={send} sending={sending} onTypingChange={notifyTyping} />
        </div>
    );
}