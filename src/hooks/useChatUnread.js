// src/hooks/useChatUnread.js
// Unread chat counts for the signed-in person: { total, byThread: { [id]: { unread, mentions } }, threads, refresh }.
// Refetches (debounced) on every live chat event, so badges move the moment a message lands.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchChatUnread } from "../utils/salesChatApi.js";

const EMPTY = { total: 0, byThread: {}, threads: 0 };

export default function useChatUnread(token, enabled = true) {
    const { socket } = useSocket() || {};
    const [state, setState] = useState(EMPTY);
    const alive = useRef(true);
    const timer = useRef(null);

    const load = useCallback(async () => {
        if (!token || !enabled) return;
        const r = await fetchChatUnread(token);
        if (r.success && alive.current) setState({ total: r.total || 0, byThread: r.byThread || {}, threads: r.threads || 0 });
    }, [token, enabled]);

    useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);

    useEffect(() => {
        if (!socket || !enabled) return undefined;
        const fire = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 350); };
        const events = ["salesChat:message", "salesChat:read", "salesChat:participants", "connect"];
        events.forEach((e) => socket.on(e, fire));
        return () => { clearTimeout(timer.current); events.forEach((e) => socket.off(e, fire)); };
    }, [socket, enabled, load]);

    return { ...state, refresh: load };
}