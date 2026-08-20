// components/chat/ConversationList.jsx
//
// List + "start a new chat" modal combined into one file — they only ever
// get touched together, and NewChatModal is small enough that a separate
// file was just one more click to trace through.
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, MessageSquare, X, Loader2, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { searchChatUsers, getOrCreateDirectConversation } from "../../utils/chatApi.js";

const C = { ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83", hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)" };
const EASE = [0.16, 1, 0.3, 1];

function timeLabel(iso) {
    if (!iso) return "";
    const d = new Date(iso), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function initials(name) {
    return (name || "?").trim().split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// ---- new chat modal -----------------------------------------------------

function NewChatModal({ onClose, onCreated }) {
    const { token } = useAuth();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [starting, setStarting] = useState(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setResults([]); return; }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const res = await searchChatUsers(token, query.trim());
            if (res?.success) setResults(res.users);
            setLoading(false);
        }, 250);
        return () => clearTimeout(debounceRef.current);
    }, [query, token]);

    const start = async (user) => {
        setStarting(user.id);
        const res = await getOrCreateDirectConversation(token, user.id);
        setStarting(null);
        if (res?.success) onCreated(res.conversationId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.16, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.hair }}>
                    <p className="text-[14px] font-extrabold tracking-wide" style={{ color: C.ink }}>New message</p>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5"><X className="h-4 w-4" style={{ color: C.muted }} /></button>
                </div>
                <div className="px-4 pt-3">
                    <div className="flex items-center gap-2 rounded-full border px-3 py-2 transition-colors focus-within:border-[#006F83]" style={{ borderColor: C.hair }}>
                        <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name"
                            className="w-full bg-transparent text-[13px] font-medium outline-none" style={{ color: C.ink }} />
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto px-2 py-2">
                    {loading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" style={{ color: C.muted }} /></div>}
                    {!loading && results.map((u) => (
                        <button key={u.id} onClick={() => start(u)} disabled={starting === u.id}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/[0.03]">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                                style={{ background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}>
                                {initials(u.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-bold" style={{ color: C.ink }}>{u.name}</span>
                                {u.shopName && (
                                    <span className="block truncate text-[10.5px] font-bold" style={{ color: C.primary }}>
                                        🏪 {u.shopName}
                                    </span>
                                )}
                            </span>
                            {starting === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.secondary }} />}
                        </button>
                    ))}
                    {!loading && query.trim().length >= 2 && results.length === 0 && (
                        <p className="px-2.5 py-6 text-center text-[12px] font-medium" style={{ color: C.muted }}>No users found.</p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ---- row skeleton ---------------------------------------------------------

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="h-2.5 w-3/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            </div>
        </div>
    );
}

// ---- main -----------------------------------------------------------------

export default function ConversationList({ conversations, loading, activeId, onSelect, reload }) {
    const [query, setQuery] = useState("");
    const [newChatOpen, setNewChatOpen] = useState(false);

    const filtered = conversations.filter((c) => c.title?.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="flex h-full flex-col" style={{ background: "#fff" }}>
            <div className="flex items-center justify-between px-3.5 pb-2 pt-3.5">
                <h1 className="text-[16.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>Messages</h1>
                <button
                    onClick={() => setNewChatOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition hover:scale-105"
                    style={{ background: C.secondary }}
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            <div className="px-3.5 pb-2.5">
                <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors focus-within:border-[#006F83]" style={{ borderColor: C.hair }}>
                    <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />
                    <input
                        value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search conversations"
                        className="w-full bg-transparent text-[13px] font-medium outline-none placeholder:text-slate-400"
                        style={{ color: C.ink }}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
                        <MessageSquare className="h-6 w-6" style={{ color: C.hair }} />
                        <p className="text-[13px] font-bold" style={{ color: C.ink }}>No conversations yet</p>
                        <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Start one with the + button.</p>
                    </div>
                ) : (
                    filtered.map((c, i) => {
                        const active = c.id === activeId;
                        return (
                            <motion.button
                                key={c.id}
                                onClick={() => onSelect(c.id)}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.12), ease: EASE }}
                                className="flex w-full items-center gap-3 border-b px-3.5 py-3 text-left transition-colors duration-150"
                                style={{ borderColor: C.hairSoft, background: active ? `${C.secondary}0f` : "transparent" }}
                            >
                                <span
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white shadow-sm"
                                    style={{ background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}
                                >
                                    {initials(c.title)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-[13.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{c.title}</p>
                                        <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: c.unread ? C.secondary : C.muted }}>
                                            {timeLabel(c.lastMessageAt)}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 flex items-center justify-between gap-2">
                                        <p className="truncate text-[12px] font-medium" style={{ color: c.unread ? C.ink : C.muted }}>
                                            {c.lastMessageIsMine && "You: "}{c.lastMessagePreview || "Say hello 👋"}
                                        </p>
                                        {c.unread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.primary }} />}
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })
                )}
            </div>

            {newChatOpen && <NewChatModal onClose={() => setNewChatOpen(false)} onCreated={(id) => { setNewChatOpen(false); reload(); onSelect(id); }} />}
        </div>
    );
}