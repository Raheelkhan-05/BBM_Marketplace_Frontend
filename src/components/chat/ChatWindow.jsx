// components/chat/ChatWindow.jsx
//
// The whole message-thread experience — header, banner, bubbles,
// composer — lives in this one file.
//
// THIS PASS FIXES THE "MESSAGES JUMP" COMPLAINT AT THE ROOT:
//
// 1. Every message row was keyed on `m.id`. An optimistic send is stored
//    under a temp id (`temp-<clientMessageId>`) and then, the instant the
//    server responds, swapped for the real id — so the bubble's React key
//    changed mid-conversation. React read that as "delete this node, mount
//    a brand new one," which is exactly the visible jump on every send.
//    Fixed by keying on `client_message_id` (stable across optimistic →
//    confirmed) with `id` only as a fallback for messages that never had one.
//
// 2. `messages` was rebuilt as all-new objects on every read/delivered
//    watermark tick (see useChat.js), which defeated MessageBubble's
//    memo() and re-rendered — and re-laid-out — the entire thread on every
//    tick. Fixed on the hook side; this file just benefits from it.
//
// 3. Auto-scroll fired on *any* change to `messages.length`, so scrolling
//    up to load older history yanked the view straight back down, and a
//    new incoming message would forcibly scroll you to the bottom even if
//    you were reading back through history. Replaced with: scroll-position
//    anchoring when older history is prepended, and "only auto-scroll on a
//    genuinely new last message, and only if you were already near the
//    bottom (or it's your own message)" — otherwise a quiet "N new
//    messages" pill offers to jump down, same as any mature chat product.
//
// 4. CreditBar / TransportBar (and the composer's growing textarea) sit
//    ABOVE the scrollable message list as flex siblings. When one of them
//    mounts late (after its own async fetch resolves) or unmounts, the
//    scroll container's clientHeight changes on its own, with no change
//    to `messages` at all — so none of the scroll-anchoring logic above
//    ever saw it happen. scrollTop stayed fixed while clientHeight
//    shrank/grew, and the thread visibly slid to make room. Fixed with a
//    ResizeObserver on the scroll container itself: if the user was
//    pinned to the bottom, any resize re-pins them, regardless of why the
//    container resized.
//
// 5. Lenis (or any similar smooth-scroll library attached at the
//    window/body level) was intercepting wheel/touch events before they
//    reached this thread's own `overflow-y-auto` div, hijacking scroll
//    for the whole page instead of letting the message list scroll
//    natively. Fixed by stopping wheel/touch propagation at the scroll
//    container so Lenis's window-level listener never sees the event,
//    plus a `data-lenis-prevent` attribute for setups that check for it.
//
// 6. UX PASS (this version):
//    - Transport mode selector uses icons + explicit choice (no silent
//      default) via the shared TRANSPORT_MODES / modeMeta table, used
//      identically by TransportBar and the transport_proposal bubble so
//      the two can never show mismatched labels for the same mode again.
//    - Every async decision button (credit approve/decline, credit
//      on/off toggle, transport agree/suggest-different) now shows its
//      own inline spinner and disables its sibling while in flight,
//      instead of giving zero feedback on a slow network.
//    - "Suggest different" on a transport proposal now declines AND
//      immediately reopens the propose sheet, instead of leaving the
//      person to hunt for the truck icon again.
//    - A transport proposal you sent that got declined shows an inline
//      "Propose again" action right on the bubble.
import { useEffect, useLayoutEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowDown, CreditCard, Truck, Loader2, Pencil, Check, CheckCheck, Clock3, AlertCircle, MoreVertical, Ban, Send, MessageCircle, Bus, TrainFront, Package, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import useChatMessages, { usePresence, useCredit, useTransportPreference } from "../../hooks/useChat.js";

import { formatLastSeen } from "../../utils/formatLastSeen.js";

// Single token system for the whole module — every color used anywhere
// below comes from here, so a status (warn/ok/danger) always looks the
// same regardless of which bar or bubble is showing it.
const C = {
    ink: "#0B1116", muted: "#667077",
    primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)",
    ok: "#059669", okBg: "#EAF7F2",
    warn: "#a16207", warnBg: "#FDF3D8",
    danger: "#C71F11", dangerBg: "rgba(199,31,17,0.07)", dangerSoft: "#B23A28",
    surface: "#fff", canvas: "#F7F6F3",
};
const EASE = [0.16, 1, 0.3, 1];
const GROUP_GAP_MS = 3 * 60 * 1000; // same-sender messages within this window render as one visual group
const NEAR_BOTTOM_PX = 140;

