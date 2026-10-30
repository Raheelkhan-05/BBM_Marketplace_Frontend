// src/utils/salesThreadApi.js: salesperson enquiry threads
import * as api from "./api.js";
const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, method = "GET", body, signal, params } = {}) {
    const qs = params
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString()
        : "";
    try {
        const res = await fetch(`${API_BASE}/sales/threads${path}${qs ? `?${qs}` : ""}`, {
            method, signal,
            headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON */ }
        return { ...data, status: res.status, success: res.ok && data?.success !== false };
    } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { success: false, status: 0, message: "Network error. Check your connection." };
    }
}

// status: "" | "open" | "won" | "lost"
export const fetchThreads = (token, { q, status, limit, offset, signal } = {}) => call("", { token, signal, params: { q, status, limit, offset } });
export const createThread = (token, payload) => call("", { token, method: "POST", body: payload });

// The company's product catalog (used to tag a product when starting an enquiry, and in the Punch order sheet).
//   gstin : a full GST number -> every product also carries that customer's last price and custom price
//   ids   : comma separated listing ids -> only those listings
export const fetchCatalogProducts = (token, { q, limit, offset, gstin, ids, signal } = {}) =>
    call("/products", { token, signal, params: { q, limit, offset, gstin, ids } });

// Thread entries are paged by cursor:
//   fetchThread(t, id, { limit })                      -> newest page
//   fetchThread(t, id, { before, beforeId, limit })    -> the page just older than that entry
//   fetchThread(t, id, { after })                      -> only what is new since that time (cheap refresh)
export const fetchThread = (token, id, { before, beforeId, after, limit, signal } = {}) =>
    call(`/${id}`, { token, signal, params: { before, beforeId, after, limit } });

export const updateThread = (token, id, payload) => call(`/${id}`, { token, method: "PATCH", body: payload });
// status: "open" (reopen) | "won" | "lost"
export const setThreadStatus = (token, id, status) => call(`/${id}/status`, { token, method: "PATCH", body: { status } });
export const addThreadEntry = (token, id, payload) => call(`/${id}/entries`, { token, method: "POST", body: payload });
export const fetchQuoteProducts = (token, id, { q, limit, offset, signal } = {}) => call(`/${id}/products`, { token, signal, params: { q, limit, offset } });
export const sendThreadQuote = (token, id, payload) => call(`/${id}/quotes`, { token, method: "POST", body: payload });
export const setThreadReminder = (token, id, reminderAt) => call(`/${id}/reminder`, { token, method: "PATCH", body: { reminderAt } });
export const resendThreadQuote = (token, id, quoteId, channels) => call(`/${id}/quotes/${quoteId}/resend`, { token, method: "POST", body: { channels } });
const signThreadFile = (token, id, file) => call(`/${id}/attachments/sign`, { token, method: "POST", body: { name: file.name, type: file.type, size: file.size } });

// Signed upload straight to private storage. Resolves { success, attachment } ready to send with an entry.
export async function uploadThreadFile(token, id, file) {
    const s = await signThreadFile(token, id, file);
    if (!s.success) return s;
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    try {
        const r = await fetch(s.uploadUrl, { method: "PUT", body: fd });
        if (!r.ok) return { success: false, message: "Upload failed. Please try again." };
    } catch {
        return { success: false, message: "Network error while uploading." };
    }
    return { success: true, attachment: { path: s.path, name: file.name, type: file.type || "", size: file.size } };
}