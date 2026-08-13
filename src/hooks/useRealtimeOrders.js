import { useEffect, useCallback, useState } from "react";
import { supabase } from "../utils/supabaseClient.js";

export default function useRealtimeOrders({ channelToken, fetcher }) {
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

    useEffect(() => {
        if (!channelToken) return;
        const channel = supabase
            .channel(`user-${channelToken}`)
            .on("broadcast", { event: "orders_changed" }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [channelToken, load]);

    return { orders, loading, error, reload: load };
}