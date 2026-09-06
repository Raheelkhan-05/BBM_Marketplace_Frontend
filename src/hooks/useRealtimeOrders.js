// hooks/useRealtimeOrders.js
//
// FIX: same root cause as useRealtimeOrder.js — this subscribed to a
// Supabase Realtime broadcast channel keyed by `channelToken`
// (profile?.notificationChannel), but the backend only ever pushes order
// updates through Socket.IO (notifyUserOrdersChanged ->
// getIO().to(`user:${userId}`).emit("orders_changed", ...)). Nothing was
// ever actually delivered to the Supabase channel this was listening on.
//
// Fix: use subscribeUserEvent from AuthContext, the same already-working
// Socket.IO wrapper used elsewhere in the app (e.g.
// SellerManageListingsPage's "submissions_changed"). `channelToken` is no
// longer needed — subscribeUserEvent already scopes events to the
// current signed-in user — so it's accepted-but-unused here rather than
// requiring every call site (OrdersPage.jsx, SalesOrdersPage.jsx) to be
// touched just to stop passing it.
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function useRealtimeOrders({ fetcher, channelToken }) { // eslint-disable-line no-unused-vars
    const { subscribeUserEvent } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try { setOrders((await fetcher()) || []); }
        catch (e) { setError(e); }
        finally { setLoading(false); }
    }, [fetcher]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => subscribeUserEvent?.("orders_changed", () => load()), [subscribeUserEvent, load]);

    return { orders, loading, error, reload: load };
}