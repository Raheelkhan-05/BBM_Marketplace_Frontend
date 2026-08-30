// hooks/useChat.js
//
// All chat-related hooks live here together (messages, conversation list,
// presence) so the module count stays small and the shared bits — the
// message cache, the socket wiring pattern — sit next to each other
// instead of being re-derived per file.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import {
    fetchMessages, sendChatMessage, markConversationRead,
    deleteChatMessage, fetchConversations,
    fetchTransportPreference, proposeTransportApi, decideTransportApi,
} from "../utils/chatApi.js";
import { fetchCreditStatus, requestCredit as requestCreditApi, decideCredit as decideCreditApi, toggleCredit as toggleCreditApi } from "../utils/api.js";

function makeClientMessageId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function statusFromWatermarks(message, myId, wm) {
    if (message.sender_id !== myId) return undefined;
    if (!wm) return "sent";
    const t = new Date(message.created_at).getTime();
    if (wm.readAt && new Date(wm.readAt).getTime() >= t) return "read";
    if (wm.deliveredAt && new Date(wm.deliveredAt).getTime() >= t) return "delivered";
    return "sent";
}

function previewFor(body) {
    if (!body) return "📎 Attachment";
    return body.length > 80 ? body.slice(0, 80) + "…" : body;
}

// ---------------------------------------------------------------------
// PERFORMANCE FIX: opening a conversation used to always show a blocking
// spinner and wait on a fresh network round trip, even for a thread you
// had open thirty seconds ago. This is a tiny in-memory (per browser
// session) cache keyed by conversationId so re-opening a recent thread
// paints instantly from cache while a background refetch quietly
// reconciles it — the same "stale while revalidate" feel WhatsApp Web
// has when you flip between chats.
// ---------------------------------------------------------------------
const messageCache = new Map(); // conversationId -> { entries, hasMore, cursor, watermarks }

