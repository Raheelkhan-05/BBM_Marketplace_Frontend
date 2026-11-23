// Pre-payment "Delivery transport" step (buyer). Wraps OrderTransportPanel, one per order, so what is shown here is the
// SAME live data as the order page (agreed transport + when it was agreed, suggest a change, activity).
//   <TransportAgreementStep embedded orderIds={[id]} .../>   inside BuyNowModal
//   <TransportAgreementModal groupId={gid} .../>              cart checkout (one card per seller)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Truck, X, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchGroupTransport } from "../../utils/api.transport.js";
import OrderTransportPanel from "./OrderTransportPanel.jsx";
import "./transport-step.css";

export function TransportAgreementStep({
    orderIds = null, groupId = null, continueLabel = "Continue to payment", backLabel = "Not now",
    onContinue, onBack, busy = false, error = null, embedded = false,
}) {
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const idsKey = (orderIds || []).join(",");

    useEffect(() => {
        if (!groupId) { setItems((orderIds || []).map((id) => ({ orderId: id }))); setLoading(false); return undefined; }
        let cancelled = false;
        setLoading(true);
        fetchGroupTransport(groupId, token).then((res) => {
            if (cancelled) return;
            if (res?.success) setItems((res.orders || []).map((o) => ({ orderId: o.orderId, title: o.sellerName, number: o.orderNumber })));
            else setLoadFailed(true);
            setLoading(false);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, idsKey, token]);

    const stop = (e) => e.stopPropagation();
    return (
        <div className={`ts${embedded ? " in" : ""}`} role="dialog" aria-modal="true" aria-label="Delivery transport">
            <header className="ts-h">
                <span className="ts-ic"><Truck size={18} /></span>
                <div className="ts-ht">
                    <h2>Delivery transport</h2>
                    <p>
                        Check how your order will be delivered <b>before you pay</b>. If you and the seller already agreed a transport
                        for this route, it is shown here. You can suggest a change; the seller reviews it before confirming your order.
                    </p>
                </div>
                {onBack && <button type="button" className="ts-x" aria-label="Close" disabled={busy} onClick={onBack}><X size={18} /></button>}
            </header>

            <div className="ts-b" data-lenis-prevent onWheel={stop} onTouchMove={stop}>
                {loading ? <div className="ts-sk" aria-busy="true" />
                    : loadFailed ? <p className="ts-note">Couldn't load the transport details. You can still continue and agree transport later from your order.</p>
                        : items.map((it) => (
                            <div key={it.orderId} className="ts-it">
                                {items.length > 1 && <h3 className="ts-sel">{it.title || "Seller"}{it.number ? ` · ${it.number}` : ""}</h3>}
                                <OrderTransportPanel orderId={it.orderId} viewer="buyer" />
                            </div>
                        ))}
                <p className="ts-note">Transport is optional. You can also change it later from the order page until the seller ships.</p>
            </div>

            <footer className="ts-f">
                {error && <p className="ot-err" role="alert">{error}</p>}
                <button type="button" className="ts-go" disabled={busy || loading} onClick={onContinue}>
                    {busy ? <Loader2 size={18} className="ot-spin" /> : <>{continueLabel}<ArrowRight size={16} /></>}
                </button>
                {/* {onBack && <button type="button" className="ts-back" disabled={busy} onClick={onBack}>{backLabel}</button>} */}
            </footer>
        </div>
    );
}

export default function TransportAgreementModal(props) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, []);
    return createPortal(<div className="ts-ov"><TransportAgreementStep {...props} /></div>, document.body);
}