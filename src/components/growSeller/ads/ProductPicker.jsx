// ProductPicker.jsx — searchable, auto-paginating list of the seller's live products.
//   * search bar appears once the seller has more than SEARCH_MIN_PRODUCTS products (server-side search)
//   * pages of PAGE_SIZE load automatically as the list is scrolled (IntersectionObserver on a sentinel row)
//   * stale/aborted responses are ignored, duplicates are dropped, failures offer a Retry
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Package, Search, X } from "lucide-react";
import { fetchMyAdProducts } from "../../../utils/adsApi.js";
import { money } from "./adsHelpers.js";

const PAGE_SIZE = 30;
const SEARCH_MIN_PRODUCTS = 10;
const DEBOUNCE_MS = 300;
const CAN_OBSERVE = typeof IntersectionObserver !== "undefined";

const mergeUnique = (a, b) => {
    const seen = new Set(a.map((p) => p.submissionId));
    return [...a, ...b.filter((p) => !seen.has(p.submissionId))];
};

export default function ProductPicker({ token, selected, onSelect }) {
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");        // debounced, trimmed query that is actually sent
    const [reload, setReload] = useState(0);
    const [chosen, setChosen] = useState(null); // { id, name } so the pick stays visible while searching
    const [s, setS] = useState({
        items: [], total: 0, totalAll: null, hasMore: false,
        loading: true, loadingMore: false, error: null, moreError: null,
    });

    const listRef = useRef(null);
    const sentinelRef = useRef(null);
    const gen = useRef(0);        // bumps on every new query; late responses from older queries are dropped
    const offsetRef = useRef(0);
    const qRef = useRef("");
    const lockRef = useRef(false); // one load-more at a time
    const moreAc = useRef(null);

    /* debounce the search box */
    useEffect(() => {
        const t = setTimeout(() => setQ(input.trim()), DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [input]);

    /* first page: runs on mount and whenever the query changes (or Retry is pressed) */
    useEffect(() => {
        if (!token) return undefined;
        const ac = new AbortController();
        const myGen = ++gen.current;
        moreAc.current?.abort();
        lockRef.current = false;
        offsetRef.current = 0;
        qRef.current = q;
        setS((p) => ({ ...p, items: [], loading: true, loadingMore: false, hasMore: false, error: null, moreError: null }));

        fetchMyAdProducts(token, { q, offset: 0, limit: PAGE_SIZE }, ac.signal).then((res) => {
            if (res.aborted || myGen !== gen.current) return;
            if (!res.success) {
                setS((p) => ({ ...p, loading: false, error: res.message || "Couldn't load your products." }));
                return;
            }
            const items = res.products || [];
            offsetRef.current = res.nextOffset ?? items.length;
            setS((p) => ({
                ...p, items, loading: false,
                total: res.total ?? items.length,
                totalAll: res.totalAll ?? p.totalAll ?? items.length,
                hasMore: !!res.hasMore && items.length > 0,
            }));
        });
        return () => ac.abort();
    }, [token, q, reload]);

    /* next page */
    const loadMore = useCallback(async () => {
        if (lockRef.current) return;
        lockRef.current = true;
        const myGen = gen.current;
        const ac = new AbortController();
        moreAc.current = ac;
        setS((p) => ({ ...p, loadingMore: true, moreError: null }));

        const res = await fetchMyAdProducts(token, { q: qRef.current, offset: offsetRef.current, limit: PAGE_SIZE }, ac.signal);
        if (res.aborted || myGen !== gen.current) return; // a new query took over (it resets the lock)
        lockRef.current = false;
        if (!res.success) {
            setS((p) => ({ ...p, loadingMore: false, moreError: res.message || "Couldn't load more products." }));
            return;
        }
        const more = res.products || [];
        offsetRef.current = res.nextOffset ?? offsetRef.current + more.length;
        setS((p) => ({
            ...p, items: mergeUnique(p.items, more), loadingMore: false,
            total: res.total ?? p.total,
            hasMore: !!res.hasMore && more.length > 0, // an empty page can never loop
        }));
    }, [token]);

    /* auto-load: watch the sentinel row inside the scrolling list.
       The observer is rebuilt after every page, so if the sentinel is still on screen the next page loads too. */
    const { hasMore, loading, loadingMore, moreError } = s;
    const count = s.items.length;
    useEffect(() => {
        const root = listRef.current;
        const el = sentinelRef.current;
        if (!CAN_OBSERVE || !root || !el || !hasMore || loading || loadingMore || moreError) return undefined;
        const io = new IntersectionObserver(
            (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
            { root, rootMargin: "0px 0px 240px 0px" } // start loading a little before the bottom
        );
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loading, loadingMore, moreError, count, loadMore]);

    const pick = (p) => {
        setChosen({ id: p.submissionId, name: p.name });
        onSelect(p.submissionId, p);
    };

    const showSearch = (s.totalAll ?? 0) > SEARCH_MIN_PRODUCTS || input !== "";

    let body;
    if (s.loading) {
        body = <div className="ad-plist" aria-busy="true"><span className="ad-sk" /><span className="ad-sk" /><span className="ad-sk" /><span className="ad-sk" /></div>;
    } else if (s.error) {
        body = (
            <p className="ad-err" role="alert">
                {s.error} <button type="button" className="ad-link" onClick={() => setReload((n) => n + 1)}>Try again</button>
            </p>
        );
    } else if (!s.items.length) {
        body = q
            ? <p className="ad-mute">No products match “{q}”.</p>
            : <p className="ad-mute">You have no live products yet. Add and publish a product first, then come back.</p>;
    } else {
        body = (
            // data-lenis-prevent: Lenis ignores wheel/touch here, so the list scrolls natively (not the page).
            <ul ref={listRef} className="ad-plist" data-lenis-prevent role="radiogroup" aria-label="Your products" aria-busy={s.loadingMore}>
                {s.items.map((p) => (
                    <li key={p.submissionId}>
                        <button type="button" role="radio" aria-checked={selected === p.submissionId} className={selected === p.submissionId ? "on" : ""} onClick={() => pick(p)}>
                            {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="ad-ph"><Package size={18} aria-hidden="true" /></span>}
                            <span><b>{p.name}</b><small>{[p.brandName, p.price ? money(p.price) : null].filter(Boolean).join(" · ")}</small></span>
                        </button>
                    </li>
                ))}
                {(s.hasMore || s.loadingMore || s.moreError) && (
                    <li ref={sentinelRef} className="ad-pk-more" role="presentation">
                        {s.moreError ? (
                            <><span className="ad-err">{s.moreError}</span> <button type="button" className="ad-link" onClick={loadMore}>Retry</button></>
                        ) : s.loadingMore ? (
                            <span role="status"><Loader2 size={16} className="ad-spin" aria-hidden="true" /> Loading more…</span>
                        ) : !CAN_OBSERVE ? (
                            <button type="button" className="ad-link" onClick={loadMore}>Show more</button>
                        ) : null}
                    </li>
                )}
            </ul>
        );
    }

    return (
        <div className="ad-picker">
            {showSearch && (
                <div className="ad-search" role="search">
                    <Search size={16} aria-hidden="true" />
                    <input
                        type="text" inputMode="search" enterKeyHint="search" autoComplete="off" maxLength={80}
                        value={input} onChange={(e) => setInput(e.target.value)}
                        placeholder="Search by product or brand" aria-label="Search your products"
                    />
                    {input && <button type="button" className="ad-ib" aria-label="Clear search" onClick={() => setInput("")}><X size={14} aria-hidden="true" /></button>}
                </div>
            )}
            {showSearch && !s.loading && !s.error && (
                <p className="ad-mute ad-pk-count" role="status">
                    {q ? `${s.total} match${s.total === 1 ? "" : "es"}` : `${s.totalAll} products`}
                </p>
            )}
            {chosen && selected === chosen.id && <p className="ad-pk-chosen">Selected: <b>{chosen.name}</b></p>}
            {body}
        </div>
    );
}