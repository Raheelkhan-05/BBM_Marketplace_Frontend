// src/components/analytics/ConsentBanner.jsx
import { useEffect, useState } from "react";
import { analyticsEnabled, getConsent, grantConsent, denyConsent } from "../../lib/analytics.js";

export default function ConsentBanner() {
    const [status, setStatus] = useState(() => getConsent());
    const [forceOpen, setForceOpen] = useState(false);

    // Any "Cookie settings" link can reopen the banner with:
    // window.dispatchEvent(new Event("bbm:open-consent"))
    useEffect(() => {
        const open = () => { setStatus(getConsent()); setForceOpen(true); };
        window.addEventListener("bbm:open-consent", open);
        return () => window.removeEventListener("bbm:open-consent", open);
    }, []);

    if (!analyticsEnabled) return null;
    if (status !== "pending" && !forceOpen) return null;

    const choose = (accept) => {
        if (accept) grantConsent(); else denyConsent();
        setStatus(getConsent());
        setForceOpen(false);
    };

    return (
        <div
            role="dialog"
            aria-label="Analytics consent"
            style={{
                // Top, not bottom: the bottom is taken by the dock and the sticky checkout bar.
                position: "fixed", left: 12, right: 12,
                top: "calc(env(safe-area-inset-top, 0px) + 12px)",
                zIndex: 9999, maxWidth: 520, margin: "0 auto",
                background: "#fff", color: "#111", border: "1px solid #e5e7eb",
                borderRadius: 14, padding: 14, boxShadow: "0 8px 30px rgba(0,0,0,.15)",
                fontSize: 13, lineHeight: 1.45,
            }}
        >
            <div style={{ marginBottom: 10 }}>
                We use analytics and session recordings to understand how the site is used and improve it.
                Passwords and payment details are never recorded. See our{" "}
                <a href="/privacy-policy" style={{ textDecoration: "underline" }}>Privacy Policy</a>.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                    type="button" onClick={() => choose(false)}
                    style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
                >
                    Decline
                </button>
                <button
                    type="button" onClick={() => choose(true)}
                    style={{ padding: "8px 14px", borderRadius: 10, border: 0, background: "#111", color: "#fff", cursor: "pointer" }}
                >
                    Accept
                </button>
            </div>
        </div>
    );
}