// pages/PurchaseOrdersPage.jsx
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Loader2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyOrders, cancelMyOrder } from "../utils/api.js";
import useRealtimeOrders from "../hooks/useRealtimeOrders.js";
import { C, EASE } from "../components/catalog/tokens";

const STATUS_TABS = [
    { key: "", label: "All" }, { key: "pending_confirmation", label: "Pending" }, { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Processing" }, { key: "shipped", label: "Shipped" }, { key: "delivered", label: "Delivered" },
    { key: "cancelled", label: "Cancelled" }, { key: "rejected", label: "Rejected" },
];
const STATUS_STYLE = {
    pending_confirmation: { bg: "#f59e0b14", fg: "#b45309", label: "Awaiting seller" },
    confirmed: { bg: `${C.secondary}14`, fg: C.secondary, label: "Confirmed" },
    processing: { bg: `${C.secondary}14`, fg: C.secondary, label: "Processing" },
    shipped: { bg: "#7c3aed14", fg: "#7c3aed", label: "Shipped" },
    delivered: { bg: "#05966914", fg: "#059669", label: "Delivered" },
    cancelled: { bg: "#64748b14", fg: "#64748b", label: "Cancelled" },
    rejected: { bg: `${C.primary}14`, fg: C.primary, label: "Rejected by seller" },
};

function StatusChip({ status }) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending_confirmation;
    return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function OrderCard({ order, idx, onCancel }) {
    const [cancelling, setCancelling] = useState(false);
    const canCancel = order.status === "pending_confirmation";
    const item = order.items?.[0];
    const extraCount = (order.items?.length || 1) - 1;

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            className="rounded-2xl border bg-white p-3.5 sm:p-4" style={{ borderColor: C.hair }}>
            <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{order.order_number}</p>
                <StatusChip status={order.status} />
            </div>
            <div className="mt-2.5 flex gap-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                    {item?.image_snapshot ? <img src={item.image_snapshot} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5" style={{ color: C.muted }} /></div>}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold" style={{ color: C.ink }}>{item?.product_name_snapshot}</p>
                    <p className="truncate text-[11.5px] font-semibold" style={{ color: C.muted }}>
                        {item?.quantity} {item?.unit} · from {order.seller?.display_name}{extraCount > 0 ? ` +${extraCount} more item${extraCount === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className="mt-1 text-[13px] font-extrabold" style={{ color: C.primary }}>₹{order.total_amount}</p>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-semibold" style={{ color: C.muted }}>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                {canCancel && (
                    <button disabled={cancelling} onClick={async () => { setCancelling(true); await onCancel(order.id); setCancelling(false); }}
                        className="rounded-lg border px-3 py-1.5 text-[11px] font-bold" style={{ borderColor: C.hair, color: C.primary }}>
                        {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel order"}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export default function PurchaseOrdersPage() {
    const navigate = useNavigate();
    const { token, profile } = useAuth();
    const [activeStatus, setActiveStatus] = useState("");

    const fetcher = useCallback(async () => {
        const res = await fetchMyOrders(token, activeStatus || undefined);
        if (!res?.success) throw new Error(res?.message || "Couldn't load orders.");
        return res.orders;
    }, [token, activeStatus]);

    const { orders, loading, reload } = useRealtimeOrders({ role: "buyer", ownerId: profile?.id, fetcher });
    const handleCancel = async (orderId) => { const res = await cancelMyOrder(token, orderId, "Cancelled by buyer"); if (res?.success) reload(); };

    return (
        <div className="mx-auto min-h-screen max-w-4xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair, color: C.ink }} aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                <h1 className="font-extrabold tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}>My Purchase Orders</h1>
            </div>
            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveStatus(t.key)} className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
                        style={{ borderColor: activeStatus === t.key ? C.primary : C.hair, background: activeStatus === t.key ? `${C.primary}10` : "#fff", color: activeStatus === t.key ? C.primary : C.muted }}>
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="mt-4 flex flex-col gap-3">
                {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />)
                    : orders.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}><ShoppingBag className="h-7 w-7" strokeWidth={1.8} /></span>
                            <h3 className="mt-4 text-[15px] font-extrabold" style={{ color: C.ink }}>No orders yet</h3>
                            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>Orders you place with sellers will show up here.</p>
                        </div>
                    ) : orders.map((o, i) => <OrderCard key={o.id} order={o} idx={i} onCancel={handleCancel} />)}
            </div>
        </div>
    );
}