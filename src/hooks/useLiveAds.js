// hooks/useLiveAds.js — paid banners that are live RIGHT NOW, grouped by placement key.
// Refreshes on: the "ads:changed" socket event, tab focus, a 60 s poll, and exactly when the soonest
// live ad ends (so an expired ad never lingers on screen). Expired items are also filtered client-side.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchLiveAds } from "../utils/homeAdsApi.js";

const POLL_MS = 60_000;
const CACHE_KEY = "bbm_live_ads_v1";
const EMPTY = {};

const readCache = () => { try { const r = sessionStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };

const stillLive = (list, now) => (Array.isArray(list) ? list.filter((a) => new Date(a.ends_at).getTime() > now) : []);

export default function useLiveAds(keys = ["home_hero", "home_duo", "home_strip"], enabled = true) {
    const keyStr = keys.join(",");
    const [raw, setRaw] = useState(() => (enabled && readCache()) || EMPTY);
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const sigRef = useRef(JSON.stringify(raw));
    const { socket } = useSocket() || {};

    const load = useCallback(async (signal) => {
        const res = await fetchLiveAds(keyStr.split(","), signal);
        if (res?.aborted) return;
        setLoaded(true);
        if (!res?.success) return; // keep what we have; the next poll retries
        const next = res.ads || EMPTY;
        const sig = JSON.stringify(next);
        if (sig === sigRef.current) return;
        sigRef.current = sig;
        setRaw(next);
        try { sessionStorage.setItem(CACHE_KEY, sig); } catch { /* storage unavailable */ }
    }, [keyStr]);

    useEffect(() => {
        if (!enabled) return undefined;
        const ctl = new AbortController();
        load(ctl.signal);
        const poll = setInterval(() => load(), POLL_MS);
        const onVisible = () => { if (document.visibilityState === "visible") load(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { ctl.abort(); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
    }, [enabled, load]);

    useEffect(() => {
        if (!enabled || !socket) return undefined;
        const on = () => load();
        socket.on("ads:changed", on);
        return () => socket.off("ads:changed", on);
    }, [enabled, socket, load]);

    // Wake up exactly when the soonest live ad ends.
    useEffect(() => {
        if (!enabled) return undefined;
        const ends = Object.values(raw).flat().map((a) => new Date(a.ends_at).getTime()).filter((t) => t > Date.now());
        if (!ends.length) return undefined;
        const wait = Math.min(Math.max(1000, Math.min(...ends) - Date.now() + 500), 2_147_000_000);
        const t = setTimeout(() => { setNow(Date.now()); load(); }, wait);
        return () => clearTimeout(t);
    }, [enabled, raw, load]);

    if (!enabled) return { ads: EMPTY, loaded: true };
    // `now` only exists to re-render when an ad expires; the filter itself always uses the real clock.
    const ads = {};
    const t = Math.max(now, Date.now());
    for (const k of Object.keys(raw)) { const l = stillLive(raw[k], t); if (l.length) ads[k] = l; }
    return { ads, loaded };
}