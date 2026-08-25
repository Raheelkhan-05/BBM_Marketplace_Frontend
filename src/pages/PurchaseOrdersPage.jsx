import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Loader2, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyOrders, cancelMyOrder } from "../utils/api.js";
import useRealtimeOrders from "../hooks/useRealtimeOrders.js";
import { C, EASE } from "../components/catalog/tokens";
import { StatusChip, SampleBadge, ItemQuantityLine, DeliveryEstimate, displayAmount, StockShortfallNote, shouldShowDelivery, shouldShowShortfall } from "../components/orders/OrderDisplayHelpers.jsx";
import { motion } from "framer-motion";

const STATUS_TABS = [
    { key: "", label: "All" }, { key: "pending_confirmation", label: "Pending" }, { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Processing" }, { key: "shipped", label: "Shipped" }, { key: "delivered", label: "Delivered" },
    { key: "cancelled", label: "Cancelled" }, { key: "rejected", label: "Rejected" },
];
const TYPE_TABS = [
    { key: "", label: "All orders" }, { key: "standard", label: "Standard" }, { key: "sample", label: "Samples" },
];

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

function GroupBadge({ groupNumber }) {
    if (!groupNumber) return null;
    return (
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: "#0B728514", color: "#0B7285" }}>
            Group #{groupNumber}
        </span>
    );
}

function OrderCard({ order, idx, onCancel }) {
    const navigate = useNavigate();
    const [cancelling, setCancelling] = useState(false);
    const canCancel = order.status === "pending_confirmation";
    const item = order.items?.[0];
    const extraCount = (order.items?.length || 1) - 1;
    const isSample = order.order_type === "sample";

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            onClick={() => navigate(`/orders/${order.id}`)}
            className="cursor-pointer rounded-2xl border bg-white p-3.5 transition-shadow duration-150 hover:shadow-sm sm:p-4" style={{ borderColor: isSample ? "#7c3aed30" : C.hair }}>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{order.order_number}</p>
                    {isSample && <SampleBadge />}
                    <GroupBadge groupNumber={order.group_number} />
                </div>
                <StatusChip status={order.status} />
            </div>

            <div className="mt-3 flex gap-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                    {item?.image_snapshot ? <img src={item.image_snapshot} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5" style={{ color: C.muted }} /></div>}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{item?.product_name_snapshot}</p>
                    <p className="mt-0.5 truncate text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                        {item && <ItemQuantityLine item={item} mutedColor={C.muted} />} · from {order.seller?.display_name}
                        {extraCount > 0 ? ` +${extraCount} more item${extraCount === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className="mt-1.5 text-[15px] font-extrabold tabular-nums tracking-wide" style={{ color: isSample ? "#7c3aed" : C.primary }}>
                        {displayAmount(order.total_amount, { isSample })}
                    </p>
                </div>
            </div>

            {(item && shouldShowDelivery(order, item)) || shouldShowShortfall(order) ? (
                <div className="mt-2.5 flex flex-col gap-1.5">
                    {item && shouldShowDelivery(order, item) && <DeliveryEstimate order={order} item={item} />}
                    {shouldShowShortfall(order) && <StockShortfallNote audience="buyer" />}
                </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: C.hairSoft }}>
                <p className="text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                    {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {canCancel && (
                    <button disabled={cancelling}
                        onClick={(e) => { e.stopPropagation(); (async () => { setCancelling(true); await onCancel(order.id); setCancelling(false); })(); }}
                        className="rounded-lg border px-3 py-1.5 text-[12.5px] font-bold tracking-wide" style={{ borderColor: C.hair, color: C.primary }}>
                        {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel order"}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// Wraps a real multi-seller group (2+ orders sharing an order_group_id) in
// a header showing the group number and combined total. A "group" of one
// (no order_group_id — a plain single-seller order) just renders as a
// bare OrderCard, unchanged from before.
function OrderGroup({ group, startIdx, onCancel }) {
    if (!group.groupId) {
        return <OrderCard order={group.orders[0]} idx={startIdx} onCancel={onCancel} />;
    }
    const combinedTotal = group.orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    return (
        <div className="rounded-2xl border-2 border-dashed p-3" style={{ borderColor: "#0B728540" }}>
            <div className="flex items-center justify-between px-1 pb-2.5">
                <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "#0B7285" }}>
                    Order Group {group.groupNumber ? `#${group.groupNumber}` : ""} · {group.orders.length} sellers
                </p>
                <p className="text-[13px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{inr(combinedTotal)}</p>
            </div>
            <div className="flex flex-col gap-3">
                {group.orders.map((o, i) => <OrderCard key={o.id} order={o} idx={startIdx + i} onCancel={onCancel} />)}
            </div>
        </div>
    );
}

