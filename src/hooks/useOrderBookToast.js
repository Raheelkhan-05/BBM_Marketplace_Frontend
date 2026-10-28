// src/hooks/useOrderBookToast.js
// Shows a toast (and plays the notification sound) when something happens in the Order Book.
//   mode "team":  a salesperson punched a new order
//   mode "sales": the team moved one of MY orders forward (the server marks those events with mine: true)
// Call it once in the layout, next to `say`.
import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { playNotificationSound } from "../utils/notificationSound.js";

const WORDS = { processed: "is being processed", shipped: "has been shipped", completed: "is completed", cancelled: "was cancelled" };

export default function useOrderBookToast(say, mode) {
    const { socket } = useSocket();
    const sayRef = useRef(say); sayRef.current = say;
    useEffect(() => {
        if (!socket) return undefined;
        const on = (p) => {
            if (!p) return;
            if (mode === "team" && p.kind === "created") {
                playNotificationSound();
                sayRef.current(`New order ${p.orderNo} from ${p.customer}`);
            } else if (mode === "sales" && p.mine && WORDS[p.kind]) {
                playNotificationSound();
                sayRef.current(`Order ${p.orderNo} ${WORDS[p.kind]}`);
            }
        };
        socket.on("orderbook:changed", on);
        return () => socket.off("orderbook:changed", on);
    }, [socket, mode]);
}