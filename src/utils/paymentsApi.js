// utils/paymentsApi.js
//
// Frontend side of the JioPay integration. API_BASE already ends in "/api" (see utils/api.js),
// so these paths map to /api/payments/... on the backend.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { apiGet, apiPost } from "./api.js";

// The buyer is sent to JioPay's hosted page; we remember where they were so the return page
// can send them back to the right place afterwards (wallet vs cart vs order).
const RETURN_KEY = "bbm_payment_return_to";

// Android app only: the payment that is open in the browser tab, so the app can check on it
// when the user switches back.
export const PENDING_PAYMENT_KEY = "bbm_pending_payment";
const PENDING_MAX_AGE_MS = 45 * 60 * 1000;
const LAUNCHER_PATH = "/pay-launch.html";

const expectedBody = (expectedTotal) =>
    expectedTotal != null && Number.isFinite(Number(expectedTotal)) ? { expectedTotal: Number(expectedTotal) } : {};

export const startOrderPayment = (token, orderId, expectedTotal = null) =>
    apiPost(`/payments/orders/${encodeURIComponent(orderId)}/checkout`, token, expectedBody(expectedTotal));

export const startGroupPayment = (token, groupId, expectedTotal = null) =>
    apiPost(`/payments/groups/${encodeURIComponent(groupId)}/checkout`, token, expectedBody(expectedTotal));

export const startWalletPayment = (token, amount) =>
    apiPost(`/payments/wallet/checkout`, token, { amount: String(amount) });

export const fetchPaymentStatus = (token, ref) =>
    apiGet(`/payments/attempts/${encodeURIComponent(ref)}`, token);

export function rememberPaymentReturnPath() {
    try { sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search); } catch { /* private mode */ }
}

// Only same-site absolute paths are ever returned (never "//host" or full URLs).
export function takePaymentReturnPath() {
    try {
        const v = sessionStorage.getItem(RETURN_KEY);
        return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
    } catch { return null; }
}

export function clearPendingPayment() {
    try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
}

export function readPendingPayment() {
    try {
        const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || Date.now() - Number(p.ts) > PENDING_MAX_AGE_MS) {
            clearPendingPayment();
            return null;
        }
        return p;
    } catch { return null; }
}

// Sends the buyer to the gateway. Returns false (and does nothing) unless the URL is https.
//   Website: navigates the whole window (as before).
//   Android app: opens the gateway in a Chrome Custom Tab via /pay-launch.html on our own domain,
//   so the gateway sees bbm.business as the referrer. Pass the checkout `ref` so the app can
//   check the payment when the user returns.
export function redirectToGateway(url, ref = null) {
    // url = "https://httpbin.org/headers"; // TEMP TEST, remove after
    try {
        if (new URL(url).protocol !== "https:") return false;
    } catch { return false; }
    rememberPaymentReturnPath();

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Browser")) {
        try { localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ ref, ts: Date.now() })); } catch { /* ignore */ }
        const launcher = `${window.location.origin}${LAUNCHER_PATH}?u=${encodeURIComponent(url)}`;
        Browser.open({ url: launcher }).catch(() => {
            clearPendingPayment();
            window.location.assign(url);
        });
        return true;
    }

    window.location.assign(url);
    return true;
}