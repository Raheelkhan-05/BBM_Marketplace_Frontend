// src/utils/gstAccessApi.js: custom prices + visibility by GST number (buyers who may not be on BBM yet)
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function call(token, path, { method = "GET", body, signal } = {}) {
    try {
        const res = await fetch(`${BASE}/seller/gst-access${path}`, {
            method, signal,
            headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        return { ...data, success: res.ok && data.success !== false, status: res.status };
    } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { success: false, message: "Network error. Please try again." };
    }
}

export const lookupGst = (token, gstin, submissionId, signal) => call(token, "/lookup", { method: "POST", body: { gstin, submissionId }, signal });

// per listing
export const fetchListingPending = (token, submissionId) => call(token, `/listing/${submissionId}`);
// payload: { gstin, grantVisibility?, price?: { canonicalPrice } }
export const addPendingBuyer = (token, submissionId, payload) => call(token, `/listing/${submissionId}/buyer`, { method: "POST", body: payload });
export const removePendingBuyer = (token, submissionId, gstin, part = "all") => call(token, `/listing/${submissionId}/buyer/${gstin}?part=${part}`, { method: "DELETE" });

// per customer (many products)
export const fetchGstPricing = (token, gstin) => call(token, `/customer/${gstin}/pricing`);
export const saveGstPricing = (token, gstin, items) => call(token, `/customer/${gstin}/pricing`, { method: "POST", body: { items } });
export const bulkClearGstPricing = (token, gstin, submissionIds) => call(token, `/customer/${gstin}/pricing/bulk-clear`, { method: "POST", body: { submissionIds } });