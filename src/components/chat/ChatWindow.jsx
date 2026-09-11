// components/chat/ChatWindow.jsx
//
// The whole message-thread experience — header, banner, bubbles,
// composer — lives in this one file.
//
// (See prior revisions' comments for the scroll-jump fixes, key-stability
// fix, and transport_proposal ReferenceError fix — all unchanged below.)
//
// THIS PASS ADDS: deleted-seller lockout.
//   - `meta.otherIsDeletedSeller` (from the conversations list) OR the
//     `canSend: false` flag returned by GET messages (source of truth,
//     since it's re-checked server-side on every load) disables the
//     composer and shows a clear inline notice, instead of letting the
//     buyer type and only discovering the block on submit.
//   - The header still shows the seller's real shop name — it does NOT
//     fall back to "Unknown seller" — with a small "Deleted" tag next to
//     it, so existing history stays legible.
//   - A send attempt that still slips through (e.g. stale client state)
//     surfaces the server's 403 message inline rather than silently
//     failing.
import { useEffect, useLayoutEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowDown, CreditCard, Truck, Loader2, Pencil, Check, CheckCheck, Clock3, AlertCircle, MoreVertical, Ban, Send, MessageCircle, Bus, TrainFront, Package, X, ShieldOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import useChatMessages, { usePresence, useCredit, useTransportPreference } from "../../hooks/useChat.js";
import { useChatContext } from "../../context/ChatContext.jsx";

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

function PendingCreditBanner({ buyerLabel, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-2 border-b px-3.5 py-2 text-left transition-colors hover:brightness-95"
            style={{ borderColor: C.hair, background: C.warnBg }}
        >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "#fff" }}>
                <CreditCard className="h-3.5 w-3.5" style={{ color: C.warn }} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold tracking-wide" style={{ color: C.warn }}>
                Credit request from {buyerLabel} needs your decision
            </span>
            <span className="shrink-0 text-[10.5px] font-bold tracking-wide underline underline-offset-2" style={{ color: C.warn }}>
                Review
            </span>
        </button>
    );
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

