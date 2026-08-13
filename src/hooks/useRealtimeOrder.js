import { useEffect, useCallback, useState } from "react";
import { supabase } from "../utils/supabaseClient.js";

export default function useRealtimeOrder({ orderId, fetcher }) {
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

    // Both buyer and seller land on the same order-scoped channel, regardless
    // of role — the UUID itself is the access boundary here, same idea as
    // channelToken but scoped to one order instead of one user.
    useEffect(() => {
        if (!orderId) return;
        const channel = supabase
            .channel(`order-${orderId}`)
            .on("broadcast", { event: "order_updated" }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [orderId, load]);

    return { order, events, loading, reload: load };
}