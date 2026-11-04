// src/pages/SalesMonitorEnquiriesPage.jsx: /sales/monitor/enquiries
// Every enquiry of the company, same look as the salesperson's list, plus who created it and who updated it last.
import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Receipt, Inbox, Loader2, Trophy, XCircle, Bell, PhoneCall, ArrowLeft } from "lucide-react";
import { dateTime, listTime, qty } from "../components/sales/salesThreadFmt.js";
import { useAuth } from "../context/AuthContext.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import useMonitorFilters from "../hooks/useMonitorFilters.js";
import useMonitorList from "../hooks/useMonitorList.js";
import { fetchMonitorEnquiries } from "../utils/salesMonitorListApi.js";
import MonitorFilters from "../components/team/monitor/MonitorFilters.jsx";
import "../components/sales/sales-threads.css";
import "../components/sales/sales-threads.cold.css";
import "../components/sales/sales-chat.css";
import "../components/team/monitor/monitor-lists.css";

const TABS = [["", "All", "all"], ["open", "Open", "open"], ["reminder", "Reminders", "reminder"], ["cold", "Cold calls", "cold"], ["won", "Won", "won"], ["lost", "Lost", "lost"]];
const kindOf = (t) => (t.status !== "closed" ? "open" : t.outcome === "won" ? "won" : t.outcome === "lost" ? "lost" : "closed");

const Row = memo(function Row({ t, from }) {
    const kind = kindOf(t);
    const due = !!t.reminderAt && new Date(t.reminderAt).getTime() <= Date.now();
    const hasProduct = t.hasProduct !== false;
    const cold = t.kind === "cold_call";
    const differs = !!t.lastUpdatedByName && (t.lastUpdatedById ? t.lastUpdatedById !== t.createdById : t.lastUpdatedByName !== t.createdByName);

    return (
        <li>
            <Link to={`/sales/monitor/enquiries/${t.id}`} state={{ from }} className={`st-row${kind === "open" ? "" : " closed"}`}>
                <span className="st-row-m">
                    <span className="st-row-1">
                        <b>{t.displayName}</b>
                        <time dateTime={t.lastActivityAt}>{listTime(t.lastActivityAt)}</time>
                    </span>
                    <span className="st-row-2">
                        {hasProduct ? `${t.productName} · ${qty(t.quantity)} ${t.unit}` : <span className="st-noprod-t">No product yet</span>}
                    </span>
                    <span className="ml-by">
                        <span>{cold ? "Logged by" : "Created by"} <b>{t.createdByName || "Unknown"}</b></span>
                        {differs && <span className="upd">Updated by <b>{t.lastUpdatedByName}</b></span>}
                    </span>
                    {t.lastPreview && <span className="st-row-4">{t.lastPreview}</span>}
                    <span className="st-row-3">
                        <small>{cold ? "Logged" : "Posted"} {dateTime(t.createdAt)}</small>
                        <span className="st-badges">
                            {cold && <span className="st-bd cold"><PhoneCall size={12} />Cold call</span>}
                            {t.reminderAt && kind === "open" && (
                                <span className={`st-bd rem${due ? " due" : ""}`}><Bell size={12} />{due ? "Due " : ""}{dateTime(t.reminderAt)}</span>
                            )}
                            {t.quotesCount > 0 && <span className="st-bd"><Receipt size={12} />{t.quotesCount}</span>}
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

export default function SalesMonitorEnquiriesPage() {
    const { token } = useAuth();
    const loc = useLocation();
    const f = useMonitorFilters();
    const list = useMonitorList(fetchMonitorEnquiries, token, f.params);
    const sentinelRef = useInfiniteScrollSentinel(list.loadMore, { lookahead: 600, disabled: list.loading || list.loadingMore || !list.hasMore });
    const from = `${loc.pathname}${loc.search}`;

    return (
        <div className="gd st-listpage ml-page">
            {/* <button type="button" className="st-ib" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft size={18} /></button> */}
            <div className="gk-ph" style={{ marginTop: 18 }}>
                <div><h1>Enquiries</h1><p>Every enquiry your team is working on. Tap one to read the chat.</p></div>
            </div>

            <MonitorFilters f={f} placeholder="Search by company, product, city or GST number" />

            <div className="st-tabs" role="group" aria-label="Filter enquiries">
                {TABS.map(([v, l, ck]) => (
                    <button key={ck} type="button" className={`st-tab ${ck}`} aria-pressed={f.status === v} onClick={() => f.setStatus(v)}>
                        {l}<span className="n">{list.counts[ck] ?? 0}</span>
                    </button>
                ))}
            </div>

            {!list.loading && !list.error && <p className="gd-note">{list.total} enquir{list.total === 1 ? "y" : "ies"}</p>}

            {list.loading && list.items.length === 0 ? (
                <div className="st-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
            ) : list.items.length > 0 ? (
                <ul className={`st-list${list.loading ? " busy" : ""}`}>{list.items.map((t) => <Row key={t.id} t={t} from={from} />)}</ul>
            ) : !list.loading && !list.error && (
                <div className="st-empty-card" style={{ marginTop: 10 }}>
                    <Inbox size={22} />
                    <b>No enquiries found</b>
                    Try another date range, employee or search.
                    {f.filtered && <button type="button" className="st-btn" onClick={f.reset}>Reset filters</button>}
                </div>
            )}

            {list.loadingMore && <p className="st-more" aria-live="polite"><Loader2 size={16} className="st-spin" />Loading more…</p>}
            {!list.loading && list.error && <div className="st-empty-card"><b>{list.error}</b><button type="button" className="st-btn" onClick={list.reload}>Try again</button></div>}
            {list.hasMore && !list.loading && <div ref={sentinelRef} style={{ height: 4 }} />}
        </div>
    );
}