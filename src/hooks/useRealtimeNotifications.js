import { useEffect, useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchNotifications, markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from "../utils/api.js";

export default function useRealtimeNotifications({ token }) {
    const { subscribeUserEvent } = useAuth();
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

    useEffect(() => {
        return subscribeUserEvent("new_notification", (payload) => {
            setNotifications((prev) => [payload, ...prev]);
        });
    }, [subscribeUserEvent]);

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