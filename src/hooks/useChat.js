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

    const ackRead = useCallback(() => {
        if (!conversationId) return;
        if (socket && connected) socket.emit("read:ack", { conversationId });
        else markConversationRead(token, conversationId);
    }, [socket, connected, conversationId, token]);

    const ackDelivered = useCallback(() => {
        if (!conversationId) return;
        if (socket && connected) socket.emit("delivered:ack", { conversationId });
    }, [socket, connected, conversationId]);

    const upsert = useCallback((msg) => {
        setMessageMap((prev) => {
            // ORDERING: this is the single writer that governs where a
            // live-arriving message ends up, and it deliberately never
            // compares timestamps across sources (your own device clock
            // vs. the server's clock for the other person's messages —
            // those two clocks drift, routinely by seconds, and any
            // comparison between them is exactly what used to cause a
            // message to visibly jump position after the fact). Instead:
            //   1. An entry that's genuinely NEW to this map (no
            //      matching id or client_message_id) is APPENDED to the
            //      end — i.e. placed last in Map insertion order, full
            //      stop, no timestamp comparison of any kind.
            //   2. An entry that MATCHES something already in the map
            //      (the optimistic → confirmed swap, or any other
            //      update to a message we already know about) is
            //      updated IN PLACE, at its existing position — it never
            //      moves.
            // Anything already rendered therefore never reorders once
            // it's on screen; a new message from either side always
            // lands at the bottom, in the order the client became aware
            // of it. Ordering for already-loaded history (initial fetch,
            // pagination) is untouched — it comes pre-ordered from the
            // server and is preserved by Map insertion order below.
            //
            // Downstream, the `messages` useMemo does NOT re-sort this —
            // it trusts Map iteration order completely. That pairing is
            // what makes this fix actually hold; see the comment there.
            let matchedKey = null;
            for (const [k, v] of prev) {
                if (k === msg.id || (v.client_message_id && msg.client_message_id && v.client_message_id === msg.client_message_id)) {
                    matchedKey = k;
                    break;
                }
            }
            const next = new Map();
            if (matchedKey !== null) {
                for (const [k, v] of prev) {
                    next.set(k === matchedKey ? msg.id : k, k === matchedKey ? { ...v, ...msg } : v);
                }
            } else {
                for (const [k, v] of prev) next.set(k, v);
                next.set(msg.id, msg);
            }
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
                // server-fetched messages arrive pre-ordered (oldest →
                // newest) — Map preserves insertion order, so building
                // straight from this array is already correct, no client-
                // side sort needed.
                const next = new Map(res.messages.map((m) => [m.id, m]));
                // preserve any purely-local state (e.g. an in-flight optimistic
                // send) that the fresh page wouldn't know about — appended
                // after the server's messages, since it's newer than
                // anything the server returned.
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
                // older batch first (Map insertion order = display order),
                // then the messages we already had layered on top —
                // preserves correct chronological order without a sort.
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
                        // update-in-place for anything we already know
                        // about; anything genuinely new (missed while
                        // disconnected) appends at the end — same
                        // append-only/no-reorder rule as `upsert`.
                        res.messages.forEach((m) => next.set(m.id, { ...next.get(m.id), ...m }));
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

    // ---------------------------------------------------------------
    // UI-STABILITY FIX (unchanged from before): this used to unconditionally
    // spread every message into a brand-new object on every recompute —
    // `{ ...m, status }` ran for ALL messages any time `otherWatermarks`
    // changed, even though a watermark update only ever changes the status
    // of messages sent by the CURRENT user, and typically only the most
    // recent one or two. Every message therefore got a new object identity
    // on every read/delivered receipt, which defeats MessageBubble's
    // React.memo() and forces the whole thread to re-render (and,
    // previously, replay its layout animation) on every tick update. Now a
    // message keeps its exact previous reference when its derived status
    // hasn't changed, so memo() actually works and only the bubble(s) that
    // changed re-render.
    //
    // ORDERING FIX (root-cause fix, replaces the earlier sort_key
    // approach): there is NO SORT here anymore, on purpose. The previous
    // version sorted by a frozen `sort_key` (falling back to created_at)
    // on every render — but that re-introduced the exact bug it was
    // trying to fix, because it still compared timestamps ACROSS
    // sources: your own optimistic message stamped with your DEVICE'S
    // clock, versus the other person's message stamped with the
    // SERVER's clock. Any clock skew between the two (routine — phones
    // drift by seconds) meant that comparison was unreliable, and
    // whichever message resolved its comparison differently could
    // "correct" its position after the fact — a visible jump.
    //
    // The actual fix: don't derive order from timestamps at all. Order
    // comes purely from Map iteration order (= insertion order), which
    // `upsert`, the initial fetch, `loadOlder`, and the resync effect
    // above already construct correctly on their own (older history
    // prepended, brand-new messages appended at the end, matches updated
    // in place, never reordered). Trusting that order here — instead of
    // re-deriving it from timestamps — is what makes the append-only,
    // never-reorder guarantee actually hold end to end.
    // ---------------------------------------------------------------
    const messages = useMemo(
        () => Array.from(messageMap.values())
            .map((m) => {
                const status = statusFromWatermarks(m, myId, otherWatermarks);
                return m.status === status ? m : { ...m, status };
            }),
        [messageMap, myId, otherWatermarks],
    );

    const send = useCallback(async (body) => {
        if (!body?.trim() || !conversationId) return;
        setSending(true);
        const clientMessageId = makeClientMessageId();
        const tempId = `temp-${clientMessageId}`;
        const optimisticCreatedAt = new Date().toISOString();
        upsert({
            id: tempId,
            conversation_id: conversationId,
            sender_id: myId,
            body: body.trim(),
            created_at: optimisticCreatedAt,
            status: "sending",
            client_message_id: clientMessageId,
        });
        const res = await sendChatMessage(token, conversationId, body.trim(), null, clientMessageId);
        setSending(false);
        setMessageMap((prev) => {
            const next = new Map(prev);
            if (res?.success) {
                const existing = next.get(tempId);
                next.delete(tempId);
                // keep the position the bubble already has on screen — this
                // set() re-inserts under the new (server) id, but since we
                // never sort by timestamp, the only thing that matters for
                // display position is where this key sits in the Map, and
                // `matchedKey` handling in `upsert`-style updates elsewhere
                // never moves an existing entry. Here we're doing the swap
                // directly (not via upsert) so we insert at the same
                // logical spot by deleting the temp key and setting the
                // real one immediately after — Map insertion order keeps
                // it in place since nothing else is re-sorted.
                next.set(res.message.id, { ...res.message });
            } else {
                // keep the bubble but mark it failed so the person can see the
                // send didn't go through and retry it, instead of the message
                // just vanishing.
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
let conversationsCache = null; // { list } — module-level, survives remounts within the session

export function useConversations() {
    const { token, profile } = useAuth();
    const { socket } = useSocket();
    const myId = profile?.id;
    const [conversations, setConversations] = useState(conversationsCache?.list || []);
    const [loading, setLoading] = useState(!conversationsCache);
    const reloadTimerRef = useRef(null);

    const reload = useCallback(() => {
        if (!token) return;
        fetchConversations(token).then((res) => {
            if (res?.success) {
                setConversations(res.conversations);
                conversationsCache = { list: res.conversations };
            }
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
                const nextList = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
                conversationsCache = { list: nextList };
                return nextList;
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
        setConversations((prev) => {
            const nextList = prev.map((c) => (c.id === conversationId ? { ...c, unread: false } : c));
            conversationsCache = { list: nextList };
            return nextList;
        });
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
        fetchTransportPreference(token, { otherUserId }).then((res) => {
            if (res?.success) { setPref(res.preference); setViewerRole(res.viewerRole); }
        });
    }, [otherUserId, token]);

    useEffect(() => { load(); }, [load]);

    // Apply the row the server pushes directly — this is what makes the
    // other person's screen update instantly and reliably, instead of
    // depending on a second fetch (and its buyer/seller direction
    // resolution) landing correctly after the fact. `load()` is only a
    // fallback for a payload that's missing the row for some reason.
    useEffect(() => {
        if (!socket || !connected) return;
        const applyOrReload = (payload) => {
            if (payload?.preference) setPref(payload.preference);
            else load();
        };
        socket.on("transport:proposed", applyOrReload);
        socket.on("transport:decided", applyOrReload);
        return () => { socket.off("transport:proposed", applyOrReload); socket.off("transport:decided", applyOrReload); };
    }, [socket, connected, load]);

    const propose = useCallback((mode, transportCompany, details) =>
        proposeTransportApi(token, { otherUserId, conversationId, mode, transportCompany, details }).then((r) => {
            if (r?.success && r.preference) setPref(r.preference);
            else if (r?.success) load();
            return r;
        }), [token, otherUserId, conversationId, load]);

    const decide = useCallback((prefId, decision) =>
        decideTransportApi(token, prefId, decision).then((r) => {
            if (r?.success && r.preference) setPref(r.preference);
            else if (r?.success) load();
            return r;
        }), [token, load]);

    return { pref, viewerRole, propose, decide };
}