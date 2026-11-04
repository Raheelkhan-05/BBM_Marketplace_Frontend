// src/hooks/useMonitorList.js
// Paged list with quiet live refresh (socket "sales:monitor"), used by the monitor Enquiries / Orders pages.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";

const PAGE = 15;
const MAX_PAGE = 100;
const mergeUnique = (prev, inc) => { const s = new Set(prev.map((i) => i.id)); return [...prev, ...inc.filter((i) => !s.has(i.id))]; };

export default function useMonitorList(fetcher, token, params, enabled = true) {
    const { socket } = useSocket() || {};
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState({});
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const paramsRef = useRef(params); paramsRef.current = params;
    const paramsKey = JSON.stringify(params);
    const seq = useRef(0);
    const ctl = useRef(null);
    const itemsRef = useRef([]);

    const load = useCallback(async (offset, append, silent = false) => {
        ctl.current?.abort();
        const c = new AbortController(); ctl.current = c;
        const my = ++seq.current;
        const have = itemsRef.current.length;
        if (append) setLoadingMore(true); else if (!silent) { setError(""); setLoading(true); }
        try {
            // a quiet refresh re-reads what is on screen, so scrolled pages don't collapse
            const limit = silent && !append ? Math.min(Math.max(PAGE, have), MAX_PAGE) : PAGE;
            const res = await fetcher(token, { ...paramsRef.current, limit, offset }, c.signal);
            if (my !== seq.current) return;
            if (!res.success) { if (!silent) { setError(res.message || "Couldn't load the list."); setHasMore(false); } return; }
            const next = append ? mergeUnique(itemsRef.current, res.items || []) : res.items || [];
            itemsRef.current = next;
            setItems(next); setTotal(res.total ?? next.length); setHasMore(!!res.hasMore);
            if (res.counts) setCounts(res.counts);
            setError("");
        } catch (e) {
            if (e?.name !== "AbortError" && !silent && my === seq.current) setHasMore(false);
        } finally {
            if (my === seq.current) { setLoading(false); setLoadingMore(false); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetcher, token, paramsKey]);

    const loadRef = useRef(load); loadRef.current = load;

    useEffect(() => {
        if (!token || !enabled) return undefined;
        load(0, false);
        return () => ctl.current?.abort();
    }, [load, token, enabled]);

    useEffect(() => {
        if (!socket || !enabled) return undefined;
        let t;
        const ping = () => { clearTimeout(t); t = setTimeout(() => loadRef.current(0, false, true), 800); };
        socket.on("sales:monitor", ping);
        socket.on("connect", ping);
        return () => { clearTimeout(t); socket.off("sales:monitor", ping); socket.off("connect", ping); };
    }, [socket, enabled]);

    const loadMore = useCallback(() => { if (!loadingMore && hasMore) load(itemsRef.current.length, true); }, [load, loadingMore, hasMore]);
    const reload = useCallback(() => load(0, false), [load]);

    return { items, total, counts, hasMore, loading, loadingMore, error, loadMore, reload };
}