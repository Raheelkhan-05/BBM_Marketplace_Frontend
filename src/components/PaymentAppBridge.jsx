import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchPaymentStatus, readPendingPayment, clearPendingPayment } from "../utils/paymentsApi.js";

// Renders nothing. Android app only. Brings the buyer back to the payment result page:
//   1) when the app is opened by the deep link  com.bbm.marketplace://payment/return?...
//   2) when the user simply switches back to the app and the pending payment has a final result
export default function PaymentAppBridge() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const tokenRef = useRef(token);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("App")) return;

        let cancelled = false;
        const handles = [];

        const goToReturn = (search) => {
            clearPendingPayment();
            Browser.close().catch(() => { /* not supported everywhere; harmless */ });
            navigate(`/payment/return${search || ""}`, { replace: true });
        };

        const listen = async (event, fn) => {
            try {
                const h = await CapApp.addListener(event, fn);
                if (cancelled) h.remove();
                else handles.push(h);
            } catch { /* plugin missing in an older APK */ }
        };

        listen("appUrlOpen", ({ url }) => {
            const m = /^[a-z0-9.+-]+:\/\/payment\/return(\?[^#]*)?/i.exec(url || "");
            if (m) goToReturn(m[1] || "");
        });

        let checking = false;
        listen("appStateChange", async ({ isActive }) => {
            if (!isActive || checking) return;
            const pending = readPendingPayment();
            const authToken = tokenRef.current;
            if (!pending?.ref || !authToken) return;
            checking = true;
            try {
                const res = await fetchPaymentStatus(authToken, pending.ref);
                const s = res?.payment;
                if (s?.final) goToReturn(`?ref=${encodeURIComponent(pending.ref)}`);

            } catch { /* ignore; the user can still use My orders */ } finally {
                checking = false;
            }
        });

        return () => {
            cancelled = true;
            handles.forEach((h) => h.remove());
        };
    }, [navigate]);

    return null;
}