const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function initials(name) {
    return (name || "?").trim().split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// shared source of truth for mode display — used by TransportBar AND
// the transport_proposal bubble, so they can never show different
// labels/icons for the same mode again.
const TRANSPORT_MODES = {
    bus: { label: "Bus", Icon: Bus },
    train: { label: "Train", Icon: TrainFront },
    other: { label: "Other", Icon: Package },
};
function modeMeta(mode) {
    return TRANSPORT_MODES[mode] || TRANSPORT_MODES.other;
}

function dayLabel(iso) {
    const d = new Date(iso), now = new Date();
    const diffDays = Math.round((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

// stable identity for a message row regardless of optimistic → confirmed swap
function rowKey(m) {
    return m.client_message_id || m.id;
}

// ---- header -----------------------------------------------------------

function TypingDots({ color = C.secondary, size = "h-1.5 w-1.5" }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className={`inline-block rounded-full ${size}`}
                    style={{ background: color }}
                    animate={prefersReducedMotion ? {} : { y: [0, -3, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
            ))}
        </span>
    );
}

function StatusStrip({
    credit, viewerRole, otherName,
    onRequestCredit, onToggleCredit, onDecideCredit, requestingCredit,
    transportPref, onOpenTransportSheet,
}) {
    const [decidingCredit, setDecidingCredit] = useState(null); // 'approved' | 'rejected' | null
    const [togglingCredit, setTogglingCredit] = useState(false);

    const handleDecideCredit = async (id, decision) => {
        setDecidingCredit(decision);
        await onDecideCredit(id, decision);
        setDecidingCredit(null);
    };
    const handleToggleCredit = async (enabled) => {
        setTogglingCredit(true);
        await onToggleCredit(enabled);
        setTogglingCredit(false);
    };

    // ---- credit chip ----
    let creditCell = null;
    if (viewerRole === "buyer") {
        const cooldownActive = credit?.status === "rejected" && credit.cooldown_until && new Date(credit.cooldown_until) > new Date();
        if (!credit || credit.status === "revoked" || (credit.status === "rejected" && !cooldownActive)) {
            creditCell = (
                <button onClick={onRequestCredit} disabled={requestingCredit}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-60"
                    style={{ background: `${C.secondary}10`, color: C.secondary }}>
                    {requestingCredit ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                    {requestingCredit ? "Requesting…" : "Buy on credit"}
                </button>
            );
        } else if (credit.status === "pending") {
            creditCell = (
                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.warnBg, color: C.warn }} title={`Waiting for ${otherName}'s approval`}>
                    <Clock3 className="h-3 w-3" /> Credit pending
                </span>
            );
        } else if (credit.status === "approved") {
            creditCell = (
                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.okBg, color: C.ok }} title={`Approved by ${otherName} — you can buy on credit`}>
                    <Check className="h-3 w-3" /> Credit approved
                </span>
            );
        } else if (cooldownActive) {
            const retryDate = new Date(credit.cooldown_until);
            creditCell = (
                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: C.hairSoft, color: C.muted }}
                    title={`Declined — you can request again after ${retryDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}>
                    Credit declined · retry {retryDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
            );
        }
    } else if (viewerRole === "seller" && credit?.status === "pending") {
        creditCell = (
            <div className="flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1" style={{ background: C.warnBg }} title={`${otherName} requested to buy on credit`}>
                <CreditCard className="h-3 w-3 shrink-0" style={{ color: C.warn }} />
                <span className="text-[11px] font-bold" style={{ color: C.warn }}>Credit request</span>
                <button onClick={() => handleDecideCredit(credit.id, "approved")} disabled={!!decidingCredit}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60" style={{ background: C.ok }}>
                    {decidingCredit === "approved" && <Loader2 className="h-2.5 w-2.5 animate-spin" />} Approve
                </button>
                <button onClick={() => handleDecideCredit(credit.id, "rejected")} disabled={!!decidingCredit}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition-colors hover:bg-black/[0.03] disabled:opacity-60" style={{ borderColor: C.hair, color: C.muted, background: "#fff" }}>
                    {decidingCredit === "rejected" && <Loader2 className="h-2.5 w-2.5 animate-spin" />} Decline
                </button>
            </div>
        );
    } else if (viewerRole === "seller" && credit && (credit.status === "approved" || credit.status === "revoked")) {
        const on = credit.status === "approved";
        creditCell = (
            <button onClick={() => handleToggleCredit(!on)} disabled={togglingCredit}
                className="flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-bold transition-colors disabled:opacity-60"
                style={{ background: on ? C.okBg : C.hairSoft, color: on ? C.ok : C.muted }}
                title={on ? `Credit enabled for ${otherName}` : `Credit off for ${otherName}`}>
                <CreditCard className="h-3 w-3" /> Credit: {on ? "On" : "Off"}
                {togglingCredit ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <span className="relative ml-0.5 h-4 w-7 rounded-full transition-colors" style={{ background: on ? C.ok : "#CBD2D6" }}>
                        <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all" style={{ left: on ? "14px" : "2px" }} />
                    </span>
                )}
            </button>
        );
    }

    // ---- transport chip ----
    let transportCell = null;
    if (transportPref?.status === "confirmed") {
        const { label, Icon } = modeMeta(transportPref.mode);
        transportCell = (
            <button onClick={onOpenTransportSheet}
                className="flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-bold transition-colors hover:opacity-80"
                style={{ background: C.hairSoft, color: C.ink }}
                title="Tap to change transport preference">
                <Icon className="h-3 w-3 shrink-0" style={{ color: C.secondary }} />
                <span className="max-w-[140px] truncate">{label}{transportPref.transport_company ? ` · ${transportPref.transport_company}` : ""}</span>
                <Pencil className="h-2.5 w-2.5 shrink-0" style={{ color: C.muted }} />
            </button>
        );
    }

    if (!creditCell && !transportCell) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5" style={{ borderColor: C.hair, background: C.surface }}>
            {creditCell}
            {transportCell}
        </div>
    );
}

function ChatHeader({ meta, otherPresence, otherTyping, onBack }) {
    return (
        <div className="flex items-center gap-3 border-b px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.surface }}>
            <button onClick={onBack} className="rounded-full p-1.5 transition-colors hover:bg-black/5 sm:hidden">
                <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
            </button>
            <div className="relative shrink-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-[12.5px] font-extrabold text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}>
                    {meta ? initials(meta.otherShopName) : ""}
                </span>
                {otherPresence?.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2" style={{ background: "#1FAE5C", borderColor: C.surface }} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {meta ? (
                    <>
                        <p className="truncate text-[14.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{meta.otherShopName}</p>
                        <AnimatePresence mode="wait" initial={false}>
                            {otherTyping ? (
                                <motion.p
                                    key="typing"
                                    initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.12 }}
                                    className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide"
                                    style={{ color: C.secondary }}
                                >
                                    typing <TypingDots size="h-1 w-1" />
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

function TypingBubble() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15, ease: EASE }}
            className="mb-3 flex justify-start"
        >
            <div className="flex items-center rounded-2xl px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.hair}`, borderBottomLeftRadius: 4, boxShadow: "0 1px 2px rgba(11,17,22,0.04)" }}>
                <TypingDots size="h-1.5 w-1.5" />
            </div>
        </motion.div>
    );
}

