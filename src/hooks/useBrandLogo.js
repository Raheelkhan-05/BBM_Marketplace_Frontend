// hooks/useBrandLogo.js
//
// Resolves a brand's logo URL as early as possible so the active-brand strip
// never flashes a fallback icon before the real logo.
//
// Order: navigation hint (from the Brands page) → memory cache → sessionStorage
// → one small request (fetchBrandsPage by name). Returns { url, loading }.
// `loading` is true ONLY while we genuinely don't know yet.

import { useEffect, useState } from "react";
import { fetchBrandsPage } from "../utils/api";

const mem = new Map(); // lower(name) -> url | null  (null = known to have no logo)
const SS_KEY = "bbm_brand_logos_v1";

const norm = (n) => String(n || "").trim().toLowerCase();

function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch { return {}; }
}
function writeSession(key, url) {
    try {
        const all = readSession();
        all[key] = url;
        sessionStorage.setItem(SS_KEY, JSON.stringify(all));
    } catch { /* private mode / quota */ }
}

function lookup(key) {
    if (mem.has(key)) return { known: true, url: mem.get(key) };
    const s = readSession();
    if (Object.prototype.hasOwnProperty.call(s, key)) {
        mem.set(key, s[key]);
        return { known: true, url: s[key] };
    }
    return { known: false, url: null };
}

function remember(key, url) {
    mem.set(key, url || null);
    writeSession(key, url || null);
}

export default function useBrandLogo(brandName, hintUrl = null, token = null) {
    const key = norm(brandName);

    // Seed the cache from the hint synchronously so the FIRST render already has it.
    if (key && hintUrl && mem.get(key) !== hintUrl) remember(key, hintUrl);

    const [, force] = useState(0);
    const current = key ? lookup(key) : { known: true, url: null };

    useEffect(() => {
        if (!key || lookup(key).known) return undefined;
        const controller = new AbortController();
        fetchBrandsPage({ q: brandName.trim(), limit: 5, offset: 0, signal: controller.signal, token })
            .then((res) => {
                const hit = (res?.brands || []).find((b) => norm(b.brand_name) === key);
                remember(key, hit?.brand_image || null);
                force((n) => n + 1);
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                remember(key, null);       // give up quietly: strip shows the icon
                force((n) => n + 1);
            });
        return () => controller.abort();
    }, [key, brandName, token]);

    return { url: current.url, loading: !current.known };
}