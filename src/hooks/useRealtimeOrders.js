import { useEffect, useCallback, useState } from "react";
import { supabase } from "../utils/supabaseClient.js";

// Any change to this user's orders (new order, status update) simply
// re-runs the currently-filtered query — simpler and safer than hand-
// patching a locally filtered list, and the user still never refreshes.
export default function useRealtimeOrders({ role, ownerId, fetcher }) {
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
        if (!ownerId) return;
        const column = role === "seller" ? "seller_id" : "buyer_id";
        const channel = supabase
            .channel(`orders-${role}-${ownerId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `${column}=eq.${ownerId}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [role, ownerId, load]);

    return { orders, loading, error, reload: load };
}