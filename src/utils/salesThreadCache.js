// src/utils/salesThreadCache.js
// Tiny in-memory cache so lists and threads open instantly (stale-while-revalidate):
// show what we have right away, then refresh quietly in the background.
// Keys are namespaced per signed-in user, so one person never sees another's data in the same tab.
import { fetchThread } from "./salesThreadApi.js";

export const FIRST_PAGE = 20;   // entries loaded when a thread opens (newest first)
export const OLDER_PAGE = 25;   // entries loaded per "scroll up" step

const TTL = 5 * 60 * 1000;
const MAX = 40;
const store = new Map();
const warming = new Map();

export const nsOf = (token) => String(token || "").slice(-16);
export const threadKey = (token, id) => `${nsOf(token)}|thread|${id}`;

export function cacheGet(key) {
    const e = store.get(key);
    if (!e) return null;
    if (Date.now() - e.t > TTL) { store.delete(key); return null; }
    return e.v;
}

export function cacheSet(key, value) {
    store.delete(key);
    store.set(key, { v: value, t: Date.now() });
    while (store.size > MAX) store.delete(store.keys().next().value);
}

// Called when a row is hovered / focused / touched: fetch the thread's newest page ahead of the tap.
export function prefetchThread(token, id) {
    if (!token || !id) return;
    const key = threadKey(token, id);
    if (cacheGet(key) || warming.has(key)) return;
    warming.set(key, true);
    fetchThread(token, id, { limit: FIRST_PAGE })
        .then((r) => { if (r.success && !cacheGet(key)) cacheSet(key, { thread: r.thread, entries: r.entries || [], hasOlder: !!r.hasOlder }); })
        .catch(() => { /* ignore */ })
        .finally(() => warming.delete(key));
}