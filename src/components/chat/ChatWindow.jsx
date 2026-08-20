// components/chat/ChatWindow.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchConversations } from "../../utils/chatApi.js";
import useChatMessages from "../../hooks/useChatMessages.js";
import MessageBubble from "./MessageBubble.jsx";
import ChatComposer from "./ChatComposer.jsx";
import usePresence from "../../hooks/usePresence.js";
import { formatLastSeen } from "../../utils/formatLastSeen.js";
import ConnectionBanner from "./ConnectionBanner.jsx";

const C = { ink: "#0B1116", muted: "#667077", secondary: "#006F83", hair: "rgba(11,17,22,0.09)" };

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

export default function ChatWindow({ conversationId, onBack }) {
    const { token, profile } = useAuth();
    const [meta, setMeta] = useState(null); // { title, otherUserId }
    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    const presence = usePresence(meta?.otherUserId ? [meta.otherUserId] : []);
    const otherPresence = meta?.otherUserId ? presence[meta.otherUserId] : null;

    const deleteMessage = useCallback(async (messageId, scope) => {
        // optimistic local update
        if (scope === "everyone") {
            setMessageMap((prev) => { const next = new Map(prev); const m = next.get(messageId); if (m) next.set(messageId, { ...m, deleted_at: new Date().toISOString(), body: null }); return next; });
        } else {
            setMessageMap((prev) => { const next = new Map(prev); next.delete(messageId); return next; });
        }
        await import("../../utils/chatApi.js").then((m) => m.deleteChatMessage(token, conversationId, messageId, scope));
    }, [conversationId, token]);

    useEffect(() => {
        let cancelled = false;
        fetchConversations(token).then((res) => {
            if (cancelled || !res?.success) return;
            setMeta(res.conversations.find((c) => c.id === conversationId) || null);
        });
        return () => { cancelled = true; };
    }, [conversationId, token]);

    const { messages, loading, loadingOlder, hasMore, loadOlder, send, sending, otherTyping, notifyTyping } =
        useChatMessages(conversationId, meta?.otherUserId);

    const prevLenRef = useRef(0);
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
        <div className="flex h-full flex-col">
            <ConnectionBanner />
            <div className="flex items-center gap-2.5 border-b px-3.5 py-2.5" style={{ borderColor: C.hair }}>
                <button onClick={onBack} className="rounded-full p-1.5 sm:hidden">
                    <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}>
                    {initials(meta?.title)}
                </span>
                <div className="flex flex-col">
                    <p className="truncate text-[14px] font-extrabold tracking-wide" style={{ color: C.ink }}>
                        {meta?.title || "…"}
                    </p>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide"
                        style={{ color: otherPresence?.online ? C.secondary : C.muted }}>
                        {otherPresence?.online ? "Online" : formatLastSeen(otherPresence?.lastSeenAt)}
                    </p>
                </div>
            </div>

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                {loadingOlder && (
                    <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.muted }} /></div>
                )}
                {loading ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: C.muted }} /></div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((m) => {
                            const day = dayLabel(m.created_at);
                            const showDay = day !== lastDay;
                            lastDay = day;
                            return (
                                <div key={m.id}>
                                    {showDay && (
                                        <div className="my-3 flex items-center justify-center">
                                            <span className="rounded-full px-3 py-1 text-[10.5px] font-bold tracking-wide" style={{ background: "rgba(11,17,22,0.05)", color: C.muted }}>
                                                {day}
                                            </span>
                                        </div>
                                    )}
                                    <MessageBubble message={m} isMine={m.sender_id === profile?.id} onDelete={deleteMessage} />
                                </div>
                            );
                        })}
                    </AnimatePresence>
                )}
                <div ref={bottomRef} />
            </div>

            <ChatComposer onSend={send} sending={sending} onTypingChange={notifyTyping} />

            {otherTyping && (
                <div className="px-4 pb-1 text-[11.5px] font-semibold" style={{ color: C.secondary }}>
                    {meta?.title} is typing…
                </div>
            )}
        </div>
    );
}