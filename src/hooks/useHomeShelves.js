// hooks/useHomeShelves.js — Deal of the Day / Featured / Limited stock / New arrivals (server-built, per viewer).
// Keeps the previous shelves on screen while a refresh is in flight so nothing flickers.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { fetchHomeSections } from "../utils/homeAdsApi.js";

const POLL_MS = 120_000;

export default function useHomeShelves({ categoryId = null, enabled = true } = {}) {
    const { token } = useAuth();
    const { socket } = useSocket() || {};
    const [state, setState] = useState({ shelves: [], loading: enabled, error: false });
    const reqRef = useRef(0);
    const sigRef = useRef("");

    const load = useCallback(async (signal, { quiet = false } = {}) => {
        const id = ++reqRef.current;
        if (!quiet) setState((s) => ({ ...s, loading: true }));
        const res = await fetchHomeSections(token, categoryId, signal);
        if (res?.aborted || id !== reqRef.current) return;
        if (!res?.success) { setState((s) => ({ ...s, loading: false, error: true })); return; }
        const next = res.shelves || [];
        const sig = JSON.stringify(next);
        if (sig === sigRef.current) { setState((s) => (s.loading || s.error ? { ...s, loading: false, error: false } : s)); return; }
        sigRef.current = sig;
        setState({ shelves: next, loading: false, error: false });
    }, [token, categoryId]);

    // A different category (or login state) is a different set of shelves: reset the comparison.
    useEffect(() => { sigRef.current = ""; }, [categoryId, token]);

    useEffect(() => {
        if (!enabled) { setState({ shelves: [], loading: false, error: false }); return undefined; }
        const ctl = new AbortController();
        load(ctl.signal);
        const poll = setInterval(() => load(undefined, { quiet: true }), POLL_MS);
        const onVisible = () => { if (document.visibilityState === "visible") load(undefined, { quiet: true }); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { ctl.abort(); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
    }, [enabled, load]);

    useEffect(() => {
        if (!enabled || !socket) return undefined;
        const on = () => load(undefined, { quiet: true });
        socket.on("ads:changed", on);
        return () => socket.off("ads:changed", on);
    }, [enabled, socket, load]);

    return state;
}