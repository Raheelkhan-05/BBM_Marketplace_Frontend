// src/utils/orderBookApi.js: Order Book (salesperson side + company team side)
import * as api from "./api.js";
const API_BASE = api.API_BASE || import.meta.env?.VITE_API_BASE_URL || "/api";

async function call(path, { token, method = "GET", body, signal, params } = {}) {
    const qs = params
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString()
        : "";
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    try {
        const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ""}`, {
            method, signal,
            headers: { ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON */ }
        return { ...data, status: res.status, success: res.ok && data?.success !== false };
    } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { success: false, status: 0, message: "Network error. Check your connection." };
    }
}

const reads = (base) => ({
    list: (token, { q, status, limit, offset, signal } = {}) => call(base, { token, signal, params: { q, status, limit, offset } }),
    get: (token, id, signal) => call(`${base}/${id}`, { token, signal }),
});

// Salesperson: only their own orders.
export const salesOrderBook = {
    ...reads("/sales/order-book"),
    create: (token, payload) => call("/sales/order-book", { token, method: "POST", body: payload }),
};

// Company team (admin + members): every order of the company.
const T = "/seller/order-book";
export const teamOrderBook = {
    ...reads(T),
    counts: (token) => call(`${T}/counts`, { token }),
    process: (token, id) => call(`${T}/${id}/process`, { token, method: "POST", body: {} }),
    ship: (token, id, formData) => call(`${T}/${id}/ship`, { token, method: "POST", body: formData }),
    complete: (token, id) => call(`${T}/${id}/complete`, { token, method: "POST", body: {} }),
    cancel: (token, id, reason) => call(`${T}/${id}/cancel`, { token, method: "POST", body: { reason: reason || "" } }),
};