// List endpoints for the admin full-page Sales monitor.
// Keep this helper aligned with salesMonitorApi.js so both use the same API base,
// Authorization handling, abort behavior, and response shape.
import * as api from "./api.js";

const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, params, signal } = {}) {
    const qs = params
        ? new URLSearchParams(
            Object.entries(params)
                .filter(([, v]) => v !== undefined && v !== "" && v !== null && v !== false)
                .map(([k, v]) => [k, String(v)]),
        ).toString()
        : "";

    try {
        const res = await fetch(`${API_BASE}/sales-monitor${path}${qs ? `?${qs}` : ""}`, {
            signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON response */ }
        return {
            ...data,
            status: res.status,
            success: res.ok && data?.success !== false,
        };
    } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { success: false, status: 0, message: "Network error. Check your connection." };
    }
}

// params: { actorId, q, status, from, to, limit, offset }
export const fetchMonitorEnquiries = (token, params = {}, signal) =>
    call("/enquiries", { token, params, signal });

// params: { actorId, q, status, from, to, limit, offset }
export const fetchMonitorOrders = (token, params = {}, signal) =>
    call("/orders", { token, params, signal });
