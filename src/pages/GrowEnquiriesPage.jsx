// src/pages/GrowEnquiriesPage.jsx — the RFQ / enquiry module (the greeting and KPIs now live on the dashboard).
// Same backend as RfqPage: fetchRfqList / closeRfq + the existing post, bulk-upload and quote modals.
// Live enquiries can be opened on their own page (/grow/enquiry/:id) and shared with the share button.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import RfqFormModal from "../components/rfq/RfqFormModal.jsx";
import RfqBulkUploadModal from "../components/rfq/RfqBulkUploadModal.jsx";
import RfqQuoteModal from "../components/rfq/RfqQuoteModal.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import { fetchRfqList, closeRfq } from "../utils/rfqApi.js";
import { fmtNum, timeAgo, paymentLabel, consumptionLabel, locationSummary } from "../utils/rfqUtils.js";
import { shareEnquiry, enquiryPath } from "../utils/rfqShare.js";
import Ic from "../components/growSeller/Ic.jsx";
import { Thumb, Empty, ListSkeleton } from "../components/growSeller/ui.jsx";
import { useGrowSeller } from "../context/GrowSellerContext.js";
import { toTitleCase, H } from "../components/growSeller/sellerHelpers.js";
import "../components/growSeller/grow-store.css";

const PAGE = 12;
const STATUS_FILTERS = [
    { value: "", label: "All" },
    { value: "pending_review", label: "In review" },
    { value: "approved", label: "Live" },
    { value: "rejected", label: "Needs changes" },
    { value: "closed", label: "Closed" },
];
const STATUS_LABEL = { pending_review: "In review", approved: "Live", rejected: "Needs changes", closed: "Closed" };

const mergeUnique = (prev, incoming) => {
    const seen = new Set(prev.map((i) => i.id));
    return [...prev, ...incoming.filter((i) => !seen.has(i.id))];
};

// Last result per (token, tab, search, status): switching tabs paints instantly, then revalidates silently.
const CACHE = new Map();

