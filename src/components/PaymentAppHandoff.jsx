import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const APP_SCHEME = "com.bbm.marketplace";
const FLAG = "bbm_app_payment"; // set by /pay-launch.html

// Renders nothing normally. When the payment return page opens in the phone's browser for a payment
// that started in the Android app, it tries to jump back into the app and shows a "Return to BBM app" button.
export default function PaymentAppHandoff() {
    const { pathname, search } = useLocation();
    const [open, setOpen] = useState(false);
    const deepLink = `${APP_SCHEME}://payment/return${search}`;

    useEffect(() => {
        if (pathname !== "/payment/return" || Capacitor.isNativePlatform()) {
            setOpen(false);
            return;
        }
        let flagged = false;
        try { flagged = sessionStorage.getItem(FLAG) === "1"; } catch { /* ignore */ }
        if (!flagged) return;
        setOpen(true);
        window.location.href = deepLink; // best effort; the button below is the reliable path
    }, [pathname, deepLink]);

    if (!open) return null;

    const dismiss = () => {
        try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
        setOpen(false);
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 9999, background: "#fff", color: "#08222B",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 14, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif",
            }}
        >
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Payment step complete</h2>
            <p style={{ margin: 0, color: "#52686F", maxWidth: 320 }}>
                Go back to the BBM app to see your payment result.
            </p>
            <a
                href={deepLink}
                onClick={dismiss}
                style={{
                    marginTop: 6, background: "#FFD60A", color: "#08222B", fontWeight: 800, fontSize: 16,
                    padding: "14px 28px", borderRadius: 14, textDecoration: "none",
                }}
            >
                Return to BBM app
            </a>
            <button
                type="button"
                onClick={dismiss}
                style={{ background: "none", border: 0, color: "#1E78D6", fontWeight: 700, fontSize: 14, padding: 8 }}
            >
                Continue in browser instead
            </button>
        </div>
    );
}