function TransportProposeSheet({ open, onClose, current, onSubmit }) {
    const [mode, setMode] = useState(current?.mode || null);
    const [company, setCompany] = useState(current?.transport_company || "");
    const [details, setDetails] = useState(current?.details || "");
    const [submitting, setSubmitting] = useState(false);

    // re-seed from `current` each time the sheet is (re)opened, so
    // re-opening after a decline/change starts from the latest state
    // instead of stale values from the previous open.
    useEffect(() => {
        if (open) {
            setMode(current?.mode || null);
            setCompany(current?.transport_company || "");
            setDetails(current?.details || "");
        }
    }, [open, current]);

    const handleSubmit = async () => {
        if (!mode || submitting) return;
        setSubmitting(true);
        await onSubmit(mode, company.trim() || null, details.trim() || null);
        setSubmitting(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[999] flex items-end justify-center bg-black/30 sm:items-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="w-full rounded-t-2xl bg-white p-4 sm:max-w-sm sm:rounded-2xl"
                        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] font-extrabold" style={{ color: C.ink }}>Propose transport</p>
                            <button onClick={onClose} className="rounded-full p-1 transition-colors hover:bg-black/5">
                                <X className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                        </div>
                        <p className="mt-1 text-[11.5px] font-medium" style={{ color: C.muted }}>
                            They'll see this as a card in the chat and can agree or suggest a different one.
                        </p>

                        {current?.status === "pending" && (
                            <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: C.warnBg, color: C.warn }}>
                                There's already a pending proposal — sending a new one replaces it.
                            </p>
                        )}

                        <div className="mt-3.5 grid grid-cols-3 gap-2">
                            {Object.entries(TRANSPORT_MODES).map(([key, { label, Icon }]) => (
                                <button key={key} onClick={() => setMode(key)}
                                    className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors"
                                    style={{ borderColor: mode === key ? C.secondary : C.hair, background: mode === key ? `${C.secondary}0f` : "#fff" }}>
                                    <Icon className="h-4.5 w-4.5" style={{ color: mode === key ? C.secondary : C.muted }} />
                                    <span className="text-[11.5px] font-bold" style={{ color: mode === key ? C.secondary : C.ink }}>{label}</span>
                                </button>
                            ))}
                        </div>

                        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Transport company (optional) — e.g. Patel Transport"
                            className="mt-3 w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-colors focus:border-[#006F83]" style={{ borderColor: C.hair }} />
                        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Notes (optional) — pickup point, timing, etc." rows={2}
                            className="mt-2 w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none transition-colors focus:border-[#006F83]" style={{ borderColor: C.hair }} />

                        <button onClick={handleSubmit} disabled={!mode || submitting}
                            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                            style={{ background: C.secondary }}>
                            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {submitting ? "Sending…" : "Send proposal"}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ---- message bubble -----------------------------------------------------

