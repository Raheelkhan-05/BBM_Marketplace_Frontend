// hooks/useOrderTransportSummary.js
//
// Powers the transport tags on the order LIST pages (SaveOrdersPage = "buyer", GrowOrdersPage = "seller").
// One light request, refreshed live: whenever the order list is told something changed (socket "orders_changed"),
// when a transport notification arrives, and when the tab becomes visible again.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchOrderTransportSummary } from "../utils/api.transport.js";

export default function useOrderTransportSummary(as) {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [summary, setSummary] = useState({});
    const seq = useRef(0);

    const load = useCallback(async () => {
        if (!token) return;
        const my = ++seq.current; // ignore stale responses
        let res = null;
        try { res = await fetchOrderTransportSummary(as, token); } catch { res = null; }
        if (my !== seq.current) return;
        if (res?.success) setSummary(res.summary || {});
    }, [as, token]);

    const loadRef = useRef(load);
    useEffect(() => { loadRef.current = load; }, [load]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!socket) return undefined;
        const onChanged = () => loadRef.current();
        const onNotif = (p) => { if (String(p?.type || "").startsWith("order_transport_")) loadRef.current(); };
        socket.on("orders_changed", onChanged);
        socket.on("notification:new", onNotif);
        return () => { socket.off("orders_changed", onChanged); socket.off("notification:new", onNotif); };
    }, [socket]);

    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === "visible") loadRef.current(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    return { summary, reload: load };
}