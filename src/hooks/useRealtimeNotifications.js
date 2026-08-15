import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchNotifications, markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from "../utils/api.js";

export default function useRealtimeNotifications({ token, onNewNotification }) {
    const { subscribeUserEvent, registerResyncHandler } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        const res = await fetchNotifications(token);
        if (res?.success) setNotifications(res.notifications || []);
        setLoading(false);
    }, [token]);

    useEffect(() => { load(); }, [load]);

    // Keep the latest callback in a ref so this subscription effect doesn't
    // need to re-run (and re-subscribe to the channel) every time the caller
    // re-renders with a fresh inline function.
    const onNewRef = useRef(onNewNotification);
    useEffect(() => { onNewRef.current = onNewNotification; }, [onNewNotification]);

    useEffect(() => {
        return subscribeUserEvent("new_notification", (payload) => {
            setNotifications((prev) => {
                if (payload?.id && prev.some((n) => n.id === payload.id)) return prev;
                return [payload, ...prev];
            });
            onNewRef.current?.(payload);
        });
    }, [subscribeUserEvent]);

    useEffect(() => {
        return registerResyncHandler(load);
    }, [registerResyncHandler, load]);

    const markRead = async (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        await apiMarkRead(token, id);
    };
    const markAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        await apiMarkAllRead(token);
    };

    return { notifications, unreadCount: notifications.filter((n) => !n.read).length, loading, markRead, markAllRead, reload: load };
}