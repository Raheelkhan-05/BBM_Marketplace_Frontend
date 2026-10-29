// src/components/orderBook/OrderBookList.jsx
// The order list, shared by the salesperson page (mode "sales") and the company page (mode "team").
// Opens instantly from cache, refreshes quietly, and stays live through useOrderBookLive.
// Search covers customer name, order number, GST number and PO number.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, Inbox, Loader2 } from "lucide-react";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";
import useOrderBookLive from "../../hooks/useOrderBookLive.js";
import { cacheGet, cacheSet, nsOf } from "../../utils/salesThreadCache.js";
import { FILTERS, inr, listTime, itemsSummary, STATUS_LABEL } from "./orderBookFmt.js";
import StatusChip from "./StatusChip.jsx";
import "../sales/sales-threads.css";
import "./order-book.css";

const PAGE = 15;
const MAX_PAGE = 100;
const EMPTY_COUNTS = { all: 0, placed: 0, processed: 0, shipped: 0, completed: 0, cancelled: 0 };
const mergeUnique = (prev, inc) => { const s = new Set(prev.map((i) => i.id)); return [...prev, ...inc.filter((i) => !s.has(i.id))]; };

const Row = memo(function Row({ o, base, team }) {
    return (
        <li>
            <Link to={`${base}/${o.id}`} className="ob-row">
                <span className="ob-r1"><b>{o.customerName}</b><time dateTime={o.lastActivityAt}>{listTime(o.lastActivityAt)}</time></span>
                <span className="ob-r2">{o.orderNo}{o.poNumber ? ` · PO ${o.poNumber}` : ""} · {itemsSummary(o.items)}</span>
                <span className="ob-r3">
                    <strong>{inr(o.total)}</strong>
                    {team && o.salespersonName && <small>by {o.salespersonName}</small>}
                    <StatusChip status={o.status} />
                </span>
            </Link>
        </li>
    );
});

export default function OrderBookList({ mode, api, token, base, title, subtitle, action }) {
    const team = mode === "team";
    const [qInput, setQInput] = useState("");
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState("all");
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const abortRef = useRef(null);
    const seqRef = useRef(0);
    const itemsRef = useRef([]); itemsRef.current = items;

    useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);

    const load = useCallback(async (offset, append, silent = false) => {
        abortRef.current?.abort();
        const ctl = new AbortController(); abortRef.current = ctl;
        const my = ++seqRef.current;
        const key = `${nsOf(token)}|ob|${mode}|${q}|${filter}`;

        let have = itemsRef.current.length;
        if (!append && !silent) {
            const c = cacheGet(key);
            if (c) {
                setItems(c.items); setTotal(c.total); setHasMore(c.hasMore);
                if (c.counts) setCounts({ ...EMPTY_COUNTS, ...c.counts });
                setError(""); setLoading(false);
                itemsRef.current = c.items; have = c.items.length; silent = true;
            }
        }

        if (append) setLoadingMore(true); else if (!silent) { setError(""); setLoading(true); }
        try {
            // a silent refresh re-reads what is on screen, so scrolled pages don't collapse
            const limit = silent && !append ? Math.min(Math.max(PAGE, have), MAX_PAGE) : PAGE;
            const res = await api.list(token, { q, status: filter === "all" ? "" : filter, limit, offset, signal: ctl.signal });
            if (my !== seqRef.current) return;
            if (!res.success) { if (!silent) { setError(res.message || "Couldn't load the orders."); setHasMore(false); } return; }
            const next = append ? mergeUnique(itemsRef.current, res.items || []) : res.items || [];
            setItems(next); setTotal(res.total ?? 0); setHasMore(!!res.hasMore);
            if (res.counts) setCounts({ ...EMPTY_COUNTS, ...res.counts });
            setError("");
            cacheSet(key, { items: next, total: res.total ?? 0, hasMore: !!res.hasMore, counts: res.counts || cacheGet(key)?.counts || null });
        } catch (e) {
            if (e?.name !== "AbortError" && !silent && my === seqRef.current) setHasMore(false);
        } finally {
            if (my === seqRef.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [api, token, mode, q, filter]);

    const loadRef = useRef(load); loadRef.current = load;
    useEffect(() => { if (!token) return undefined; load(0, false); return () => abortRef.current?.abort(); }, [load, token]);
    useOrderBookLive(() => loadRef.current(0, false, true), { enabled: !!token });

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && load(items.length, true),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore },
    );

    const label = filter === "all" ? "" : STATUS_LABEL[filter].toLowerCase();
    const emptyTitle = q ? "No orders match your search" : filter === "all" ? "No orders yet" : `No ${label} orders`;
    const emptyText = q ? "Try a different customer, order number, PO number or GST number."
        : filter !== "all" ? "Orders will show up here as they move through this step."
            : team ? "Orders your salespeople punch will appear here the moment they are placed."
                : "When a customer gives you an order, punch it here so your team can process it.";

    return (
        <div className="ob st-listpage">
            <div className="ob-ph">
                <div><h1>{title}</h1><p>{subtitle}</p></div>
                {action}
            </div>

            <label className="st-srch st-srch-l" style={{ marginTop: 14 }}>
                <Search size={16} aria-hidden="true" />
                <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by customer, order no., PO number or GST number" aria-label="Search orders" />
                {qInput && <button type="button" aria-label="Clear search" onClick={() => setQInput("")}><X size={14} /></button>}
            </label>

            <div className="st-tabs" role="group" aria-label="Filter orders">
                {FILTERS.map(([v, l]) => (
                    <button key={v} type="button" className={`st-tab ob-tab ${v}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>
                        {l}<span className="n">{counts[v] ?? 0}</span>
                    </button>
                ))}
            </div>

            {!loading && !error && <p className="ob-note">{total} order{total === 1 ? "" : "s"}</p>}

            {loading && items.length === 0 ? (
                <div className="ob-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
            ) : items.length > 0 ? (
                <ul className="ob-list">{items.map((o) => <Row key={o.id} o={o} base={base} team={team} />)}</ul>
            ) : !loading && !error && (
                <div className="st-empty-card" style={{ marginTop: 10 }}><Inbox size={22} /><b>{emptyTitle}</b>{emptyText}</div>
            )}

            {loadingMore && <p className="st-more" aria-live="polite"><Loader2 size={16} className="st-spin" />Loading more…</p>}
            {!loading && error && <div className="st-empty-card"><b>{error}</b><button type="button" className="st-btn" onClick={() => load(0, false)}>Try again</button></div>}
            {hasMore && !loading && <div ref={sentinelRef} style={{ height: 4 }} />}
        </div>
    );
}