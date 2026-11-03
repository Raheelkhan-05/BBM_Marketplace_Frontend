// src/hooks/useChatSocket.js
// Live events for ONE enquiry chat: new messages, people added / removed, and who is typing.
//   const chat = useChatSocket(threadId, { onMessage, onParticipants, onReconnect });
//   chat.typingNames -> ["Rahul"]   chat.emitTyping(true | false)
// The server only sends typing events when more than one person can see the thread, so nothing shows for a solo chat.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";

const TYPING_TTL = 4500;   // a typing label disappears by itself if no new event arrives
const SEND_EVERY = 2500;   // we re-announce at most this often while someone keeps typing

export default function useChatSocket(threadId, handlers = {}) {
    const { socket } = useSocket() || {};
    const h = useRef(handlers); h.current = handlers;
    const [typing, setTyping] = useState({});
    const timers = useRef(new Map());
    const lastSent = useRef(0);

    const drop = useCallback((uid) => {
        clearTimeout(timers.current.get(uid));
        timers.current.delete(uid);
        setTyping((p) => { if (!(uid in p)) return p; const n = { ...p }; delete n[uid]; return n; });
    }, []);

    useEffect(() => {
        if (!socket || !threadId) return undefined;
        const onMsg = (p) => { if (p?.threadId !== threadId) return; drop(p.senderId); h.current.onMessage?.(p); };
        const onTyp = (p) => {
            if (p?.threadId !== threadId || !p.userId) return;
            if (h.current.selfId && p.userId === h.current.selfId) return;   // never show my own typing to me
            if (p.typing === false) { drop(p.userId); return; }
            setTyping((prev) => ({ ...prev, [p.userId]: p.name || "Someone" }));
            clearTimeout(timers.current.get(p.userId));
            timers.current.set(p.userId, setTimeout(() => drop(p.userId), TYPING_TTL));
        };
        const onPeople = (p) => { if (p?.threadId === threadId) h.current.onParticipants?.(p); };
        const onConn = () => h.current.onReconnect?.();
        socket.on("salesChat:message", onMsg);
        socket.on("salesChat:typing", onTyp);
        socket.on("salesChat:participants", onPeople);
        socket.on("connect", onConn);
        const live = timers.current;
        return () => {
            socket.off("salesChat:message", onMsg);
            socket.off("salesChat:typing", onTyp);
            socket.off("salesChat:participants", onPeople);
            socket.off("connect", onConn);
            live.forEach((t) => clearTimeout(t));
            live.clear();
            setTyping({});
        };
    }, [socket, threadId, drop]);

    const emitTyping = useCallback((on = true) => {
        if (!socket || !threadId) return;
        const now = Date.now();
        if (on && now - lastSent.current < SEND_EVERY) return;
        if (!on && !lastSent.current) return;
        lastSent.current = on ? now : 0;
        socket.emit("salesChat:typing", { threadId, typing: on });
    }, [socket, threadId]);

    useEffect(() => () => { if (lastSent.current && socket && threadId) socket.emit("salesChat:typing", { threadId, typing: false }); }, [socket, threadId]);

    return { typingNames: Object.values(typing), emitTyping };
}