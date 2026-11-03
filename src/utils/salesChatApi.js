// src/utils/salesChatApi.js: enquiry group chat (salesperson, admin, added team members)
import * as api from "./api.js";
const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, method = "GET", body, params, signal } = {}) {
    const qs = params
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString()
        : "";
    try {
        const res = await fetch(`${API_BASE}/sales-chat${path}${qs ? `?${qs}` : ""}`, {
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

export const fetchChatUnread = (token) => call("/unread", { token });
export const fetchChatInbox = (token) => call("/threads", { token });
// { limit, before, beforeId }
export const fetchChatThread = (token, id, params = {}) => call(`/threads/${id}`, { token, params });
export const fetchChatParticipants = (token, id) => call(`/threads/${id}/participants`, { token });
export const fetchChatCandidates = (token, id) => call(`/threads/${id}/candidates`, { token });
// payload: { body, mentions: [userId], attachments: [...] }
export const postChatMessage = (token, id, payload) => call(`/threads/${id}/messages`, { token, method: "POST", body: payload });
export const markChatRead = (token, id) => call(`/threads/${id}/read`, { token, method: "POST", body: {} });
export const addChatParticipant = (token, id, userId) => call(`/threads/${id}/participants`, { token, method: "POST", body: { userId } });
export const removeChatParticipant = (token, id, userId) => call(`/threads/${id}/participants/${userId}`, { token, method: "DELETE" });

// Signed upload straight to private storage. Resolves { success, attachment }.
export async function uploadChatFile(token, id, file) {
    const s = await call(`/threads/${id}/attachments/sign`, { token, method: "POST", body: { name: file.name, type: file.type, size: file.size } });
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