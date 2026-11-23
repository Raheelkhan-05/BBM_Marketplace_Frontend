// Opens the SAME transport card as the order page (OrderTransportPanel) in a modal, straight from the Transport pages.
// Everything (accept / decline / suggest another / withdraw, activity) works here and stays in sync with the order pages.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";
import OrderTransportPanel from "./OrderTransportPanel.jsx";
import "./transport-agreements.css";

export default function TransportDetailModal({ orderId, orderNumber, viewer, onClose, onChanged, onOpenOrder }) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }, [onClose]);

    const stop = (e) => e.stopPropagation();

    return createPortal(
        <div className="tdm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tdm" role="dialog" aria-modal="true" aria-label="Delivery transport">
                <div className="tdm-h">
                    <div className="tdm-ht">
                        <b>Delivery transport</b>
                        {orderNumber && <small>Order {orderNumber}</small>}
                    </div>
                    <button type="button" className="tdm-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="tdm-b" data-lenis-prevent onWheel={stop} onTouchMove={stop}>
                    <OrderTransportPanel orderId={orderId} viewer={viewer} onChanged={onChanged} />
                </div>
                {onOpenOrder && (
                    <div className="tdm-f">
                        <button type="button" className="tdm-link" onClick={onOpenOrder}>
                            <ExternalLink size={14} />View full order
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}