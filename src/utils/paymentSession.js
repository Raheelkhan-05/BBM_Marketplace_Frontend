// utils/paymentSession.js
//
// Persists the buyer's "mid-payment" state (which order they're paying for,
// the UPI details, and an in-progress UTR draft) across page refreshes and
// app-switches (buyer leaves to their UPI app, comes back). Backed by
// localStorage rather than sessionStorage specifically because on mobile,
// switching to a UPI app and back can sometimes cost the tab its
// sessionStorage depending on OS/browser, whereas localStorage always
// survives.
//
// Deliberately a SINGLE global session, not one per order — a buyer can
// only realistically be mid-payment on one order at a time, and keying by
// a single slot also means an abandoned session for order A doesn't
// quietly leak forward and confuse order B later.

const STORAGE_KEY = "bbm_pending_payment";
export const PAYMENT_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function savePaymentSession({ orderId, orderNumber, amount, vpa, payeeName, note, upiUri, utrDraft }) {
    const existing = loadPaymentSession(orderId);
    const session = {
        orderId, orderNumber, amount, vpa, payeeName, note, upiUri,
        utrDraft: utrDraft ?? existing?.utrDraft ?? "",
        // Preserve the original startedAt when we're just refreshing fields
        // for the SAME order/session — only a brand new order, or an
        // explicit resetPaymentSession() call, should restart the clock.
        startedAt: existing?.orderId === orderId ? existing.startedAt : Date.now(),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // localStorage can throw in private-browsing / quota-exceeded edge
        // cases — payment still works, it just won't survive a refresh.
    }
    return session;
}

// Starts (or restarts) the 10-minute window fresh — used once the previous
// window has expired and the buyer explicitly asks to try again.
export function resetPaymentSession(fields) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    return savePaymentSession(fields);
}

// Lightweight update for just the UTR draft, so a half-typed reference
// number survives an app-switch even before the buyer hits submit.
export function updateUtrDraft(orderId, utrDraft) {
    const existing = loadPaymentSession(orderId);
    if (!existing) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, utrDraft }));
    } catch { /* noop */ }
}

// Returns the stored session only if it matches the given orderId (when
// provided) and hasn't expired yet — otherwise null. Call with no orderId
// to just check "is there anything at all to resume?" (used at app root).
export function loadPaymentSession(orderId) {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;

    let session;
    try {
        session = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!session?.orderId || !session?.startedAt) return null;
    if (orderId && session.orderId !== orderId) return null;
    if (Date.now() - session.startedAt > PAYMENT_SESSION_TTL_MS) return null;

    return session;
}

export function clearPaymentSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function msRemaining(session) {
    if (!session) return 0;
    return Math.max(0, PAYMENT_SESSION_TTL_MS - (Date.now() - session.startedAt));
}