export default function useChatMessages(conversationId, otherUserId) {
    const { token, profile } = useAuth();
    const { socket, connected } = useSocket();
    const myId = profile?.id;

    const cached = conversationId ? messageCache.get(conversationId) : null;

    const [messageMap, setMessageMap] = useState(() => (cached ? new Map(cached.entries) : new Map()));
    const [otherWatermarks, setOtherWatermarks] = useState(() => cached?.watermarks || { deliveredAt: null, readAt: null });
    const [otherTyping, setOtherTyping] = useState(false);
    const [loading, setLoading] = useState(!cached);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
    const [sending, setSending] = useState(false);

    const oldestCursorRef = useRef(cached?.cursor || null);
    const typingTimeoutRef = useRef(null);
    const isOpenRef = useRef(true);

    // FIX: acknowledging "read" used to always go over REST, which adds a
    // full request/response hop in front of the socket push that carries
    // the receipt back to the sender. When the socket is live (the normal
    // case for someone actively looking at the thread), send the
    // acknowledgment straight over it instead — same server-side effect,
    // one less hop. REST stays as the fallback for when the socket isn't
    // connected yet.
    const ackRead = useCallback(() => {
        if (!conversationId) return;
        if (socket && connected) socket.emit("read:ack", { conversationId });
        else markConversationRead(token, conversationId); // <- hits the broken endpoint
    }, [socket, connected, conversationId, token]);

    // MOVED HERE — top level of the hook, alongside ackRead, not inside the effect
    const ackDelivered = useCallback(() => {
        if (!conversationId) return;
        if (socket && connected) socket.emit("delivered:ack", { conversationId });
    }, [socket, connected, conversationId]);



    const upsert = useCallback((msg) => {
        setMessageMap((prev) => {
            // dedup on BOTH server id and client_message_id — covers the
            // optimistic-bubble-reconciliation case AND the "same message
            // arrives via socket AND via the HTTP response" race.
            const next = new Map(prev);
            for (const [k, v] of next) {
                if (v.client_message_id && v.client_message_id === msg.client_message_id) next.delete(k);
            }
            next.set(msg.id, { ...next.get(msg.id), ...msg });
            return next;
        });
    }, []);

    // reset per-conversation transient state whenever the thread changes
    useEffect(() => {
        const next = conversationId ? messageCache.get(conversationId) : null;
        setMessageMap(next ? new Map(next.entries) : new Map());
        setOtherWatermarks(next?.watermarks || { deliveredAt: null, readAt: null });
        setHasMore(next?.hasMore ?? true);
        oldestCursorRef.current = next?.cursor || null;
        setLoading(!next);
        setOtherTyping(false);
    }, [conversationId]);

    // initial fetch (or silent background revalidation if we hydrated from cache)
    useEffect(() => {
        if (!conversationId || !token) return;
        let cancelled = false;
        fetchMessages(token, conversationId).then((res) => {
            if (cancelled || !res?.success) return;
            setMessageMap((prev) => {
                const next = new Map(res.messages.map((m) => [m.id, m]));
                // preserve any purely-local state (e.g. an in-flight optimistic
                // send) that the fresh page wouldn't know about
                prev.forEach((v, k) => { if (!next.has(k)) next.set(k, v); });
                return next;
            });
            setHasMore(res.hasMore);
            oldestCursorRef.current = res.oldestCursor || null;
            if (res.otherWatermarks) setOtherWatermarks(res.otherWatermarks);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [conversationId, token]);

    // write-through: keep the cache current so the next visit is instant
    useEffect(() => {
        if (!conversationId) return;
        messageCache.set(conversationId, {
            entries: Array.from(messageMap.entries()),
            hasMore,
            cursor: oldestCursorRef.current,
            watermarks: otherWatermarks,
        });
    }, [conversationId, messageMap, hasMore, otherWatermarks]);

    const loadOlder = useCallback(async () => {
        if (loadingOlder || !hasMore || !oldestCursorRef.current) return;
        setLoadingOlder(true);
        const res = await fetchMessages(token, conversationId, oldestCursorRef.current);
        if (res?.success) {
            setMessageMap((prev) => {
                const next = new Map(res.messages.map((m) => [m.id, m]));
                prev.forEach((v, k) => next.set(k, v));
                return next;
            });
            setHasMore(res.hasMore);
            oldestCursorRef.current = res.oldestCursor || oldestCursorRef.current;
        }
        setLoadingOlder(false);
    }, [conversationId, token, hasMore, loadingOlder]);

    // listeners attach once the socket is actually connected — a
    // stable-but-not-yet-connected socket object passes `if (!socket)`
    // fine, so `connected` has to be in the deps or this would silently
    // never re-run once the handshake finished.
    useEffect(() => {
        if (!socket || !connected || !conversationId) return;

        const onNew = (msg) => {
            if (msg.conversation_id !== conversationId) return;
            upsert(msg);
            if (msg.sender_id !== myId) {
                ackDelivered();
                if (isOpenRef.current) ackRead();
            }
        };
        const onStatus = ({ conversationId: cid, deliveredAt, readAt }) => {
            if (cid !== conversationId) return;
            setOtherWatermarks((prev) => ({ deliveredAt: deliveredAt || prev.deliveredAt, readAt: readAt || prev.readAt }));
        };
        const onTyping = ({ conversationId: cid, userId, typing }) => {
            if (cid !== conversationId || userId !== otherUserId) return;
            setOtherTyping(typing);
        };
        const onDeleted = ({ conversationId: cid, messageId, scope }) => {
            if (cid !== conversationId) return;
            if (scope === "everyone") {
                setMessageMap((prev) => {
                    const next = new Map(prev);
                    const m = next.get(messageId);
                    if (m) next.set(messageId, { ...m, deleted_at: new Date().toISOString(), body: null, attachment_url: null });
                    return next;
                });
            } else {
                setMessageMap((prev) => { const next = new Map(prev); next.delete(messageId); return next; });
            }
        };

        socket.on("message:new", onNew);
        socket.on("message:status", onStatus);
        socket.on("typing:update", onTyping);
        socket.on("message:deleted", onDeleted);
        return () => {
            socket.off("message:new", onNew);
            socket.off("message:status", onStatus);
            socket.off("typing:update", onTyping);
            socket.off("message:deleted", onDeleted);
        };
    }, [socket, connected, conversationId, myId, otherUserId, upsert, ackRead, ackDelivered]);

    // resync on regaining connection — covers "closed laptop, reopened
    // 10 minutes later" without a full page reload
    const prevConnectedRef = useRef(connected);
    useEffect(() => {
        if (connected && !prevConnectedRef.current && conversationId && token) {
            fetchMessages(token, conversationId).then((res) => {
                if (res?.success) {
                    setMessageMap((prev) => {
                        const next = new Map(prev);
                        res.messages.forEach((m) => next.set(m.id, m));
                        return next;
                    });
                    if (res.otherWatermarks) setOtherWatermarks(res.otherWatermarks);
                }
            });
        }
        prevConnectedRef.current = connected;
    }, [connected, conversationId, token]);

    useEffect(() => {
        if (!conversationId || !token) return;
        isOpenRef.current = true;
        ackRead();
        return () => { isOpenRef.current = false; };
    }, [conversationId, token, ackRead]);

    const messages = useMemo(
        () => Array.from(messageMap.values())
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((m) => ({ ...m, status: statusFromWatermarks(m, myId, otherWatermarks) })),
        [messageMap, myId, otherWatermarks],
    );

    const send = useCallback(async (body) => {
        if (!body?.trim() || !conversationId) return;
        setSending(true);
        const clientMessageId = makeClientMessageId();
        const tempId = `temp-${clientMessageId}`;
        upsert({ id: tempId, conversation_id: conversationId, sender_id: myId, body: body.trim(), created_at: new Date().toISOString(), status: "sending", client_message_id: clientMessageId });
        const res = await sendChatMessage(token, conversationId, body.trim(), null, clientMessageId);
        setSending(false);
        setMessageMap((prev) => {
            const next = new Map(prev);
            if (res?.success) {
                next.delete(tempId);
                next.set(res.message.id, res.message);
            } else {
                // BUG FIX (was: silently dropped): keep the bubble but mark it
                // failed so the person can see the send didn't go through and
                // retry it, instead of the message just vanishing.
                const existing = next.get(tempId);
                if (existing) next.set(tempId, { ...existing, status: "failed" });
            }
            return next;
        });
    }, [conversationId, token, myId, upsert]);

    const retry = useCallback((tempId) => {
        const existing = messageMap.get(tempId);
        if (!existing) return;
        setMessageMap((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
        send(existing.body);
    }, [messageMap, send]);

    // BUG FIX: this used to live in ChatWindow.jsx and called
    // `setMessageMap`, a piece of state that only ever existed inside
    // *this* hook — it threw a ReferenceError the moment anyone tried to
    // delete a message. Delete now lives where the state actually is,
    // with optimistic update + rollback on failure.
    const deleteMessage = useCallback(async (messageId, scope) => {
        const previous = messageMap.get(messageId);
        if (!previous) return;
        setMessageMap((prev) => {
            const next = new Map(prev);
            if (scope === "everyone") {
                next.set(messageId, { ...previous, deleted_at: new Date().toISOString(), body: null, attachment_url: null });
            } else {
                next.delete(messageId);
            }
            return next;
        });
        const res = await deleteChatMessage(token, conversationId, messageId, scope);
        if (!res?.success) {
            // rollback — the delete didn't actually happen server-side
            setMessageMap((prev) => { const next = new Map(prev); next.set(messageId, previous); return next; });
        }
    }, [messageMap, token, conversationId]);

    const notifyTyping = useCallback((isTyping) => {
        if (!socket || !connected || !conversationId) return;
        clearTimeout(typingTimeoutRef.current);
        socket.emit(isTyping ? "typing:start" : "typing:stop", { conversationId });
        if (isTyping) typingTimeoutRef.current = setTimeout(() => socket.emit("typing:stop", { conversationId }), 3000);
    }, [socket, connected, conversationId]);

    return {
        messages, loading, loadingOlder, hasMore, loadOlder,
        send, retry, deleteMessage, sending,
        otherTyping, notifyTyping, connected,
    };
}

// ---------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------
export function useConversations() {
    const { token, profile } = useAuth();
    const { socket } = useSocket();
    const myId = profile?.id;
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const reloadTimerRef = useRef(null);

    const reload = useCallback(() => {
        if (!token) return;
        fetchConversations(token).then((res) => {
            if (res?.success) setConversations(res.conversations);
            setLoading(false);
        });
    }, [token]);

    useEffect(() => { reload(); }, [reload]);

    const scheduleReload = useCallback(() => {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(reload, 150);
    }, [reload]);

    useEffect(() => {
        if (!socket) return;

        // PERFORMANCE FIX: this used to reload the *entire* conversation
        // list from the network on every single "message:new" — a full
        // round trip just to bump one row's preview text and timestamp.
        // Now it patches the affected row in place from the socket
        // payload itself (which already has everything needed) and only
        // falls back to a real reload for the rare case of a brand-new
        // conversation that isn't in the list yet.
        const onMessage = (payload) => {
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === payload.conversation_id);
                if (idx === -1) { scheduleReload(); return prev; }
                const updated = {
                    ...prev[idx],
                    lastMessagePreview: previewFor(payload.body),
                    lastMessageIsMine: payload.sender_id === myId,
                    lastMessageAt: payload.created_at,
                    unread: payload.sender_id !== myId ? true : prev[idx].unread,
                };
                return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
            });
        };
        socket.on("message:new", onMessage);
        socket.on("conversation:updated", scheduleReload);
        return () => {
            clearTimeout(reloadTimerRef.current);
            socket.off("message:new", onMessage);
            socket.off("conversation:updated", scheduleReload);
        };
    }, [socket, myId, scheduleReload]);

    // lets the chat screen clear a conversation's unread dot the instant
    // it's opened, rather than waiting on the next list refresh
    const markLocalRead = useCallback((conversationId) => {
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread: false } : c)));
    }, []);

    return { conversations, loading, unreadTotal: conversations.filter((c) => c.unread).length, reload, markLocalRead };
}

