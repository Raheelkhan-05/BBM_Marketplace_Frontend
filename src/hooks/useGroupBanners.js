// hooks/useGroupBanners.js
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGroupBanners } from "../utils/api.groupBanners.js";
import { useSocket } from "../context/SocketContext.jsx";

const SS_KEY = "bbm_group_banners_v1";
const POLL_MS = 60000;
const EMPTY = [];

let memo = null; // survives route changes (e.g. back from the variants view) -> instant render

const readSession = () => {
    try { const v = JSON.parse(sessionStorage.getItem(SS_KEY) || "null"); return Array.isArray(v) ? v : null; } catch { return null; }
};
const writeSession = (list) => { try { sessionStorage.setItem(SS_KEY, JSON.stringify(list)); } catch { /* private mode */ } };
const signature = (list) => list.map((b) => `${b.group_id}|${b.image_url}|${b.alt_text || ""}|${b.name}|${b.variant_count}`).join("~");

// Admin-curated banners, ordered as the admin set them. Stays fresh via:
//   1) the server's "group-banners:update" socket event, 2) a 60s ETag poll, 3) tab-visible refetch.
// State only changes when the data really changed, so unchanged polls never re-render the feed.
export default function useGroupBanners(enabled = true) {
    const [banners, setBanners] = useState(() => memo ?? readSession() ?? EMPTY);
    const sigRef = useRef(signature(banners));
    const ctlRef = useRef(null);
    const socketTimerRef = useRef(null);
    const { socket } = useSocket() || {};

    const refresh = useCallback(async () => {
        ctlRef.current?.abort();
        const c = new AbortController();
        ctlRef.current = c;
        const res = await fetchGroupBanners({ signal: c.signal });
        if (res.aborted || !res.success || !Array.isArray(res.banners)) return;
        memo = res.banners;
        writeSession(res.banners);
        const sig = signature(res.banners);
        if (sig !== sigRef.current) { sigRef.current = sig; setBanners(res.banners); }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        refresh();
        const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
        document.addEventListener("visibilitychange", onVisible);
        const poll = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, POLL_MS);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            clearInterval(poll);
            ctlRef.current?.abort();
        };
    }, [enabled, refresh]);

    useEffect(() => {
        if (!enabled || !socket) return undefined;
        const onUpdate = () => {
            clearTimeout(socketTimerRef.current);
            socketTimerRef.current = setTimeout(refresh, 150);
        };
        socket.on("group-banners:update", onUpdate);
        return () => { socket.off("group-banners:update", onUpdate); clearTimeout(socketTimerRef.current); };
    }, [enabled, socket, refresh]);

    return enabled ? banners : EMPTY;
}