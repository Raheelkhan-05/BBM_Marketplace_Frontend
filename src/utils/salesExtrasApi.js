// List with the heat filter, heat update, and an entry post that always carries replyTo / duration.
import * as api from "./api.js";
const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, method = "GET", body, params, signal } = {}) {
    const qs = params
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString()
        : "";
    try {
        const res = await fetch(`${API_BASE}/sales${path}${qs ? `?${qs}` : ""}`, {
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

export const fetchThreadList = (token, { q, status, heat, limit, offset, signal } = {}) =>
    call("/threads", { token, signal, params: { q, status, heat, limit, offset } });
export const setThreadHeat = (token, id, heat) => call(`/threads/${id}/heat`, { token, method: "PATCH", body: { heat } });
export const postThreadEntry = (token, id, payload) => call(`/threads/${id}/entries`, { token, method: "POST", body: payload });