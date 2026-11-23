// Shown when the seller presses "Confirm order" while the buyer's transport suggestion is still unanswered.
// Delivery address + transport panel first, so the seller decides about transport BEFORE accepting the order.
import { useState } from "react";
import { Sheet } from "./ui.jsx";
import Ic from "./Ic.jsx";
import OrderTransportPanel from "../orders/OrderTransportPanel.jsx";
import DeliveryAddressCard from "../orders/DeliveryAddressCard.jsx";

export default function GrowTransportGateSheet({ order, onClose, onConfirm, onChanged }) {
    const [info, setInfo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const pending = !!(info?.active && info.active.proposed_by_role === "buyer");

    const confirm = async () => {
        setBusy(true); setError(null);
        let res = null;
        try { res = await onConfirm(); } catch { res = null; }
        setBusy(false);
        if (!res?.success) setError(res?.message || "Couldn't confirm the order.");
    };

    return (
        <Sheet title="Before you confirm" sub={order.order_number} onClose={busy ? undefined : onClose}>
            <DeliveryAddressCard order={order} viewer="seller" variant="grow" />
            <OrderTransportPanel orderId={order.id} viewer="seller" onLoaded={setInfo} onChanged={onChanged} />
            {pending && <p className="sx-err" role="note">Accept, decline or suggest another transport option to continue.</p>}
            {error && <p className="sx-err" role="alert">{error}</p>}
            <div className="sx-foot">
                <button type="button" className="bt go blk" disabled={busy || pending || !info} onClick={confirm}>
                    {busy ? <><Ic n="spin" />Confirming…</> : "Confirm order"}
                </button>
            </div>
        </Sheet>
    );
}