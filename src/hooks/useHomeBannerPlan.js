// hooks/useHomeBannerPlan.js — live banners + today's placement plan (refreshes on socket event, tab focus, 60s poll)
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchGroupBanners } from "../utils/api.groupBanners.js";

const POLL_MS = 60_000;
const CACHE_KEY = "bbm_home_banner_plan_v1";
const EMPTY = { banners: [], plan: null };

const readCache = () => {
    try { const raw = sessionStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

export default function useHomeBannerPlan(enabled = true) {
    const [data, setData] = useState(() => (enabled && readCache()) || EMPTY);
    const sigRef = useRef(JSON.stringify(data));
    const { socket } = useSocket() || {};

    const load = useCallback(async (signal) => {
        const res = await fetchGroupBanners({ signal });
        if (res?.aborted || !res?.success) return;
        const next = { banners: res.banners || [], plan: res.plan || null };
        const sig = JSON.stringify(next);
        if (sig === sigRef.current) return; // nothing changed -> no re-render
        sigRef.current = sig;
        setData(next);
        try { sessionStorage.setItem(CACHE_KEY, sig); } catch { /* storage unavailable */ }
    }, []);

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
        socket.on("group-banners:update", on);
        return () => socket.off("group-banners:update", on);
    }, [enabled, socket, load]);

    return enabled ? data : EMPTY;
}