// small inline tag — same visual language as the one in ConversationList,
// used next to the shop name in the header when the seller is deleted.
function DeletedTag() {
    return (
        <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide" style={{ background: "#fdecea", color: "#c71f11" }}>
            Deleted
        </span>
    );
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
    credit, viewerRole, buyerInfo, otherName,
    onRequestCredit, onToggleCredit, onDecideCredit, requestingCredit,
    transportPref, onOpenTransportSheet,
    disabled, // NEW — deleted-seller lockout also freezes credit/transport actions
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
                <button onClick={onRequestCredit} disabled={requestingCredit || disabled}
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
    } else if (viewerRole === "seller" && credit && (credit.status === "approved" || credit.status === "revoked")) {
        const on = credit.status === "approved";
        creditCell = (
            <button onClick={() => handleToggleCredit(!on)} disabled={togglingCredit || disabled}
                className="flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-[11px] font-bold tracking-wide transition-colors disabled:opacity-60"
                style={{ background: on ? C.okBg : C.hairSoft, color: on ? C.ok : C.muted, border: `1px solid ${on ? "transparent" : C.hair}` }}
                title={on ? `Credit enabled for ${otherName}` : `Credit off for ${otherName}`}>
                <CreditCard className="h-3 w-3" /> Credit {on ? "enabled" : "off"}
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
            <button onClick={onOpenTransportSheet} disabled={disabled}
                className="flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-bold transition-colors hover:opacity-80 disabled:opacity-60"
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
    const isDeleted = !!meta?.otherIsDeletedSeller;
    return (
        <div className="flex items-center gap-3 border-b px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.surface }}>
            <button onClick={onBack} className="rounded-full p-1.5 transition-colors hover:bg-black/5 sm:hidden">
                <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
            </button>
            <div className="relative shrink-0">
                {meta?.otherShopLogo ? (
                    <img
                        src={meta.otherShopLogo}
                        alt={meta.otherShopName || "Shop"}
                        className="h-10 w-10 rounded-full object-cover shadow-sm"
                        style={{ border: `1px solid ${C.hair}`, filter: isDeleted ? "grayscale(1)" : "none", opacity: isDeleted ? 0.6 : 1 }}
                        onError={(e) => {
                            // logo URL broken/expired — fall back to the initials
                            // avatar (its sibling span) instead of a broken-image icon
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display = "flex";
                        }}
                    />
                ) : null}
                <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[12.5px] font-extrabold tracking-wide text-white shadow-sm"
                    style={{
                        display: meta?.otherShopLogo ? "none" : "flex", // hidden by default when a logo exists; onError above reveals it
                        background: isDeleted ? "#9AA3A8" : "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)",
                    }}
                >
                    {meta ? initials(meta.otherShopName) : ""}
                </span>
                {otherPresence?.online && !isDeleted && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2" style={{ background: "#1FAE5C", borderColor: C.surface }} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {meta ? (
                    <>
                        <span className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-[14.5px] font-extrabold tracking-wide" style={{ color: isDeleted ? C.muted : C.ink }}>{meta.otherShopName}</p>
                            {isDeleted && <DeletedTag />}
                        </span>
                        <AnimatePresence mode="wait" initial={false}>
                            {isDeleted ? (
                                <motion.p
                                    key="deleted"
                                    initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.12 }}
                                    className="text-[10.5px] font-semibold uppercase tracking-wide"
                                    style={{ color: C.muted }}
                                >
                                    Account no longer active
                                </motion.p>
                            ) : otherTyping ? (
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

// Notice shown above the composer whenever sending is blocked because the
// other party's account is deleted. Non-dismissible by design — it should
// stay visible for the life of the disabled state, not just be seen once.
function DeletedSellerNotice({ shopName }) {
    return (
        <div className="flex items-start gap-2 border-t px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.dangerBg }}>
            <ShieldOff className="mt-[1px] h-3.5 w-3.5 shrink-0" style={{ color: C.danger }} />
            <p className="text-[12px] font-semibold leading-snug" style={{ color: C.danger }}>
                {shopName || "This seller"}'s account has been deleted. You can no longer send messages here — this thread is kept for your records only.
            </p>
        </div>
    );
}

function CreditApprovalDialog({ open, onClose, onConfirm, buyerLabel, confirming }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 sm:items-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="w-full rounded-t-2xl bg-white p-5 sm:max-w-[420px] sm:rounded-2xl"
                        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: C.okBg, color: C.ok }}>
                                <CreditCard className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p className="text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>Approve credit for {buyerLabel}?</p>
                                <p className="mt-0.5 text-[12px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                                    They'll be able to place orders with you on credit terms you arrange directly.
                                </p>
                            </div>
                            <button onClick={onClose} className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5">
                                <X className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                        </div>

                        <div className="mt-4 rounded-xl px-3.5 py-3" style={{ background: C.canvas, border: `1px solid ${C.hair}` }}>
                            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>Before you approve</p>
                            <p className="mt-1.5 text-[12px] font-medium leading-relaxed tracking-wide" style={{ color: C.ink }}>
                                Credit terms, repayment, and any dispute arising from a credit sale are strictly between you and the buyer.
                                BBM Marketplace does not process, hold, or guarantee any payment made under a credit arrangement, and is not
                                a party to it. BBM Marketplace shall not be liable for any loss, non-payment, delay, or dispute connected with
                                credit extended under this feature. Approving this request is your independent business decision.
                            </p>
                        </div>

                        <div className="mt-4 flex gap-2.5">
                            <button onClick={onClose} disabled={confirming}
                                className="flex flex-1 items-center justify-center rounded-xl border py-2.5 text-[12.5px] font-bold tracking-wide transition-colors hover:bg-black/[0.03] disabled:opacity-60"
                                style={{ borderColor: C.hair, color: C.muted }}>
                                Cancel
                            </button>
                            <button onClick={onConfirm} disabled={confirming}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold tracking-wide text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                                style={{ background: C.ok }}>
                                {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                I understand, approve
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function TransportProposeSheet({ open, onClose, current, onSubmit }) {
    const [mode, setMode] = useState(current?.mode || null);
    const [company, setCompany] = useState(current?.transport_company || "");
    const [details, setDetails] = useState(current?.details || "");
    const [submitting, setSubmitting] = useState(false);

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

const MessageBubble = memo(function MessageBubble({
    message, isMine, groupPos, onDelete, onRetry,
    credit, buyerInfo, onDecideCredit, onRequestApproval,
    transportPref, onTransportDecision, onOpenTransportSheet, disabled,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [decidingAction, setDecidingAction] = useState(null);
    const [decidingCredit, setDecidingCredit] = useState(null); // NEW — 'approved' | 'rejected' | null, local to this bubble
    const menuRef = useRef(null);
    // ...existing menu-close effect unchanged...

    if (message.message_type === "credit_request") {
        const isLiveRequest = credit?.request_message_id === message.id;
        const frozenStatus = message.metadata?.finalStatus;
        const status = frozenStatus || (isLiveRequest ? credit?.status : null);

        const statusStyle = {
            pending: { color: C.warn, bg: C.warnBg, label: "Pending" },
            approved: { color: C.ok, bg: C.okBg, label: "Approved" },
            rejected: { color: C.danger, bg: C.dangerBg, label: "Declined by seller" },
            revoked: { color: C.muted, bg: C.hairSoft, label: "Turned off by seller" },
        }[status] || { color: C.muted, bg: C.hairSoft, label: "Requested" };

        const time = new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

        // Superseded by a newer cycle — collapses to a slim reference line,
        // never competes visually with whatever is actually live.
        if (!isLiveRequest) {
            return (
                <div className={`mb-2 flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide" style={{ background: C.hairSoft, color: C.muted }}>
                        <CreditCard className="h-3 w-3 shrink-0" style={{ color: statusStyle.color, opacity: 0.7 }} />
                        <span>Credit request</span>
                        <span aria-hidden style={{ opacity: 0.35 }}>•</span>
                        <span style={{ color: statusStyle.color, fontWeight: 700 }}>{statusStyle.label}</span>
                        <span aria-hidden style={{ opacity: 0.35 }}>•</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{time}</span>
                    </div>
                </div>
            );
        }

        const buyerLabel = buyerInfo?.businessName || buyerInfo?.name;
        const needsDecision = !isMine && status === "pending" && !disabled;

        const handleDecide = async (decision) => {
            setDecidingCredit(decision);
            await onDecideCredit(credit.id, decision);
            setDecidingCredit(null);
        };

        // handleDecide for "rejected" stays direct (no terms to accept for declining);
        // "approved" now opens the confirmation dialog via a prop instead of deciding inline.
        const handleDecline = async () => {
            setDecidingCredit("rejected");
            await onDecideCredit(credit.id, "rejected");
            setDecidingCredit(null);
        };

        return (
            <div className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                    className="w-full max-w-[320px] overflow-hidden rounded-2xl border"
                    style={{ borderColor: needsDecision ? `${C.warn}35` : C.hair, background: C.surface, boxShadow: "0 1px 3px rgba(11,17,22,0.06)" }}
                >
                    {/* header row */}
                    <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                            <CreditCard className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>Credit request</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{isMine ? "You requested" : "Requested to you"}</p>
                        </div>
                        <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label}
                        </span>
                    </div>

                    {/* buyer identity — only shown to the seller, only while this card is the one that matters */}
                    {!isMine && buyerLabel && (
                        <div className="mx-3.5 mb-3 rounded-xl px-3 py-2.5" style={{ background: C.canvas, border: `1px solid ${C.hair}` }}>
                            <div className="flex items-center gap-2.5">
                                <span className="relative h-8 w-8 shrink-0">
                                    {buyerInfo?.logoUrl ? (
                                        <img
                                            src={buyerInfo.logoUrl}
                                            alt={buyerLabel || "Buyer"}
                                            className="h-8 w-8 rounded-full object-cover"
                                            style={{ border: `1px solid ${C.hair}` }}
                                            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
                                        />
                                    ) : null}
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-[10.5px] font-extrabold tracking-wide text-white"
                                        style={{ display: buyerInfo?.logoUrl ? "none" : "flex", background: "linear-gradient(135deg, #006F83 0%, #4FA3B0 100%)" }}
                                    >
                                        {initials(buyerLabel)}
                                    </span>
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-bold tracking-wide" style={{ color: C.ink }}>{buyerLabel}</p>
                                    {buyerInfo?.name && buyerInfo.businessName && (
                                        <p className="truncate text-[10.5px] font-medium tracking-wider" style={{ color: C.muted }}>{buyerInfo.name}</p>
                                    )}
                                </div>
                            </div>
                            {(buyerInfo?.phone || buyerInfo?.email || buyerInfo?.location || buyerInfo?.gstin || buyerInfo?.memberSince) && (
                                <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t pt-2.5" style={{ borderColor: C.hair }}>
                                    {buyerInfo.phone && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Phone</span>
                                            <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{buyerInfo.phone}</span>
                                        </div>
                                    )}
                                    {buyerInfo.email && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Email</span>
                                            <span className="truncate text-[11px] font-semibold tracking-wide" style={{ color: C.ink }}>{buyerInfo.email}</span>
                                        </div>
                                    )}
                                    {buyerInfo.location && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Location</span>
                                            <span className="truncate text-[11px] font-semibold tracking-wide" style={{ color: C.ink }}>{buyerInfo.location}</span>
                                        </div>
                                    )}
                                    {buyerInfo.gstin && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>GSTIN</span>
                                            <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{buyerInfo.gstin}</span>
                                        </div>
                                    )}
                                    {buyerInfo.memberSince && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>On BBM since</span>
                                            <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                                {new Date(buyerInfo.memberSince).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* decision — lives here, and only here, for a pending incoming request */}
                    {needsDecision && (
                        <div className="flex gap-2 px-3.5 pb-3.5">
                            <button onClick={() => onRequestApproval(credit.id, buyerLabel || "this buyer")} disabled={!!decidingCredit}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-bold tracking-wide text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                                style={{ background: C.ok }}>
                                <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={handleDecline} disabled={!!decidingCredit}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-[11.5px] font-bold tracking-wide transition-colors hover:bg-black/[0.03] disabled:opacity-60"
                                style={{ borderColor: C.hair, color: C.muted }}>
                                {decidingCredit === "rejected" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Decline
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-end px-3.5 pb-3">
                        <span className="text-[10px] font-semibold" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{time}</span>
                    </div>
                </div>
            </div>
        );
    }


    if (message.message_type === "transport_proposal") {
        const p = message.metadata;
        const isLiveProposal = transportPref?.request_message_id === message.id;
        const status = p.finalStatus || (isLiveProposal ? transportPref.status : null);

        const { label, Icon } = modeMeta(p.mode);
        const statusStyle = {
            pending: { color: C.warn, bg: C.warnBg, label: "Proposed" },
            confirmed: { color: C.ok, bg: C.okBg, label: "Agreed" },
            declined: { color: C.muted, bg: C.hairSoft, label: "Declined" },
            superseded: { color: C.muted, bg: C.hairSoft, label: "Replaced" },
        }[status] || { color: C.muted, bg: C.hairSoft, label: "Sent" };

        const time = new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
        const senderLabel = isMine ? "You proposed" : "They proposed";

        const handleDecision = async (decision) => {
            setDecidingAction(decision);
            await onTransportDecision(p.prefId, decision);
            setDecidingAction(null);
            if (decision === "declined") onOpenTransportSheet?.();
        };

        return (
            <div className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className="flex w-full max-w-[280px] flex-col gap-2 rounded-2xl border px-3.5 py-3" style={{ borderColor: C.hair, background: C.surface }}>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: C.secondary }} />
                        <p className="text-[12.5px] font-bold" style={{ color: C.ink }}>Transport preference</p>
                    </div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{senderLabel}</p>
                    <p className="text-[13px] font-semibold" style={{ color: C.ink }}>
                        {label}{p.transportCompany ? ` · ${p.transportCompany}` : ""}
                    </p>
                    {p.details && <p className="text-[11.5px]" style={{ color: C.muted }}>{p.details}</p>}
                    <div className="flex items-center justify-between">
                        <span className="w-fit rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                        <span className="text-[10px] font-semibold" style={{ color: C.muted }}>{time}</span>
                    </div>

                    {isLiveProposal && status === "pending" && !isMine && !disabled && (
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

                    {isLiveProposal && status === "declined" && isMine && !disabled && (
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
    prev.message === next.message &&
    prev.isMine === next.isMine &&
    prev.groupPos === next.groupPos &&
    prev.credit === next.credit &&
    prev.buyerInfo === next.buyerInfo &&
    prev.onDecideCredit === next.onDecideCredit &&
    prev.onRequestApproval === next.onRequestApproval &&
    prev.transportPref === next.transportPref &&
    prev.onOpenTransportSheet === next.onOpenTransportSheet &&
    prev.disabled === next.disabled
));

// ---- composer -----------------------------------------------------------

function ChatComposer({ onSend, sending, onTypingChange, onOpenTransport, disabled }) {
    const [value, setValue] = useState("");
    const textareaRef = useRef(null);

    const autoGrow = (e) => {
        setValue(e.target.value);
        onTypingChange?.(e.target.value.length > 0);
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    };
    const submit = () => {
        if (!value.trim() || disabled) return;
        onSend(value);
        onTypingChange?.(false);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
    };
    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    };

    // No message here — DeletedSellerNotice (rendered just above this
    // composer in ChatWindow) already states the reason once. Repeating
    // it here just showed the same thing twice in a row.
    if (disabled) {
        return (
            <div className="flex items-center justify-center gap-2 border-t px-3 py-2.5 sm:px-4" style={{ borderColor: C.hair, background: C.hairSoft }}>
                <ShieldOff className="h-3.5 w-3.5" style={{ color: C.muted }} />
            </div>
        );
    }

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
    const { markLocalRead } = useChatContext();
    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    const presence = usePresence(meta?.otherUserId ? [meta.otherUserId] : []);
    const otherPresence = meta?.otherUserId ? presence[meta.otherUserId] : null;

    const [approvalDialog, setApprovalDialog] = useState(null); // { creditId, buyerLabel } | null
    const [confirmingApproval, setConfirmingApproval] = useState(false);

    const handleRequestApproval = useCallback((creditId, buyerLabel) => {
        setApprovalDialog({ creditId, buyerLabel });
    }, []);

    const handleConfirmApproval = async () => {
        if (!approvalDialog) return;
        setConfirmingApproval(true);
        await decide(approvalDialog.creditId, "approved");
        setConfirmingApproval(false);
        setApprovalDialog(null);
    };

    const { pref: transportPref, propose: proposeTransport, decide: decideTransport } = useTransportPreference(meta?.otherUserId, conversationId);
    const [transportSheetOpen, setTransportSheetOpen] = useState(false);
    const openTransportSheet = useCallback(() => setTransportSheetOpen(true), []);

    const { credit, viewerRole, buyerInfo, request, decide, toggle } = useCredit(meta?.otherUserId);
    const [requestingCredit, setRequestingCredit] = useState(false);

    const handleRequestCredit = async () => {
        setRequestingCredit(true);
        await request();
        setRequestingCredit(false);
    };

    const {
        messages, loading, loadingOlder, hasMore, loadOlder,
        send, retry, deleteMessage, sending, otherTyping, notifyTyping, connected,
        canSend, // NEW — server-verified send permission for this conversation, from listMessages
        sendError, // NEW — surfaces the server's 403 message if a send still gets rejected
    } = useChatMessages(conversationId, meta?.otherUserId);

    // Composer/actions are locked if EITHER the conversations-list flag
    // (fast, client-side) or the server's fresh per-load check says so.
    // `canSend` defaults to true before the first load resolves so the
    // composer doesn't flash disabled on every open.
    const isLockedOut = !!meta?.otherIsDeletedSeller || canSend === false;

    // ---- scroll behavior ---------------------------------------------
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [newIncoming, setNewIncoming] = useState(0);

    const scrollStateRef = useRef({ convId: null, placedAtBottom: false });
    const lastMessageIdRef = useRef(null);
    const isPrependingRef = useRef(false);
    const prevScrollHeightRef = useRef(0);

    const messageRefs = useRef(new Map()); // message.id -> DOM node
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const highlightTimeoutRef = useRef(null);

    const scrollToMessage = useCallback((messageId) => {
        const el = messageRefs.current.get(messageId);
        if (!el) return;
        el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
        clearTimeout(highlightTimeoutRef.current);
        setHighlightedMessageId(messageId);
        highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 2200);
    }, []);

    useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

    const jumpToBottom = useCallback((smooth = false) => {
        bottomRef.current?.scrollIntoView(smooth && !prefersReducedMotion ? { behavior: "smooth", block: "end" } : { block: "end" });
    }, []);

    useEffect(() => {
        if (scrollStateRef.current.convId !== conversationId) {
            scrollStateRef.current = { convId: conversationId, placedAtBottom: false };
            lastMessageIdRef.current = null;
            setIsNearBottom(true);
            setNewIncoming(0);
        }
    }, [conversationId]);

    useEffect(() => {
        if (conversationId) markLocalRead(conversationId);
    }, [conversationId, markLocalRead]);

    useEffect(() => {
        const last = messages[messages.length - 1];
        if (last && last.sender_id !== profile?.id) markLocalRead(conversationId);
    }, [messages, profile?.id, conversationId, markLocalRead]);

    useLayoutEffect(() => {
        if (loading) return;
        if (scrollStateRef.current.convId !== conversationId) return;
        if (scrollStateRef.current.placedAtBottom) return;
        scrollStateRef.current.placedAtBottom = true;
        const last = messages[messages.length - 1];
        lastMessageIdRef.current = last ? rowKey(last) : null;
        jumpToBottom(false);
    }, [loading, messages, conversationId, jumpToBottom]);

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

    useLayoutEffect(() => {
        if (!scrollStateRef.current.placedAtBottom) return;
        const last = messages[messages.length - 1];
        if (!last) return;
        const key = rowKey(last);
        if (key === lastMessageIdRef.current) return;
        lastMessageIdRef.current = key;

        const mine = last.sender_id === profile?.id;
        if (mine || isNearBottom) {
            jumpToBottom(false);
            setNewIncoming(0);
        } else {
            setNewIncoming((n) => n + 1);
        }
    }, [messages, isNearBottom, profile?.id, jumpToBottom]);

    useLayoutEffect(() => {
        if (otherTyping && isNearBottom) jumpToBottom(false);
    }, [otherTyping, isNearBottom, jumpToBottom]);

    const pinnedRef = useRef(true);
    useEffect(() => { pinnedRef.current = isNearBottom; }, [isNearBottom]);

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

            {viewerRole === "seller" && credit?.status === "pending" && credit?.request_message_id && (
                <PendingCreditBanner
                    buyerLabel={buyerInfo?.businessName || buyerInfo?.name || "a buyer"}
                    onClick={() => scrollToMessage(credit.request_message_id)}
                />
            )}

            <StatusStrip
                credit={credit} viewerRole={viewerRole} otherName={meta?.otherShopName || meta?.title || "them"}
                onToggleCredit={toggle} // onDecideCredit + requestingCredit-for-seller no longer needed here
                onRequestCredit={handleRequestCredit} requestingCredit={requestingCredit}
                transportPref={transportPref} onOpenTransportSheet={openTransportSheet}
                disabled={isLockedOut}
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
                                    <div
                                        key={rowKey(m)}
                                        ref={(el) => {
                                            if (el) messageRefs.current.set(m.id, el);
                                            else messageRefs.current.delete(m.id);
                                        }}
                                        className="rounded-2xl transition-colors duration-500"
                                        style={highlightedMessageId === m.id ? { background: `${C.secondary}0f`, boxShadow: `0 0 0 2px ${C.secondary}30` } : undefined}
                                    >
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
                                            buyerInfo={buyerInfo}
                                            onDecideCredit={decide}
                                            onRequestApproval={handleRequestApproval}
                                            transportPref={transportPref}
                                            onTransportDecision={decideTransport}
                                            onOpenTransportSheet={openTransportSheet}
                                            disabled={isLockedOut}
                                        />
                                    </div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                    <AnimatePresence>
                        {otherTyping && !isLockedOut && <TypingBubble key="typing-bubble" />}
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

            {sendError && !isLockedOut && (
                <div className="px-3.5 py-1.5 text-[11.5px] font-semibold" style={{ color: C.danger, background: C.dangerBg }}>
                    {sendError}
                </div>
            )}

            {isLockedOut && <DeletedSellerNotice shopName={meta?.otherShopName} />}

            <ChatComposer
                onSend={send}
                sending={sending}
                onTypingChange={notifyTyping}
                onOpenTransport={openTransportSheet}
                disabled={isLockedOut}
            />
            <TransportProposeSheet
                open={transportSheetOpen}
                onClose={() => setTransportSheetOpen(false)}
                current={transportPref}
                onSubmit={(mode, company, details) => proposeTransport(mode, company, details)}
            />
            <CreditApprovalDialog
                open={!!approvalDialog}
                onClose={() => setApprovalDialog(null)}
                onConfirm={handleConfirmApproval}
                buyerLabel={approvalDialog?.buyerLabel}
                confirming={confirmingApproval}
            />
        </div>
    );
}