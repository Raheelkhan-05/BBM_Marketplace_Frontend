// src/utils/salesMonitorApi.js: team admin's Sales monitor
import * as api from "./api.js";
const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, params, signal } = {}) {
    const qs = params
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null && v !== false).map(([k, v]) => [k, String(v)])).toString()
        : "";
    try {
        const res = await fetch(`${API_BASE}/sales-monitor${path}${qs ? `?${qs}` : ""}`, {
            signal, headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON */ }
        return { ...data, status: res.status, success: res.ok && data?.success !== false };
    } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { success: false, status: 0, message: "Network error. Check your connection." };
    }
}

// { from, to }  inclusive IST dates, YYYY-MM-DD
export const fetchMonitorPeople = (token, { from, to, signal } = {}) => call("/people", { token, signal, params: { from, to } });

// { actorId, module, idleOnly: "1", q, from, to, limit, before, beforeId, after }
export const fetchMonitorFeed = (token, params = {}) => call("/feed", { token, params });

// { limit, before, beforeId }
export const fetchMonitorThread = (token, id, params = {}) => call(`/threads/${id}`, { token, params });