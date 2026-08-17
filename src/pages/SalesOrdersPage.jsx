// pages/SalesOrdersPage.jsx
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, User, Phone, Mail, ShieldCheck, Loader2, Store, IndianRupee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerOrders, confirmSellerOrder, rejectSellerOrder, processSellerOrder, shipSellerOrder, deliverSellerOrder } from "../utils/api.js";
import useRealtimeOrders from "../hooks/useRealtimeOrders.js";
import { C, EASE } from "../components/catalog/tokens";

const STATUS_TABS = [
    { key: "", label: "All" }, { key: "pending_confirmation", label: "New" }, { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Processing" }, { key: "shipped", label: "Shipped" }, { key: "delivered", label: "Delivered" },
    { key: "rejected", label: "Rejected" }, { key: "cancelled", label: "Cancelled" },
];
const NEXT_ACTION = {
    pending_confirmation: [{ key: "confirm", label: "Confirm order", fn: confirmSellerOrder, primary: true }, { key: "reject", label: "Reject", fn: rejectSellerOrder, needsReason: true }],
    confirmed: [{ key: "process", label: "Mark as processing", fn: processSellerOrder, primary: true }],
    processing: [{ key: "ship", label: "Mark as shipped", fn: shipSellerOrder, primary: true }],
    shipped: [{ key: "deliver", label: "Mark as delivered", fn: deliverSellerOrder, primary: true }],
};

function OrderCard({ order, idx, onAction }) {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(null);
    const actions = NEXT_ACTION[order.status] || [];
    const addr = order.shipping_address_snapshot || {};

    const run = async (action) => {
        if (action.needsReason) {
            const reason = window.prompt("Reason for rejecting this order (shown to the buyer):");
            if (reason === null) return;
            setBusy(action.key); await onAction(order.id, action.fn, reason); setBusy(null); return;
        }
        setBusy(action.key); await onAction(order.id, action.fn); setBusy(null);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            onClick={() => navigate(`/seller/orders/${order.id}`)}
            className="cursor-pointer rounded-2xl border bg-white p-3.5 sm:p-4" style={{ borderColor: C.hair }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{order.order_number}</p>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: `${C.secondary}14`, color: C.secondary }}>{order.status.replace("_", " ")}</span>
            </div>
            <div className="mt-2.5 flex flex-col gap-2">
                {(order.items || []).map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5">
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-white" style={{ borderColor: C.hair }}>
                            {item.image_snapshot ? <img src={item.image_snapshot} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto h-4 w-4" style={{ color: C.muted }} />}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-bold" style={{ color: C.ink }}>{item.product_name_snapshot}</p>
                            <p className="text-[11px] font-semibold" style={{ color: C.muted }}>{item.quantity} {item.unit} × ₹{item.unit_price}</p>
                        </div>
                        <p className="text-[12.5px] font-extrabold" style={{ color: C.ink }}>₹{item.line_total}</p>
                    </div>
                ))}
            </div>
            <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: C.hair, background: "#fafbfb" }}>
                <p className="flex items-center gap-1 text-[12px] font-bold" style={{ color: C.ink }}>
                    <User className="h-3 w-3" /> {order.buyer_contact_name}
                    {order.buyer_gst_verified && <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold text-white" style={{ background: C.secondary }}><ShieldCheck className="h-2.5 w-2.5" /> GST Verified</span>}
                </p>
                {order.buyer_business_name && <p className="text-[11px] font-semibold" style={{ color: C.muted }}>{order.buyer_business_name}{order.buyer_gstin ? ` · ${order.buyer_gstin}` : ""}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] font-semibold" style={{ color: C.muted }}>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.buyer_contact_phone}</span>
                    {order.buyer_contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{order.buyer_contact_email}</span>}
                </p>
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed" style={{ color: C.muted }}>
                    Ship to: {addr.contact_name}, {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}
                </p>
                {order.buyer_notes && <p className="mt-1 text-[11px] font-medium italic" style={{ color: C.muted }}>"{order.buyer_notes}"</p>}
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: `${C.primary}08` }}>
                <div className="text-[10.5px] font-semibold" style={{ color: C.muted }}>Order total ₹{order.subtotal_amount} · Platform fee {order.platform_fee_percent}% (₹{order.platform_fee_amount})</div>
                <p className="flex items-center gap-0.5 text-[13px] font-extrabold" style={{ color: C.primary }}><IndianRupee className="h-3.5 w-3.5" />{order.seller_payout_amount}</p>
            </div>
            {actions.length > 0 && (
                <div className="mt-3 flex gap-2">
                    {actions.map((a) => (
                        <button key={a.key} disabled={busy !== null} onClick={() => run(a)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold ${a.primary ? "text-white" : ""}`}
                            style={a.primary ? { background: `linear-gradient(135deg, ${C.secondary} 0%, #047084 100%)` } : { border: `1px solid ${C.hair}`, color: C.primary }}>
                            {busy === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : a.label}
                        </button>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

export default function SalesOrdersPage() {
    const navigate = useNavigate();
    const { token, profile } = useAuth();
    const [activeStatus, setActiveStatus] = useState("");

    const fetcher = useCallback(async () => {
        const res = await fetchSellerOrders(token, activeStatus || undefined);
        if (!res?.success) throw new Error(res?.message || "Couldn't load orders.");
        return res.orders;
    }, [token, activeStatus]);

    // FIX: useRealtimeOrders only accepts { channelToken, fetcher } — it
    // has no notion of "role"/"ownerId". The old call here passed those
    // and they were silently dropped, so this page never subscribed to
    // realtime updates (new orders only appeared after a manual refresh).
    // notifyUser(sellerProfile.user_id, ...) + notifyUserOrdersChanged
    // broadcast on the `user-${sellerProfile.user_id}` channel (see
    // orders.controller.js / sellerOrders.controller.js), so this needs
    // the seller's own user id — same `profile.notificationChannel` the
    // buyer-side PurchaseOrdersPage already uses correctly.
    const { orders, loading, reload } = useRealtimeOrders({ channelToken: profile?.notificationChannel, fetcher });
    const handleAction = async (orderId, fn, reason) => { const res = await fn(token, orderId, reason); if (res?.success) reload(); else window.alert(res?.message || "Couldn't update the order."); };

    return (
        <div className="mx-auto min-h-screen max-w-4xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair, color: C.ink }} aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                <h1 className="font-extrabold tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}>Sales Orders</h1>
            </div>
            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveStatus(t.key)} className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
                        style={{ borderColor: activeStatus === t.key ? C.secondary : C.hair, background: activeStatus === t.key ? `${C.secondary}10` : "#fff", color: activeStatus === t.key ? C.secondary : C.muted }}>
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="mt-4 flex flex-col gap-3">
                {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />)
                    : orders.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}><Store className="h-7 w-7" strokeWidth={1.8} /></span>
                            <h3 className="mt-4 text-[15px] font-extrabold" style={{ color: C.ink }}>No orders yet</h3>
                            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>Orders buyers place on your listings will show up here in real time.</p>
                        </div>
                    ) : orders.map((o, i) => <OrderCard key={o.id} order={o} idx={i} onAction={handleAction} />)}
            </div>
        </div>
    );
}