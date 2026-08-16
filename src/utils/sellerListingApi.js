// utils/sellerListingApi.js
//
// New endpoints introduced by the seller-listing rework. Kept separate
// from utils/api.js (already 400+ lines) rather than merged in — import
// from both freely, they share the same API_BASE convention. Every
// existing function in utils/api.js (createSellerSubmission,
// updateSellerProductSubmission, createSellerListingForBrand,
// uploadSellerFile, etc.) is unchanged and still used as-is.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function authedJson(path, token, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
    return res.json();
}

export async function fetchCommissionInfo() {
    const res = await fetch(`${API_BASE}/seller/catalog/commission-info`);
    return res.json(); // { success, commissionPercent }
}

export async function fetchSubmissionDetail(token, id) {
    return authedJson(`/seller/catalog/submissions/${id}`, token);
}

// ---- Saved "groups" (Packaging / Delivery / Tax & Legal / Commercial
// Terms / Quality) — the Amazon-style reusable field sets ----

export async function fetchListingTemplates(token, groupType) {
    const qs = groupType ? `?groupType=${encodeURIComponent(groupType)}` : "";
    return authedJson(`/seller/catalog/templates${qs}`, token);
}

export async function fetchDefaultListingTemplates(token) {
    return authedJson(`/seller/catalog/templates/defaults`, token);
}

export async function createListingTemplate(token, { groupType, name, data, isDefault }) {
    return authedJson(`/seller/catalog/templates`, token, {
        method: "POST",
        body: JSON.stringify({ groupType, name, data, isDefault }),
    });
}

export async function updateListingTemplate(token, id, payload) {
    return authedJson(`/seller/catalog/templates/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

export async function deleteListingTemplate(token, id) {
    return authedJson(`/seller/catalog/templates/${id}`, token, { method: "DELETE" });
}