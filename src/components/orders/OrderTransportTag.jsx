// components/orders/OrderTransportTag.jsx
// Small status tag for order LIST cards. variant="save" (buyer, sh- classes) | "grow" (seller, plain classes).
//   transport: entry from useOrderTransportSummary ({ state: "needs_you" | "waiting" | "declined" }) or undefined
//   nudge: show the soft "choose transport" prompt (buyer list: paid order with no transport yet)
import { Truck } from "lucide-react";

export default function OrderTransportTag({ variant = "save", viewer, transport, nudge = false }) {
    const other = viewer === "seller" ? "Buyer" : "Seller";
    let text = null;
    let tone = "";

    if (transport?.state === "needs_you") { text = `${other} suggested transport · reply needed`; tone = "o"; }
    else if (transport?.state === "waiting") { text = "Transport suggestion sent · waiting for reply"; tone = "b"; }
    else if (transport?.state === "declined") { text = `${other} declined your transport suggestion`; tone = "o"; }
    else if (nudge) { text = "Choose delivery transport (optional)"; tone = ""; }

    if (!text) return null;
    const wrap = variant === "grow" ? "tags" : "sh-tags";
    const tg = variant === "grow" ? "tg" : "sh-tg";
    return (
        <div className={wrap}>
            <span className={`${tg} ${tone}`.trim()}><Truck size={13} />{text}</span>
        </div>
    );
}