function TickIcon({ status, onRetry }) {
    if (status === "sending") return <Clock3 className="h-3 w-3" style={{ color: "rgba(255,255,255,0.7)" }} />;
    if (status === "failed") return (
        <button onClick={onRetry} className="flex items-center gap-0.5 text-[10px] font-bold underline decoration-dotted underline-offset-2" style={{ color: "#ffd6d1" }} title="Tap to retry">
            <AlertCircle className="h-3 w-3" /> Retry
        </button>
    );
    if (status === "read") return <CheckCheck className="h-3.5 w-3.5" style={{ color: "#6FD3FF" }} />;
    if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />;
    return <Check className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />;
}

const MessageBubble = memo(function MessageBubble({ message, isMine, groupPos, onDelete, onRetry, credit, transportPref, onTransportDecision, onOpenTransportSheet }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [decidingAction, setDecidingAction] = useState(null); // 'confirmed' | 'declined' | null
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
            pending: { color: C.warn, bg: C.warnBg, label: "Pending" },
            approved: { color: C.ok, bg: C.okBg, label: "Approved" },
            rejected: { color: C.danger, bg: C.dangerBg, label: "Declined" },
            revoked: { color: C.muted, bg: C.hairSoft, label: "Turned off" },
        }[status] || { color: C.muted, bg: C.hairSoft, label: "Sent" };

        return (
            <div className="mb-3 flex justify-center">
                <div className="flex w-full max-w-[260px] items-center gap-2.5 rounded-2xl border px-3.5 py-3" style={{ borderColor: C.hair, background: C.surface }}>
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

    if (message.message_type === "transport_proposal") {
        const p = message.metadata;
        const isCurrent = transportPref?.id === p.prefId;
        const status = isCurrent ? transportPref.status : null;
        const { label, Icon } = modeMeta(p.mode);
        const statusStyle = {
            pending: { color: C.warn, bg: C.warnBg, label: "Proposed" },
            confirmed: { color: C.ok, bg: C.okBg, label: "Agreed" },
            declined: { color: C.muted, bg: C.hairSoft, label: "Declined" },
        }[status] || { color: C.muted, bg: C.hairSoft, label: "Sent" };

        const handleDecision = async (decision) => {
            setDecidingAction(decision);
            await onTransportDecision(p.prefId, decision);
            setDecidingAction(null);
            if (decision === "declined") onOpenTransportSheet?.();
        };

        return (
            <div className="mb-3 flex justify-center">
                <div className="flex w-full max-w-[280px] flex-col gap-2 rounded-2xl border px-3.5 py-3" style={{ borderColor: C.hair, background: C.surface }}>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: C.secondary }} />
                        <p className="text-[12.5px] font-bold" style={{ color: C.ink }}>Transport preference</p>
                    </div>
                    <p className="text-[13px] font-semibold" style={{ color: C.ink }}>
                        {label}{p.transportCompany ? ` · ${p.transportCompany}` : ""}
                    </p>
                    {p.details && <p className="text-[11.5px]" style={{ color: C.muted }}>{p.details}</p>}
                    <span className="w-fit rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>

                    {isCurrent && status === "pending" && !isMine && (
                        <div className="flex gap-1.5">
                            <button onClick={() => handleDecision("confirmed")} disabled={!!decidingAction}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60" style={{ background: C.ok }}>
                                {decidingAction === "confirmed" && <Loader2 className="h-3 w-3 animate-spin" />}
                                Agree
                            </button>
                            <button onClick={() => handleDecision("declined")} disabled={!!decidingAction}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-black/[0.03] disabled:opacity-60" style={{ borderColor: C.hair, color: C.muted }}>
                                {decidingAction === "declined" && <Loader2 className="h-3 w-3 animate-spin" />}
                                Suggest different
                            </button>
                        </div>
                    )}

                    {isCurrent && status === "declined" && isMine && (
                        <button onClick={() => onOpenTransportSheet?.()}
                            className="rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-black/[0.03]" style={{ borderColor: C.secondary, color: C.secondary }}>
                            Propose again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const time = new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const isDeleted = !!message.deleted_at;
    const isFailed = message.status === "failed";
    const isOuterEdge = groupPos === "last" || groupPos === "only";

    // WhatsApp-style corner rounding: only the outer edge of a grouped
    // run gets the "tail" corner, interior bubbles round evenly on both
    // sides so a run of consecutive messages reads as one visual block.
    const tailRadius = isMine
        ? { borderBottomRightRadius: isOuterEdge ? 4 : 16 }
        : { borderBottomLeftRadius: isOuterEdge ? 4 : 16 };

    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={`group relative flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"} ${isOuterEdge ? "mb-3" : "mb-0.5"}`}
        >
            {isMine && !isDeleted && (
                <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
                    <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full p-1 hover:bg-black/5">
                        <MoreVertical className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={{ duration: 0.12 }}
                                className="absolute right-0 top-6 z-10 w-40 overflow-hidden rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: C.hair }}
                            >
                                <button onClick={() => { setMenuOpen(false); onDelete(message.id, "me"); }} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-black/5" style={{ color: C.ink }}>
                                    Delete for me
                                </button>
                                <button onClick={() => { setMenuOpen(false); onDelete(message.id, "everyone"); }} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-rose-50" style={{ color: C.danger }}>
                                    Delete for everyone
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug tracking-wide sm:max-w-[65%] ${isDeleted ? "italic" : ""}`}
                style={{
                    ...(isDeleted
                        ? { background: "rgba(11,17,22,0.04)", color: C.muted, border: `1px dashed ${C.hair}` }
                        : isMine
                            ? { background: isFailed ? C.dangerSoft : "linear-gradient(135deg, #006F83 0%, #0B8A93 100%)", color: "#fff", boxShadow: "0 1px 2px rgba(11,17,22,0.08)" }
                            : { background: C.surface, color: C.ink, border: `1px solid ${C.hair}`, boxShadow: "0 1px 2px rgba(11,17,22,0.04)" }),
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
}, (prev, next) => (
    // explicit compare (belt-and-braces alongside the stable-reference fix
    // in useChat.js): a bubble only needs to re-render when ITS OWN fields
    // change, or when a credit/transport reference message needs to react
    // to a status update that isn't reflected in `message` itself.
    prev.message === next.message &&
    prev.isMine === next.isMine &&
    prev.groupPos === next.groupPos &&
    prev.credit === next.credit &&
    prev.transportPref === next.transportPref &&
    prev.onOpenTransportSheet === next.onOpenTransportSheet
));

// ---- composer -----------------------------------------------------------

function ChatComposer({ onSend, sending, onTypingChange, onOpenTransport }) {
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
        <div className="flex items-end gap-2 border-t px-3 py-2.5 sm:px-4" style={{ borderColor: C.hair, background: C.surface }}>
            <button onClick={onOpenTransport} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5" title="Propose transport">
                <Truck className="h-4 w-4" style={{ color: C.muted }} />
            </button>
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
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
    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    const presence = usePresence(meta?.otherUserId ? [meta.otherUserId] : []);
    const otherPresence = meta?.otherUserId ? presence[meta.otherUserId] : null;

    const { pref: transportPref, propose: proposeTransport, decide: decideTransport } = useTransportPreference(meta?.otherUserId, conversationId);
    const [transportSheetOpen, setTransportSheetOpen] = useState(false);
    const openTransportSheet = useCallback(() => setTransportSheetOpen(true), []);

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

    // ---- scroll behavior ---------------------------------------------
    // Every programmatic scroll below is an INSTANT jump (no `behavior:
    // "smooth"` anywhere) — opening a chat, sending a message, and
    // receiving a message should all land you at the bottom immediately,
    // with no animated scrolling motion.
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [newIncoming, setNewIncoming] = useState(0);

    // `null` on purpose (NOT `conversationId`) — this is what makes the
    // very first conversation opened in this mounted ChatWindow instance
    // register as "a conversation just opened" too. Initializing it to
    // the current conversationId meant the first-ever open never counted
    // as a change, so the initial snap-to-bottom silently never ran and
    // the thread was left sitting at the top, looking stuck.
    const scrollStateRef = useRef({ convId: null, placedAtBottom: false });
    const lastMessageIdRef = useRef(null);
    const isPrependingRef = useRef(false);
    const prevScrollHeightRef = useRef(0);

    const jumpToBottom = useCallback((smooth = false) => {
        bottomRef.current?.scrollIntoView(smooth && !prefersReducedMotion ? { behavior: "smooth", block: "end" } : { block: "end" });
    }, []);

    // conversation changed (including the first one ever opened) — reset
    // all scroll bookkeeping so the effect below treats it as unplaced.
    useEffect(() => {
        if (scrollStateRef.current.convId !== conversationId) {
            scrollStateRef.current = { convId: conversationId, placedAtBottom: false };
            lastMessageIdRef.current = null;
            setIsNearBottom(true);
            setNewIncoming(0);
        }
    }, [conversationId]);

    // Once messages for the CURRENT conversation have actually loaded,
    // snap straight to the latest message — this is the ONLY place that
    // handles "opening a chat", and it runs regardless of whether this is
    // the first conversation opened or a switch from another one.
    useLayoutEffect(() => {
        if (loading) return;
        if (scrollStateRef.current.convId !== conversationId) return;
        if (scrollStateRef.current.placedAtBottom) return;
        scrollStateRef.current.placedAtBottom = true;
        const last = messages[messages.length - 1];
        lastMessageIdRef.current = last ? rowKey(last) : null;
        jumpToBottom(false);
    }, [loading, messages, conversationId, jumpToBottom]);

    // preserves scroll position when older history is prepended — without
    // this, the browser keeps the scrollTOP fixed while content grows
    // above it, which reads as the whole thread "jumping" down.
    const handleLoadOlder = useCallback(() => {
        if (!scrollRef.current || loadingOlder || !hasMore) return;
        isPrependingRef.current = true;
        prevScrollHeightRef.current = scrollRef.current.scrollHeight;
        loadOlder();
    }, [loadOlder, loadingOlder, hasMore]);

    useLayoutEffect(() => {
        if (isPrependingRef.current && scrollRef.current) {
            const el = scrollRef.current;
            el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
            isPrependingRef.current = false;
        }
    }, [messages]);

    // handles messages arriving AFTER the thread has already been placed
    // at the bottom once (new sends/receives while the chat is open) —
    // the initial "opening a chat" placement above is handled separately,
    // so this only ever fires for genuinely new activity.
    //
    // This MUST be useLayoutEffect, not useEffect. A new message mounting
    // extends the container's scrollHeight immediately on commit, but
    // plain useEffect only runs AFTER the browser paints. That gap meant
    // every send/receive painted one real frame with the new bubble
    // sitting at its unscrolled position (often half-clipped at the
    // bottom edge) before this effect fired and snapped scrollTop down —
    // which is exactly the "jumps for a second, then settles" flash being
    // reported. useLayoutEffect runs synchronously after the DOM mutation
    // but before paint, so the scroll correction is applied before the
    // browser ever shows the unscrolled frame.
    useLayoutEffect(() => {
        if (!scrollStateRef.current.placedAtBottom) return;
        const last = messages[messages.length - 1];
        if (!last) return;
        const key = rowKey(last);
        if (key === lastMessageIdRef.current) return; // prepend or status tick, not a new message
        lastMessageIdRef.current = key;

        const mine = last.sender_id === profile?.id;
        if (mine || isNearBottom) {
            jumpToBottom(false);
            setNewIncoming(0);
        } else {
            setNewIncoming((n) => n + 1);
        }
    }, [messages, isNearBottom, profile?.id, jumpToBottom]);

    // same reasoning as above — the typing bubble also grows content
    // height, so this needs to resolve before paint too.
    useLayoutEffect(() => {
        if (otherTyping && isNearBottom) jumpToBottom(false);
    }, [otherTyping, isNearBottom, jumpToBottom]);

    // keep a ref mirror of `isNearBottom` so the ResizeObserver callback
    // below (which fires outside React's render cycle) always reads the
    // latest "was the user pinned to the bottom" value without needing to
    // be re-subscribed on every change.
    const pinnedRef = useRef(true);
    useEffect(() => { pinnedRef.current = isNearBottom; }, [isNearBottom]);

    // re-pin to the bottom whenever the scroll container's own box size
    // changes for reasons that have nothing to do with new messages:
    // CreditBar / TransportBar mounting once their async fetch resolves
    // (or unmounting when a credit is revoked / transport is cleared), or
    // the composer's textarea growing/shrinking. None of these change
    // `messages`, so the effects above never fire for them — scrollTop
    // stays fixed while clientHeight shifts under it, which is exactly
    // what reads as "the thread slid to make room". This only re-pins if
    // the user was already at the bottom; if they'd scrolled up to read
    // history, a layout shift elsewhere won't yank them down.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            if (pinnedRef.current) jumpToBottom(false);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [jumpToBottom]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distanceFromBottom < NEAR_BOTTOM_PX;
        setIsNearBottom(nearBottom);
        if (nearBottom) setNewIncoming(0);
        if (el.scrollTop < 80 && hasMore && !loadingOlder) handleLoadOlder();
    };

    const handleJumpToBottomClick = () => {
        jumpToBottom(false);
        setNewIncoming(0);
    };

    // Lenis (or any similar window/body-level smooth-scroll library)
    // attaches its own wheel/touch listeners further up the DOM tree and
    // calls preventDefault() there to drive its virtual scroll. Because
    // those events bubble up from this div, Lenis was seeing them before
    // this container's native scroll ever got a chance to run,
    // effectively hijacking scroll for the whole page instead of letting
    // the thread scroll on its own. Stopping propagation here (NOT
    // preventDefault — we still want the browser's native scroll on this
    // element) cuts Lenis off from ever seeing the event for this
    // container, without touching how Lenis behaves anywhere else on the
    // page. `data-lenis-prevent` is added too, for setups that configure
    // Lenis with `prevent: (node) => node.closest('[data-lenis-prevent]')`
    // — but the stopPropagation handlers are what guarantee the fix
    // regardless of how (or whether) Lenis was configured for that.
    const stopScrollPropagation = useCallback((e) => { e.stopPropagation(); }, []);

    let lastDay = null;

    return (
        <div className="flex h-full flex-col" style={{ background: C.canvas }}>
            {!connected && (
                <div className="px-4 py-1.5 text-center text-[11px] font-bold text-white" style={{ background: C.danger }}>
                    Reconnecting…
                </div>
            )}

            <ChatHeader meta={meta} otherPresence={otherPresence} otherTyping={otherTyping} onBack={onBack} />
            <StatusStrip
                credit={credit} viewerRole={viewerRole} otherName={meta?.otherShopName || meta?.title || "them"}
                onRequestCredit={handleRequestCredit} onToggleCredit={toggle} onDecideCredit={decide} requestingCredit={requestingCredit}
                transportPref={transportPref} onOpenTransportSheet={openTransportSheet}
            />

            <div className="relative min-h-0 flex-1">
                <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    data-lenis-prevent
                    onWheel={stopScrollPropagation}
                    onTouchStart={stopScrollPropagation}
                    onTouchMove={stopScrollPropagation}
                    className="h-full overflow-y-auto px-3 py-3 sm:px-4"
                >
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
                            <p className="max-w-[220px] text-[11.5px] font-medium" style={{ color: C.muted }}>Your messages with {meta?.otherShopName || meta?.title || "them"} start here.</p>
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
                                    <div key={rowKey(m)}>
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
                                            transportPref={transportPref}
                                            onTransportDecision={decideTransport}
                                            onOpenTransportSheet={openTransportSheet}
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

                <AnimatePresence>
                    {newIncoming > 0 && (
                        <motion.button
                            initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15, ease: EASE }}
                            onClick={handleJumpToBottomClick}
                            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold text-white shadow-lg"
                            style={{ background: C.secondary }}
                        >
                            {newIncoming} new message{newIncoming > 1 ? "s" : ""} <ArrowDown className="h-3.5 w-3.5" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            <ChatComposer
                onSend={send}
                sending={sending}
                onTypingChange={notifyTyping}
                onOpenTransport={openTransportSheet}
            />
            <TransportProposeSheet
                open={transportSheetOpen}
                onClose={() => setTransportSheetOpen(false)}
                current={transportPref}
                onSubmit={(mode, company, details) => proposeTransport(mode, company, details)}
            />
        </div>
    );
}