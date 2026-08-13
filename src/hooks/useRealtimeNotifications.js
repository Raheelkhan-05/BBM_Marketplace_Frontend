import { useEffect, useCallback, useState } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchNotifications, markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from "../utils/api.js";

export default function useRealtimeNotifications({ token, channelToken }) {
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
        if (!channelToken) return;
        const channel = supabase
            .channel(`user-${channelToken}`)
            .on("broadcast", { event: "new_notification" }, ({ payload }) => setNotifications((prev) => [payload, ...prev]))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [channelToken]);

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