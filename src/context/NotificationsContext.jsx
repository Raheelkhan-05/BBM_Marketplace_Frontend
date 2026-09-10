// context/NotificationsContext.jsx
//
// Single source of truth for notifications, shared by NotificationBell,
// the "My Orders" nav badge (Header + BottomNavStrip), the Purchase/Sales
// tab counts on OrdersPage, and OrderNotificationToast — so there's one
// fetch + one socket subscription instead of each of those re-doing it.
//
// Notifications are split into two buckets by LINK (see
// utils/notificationTypes.js for why link and not `type`):
//   - "order" notifications (purchase + sales) never appear in the bell,
//     and toast from the center of the screen (OrderNotificationToast).
//   - everything else stays in the bell dropdown and keeps the existing
//     bell-origin toast (NotificationIsland).
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";
import { fetchNotifications, markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from "../utils/api.js";
import { playNotificationSound } from "../utils/notificationSound.js";
import { isOrderNotification, isPurchaseOrderNotification, isSalesOrderNotification, orderIdFromLink, isChatNotification } from "../utils/notificationTypes.js";

const NotificationsContext = createContext(null);

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
    return ctx;
}

export function NotificationsProvider({ children }) {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // Callback registries for "a new notification of this kind just
    // arrived" — NotificationBell subscribes to non-order, and
    // OrderNotificationToast subscribes to order, so each can run its own
    // one-at-a-time toast queue without both listening to the raw socket.
    const nonOrderListenersRef = useRef(new Set());
    const orderListenersRef = useRef(new Set());
    const chatListenersRef = useRef(new Set());

    const load = useCallback(async () => {
        if (!token) { setNotifications([]); setLoading(false); return; }
        setLoading(true);
        const res = await fetchNotifications(token);
        if (res?.success) setNotifications(res.notifications || []);
        setLoading(false);
    }, [token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket) return;
        const onNotif = (payload) => {
            if (!payload?.id) return;
            // Chat has its own unread system (ChatContext, driven by message
            // read-watermarks) and never enters the bell dropdown or its list —
            // but it still needs to fire a toast, so route it to its own
            // listener bucket instead of silently dropping it.
            if (isChatNotification(payload)) {
                chatListenersRef.current.forEach((cb) => cb(payload));
                return;
            }
            setNotifications((prev) => (prev.some((n) => n.id === payload.id) ? prev : [payload, ...prev]));
            playNotificationSound();
            const targets = isOrderNotification(payload) ? orderListenersRef.current : nonOrderListenersRef.current;
            targets.forEach((cb) => cb(payload));
        };
        socket.on("notification:new", onNotif);
        return () => socket.off("notification:new", onNotif);
    }, [socket]);

    const subscribeChat = useCallback((cb) => {
        chatListenersRef.current.add(cb);
        return () => chatListenersRef.current.delete(cb);
    }, []);

    const subscribeNonOrder = useCallback((cb) => {
        nonOrderListenersRef.current.add(cb);
        return () => nonOrderListenersRef.current.delete(cb);
    }, []);
    const subscribeOrder = useCallback((cb) => {
        orderListenersRef.current.add(cb);
        return () => orderListenersRef.current.delete(cb);
    }, []);

    const markRead = useCallback(async (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        await apiMarkRead(token, id);
    }, [token]);

    const markAllRead = useCallback(async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        await apiMarkAllRead(token);
    }, [token]);

    // Marks every unread notification pointing at this order as read —
    // called by OrderDetailPage / SellerOrderDetailPage on open. An order
    // can accumulate several notifications with the SAME link over its
    // lifecycle (confirmed, shipped, delivered all reuse "/orders/:id"),
    // so this clears all of them at once, not just one.
    const markOrderRead = useCallback(async (orderId, role) => {
        if (!orderId) return;
        const expectedLink = role === "seller" ? `/seller/orders/${orderId}` : `/orders/${orderId}`;
        const toMark = notifications.filter((n) => !n.read && n.link === expectedLink);
        if (toMark.length === 0) return;
        setNotifications((prev) => prev.map((n) => (n.link === expectedLink ? { ...n, read: true } : n)));
        await Promise.all(toMark.map((n) => apiMarkRead(token, n.id)));
    }, [notifications, token]);

    // bellNotifications memo — exclude chat too, in case any pre-existing
    // "message" notifications are already sitting in the DB from before this change
    const bellNotifications = useMemo(
        () => notifications.filter((n) => !isOrderNotification(n) && !isChatNotification(n)),
        [notifications]
    );

    const bellUnreadCount = useMemo(() => bellNotifications.filter((n) => !n.read).length, [bellNotifications]);
    const purchaseUnreadCount = useMemo(
        () => notifications.filter((n) => isPurchaseOrderNotification(n) && !n.read).length,
        [notifications]
    );
    const salesUnreadCount = useMemo(
        () => notifications.filter((n) => isSalesOrderNotification(n) && !n.read).length,
        [notifications]
    );

    const purchaseOrderUnreadCounts = useMemo(() => {
        const map = new Map();
        for (const n of notifications) {
            if (n.read || !isPurchaseOrderNotification(n)) continue;
            const oid = orderIdFromLink(n.link);
            if (oid) map.set(oid, (map.get(oid) || 0) + 1);
        }
        return map;
    }, [notifications]);

    const salesOrderUnreadCounts = useMemo(() => {
        const map = new Map();
        for (const n of notifications) {
            if (n.read || !isSalesOrderNotification(n)) continue;
            const oid = orderIdFromLink(n.link);
            if (oid) map.set(oid, (map.get(oid) || 0) + 1);
        }
        return map;
    }, [notifications]);


    const orderUnreadCount = purchaseUnreadCount + salesUnreadCount;

    const value = {
        notifications, loading, reload: load,
        bellNotifications, bellUnreadCount,
        purchaseUnreadCount, salesUnreadCount, orderUnreadCount,
        purchaseOrderUnreadCounts, salesOrderUnreadCounts, // NEW
        markRead, markAllRead, markOrderRead,
        subscribeNonOrder, subscribeOrder, subscribeChat,
    };

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}