import { useEffect, useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchNotifications, markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from "../utils/api.js";

export default function useRealtimeNotifications({ token }) {
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

    // Single delivery path: AuthContext owns the one realtime channel for
    // this user and forwards "new_notification" broadcasts here. Do NOT
    // open a second supabase.channel() for the same topic — that's what
    // caused every notification (including order ones) to show twice.
    useEffect(() => {
        return subscribeUserEvent("new_notification", (payload) => {
            setNotifications((prev) => {
                if (payload?.id && prev.some((n) => n.id === payload.id)) return prev;
                return [payload, ...prev];
            });
        });
    }, [subscribeUserEvent]);

    // Safety net: if the socket dropped and came back (or the tab regained
    // focus), refetch once so anything missed while disconnected shows up
    // without needing a manual page refresh.
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