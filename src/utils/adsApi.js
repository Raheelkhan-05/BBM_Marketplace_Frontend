// utils/adsApi.js — seller-side client for /api/ads (Stage 2 routes + /my-products).
// Every call resolves to the server's JSON ({ success, code?, message?, details? }); it never throws.
import { API_BASE } from "./api.js";

async function call(token, method, path, { body, form, signal } = {}) {
    try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        let payload;
        if (form) payload = form; // the browser sets the multipart boundary itself
        else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
        const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
        let json = null;
        try { json = await res.json(); } catch { /* non-JSON error body */ }
        if (!json) return { success: false, status: res.status, message: "Unexpected server response." };
        return { status: res.status, ...json };
    } catch (e) {
        if (e?.name === "AbortError") return { aborted: true, success: false };
        return { success: false, message: "Network error. Please check your connection." };
    }
}

export const fetchPlacements = (token, signal) => call(token, "GET", "/ads/placements", { signal });

// { month: "YYYY-MM" } -> { days: [...] }      { day: "YYYY-MM-DD" } -> { hours: [...] }
export function fetchAvailability(token, key, { month, day }, signal) {
    const qs = day ? `day=${encodeURIComponent(day)}` : `month=${encodeURIComponent(month)}`;
    return call(token, "GET", `/ads/placements/${encodeURIComponent(key)}/availability?${qs}`, { signal });
}

export function fetchQuote(token, key, startIso, hours, signal) {
    const qs = `start=${encodeURIComponent(startIso)}&hours=${encodeURIComponent(hours)}`;
    return call(token, "GET", `/ads/placements/${encodeURIComponent(key)}/quote?${qs}`, { signal });
}

// One image per call; the field name is the shape key (wide | landscape | square | portrait).
export function uploadCreative(token, shape, file) {
    const form = new FormData();
    form.append(shape, file);
    return call(token, "POST", "/ads/creatives", { form });
}

export const postBooking = (token, body) => call(token, "POST", "/ads/bookings", { body });
export const fetchMyBookings = (token, signal) => call(token, "GET", "/ads/bookings", { signal });

// Paged + searchable: -> { products, total, totalAll, nextOffset, hasMore }
export function fetchMyAdProducts(token, { q = "", offset = 0, limit = 30 } = {}, signal) {
    const qs = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (q) qs.set("q", q);
    return call(token, "GET", `/ads/my-products?${qs.toString()}`, { signal });
}