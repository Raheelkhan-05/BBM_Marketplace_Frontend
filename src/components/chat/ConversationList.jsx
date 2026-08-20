// components/chat/ConversationList.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, MessageSquare } from "lucide-react";
import useConversations from "../../hooks/useConversations.js";
import NewChatModal from "./NewChatModal.jsx";

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

export default function ConversationList({ activeId, onSelect }) {
    const { conversations, loading, reload } = useConversations();
    const [query, setQuery] = useState("");
    const [newChatOpen, setNewChatOpen] = useState(false);

    const filtered = conversations.filter((c) => c.title?.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-3.5 pb-2 pt-3.5">
                <h1 className="text-[16px] font-extrabold tracking-wide" style={{ color: C.ink }}>Messages</h1>
                <button
                    onClick={() => setNewChatOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:scale-105"
                    style={{ background: C.secondary }}
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            <div className="px-3.5 pb-2.5">
                <div className="flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: C.hair }}>
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
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3.5 py-3">
                            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-2/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                <div className="h-2.5 w-3/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                            </div>
                        </div>
                    ))
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
                                style={{ borderColor: C.hairSoft, background: active ? `${C.secondary}0c` : "transparent" }}
                            >
                                <span
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
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