// ---------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------
export function usePresence(userIds = []) {
    const { socket, connected } = useSocket();
    const [presenceMap, setPresenceMap] = useState({}); // userId -> { online, lastSeenAt }

    const key = userIds.join(",");
    const refresh = useCallback(() => {
        if (!socket || !connected || userIds.length === 0) return;
        socket.emit("presence:query_many", userIds, (result) => {
            setPresenceMap((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(result).map(([id, online]) => [id, { ...prev[id], online }])) }));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, connected, key]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        if (!socket) return;
        const onUpdate = ({ userId, online, lastSeenAt }) => {
            setPresenceMap((prev) => ({ ...prev, [userId]: { online, lastSeenAt: lastSeenAt || prev[userId]?.lastSeenAt } }));
        };
        socket.on("presence:update", onUpdate);
        return () => socket.off("presence:update", onUpdate);
    }, [socket]);

    return presenceMap;
}


// One credit relationship, keyed off the OTHER user's profile id — role-agnostic,
// used by ChatWindow for both buyer and seller views of the same pinned bar.
export function useCredit(otherUserId) {
    const { token } = useAuth();
    const { socket, connected } = useSocket();
    const [credit, setCredit] = useState(null);
    const [viewerRole, setViewerRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        if (!otherUserId || !token) return;
        setLoading(true);
        fetchCreditStatus(token, { otherUserId }).then((res) => {
            if (res?.success) { setCredit(res.credit); setViewerRole(res.viewerRole); }
            setLoading(false);
        });
    }, [otherUserId, token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket || !connected) return;

        const onRequested = () => { load(); };

        // FIX: previously patched `credit` in place only if `prev.id ===
        // creditId` — if that guard ever missed (stale/null prev on the
        // buyer's side after a decision came in), the update silently
        // no-op'd and the UI stayed frozen on the message's original state.
        // A REST refetch is cheap here (fires once per decision, not per
        // keystroke) and removes any dependency on local state already
        // being in the exact right shape — it's just correct.
        const onDecided = () => { load(); };
        const onToggled = () => { load(); };

        socket.on("credit:requested", onRequested);
        socket.on("credit:decided", onDecided);
        socket.on("credit:toggled", onToggled);
        return () => {
            socket.off("credit:requested", onRequested);
            socket.off("credit:decided", onDecided);
            socket.off("credit:toggled", onToggled);
        };
    }, [socket, connected, load]);

    const request = useCallback(async (conversationId) => {
        const res = await requestCreditApi(token, { sellerUserId: otherUserId });
        if (res?.success) load();
        return res;
    }, [token, otherUserId, load]);

    const decide = useCallback(async (creditId, decision) => {
        setCredit((prev) => (prev ? { ...prev, status: decision } : prev)); // optimistic
        const res = await decideCreditApi(token, creditId, decision);
        if (!res?.success) load();
        return res;
    }, [token, load]);

    const toggle = useCallback(async (enabled) => {
        setCredit((prev) => (prev ? { ...prev, status: enabled ? "approved" : "revoked" } : prev));
        const res = await toggleCreditApi(token, otherUserId, enabled);
        if (!res?.success) load();
        return res;
    }, [token, otherUserId, load]);

    return { credit, viewerRole, loading, request, decide, toggle, reload: load };
}

export function useTransportPreference(otherUserId, conversationId) {
    const { token } = useAuth();
    const { socket, connected } = useSocket();
    const [pref, setPref] = useState(null);
    const [viewerRole, setViewerRole] = useState(null);

    const load = useCallback(() => {
        if (!otherUserId || !token) return;
        fetchTransportPreference(token, { otherUserId }).then((res) => { // was: fetchTransportPreference(token, otherUserId)
            if (res?.success) { setPref(res.preference); setViewerRole(res.viewerRole); }
        });
    }, [otherUserId, token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket || !connected) return;
        socket.on("transport:proposed", load);
        socket.on("transport:decided", load);
        return () => { socket.off("transport:proposed", load); socket.off("transport:decided", load); };
    }, [socket, connected, load]);

    const propose = useCallback((mode, transportCompany, details) =>
        proposeTransportApi(token, { otherUserId, conversationId, mode, transportCompany, details }).then((r) => { if (r?.success) load(); return r; }),
        [token, otherUserId, conversationId, load]);

    const decide = useCallback((prefId, decision) =>
        decideTransportApi(token, prefId, decision).then((r) => { if (r?.success) load(); return r; }),
        [token, load]);

    return { pref, viewerRole, propose, decide };
}