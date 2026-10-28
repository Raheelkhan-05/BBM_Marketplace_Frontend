// src/hooks/useOrderBookPending.js
// Number of orders still waiting to be processed (the badge on the Order Book tab). Team side only.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { teamOrderBook } from "../utils/orderBookApi.js";
import useOrderBookLive from "./useOrderBookLive.js";

export default function useOrderBookPending() {
    const { token } = useAuth();
    const [n, setN] = useState(0);
    const load = useCallback(async () => {
        if (!token) return;
        const r = await teamOrderBook.counts(token);
        if (r.success) setN(r.counts?.placed || 0);
    }, [token]);
    useEffect(() => { load(); }, [load]);
    useOrderBookLive(load, { enabled: !!token, interval: 60000 });
    return n;
}