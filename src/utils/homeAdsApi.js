// utils/homeAdsApi.js — public, buyer-facing reads for the monetised Home page.
//   GET /api/ads/live?keys=home_hero,home_duo,home_strip   -> { ads: { [placementKey]: [ {booking_id, lane, shop_slug, shop_name, creative, ends_at} ] } }
//   GET /api/catalog/home-sections?categoryId=<uuid>       -> { shelves: [ { key, title, subtitle, items: [...] } ] }
// Never throws: always resolves to { success, ... } or { aborted: true }.
import { API_BASE } from "./api.js";

async function get(path, { token, signal } = {}) {
    try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}${path}`, { headers, signal });
        let json = null;
        try { json = await res.json(); } catch { /* non-JSON body */ }
        if (!json) return { success: false, status: res.status };
        return { status: res.status, ...json };
    } catch (e) {
        if (e?.name === "AbortError") return { aborted: true, success: false };
        return { success: false };
    }
}

export const fetchLiveAds = (keys, signal) =>
    get(`/ads/live?keys=${encodeURIComponent((keys || []).join(","))}`, { signal });

export const fetchHomeSections = (token, categoryId, signal) =>
    get(`/catalog/home-sections${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`, { token, signal });