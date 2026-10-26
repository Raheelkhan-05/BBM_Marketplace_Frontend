// src/pages/SalesEnquiriesPage.jsx
// The salesperson's own enquiry threads, newest activity first (like a chat list):
// customer company, product, when the enquiry was posted (the same customer can ask for the same product again).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Plus, Search, X, Receipt, Inbox } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import useRfqLive from "../hooks/useRfqLive.js";
import { fetchThreads } from "../utils/salesThreadApi.js";
import SalesNewEnquirySheet from "../components/sales/SalesNewEnquirySheet.jsx";
import { dateTime, initialOf, listTime, qty } from "../components/sales/salesThreadFmt.js";
import "../components/sales/sales-threads.css";

const PAGE = 15;
const MAX_PAGE = 100; // server cap
const mergeUnique = (prev, inc) => { const s = new Set(prev.map((i) => i.id)); return [...prev, ...inc.filter((i) => !s.has(i.id))]; };

function ThreadRow({ t }) {
    const closed = t.status === "closed";
    return (
        <Link to={`/sales/enquiries/${t.id}`} className={`st-row${closed ? " closed" : ""}`}>
            <span className="st-av" aria-hidden="true">{initialOf(t.displayName)}</span>
            <span className="st-row-m">
                <span className="st-row-1">
                    <b>{t.displayName}</b>
                    <time dateTime={t.lastActivityAt}>{listTime(t.lastActivityAt)}</time>
                </span>
                <span className="st-row-2">{t.productName} · {qty(t.quantity)} {t.unit}</span>
                <span className="st-row-3">
                    <small>Posted {dateTime(t.createdAt)}</small>
                    <span className="st-badges">
                        {t.quotesCount > 0 && <span className="st-bd"><Receipt size={12} />{t.quotesCount}</span>}
                        {closed && <span className="st-bd mute">Closed</span>}
                    </span>
                </span>
                {t.lastPreview && <span className="st-row-4">{t.lastPreview}</span>}
            </span>
        </Link>
    );
}

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
    const [counts, setCounts] = useState({ all: 0, open: 0, closed: 0 });
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
        if (append) setLoadingMore(true); else if (!silent) { setError(""); setLoading(true); }
        try {
            // a silent refresh re-reads what is on screen, so scrolled pages don't collapse
            const limit = silent && !append ? Math.min(Math.max(PAGE, itemsRef.current.length), MAX_PAGE) : PAGE;
            const res = await fetchThreads(token, { q, status: filter === "all" ? "" : filter, limit, offset, signal: ctl.signal });
            if (my !== seqRef.current) return;
            if (!res.success) { if (!silent) { setError(res.message || "Couldn't load your enquiries."); setHasMore(false); } return; }
            setItems(append ? mergeUnique(itemsRef.current, res.items || []) : res.items || []);
            setTotal(res.total ?? 0); setHasMore(!!res.hasMore);
            if (res.counts) setCounts(res.counts);
            setError("");
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

    const chips = [["all", "All", counts.all], ["open", "Open", counts.open], ["closed", "Closed", counts.closed]];

    return (
        <div className="gd">
            <div className="gk-ph" style={{ marginTop: 22 }}>
                <div><h1>Enquiries</h1><p>Price requests you take from customers. Only you can see them.</p></div>
                <button type="button" className="st-btn pri" onClick={() => setCreating(true)}><Plus size={16} />New enquiry</button>
            </div>

            <label className="st-srch" style={{ marginTop: 14 }}>
                <Search size={16} aria-hidden="true" />
                <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by company, product or GST number" aria-label="Search enquiries" />
                {qInput && <button type="button" aria-label="Clear search" onClick={() => setQInput("")}><X size={14} /></button>}
            </label>

            <div className="gd-ranges" role="group" aria-label="Filter" style={{ marginTop: 12 }}>
                {chips.map(([v, l, n]) => <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l} · {n}</button>)}
            </div>

            {!loading && !error && <p className="gd-note">{total} enquir{total === 1 ? "y" : "ies"}</p>}

            {loading && items.length === 0 ? (
                <div className="st-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
            ) : (
                <div className="st-list">
                    {items.map((t) => <ThreadRow key={t.id} t={t} />)}
                    {!loading && !error && items.length === 0 && (
                        <div className="st-empty-card">
                            <Inbox size={22} />
                            <b>{q ? "No enquiries match your search" : filter === "closed" ? "No closed enquiries" : "No enquiries yet"}</b>
                            {q ? "Try a different company, product or GST number." : "When a customer asks for a price, start an enquiry and keep every update in one place."}
                            {!q && filter === "all" && <button type="button" className="st-btn pri" onClick={() => setCreating(true)}><Plus size={16} />New enquiry</button>}
                        </div>
                    )}
                </div>
            )}

            {!loading && error && <div className="st-empty-card"><b>{error}</b><button type="button" className="st-btn" onClick={() => load(0, false)}>Try again</button></div>}
            {hasMore && !loading && <div ref={sentinelRef} style={{ height: 4 }} />}

            {creating && (
                <SalesNewEnquirySheet token={token} onClose={() => setCreating(false)}
                    onCreated={(t) => { setCreating(false); say("Enquiry created."); nav(`/sales/enquiries/${t.id}`); }} />
            )}
        </div>
    );
}