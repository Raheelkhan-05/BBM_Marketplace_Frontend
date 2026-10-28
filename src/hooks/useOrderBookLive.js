// src/hooks/useOrderBookLive.js
// Silent refetch on: server ping ("orderbook:changed"), socket reconnect, tab focus, and a light poll while visible.
// Bursts are merged into one call. No spinner, no page refresh.
import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext.jsx";

export default function useOrderBookLive(refresh, { enabled = true, interval = 45000 } = {}) {
    const { socket, connected } = useSocket();
    const ref = useRef(refresh); ref.current = refresh;
    const timer = useRef(null);

    useEffect(() => {
        if (!enabled) return undefined;
        const fire = () => { clearTimeout(timer.current); timer.current = setTimeout(() => ref.current?.(), 200); };
        const onVis = () => { if (document.visibilityState === "visible") fire(); };
        const poll = setInterval(() => { if (document.visibilityState === "visible") fire(); }, interval);
        socket?.on("orderbook:changed", fire);
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("focus", fire);
        window.addEventListener("online", fire);
        return () => {
            clearTimeout(timer.current); clearInterval(poll);
            socket?.off("orderbook:changed", fire);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("focus", fire);
            window.removeEventListener("online", fire);
        };
    }, [socket, enabled, interval]);

    const prev = useRef(connected);
    useEffect(() => { if (enabled && connected && !prev.current) ref.current?.(); prev.current = connected; }, [connected, enabled]);
}