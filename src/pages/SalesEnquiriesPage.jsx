// src/pages/SalesEnquiriesPage.jsx
// The salesperson's own enquiry threads, newest activity first (like a chat list):
// customer company, product, when the enquiry was posted (the same customer can ask for the same product again),
// and the outcome (open / won / lost).
// Opens instantly from cache and refreshes quietly; hovering/touching a row warms up its thread.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Plus, Search, X, Receipt, Inbox, Loader2, Trophy, XCircle, Bell } from "lucide-react";
import { dateTime, listTime, qty } from "../components/sales/salesThreadFmt.js";   // initialOf no longer needed
import { useAuth } from "../context/AuthContext.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import useRfqLive from "../hooks/useRfqLive.js";
import { fetchThreads } from "../utils/salesThreadApi.js";
import { cacheGet, cacheSet, nsOf, prefetchThread } from "../utils/salesThreadCache.js";
import SalesNewEnquirySheet from "../components/sales/SalesNewEnquirySheet.jsx";
// import { dateTime, initialOf, listTime, qty } from "../components/sales/salesThreadFmt.js";
import "../components/sales/sales-threads.css";

const PAGE = 15;
const MAX_PAGE = 100; // server cap
const mergeUnique = (prev, inc) => { const s = new Set(prev.map((i) => i.id)); return [...prev, ...inc.filter((i) => !s.has(i.id))]; };
const TABS = [["all", "All"], ["open", "Open"], ["reminder", "Reminders"], ["won", "Won"], ["lost", "Lost"]];
const EMPTY_COUNTS = { all: 0, open: 0, reminder: 0, won: 0, lost: 0 };

const kindOf = (t) => (t.status !== "closed" ? "open" : t.outcome === "won" ? "won" : t.outcome === "lost" ? "lost" : "closed");

const ThreadRow = memo(function ThreadRow({ t, onWarm }) {
    const kind = kindOf(t);
    const warm = () => onWarm(t.id);
    const due = !!t.reminderAt && new Date(t.reminderAt).getTime() <= Date.now();

    return (
        <li>
            <Link to={`/sales/enquiries/${t.id}`} className={`st-row${kind === "open" ? "" : " closed"}`} onPointerEnter={warm} onFocus={warm}>
                <span className="st-row-m">
                    <span className="st-row-1">
                        <b>{t.displayName}</b>
                        <time dateTime={t.lastActivityAt}>{listTime(t.lastActivityAt)}</time>
                    </span>
                    <span className="st-row-2">{t.productName} · {qty(t.quantity)} {t.unit}</span>
                    {t.lastPreview && <span className="st-row-4">{t.lastPreview}</span>}
                    <span className="st-row-3">
                        <small>Posted {dateTime(t.createdAt)}</small>
                        <span className="st-badges">
                            {t.reminderAt && kind === "open" && (
                                <span className={`st-bd rem${due ? " due" : ""}`} title={due ? "Reminder due" : "Reminder"}>
                                    <Bell size={12} />{due ? "Due " : ""}{dateTime(t.reminderAt)}
                                </span>
                            )}
                            {t.quotesCount > 0 && (
                                <span className="st-bd" title={`${t.quotesCount} quotation${t.quotesCount === 1 ? "" : "s"} sent`}>
                                    <Receipt size={12} />{t.quotesCount}
                                </span>
                            )}
                            {kind === "won" && <span className="st-bd won"><Trophy size={12} />Won</span>}
                            {kind === "lost" && <span className="st-bd lost"><XCircle size={12} />Lost</span>}
                            {kind === "closed" && <span className="st-bd mute">Closed</span>}
                        </span>
                    </span>
                </span>
            </Link>
        </li>
    );
});

