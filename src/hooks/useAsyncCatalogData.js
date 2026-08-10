import { useEffect, useRef, useState, useCallback } from "react";

export default function useAsyncCatalogData(fetchFn, deps) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchFnRef = useRef(fetchFn);
    fetchFnRef.current = fetchFn; // always run the latest closure, never a stale one
    const runIdRef = useRef(0);

    const run = useCallback(async () => {
        const runId = ++runIdRef.current;
        setLoading(true);
        setError(null);

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await fetchFnRef.current();
                if (runId !== runIdRef.current) return; // a newer run started — drop this result
                setData(result);
                setLoading(false);
                return;
            } catch (err) {
                if (attempt === 0) {
                    await new Promise((r) => setTimeout(r, 600));
                    continue;
                }
                if (runId !== runIdRef.current) return;
                setError(err?.message || "Something went wrong loading this page.");
                setLoading(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => { run(); }, [run]);

    return { data, loading, error, retry: run };
}