function EnquiryCard({ item, quoted, onQuote, onEdit, onClose, onShare }) {
    const mine = item.isMine;
    const total = item.quantity * item.packSize;
    const published = item.publishedAt || item.createdAt;
    const isNew = published && Date.now() - new Date(published).getTime() < H;
    const live = item.status === "approved";
    return (
        <article className="card">
            <div className="top">
                <Thumb src={item.images?.[0]} name={item.productName} />
                <div className="in">
                    <h3>
                        <Link to={enquiryPath(item.id)} state={{ enquiry: item }} style={{ color: "inherit", textDecoration: "none" }}>
                            {toTitleCase(item.productName)}
                        </Link>
                        {mine && <span className={`stt rfq ${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span>}
                        {!mine && isNew && <span className="nw">NEW</span>}
                    </h3>
                    <b className="q">{fmtNum(item.quantity)} Pack{item.quantity === 1 ? "" : "s"} × {fmtNum(item.packSize)} {item.unit}</b>
                    <small>Total {fmtNum(total)} {item.unit}</small>
                    <span className="eq">
                        {item.acceptEquivalent ? <><Ic n="shuffle" />Equivalent OK</> : <><Ic n="equal" />Same product only</>}
                    </span>
                </div>
            </div>
            {item.specifications && <p className="ds">{item.specifications}</p>}
            <ul className="mt" style={{ marginTop: item.specifications ? 0 : 14 }}>
                <li><Ic n="wallet" /><span>{paymentLabel(item)}</span></li>
                <li><Ic n="repeat" /><span>{consumptionLabel(item)}</span></li>
                <li><Ic n="pin" /><span>Deliver to {item.deliveryCity}, {item.deliveryState}</span></li>
                <li><Ic n="pin" /><span>Suppliers: {locationSummary(item.supplierLocations)}</span></li>
            </ul>
            {mine && item.status === "rejected" && item.reviewNote && <p className="rej">{item.reviewNote}</p>}
            {mine && item.status === "pending_review" && <p className="pend">Our team is reviewing this. It will go live once approved.</p>}
            <div className="rf">
                <div className="tm"><Ic n="clock" /><span><b>{timeAgo(published)}</b></span></div>
                <div className="rowa">
                    {live && (
                        <button type="button" className="bt sm" aria-label={`Share enquiry for ${item.productName}`} onClick={() => onShare(item)}>
                            <Share2 size={15} strokeWidth={2.2} />Share
                        </button>
                    )}
                    {mine && ["pending_review", "rejected"].includes(item.status) && (
                        <button type="button" className="bt sm" onClick={() => onEdit(item)}><Ic n="edit" />{item.status === "rejected" ? "Fix & resubmit" : "Edit"}</button>
                    )}
                    {mine && ["pending_review", "approved"].includes(item.status) && (
                        <button type="button" className="bt sm" onClick={() => onClose(item)}><Ic n="x" />Close</button>
                    )}
                    {!mine && live && (
                        quoted
                            ? <span className="qd"><Ic n="check" />Quote sent</span>
                            : <button type="button" className="bt go" onClick={() => onQuote(item)}><Ic n="send" />Submit quote</button>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function GrowEnquiriesPage() {
    const { token } = useAuth();
    const { say } = useGrowSeller();
    const [params, setParams] = useSearchParams();

    const tab = params.get("tab") === "mine" ? "mine" : "all";
    const setTab = (t) => {
        const next = new URLSearchParams(params);
        if (t === "mine") next.set("tab", "mine"); else next.delete("tab");
        setParams(next, { replace: true });
    };

    const [qInput, setQInput] = useState("");
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("");
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [formState, setFormState] = useState(null); // { mode, initial }
    const [bulkOpen, setBulkOpen] = useState(false);
    const [quoteFor, setQuoteFor] = useState(null);
    const [quoted, setQuoted] = useState(() => new Set());

    const abortRef = useRef(null);
    const seqRef = useRef(0);
    const itemsRef = useRef([]);
    itemsRef.current = items;

    useEffect(() => {
        const t = setTimeout(() => setQ(qInput.trim()), 300);
        return () => clearTimeout(t);
    }, [qInput]);

    const load = useCallback(async (offset, append) => {
        const key = `${token}|${tab}|${q}|${tab === "mine" ? status : ""}`;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const seq = ++seqRef.current;

        if (append) setLoadingMore(true);
        else {
            setError(null);
            const hit = CACHE.get(key);
            if (hit) { setItems(hit.items); setTotal(hit.total); setHasMore(hit.hasMore); setLoading(false); }
            else { setItems([]); setTotal(0); setHasMore(false); setLoading(true); }
        }
        try {
            const res = await fetchRfqList(token, {
                scope: tab, q, status: tab === "mine" ? status : "", limit: PAGE, offset, signal: controller.signal,
            });
            if (seq !== seqRef.current) return;
            if (!res.success) {
                if (!append && !CACHE.get(key)) { setItems([]); setTotal(0); }
                setHasMore(false);
                setError(res.message || "Couldn't load enquiries.");
                return;
            }
            const merged = append ? mergeUnique(itemsRef.current, res.items || []) : res.items || [];
            setItems(merged);
            setTotal(res.total ?? 0);
            setHasMore(!!res.hasMore);
            CACHE.set(key, { items: merged, total: res.total ?? 0, hasMore: !!res.hasMore });
        } catch (e) {
            if (e?.name !== "AbortError" && seq === seqRef.current) setHasMore(false);
        } finally {
            if (seq === seqRef.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [token, tab, q, status]);

    useEffect(() => {
        if (!token) { setLoading(false); return undefined; }
        load(0, false);
        return () => abortRef.current?.abort();
    }, [load, reloadKey, token]);

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && load(items.length, true),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore }
    );

    const afterSubmit = (message) => {
        say(message);
        if (tab !== "mine") setTab("mine");
        setStatus("");
        CACHE.clear();
        setReloadKey((k) => k + 1);
    };

    const handleClose = async (item) => {
        if (!window.confirm(`Close the enquiry for "${item.productName}"? Suppliers will no longer see it.`)) return;
        const res = await closeRfq(token, item.id);
        if (!res.success) { say(res.message || "Couldn't close this enquiry."); return; }
        say("Enquiry closed.");
        CACHE.clear();
        setReloadKey((k) => k + 1);
    };

    const handleShare = async (item) => {
        const r = await shareEnquiry(item);
        if (r === "copied") say("Enquiry link copied.");
        else if (r === "failed") say("Couldn't copy the link.");
    };

    return (
        <div className="v">
            <h2 className="h2" style={{ marginTop: 22 }}>Requests for quotation</h2>
            <p className="sub2">Quote on live enquiries from buyers.</p>

            {/* <div className="act">
                <button className="bt" type="button" onClick={() => setBulkOpen(true)}><Ic n="upload" />Bulk upload</button>
                <button className="bt or" type="button" onClick={() => setFormState({ mode: "create", initial: null })}><Ic n="plus" />Post enquiry</button>
            </div> */}

            <div className="tb" style={{ marginTop: 14 }}>
                <label className="srch">
                    <Ic n="search" />
                    <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search enquiries" aria-label="Search enquiries" />
                    {qInput && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQInput("")}><Ic n="x" /></button>}
                </label>
            </div>

            {tab === "mine" && (
                <div className="chs">
                    {STATUS_FILTERS.map((s) => (
                        <button key={s.value || "all"} type="button" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>{s.label}</button>
                    ))}
                </div>
            )}

            {!loading && !error && <p className="cnt">{total} enquir{total === 1 ? "y" : "ies"}</p>}

            {loading && items.length === 0 ? <ListSkeleton n={4} tall /> : (
                <div className="grid c3">
                    {items.map((item) => (
                        <EnquiryCard key={item.id} item={item} quoted={quoted.has(item.id)}
                            onQuote={setQuoteFor}
                            onEdit={(it) => setFormState({ mode: "edit", initial: it })}
                            onClose={handleClose}
                            onShare={handleShare} />
                    ))}
                    {!loading && !error && items.length === 0 && (
                        <Empty
                            title={q ? "No enquiries match your search" : tab === "mine" ? "You have not posted an enquiry yet" : "No live enquiries right now"}
                            text={tab === "mine" && !q ? "Post what you need and suppliers will quote." : q ? "Try a different word." : "New enquiries appear here as buyers post them."}>
                            {tab === "mine" && !q && (<><br /><button className="bt or" type="button" onClick={() => setFormState({ mode: "create", initial: null })}><Ic n="plus" />Post enquiry</button></>)}
                        </Empty>
                    )}
                </div>
            )}

            {!loading && error && (
                <div className="errb"><b>{error}</b><button type="button" className="bt go" onClick={() => setReloadKey((k) => k + 1)}>Try again</button></div>
            )}
            {loadingMore && <div className="more"><Ic n="spin" /></div>}
            {hasMore && !loading && <div ref={sentinelRef} style={{ height: 4 }} />}

            {createPortal(
                <AnimatePresence>
                    {formState && (
                        <RfqFormModal key="form" mode={formState.mode} initial={formState.initial} token={token}
                            onClose={() => setFormState(null)}
                            onSubmitted={(res) => { setFormState(null); afterSubmit(res.message || "Submitted for review."); }} />
                    )}
                    {bulkOpen && (
                        <RfqBulkUploadModal key="bulk" token={token} onClose={() => setBulkOpen(false)}
                            onUploaded={(res, skipped) => {
                                setBulkOpen(false);
                                afterSubmit(`${res.message}${skipped ? ` ${skipped} row${skipped === 1 ? " was" : "s were"} skipped.` : ""}`);
                            }} />
                    )}
                    {quoteFor && (
                        <RfqQuoteModal key="quote" enquiry={quoteFor} onClose={() => setQuoteFor(null)}
                            onDone={() => { setQuoted((s) => new Set(s).add(quoteFor.id)); setQuoteFor(null); say("Quote preview submitted."); }} />
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}