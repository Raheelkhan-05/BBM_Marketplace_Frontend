// src/hooks/useCategories.js
//
// One shared category list for the sidebar AND the mobile drawer: a single fetch, a single realtime
// channel, same sessionStorage cache key the old CategoryStrip used.
import { useEffect, useSyncExternalStore } from "react";
import { searchCategories } from "../utils/api";
import { supabase } from "../utils/supabaseClient";

const CACHE_KEY = "bbm_category_strip_cache_v1";

const isHidden = (name) => typeof name === "string" && name.trim().toLowerCase() === "pending";

// Display only: "Automotive and engineering" -> "Automotive & engineering".
export function shortLabel(name) {
    return String(name ?? "").replace(/\band\b/gi, "&").replace(/\s{2,}/g, " ").trim();
}

function readCache() {
    try {
        if (typeof sessionStorage === "undefined") return null;
        const raw = sessionStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function writeCache(items) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch { /* not fatal */ }
}

// Keeps the list sorted by name, same order as the backend query.
function upsertSorted(list, category) {
    const rest = list.filter((c) => c.id !== category.id);
    const idx = rest.findIndex((c) => c.name.localeCompare(category.name, undefined, { sensitivity: "base" }) > 0);
    if (idx === -1) return [...rest, category];
    return [...rest.slice(0, idx), category, ...rest.slice(idx)];
}

const cached = readCache();
let state = { items: cached || [], loading: !cached };
const listeners = new Set();
let started = false;

const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
};
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => state;
const SERVER_STATE = { items: [], loading: true };
const getServerSnapshot = () => SERVER_STATE;

function start() {
    if (started) return;
    started = true;

    // Always revalidate; the cache only avoids an empty first paint.
    searchCategories("", 16)
        .then((res) => {
            if (!res?.success) return;
            const items = (res.items || []).filter((c) => !isHidden(c.name));
            writeCache(items);
            set({ items, loading: false });
        })
        .catch(() => { })
        .finally(() => { if (state.loading) set({ loading: false }); });

    // Deferred so the websocket doesn't compete with the first feed fetch.
    // Intentionally never unsubscribed: it is a single app-lifetime channel.
    setTimeout(() => {
        supabase
            .channel("category-list-live")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "hs_categories" }, (payload) => {
                const row = payload.new;
                if (row.review_status !== "approved" || isHidden(row.name)) return;
                const items = upsertSorted(state.items, { id: row.id, name: row.name, slug: row.slug, image: row.image });
                writeCache(items);
                set({ items });
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hs_categories" }, (payload) => {
                const row = payload.new;
                const items = row.review_status === "approved" && !isHidden(row.name)
                    ? upsertSorted(state.items, { id: row.id, name: row.name, slug: row.slug, image: row.image })
                    : state.items.filter((c) => c.id !== row.id);
                writeCache(items);
                set({ items });
            })
            .subscribe();
    }, 2000);
}

export default function useCategories() {
    useEffect(() => { start(); }, []);
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}