export default function PurchaseOrdersPage() {
    const navigate = useNavigate();
    const { token, profile } = useAuth();
    const [activeStatus, setActiveStatus] = useState("");
    const [activeType, setActiveType] = useState("");

    const fetcher = useCallback(async () => {
        const res = await fetchMyOrders(token, activeStatus || undefined, activeType || undefined);
        if (!res?.success) throw new Error(res?.message || "Couldn't load orders.");
        return res.orders; // flat — grouping happens below, for display only
    }, [token, activeStatus, activeType]);

    const { orders, loading, reload } = useRealtimeOrders({ channelToken: profile?.notificationChannel, fetcher });
    const handleCancel = async (orderId) => { const res = await cancelMyOrder(token, orderId, "Cancelled by buyer"); if (res?.success) reload(); };

    // Groups orders that share an order_group_id (placed together via cart
    // checkout) into a single visual unit; ungrouped orders each stand alone.
    const groups = useMemo(() => {
        const map = new Map();
        for (const o of orders || []) {
            const key = o.order_group_id || `single:${o.id}`;
            if (!map.has(key)) map.set(key, { groupId: o.order_group_id || null, groupNumber: o.group_number || null, orders: [] });
            map.get(key).orders.push(o);
        }
        return Array.from(map.values()).sort((a, b) => {
            const aLatest = Math.max(...a.orders.map((o) => new Date(o.created_at).getTime()));
            const bLatest = Math.max(...b.orders.map((o) => new Date(o.created_at).getTime()));
            return bLatest - aLatest;
        });
    }, [orders]);

    return (
        <div className="mx-auto min-h-screen max-w-4xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate('/home')} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair }}><ArrowLeft className="h-4 w-4" /></button>
                <h1 className="font-extrabold" style={{ color: C.ink, fontSize: "clamp(20px,1.8vw,26px)" }}>Cart</h1>
            </div>
            <div className="mt-3 flex items-center gap-3">

                <h1 className="font-extrabold tracking-wide" style={{ color: C.ink, fontSize: "clamp(22px, 1.8vw, 27px)" }}>My Purchase Orders</h1>
            </div>

            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TYPE_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveType(t.key)} className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold tracking-wide"
                        style={{ borderColor: activeType === t.key ? "#0B7285" : C.hair, background: activeType === t.key ? "#0B7285" : "#fff", color: activeType === t.key ? "#ffffff" : C.muted }}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveStatus(t.key)} className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold tracking-wide"
                        style={{ borderColor: activeStatus === t.key ? C.primary : C.hair, background: activeStatus === t.key ? `${C.primary}` : "#fff", color: activeStatus === t.key ? "#ffffff" : C.muted }}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-4 flex flex-col gap-3">
                {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />)
                    : groups.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}><ShoppingBag className="h-7 w-7" strokeWidth={1.8} /></span>
                            <h3 className="mt-4 text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>No orders yet</h3>
                            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium tracking-wide" style={{ color: C.muted }}>Orders you place with sellers will show up here.</p>
                        </div>
                    ) : groups.map((g, i) => (
                        <OrderGroup key={g.groupId || g.orders[0].id} group={g} startIdx={i} onCancel={handleCancel} />
                    ))}
            </div>
        </div>
    );
}