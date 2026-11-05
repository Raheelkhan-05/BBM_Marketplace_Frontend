// src/hooks/useSalesUnread.js
// Unread summary for the signed-in salesperson: { threads, unread, mentions }.
// Updates the moment a chat message or read happens (socket), when the tab regains focus, and on a light poll.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchUnreadSummary } from "../utils/salesThreadApi.js";

const EMPTY = { threads: 0, unread: 0, mentions: 0 };
const EVENTS = ["salesChat:message", "salesChat:read", "salesChat:participants", "rfq_quotes_changed", "connect"];

export default function useSalesUnread(token, enabled = true, interval = 30000) {
    const { socket } = useSocket() || {};
    const [state, setState] = useState(EMPTY);
    const alive = useRef(true);

    const load = useCallback(async () => {
        if (!token || !enabled) return;
        const r = await fetchUnreadSummary(token);
        if (!r.success || !alive.current) return;
        const next = { threads: r.threads || 0, unread: r.unread || 0, mentions: r.mentions || 0 };
        setState((p) => (p.threads === next.threads && p.unread === next.unread && p.mentions === next.mentions ? p : next));
    }, [token, enabled]);

    useEffect(() => {
        alive.current = true;
        load();
        return () => { alive.current = false; };
    }, [load]);

    useEffect(() => {
        if (!token || !enabled) return undefined;
        let t;
        const fire = () => { clearTimeout(t); t = setTimeout(load, 400); };
        const onVis = () => { if (document.visibilityState === "visible") fire(); };
        const poll = setInterval(() => { if (document.visibilityState === "visible") fire(); }, interval);
        EVENTS.forEach((e) => socket?.on(e, fire));
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("focus", fire);
        return () => {
            clearTimeout(t);
            clearInterval(poll);
            EVENTS.forEach((e) => socket?.off(e, fire));
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("focus", fire);
        };
    }, [socket, token, enabled, interval, load]);

    return { ...state, refresh: load };
}