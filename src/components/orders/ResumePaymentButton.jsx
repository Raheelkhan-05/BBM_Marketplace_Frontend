// src/components/orders/ResumePaymentButton.jsx
// Lets a buyer finish paying for an order that is still "awaiting_payment".
//  - standalone order  -> startOrderPayment(orderId)
//  - order in a cart   -> startGroupPayment(groupId)  (the backend refuses single-order payment for group orders)
// If starting the payment fails, the button stays and the buyer can tap it again.
import { useState, useEffect } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { startOrderPayment, startGroupPayment, redirectToGateway } from "../../utils/paymentsApi.js";

export default function ResumePaymentButton({ orderId, groupId = null, label = "Complete payment", className = "sh-btn go sm" }) {
    const { token } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Coming back with the browser's Back button can restore the page from the bfcache with the spinner stuck.
    useEffect(() => {
        const onShow = (e) => { if (e.persisted) setBusy(false); };
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    const pay = async () => {
        if (busy) return;
        setError(null);
        setBusy(true);
        let navigating = false;
        try {
            const res = groupId ? await startGroupPayment(token, groupId) : await startOrderPayment(token, orderId);
            if (!res?.success || !res.redirectUrl) {
                setError(res?.message || "Couldn't start the payment. Please try again.");
                return;
            }
            navigating = redirectToGateway(res.redirectUrl);
            if (!navigating) setError("Couldn't open the payment page. Please try again.");
        } catch {
            setError("Couldn't start the payment. Please try again.");
        } finally {
            // While the browser navigates to the gateway keep the spinner up.
            if (!navigating) setBusy(false);
        }
    };

    return (
        <div>
            <button type="button" className={className} onClick={pay} disabled={busy}>
                {busy ? <Loader2 size={16} className="sh-spin" /> : <CreditCard size={16} />}
                {busy ? "Opening payment…" : label}
            </button>
            {error && <p className="sh-err" role="alert" style={{ marginTop: 8 }}>{error}</p>}
        </div>
    );
}