// hooks/useRealtimeOrder.js
//
// FIX: this used to subscribe to a Supabase Realtime broadcast channel
// (`supabase.channel('order-' + orderId)`), but nothing on the backend
// ever publishes to Supabase Realtime — every order-status push goes out
// through this app's own Socket.IO server instead (see
// realtimeBroadcast.js's notifyOrderChanged/notifyUserOrdersChanged,
// which both call getIO().to(...).emit(...)). Those are two completely
// separate pub/sub systems that don't talk to each other, on top of which
// the channel names didn't even match ("order-123" vs "order:123") — so
// this listener was subscribed to a channel nothing could ever reach.
//
// Fix: use subscribeUserEvent from AuthContext — this app's existing,
// already-working wrapper around that same Socket.IO connection (the
// same one SellerManageListingsPage already relies on for
// "submissions_changed"). The backend already emits "orders_changed" to
// the buyer's and seller's own user-channel on every order transition
// (place, cancel, confirm/reject/process/ship/deliver) — this just needed
// to listen on the right transport. Reloading this one order on any
// "orders_changed" event is cheap and avoids needing a separate
// per-order Socket.IO room with its own explicit join/leave lifecycle.
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function useRealtimeOrder({ orderId, fetcher }) {
    const { subscribeUserEvent } = useAuth();
    const [order, setOrder] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const res = await fetcher(orderId);
            setOrder(res?.order || null);
            setEvents(res?.events || []);
        } finally { setLoading(false); }
    }, [orderId, fetcher]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => subscribeUserEvent?.("orders_changed", () => load()), [subscribeUserEvent, load]);

    return { order, events, loading, reload: load };
}