export default function SalesEnquiriesPage() {
    const { token } = useAuth();
    const { say } = useOutletContext();
    const nav = useNavigate();
    const [sp, setSp] = useSearchParams();

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
    const [creating, setCreating] = useState(false);

    const abortRef = useRef(null);
    const seqRef = useRef(0);
    const itemsRef = useRef([]); itemsRef.current = items;

    useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);
    useEffect(() => { if (sp.get("new") === "1") { setCreating(true); setSp({}, { replace: true }); } }, [sp, setSp]);

    const load = useCallback(async (offset, append, silent = false) => {
        abortRef.current?.abort();
        const ctl = new AbortController(); abortRef.current = ctl;
        const my = ++seqRef.current;
        const key = `${nsOf(token)}|list|${q}|${filter}`;

        // Show the cached copy immediately, then refresh it quietly.
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
            const res = await fetchThreads(token, { q, status: filter === "all" ? "" : filter, limit, offset, signal: ctl.signal });
            if (my !== seqRef.current) return;
            if (!res.success) { if (!silent) { setError(res.message || "Couldn't load your enquiries."); setHasMore(false); } return; }
            const next = append ? mergeUnique(itemsRef.current, res.items || []) : res.items || [];
            setItems(next);
            setTotal(res.total ?? 0); setHasMore(!!res.hasMore);
            if (res.counts) setCounts({ ...EMPTY_COUNTS, ...res.counts });
            setError("");
            cacheSet(key, { items: next, total: res.total ?? 0, hasMore: !!res.hasMore, counts: res.counts || cacheGet(key)?.counts || null });
        } catch (e) {
            if (e?.name !== "AbortError" && !silent && my === seqRef.current) setHasMore(false);
        } finally {
            if (my === seqRef.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [token, q, filter]);

    const loadRef = useRef(load); loadRef.current = load;
    useEffect(() => { if (!token) return undefined; load(0, false); return () => abortRef.current?.abort(); }, [load, token]);
    useRfqLive(() => loadRef.current(0, false, true), { enabled: !!token }); // socket, focus and a light poll

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && load(items.length, true),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore },
    );

    const warm = useCallback((id) => prefetchThread(token, id), [token]);

    const emptyTitle = q ? "No enquiries match your search"
        : filter === "reminder" ? "No reminders set"
            : filter === "won" ? "No won enquiries yet"
                : filter === "lost" ? "No lost enquiries"
                    : filter === "open" ? "No open enquiries" : "No enquiries yet";
    const emptyText = q ? "Try a different company, product or GST number."
        : filter === "reminder" ? "Open an enquiry, tap + and choose Set reminder. Reminders clear when you add an update."
            : filter === "won" ? "Enquiries you mark as won will show up here."
                : filter === "lost" ? "Enquiries you mark as lost will show up here."
                    : filter === "open" ? "Everything is closed. Start a new enquiry when a customer asks for a price."
                        : "When a customer asks for a price, start an enquiry and keep every update in one place.";

    return (
        <div className="gd st-listpage">
            <div className="gk-ph" style={{ marginTop: 22 }}>
                <div><h1>RFQs</h1><p>Price requests you take from customers. Only you can see them.</p></div>
                <button type="button" className="st-btn pri" onClick={() => setCreating(true)}><Plus size={16} />New enquiry</button>
            </div>

            <label className="st-srch st-srch-l" style={{ marginTop: 14 }}>
                <Search size={16} aria-hidden="true" />
                <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by company, product or GST number" aria-label="Search enquiries" />
                {qInput && <button type="button" aria-label="Clear search" onClick={() => setQInput("")}><X size={14} /></button>}
            </label>

            <div className="st-tabs" role="group" aria-label="Filter enquiries">
                {TABS.map(([v, l]) => (
                    <button key={v} type="button" className={`st-tab ${v}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>
                        {l}<span className="n">{counts[v] ?? 0}</span>
                    </button>
                ))}
            </div>

            {!loading && !error && <p className="gd-note">{total} enquir{total === 1 ? "y" : "ies"}</p>}

            {loading && items.length === 0 ? (
                <div className="st-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
            ) : items.length > 0 ? (
                <ul className={`st-list${loading ? " busy" : ""}`}>
                    {items.map((t) => <ThreadRow key={t.id} t={t} onWarm={warm} />)}
                </ul>
            ) : !loading && !error && (
                <div className="st-empty-card" style={{ marginTop: 10 }}>
                    <Inbox size={22} />
                    <b>{emptyTitle}</b>
                    {emptyText}
                    {!q && filter === "all" && <button type="button" className="st-btn pri" onClick={() => setCreating(true)}><Plus size={16} />New enquiry</button>}
                </div>
            )}

            {loadingMore && <p className="st-more" aria-live="polite"><Loader2 size={16} className="st-spin" />Loading more…</p>}
            {!loading && error && <div className="st-empty-card"><b>{error}</b><button type="button" className="st-btn" onClick={() => load(0, false)}>Try again</button></div>}
            {hasMore && !loading && <div ref={sentinelRef} style={{ height: 4 }} />}

            {creating && (
                <SalesNewEnquirySheet token={token} onClose={() => setCreating(false)}
                    onCreated={(t) => { setCreating(false); say("Enquiry created."); nav(`/sales/enquiries/${t.id}`); }} />
            )}
        </div>
    );
}