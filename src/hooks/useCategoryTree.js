// src/hooks/useCategoryTree.js
//
// Categories + their subcategories, for the sidebar, the mobile drawer and HomePage's
// "is the active filter still valid?" check. One shared in-memory cache, so using the hook in
// several components costs ONE request:
//   - keyed by viewer + seller scope + brand scope (visibility rules are per buyer)
//   - fresh for 3 minutes; after that the cached tree is still shown while it quietly refreshes
//   - concurrent callers share the same in-flight request
import { useCallback, useEffect, useState } from "react";
import { fetchCategoryTree } from "../utils/api";
import { useAuth } from "../context/AuthContext.jsx";

const TTL_MS = 3 * 60 * 1000;
const cache = new Map();     // key -> { t, categories }
const inflight = new Map();  // key -> Promise

function fetchInto(key, args) {
    if (inflight.has(key)) return inflight.get(key);
    const p = fetchCategoryTree(args)
        .then((res) => {
            if (!res?.success) throw new Error("bad response");
            cache.set(key, { t: Date.now(), categories: Array.isArray(res.categories) ? res.categories : [] });
        })
        .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

export default function useCategoryTree({ shopSlug = null, brandName = null } = {}) {
    const { token } = useAuth();
    const viewer = token ? token.slice(-16) : "guest";
    const key = `${viewer}::${shopSlug || ""}::${(brandName || "").trim().toLowerCase()}`;

    const [, setTick] = useState(0);
    const [failedKey, setFailedKey] = useState(null);

    const refresh = useCallback(() => {
        setFailedKey(null);
        return fetchInto(key, { shopSlug, brandName, token })
            .then(() => setTick((n) => n + 1))
            .catch(() => setFailedKey(key));
    }, [key, shopSlug, brandName, token]);

    useEffect(() => {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.t < TTL_MS) return;
        refresh();
    }, [key, refresh]);

    const hit = cache.get(key);
    return {
        categories: hit ? hit.categories : null,   // null until the first load for THIS scope finishes
        loading: !hit && failedKey !== key,
        error: !hit && failedKey === key,
        retry: refresh,
    };
}