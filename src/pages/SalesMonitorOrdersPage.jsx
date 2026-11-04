// src/pages/SalesMonitorOrdersPage.jsx: /sales/monitor/orders
// Every order punched by the team, with who punched it and who last updated it.
// An order opens the existing Order Book detail page.
import { memo } from "react";
import { Link } from "react-router-dom";
import { Inbox, Loader2 } from "lucide-react";
import { listTime } from "../components/sales/salesThreadFmt.js";
import { dateTime, inr, STATUS_LABEL } from "../components/orderBook/orderBookFmt.js";
import StatusChip from "../components/orderBook/StatusChip.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import useMonitorFilters from "../hooks/useMonitorFilters.js";
import useMonitorList from "../hooks/useMonitorList.js";
import { fetchMonitorOrders } from "../utils/salesMonitorListApi.js";
import MonitorFilters from "../components/team/monitor/MonitorFilters.jsx";
import "../components/sales/sales-threads.css";
import "../components/team/monitor/monitor-lists.css";

const TABS = [["", "All", "all"], ...["placed", "processed", "shipped", "completed", "cancelled"].map((s) => [s, STATUS_LABEL[s] || s, s])];

const Row = memo(function Row({ o }) {
    const differs = !!o.lastUpdatedByName && (o.lastUpdatedById ? o.lastUpdatedById !== o.createdById : o.lastUpdatedByName !== o.createdByName);
    const done = o.status === "completed" || o.status === "cancelled";
    return (
        <li>
            <Link to={`/sell/order-book/${o.id}`} className={`st-row${done ? " closed" : ""}`}>
                <span className="st-row-m">
                    <span className="st-row-1">
                        <b>{o.customerName}</b>
                        <time dateTime={o.updatedAt || o.createdAt}>{listTime(o.updatedAt || o.createdAt)}</time>
                    </span>
                    <span className="st-row-2">
                        {o.orderNo}{o.poNumber ? ` · PO ${o.poNumber}` : ""} · {o.itemsCount} item{o.itemsCount === 1 ? "" : "s"} · {inr(o.total)}
                    </span>
                    <span className="ml-by">
                        <span>Punched by <b>{o.createdByName || "Unknown"}</b></span>
                        {differs && <span className="upd">Updated by <b>{o.lastUpdatedByName}</b></span>}
                    </span>
                    <span className="st-row-3">
                        <small>Placed {dateTime(o.createdAt)}</small>
                        <span className="st-badges"><StatusChip status={o.status} /></span>
                    </span>
                </span>
            </Link>
        </li>
    );
});

export default function SalesMonitorOrdersPage() {
    const { token } = useAuth();
    const f = useMonitorFilters();
    const list = useMonitorList(fetchMonitorOrders, token, f.params);
    const sentinelRef = useInfiniteScrollSentinel(list.loadMore, { lookahead: 600, disabled: list.loading || list.loadingMore || !list.hasMore });

    return (
        <div className="gd st-listpage ml-page">
            <div className="gk-ph" style={{ marginTop: 18 }}>
                <div><h1>Order Book</h1><p>Every order your salespeople punched, and where it stands.</p></div>
            </div>

            <MonitorFilters f={f} placeholder="Search customer, order no. or PO number" />

            <div className="st-tabs" role="group" aria-label="Filter orders">
                {TABS.map(([v, l, ck]) => (
                    <button key={ck} type="button" className="st-tab" aria-pressed={f.status === v} onClick={() => f.setStatus(v)}>
                        {l}<span className="n">{list.counts[ck] ?? 0}</span>
                    </button>
                ))}
            </div>

            {!list.loading && !list.error && <p className="gd-note">{list.total} order{list.total === 1 ? "" : "s"}</p>}

            {list.loading && list.items.length === 0 ? (
                <div className="st-list">{[0, 1, 2, 3].map((i) => <div key={i} className="st-sk tall" />)}</div>
            ) : list.items.length > 0 ? (
                <ul className={`st-list${list.loading ? " busy" : ""}`}>{list.items.map((o) => <Row key={o.id} o={o} />)}</ul>
            ) : !list.loading && !list.error && (
                <div className="st-empty-card" style={{ marginTop: 10 }}>
                    <Inbox size={22} />
                    <b>No orders found</b>
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