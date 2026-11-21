// src/utils/impersonation.js
// Impersonation lives in sessionStorage (this tab only), so it never overwrites a real login in localStorage.
import { API_BASE } from "./api.js";

export const IMP_TOKEN_KEY = "bbm_imp_token";
export const IMP_META_KEY = "bbm_imp_meta";

export function clearImpersonation() {
    try { sessionStorage.removeItem(IMP_TOKEN_KEY); sessionStorage.removeItem(IMP_META_KEY); } catch { /* private mode */ }
}

export function saveImpersonation(token, meta) {
    try {
        sessionStorage.setItem(IMP_TOKEN_KEY, token);
        sessionStorage.setItem(IMP_META_KEY, JSON.stringify(meta || {}));
    } catch { /* private mode */ }
}

// { token, meta } while a valid (unexpired) admin session is stored in this tab, else null.
export function readImpersonation() {
    if (typeof window === "undefined") return null;
    try {
        const token = sessionStorage.getItem(IMP_TOKEN_KEY);
        const raw = sessionStorage.getItem(IMP_META_KEY);
        if (!token || !raw) return null;
        const meta = JSON.parse(raw);
        if (!meta?.expiresAt || new Date(meta.expiresAt).getTime() <= Date.now()) { clearImpersonation(); return null; }
        return { token, meta };
    } catch {
        return null;
    }
}

// Wipes the admin session from this tab and hard-reloads, so the app boots with whatever real login exists.
export function leaveImpersonation(path = "/home") {
    clearImpersonation();
    window.location.replace(path);
}

async function call(path, options) {
    try {
        const res = await fetch(`${API_BASE}${path}`, options);
        const data = await res.json().catch(() => null);
        return { ...(data && typeof data === "object" ? data : {}), status: res.status, success: res.ok && data?.success !== false };
    } catch {
        return { success: false, status: 0, message: "Couldn't reach the server. Check your connection." };
    }
}

export const exchangeImpersonationCode = (code) =>
    call("/impersonation/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });

export const fetchImpersonationStatus = (token) =>
    call("/impersonation/current", { headers: { Authorization: `Bearer ${token}` } });

export const endImpersonationSession = (token) =>
    call("/impersonation/end", { method: "POST", headers: { Authorization: `Bearer ${token}` } });