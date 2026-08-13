import { useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, MapPin, Loader2, CheckCircle2, Circle, XCircle, Radio } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchOrderById, cancelMyOrder } from "../utils/api.js";
import useRealtimeOrder from "../hooks/useRealtimeOrder.js";
import { C, EASE } from "../components/catalog/tokens";

const STATUS_STYLE = {
    pending_confirmation: { bg: "#f59e0b14", fg: "#b45309", label: "Awaiting seller" },
    confirmed: { bg: `${C.secondary}14`, fg: C.secondary, label: "Confirmed" },
    processing: { bg: `${C.secondary}14`, fg: C.secondary, label: "Processing" },
    shipped: { bg: "#7c3aed14", fg: "#7c3aed", label: "Shipped" },
    delivered: { bg: "#05966914", fg: "#059669", label: "Delivered" },
    cancelled: { bg: "#64748b14", fg: "#64748b", label: "Cancelled" },
    rejected: { bg: `${C.primary}14`, fg: C.primary, label: "Rejected by seller" },
};
const TIMELINE_STEPS = ["pending_confirmation", "confirmed", "processing", "shipped", "delivered"];

function StatusChip({ status }) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending_confirmation;
    return <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

// NOTE: assumes order_events has a `to_status` + `created_at` column from
// your update_order_status RPC — rename here if your schema differs.
function Timeline({ status, events }) {
    const isTerminalBad = status === "cancelled" || status === "rejected";
    const currentIdx = TIMELINE_STEPS.indexOf(status);
    return (
        <div className="flex flex-col gap-0">
            {TIMELINE_STEPS.map((step, i) => {
                const done = !isTerminalBad && i <= currentIdx;
                const isCurrent = !isTerminalBad && i === currentIdx;
                const event = events.find((e) => e.to_status === step);
                return (
                    <div key={step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            {done ? <CheckCircle2 className="h-5 w-5" style={{ color: isCurrent ? C.secondary : "#059669" }} /> : <Circle className="h-5 w-5" style={{ color: C.hairSoft }} />}
                            {i < TIMELINE_STEPS.length - 1 && <span className="my-0.5 h-8 w-0.5" style={{ background: done && i < currentIdx ? "#059669" : C.hairSoft }} />}
                        </div>
                        <div className="pb-6">
                            <p className="text-[12.5px] font-bold capitalize" style={{ color: done ? C.ink : C.muted }}>{step.replace("_", " ")}</p>
                            {event?.created_at && <p className="text-[10.5px] font-medium" style={{ color: C.muted }}>{new Date(event.created_at).toLocaleString("en-IN")}</p>}
                        </div>
                    </div>
                );
            })}
            {isTerminalBad && (
                <div className="flex gap-3">
                    <XCircle className="h-5 w-5" style={{ color: C.primary }} />
                    <p className="text-[12.5px] font-bold" style={{ color: C.primary }}>{status === "cancelled" ? "Cancelled" : "Rejected by seller"}</p>
                </div>
            )}
        </div>
    );
}

export default function OrderDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const fetcher = useCallback((orderId) => fetchOrderById(token, orderId), [token]);
    const { order, events, loading, reload } = useRealtimeOrder({ orderId: id, fetcher });

    const handleCancel = async () => {
        const res = await cancelMyOrder(token, id, "Cancelled by buyer");
        if (res?.success) reload(); else window.alert(res?.message || "Couldn't cancel the order.");
    };

    if (loading && !order) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>;
    if (!order) return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
            <p className="text-[14px] font-bold" style={{ color: C.ink }}>Order not found.</p>
            <button onClick={() => navigate("/orders")} className="mt-4 text-[12.5px] font-bold" style={{ color: C.secondary }}>Back to orders</button>
        </div>
    );

    const addr = order.shipping_address_snapshot || {};

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair, color: C.ink }} aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-extrabold tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(17px, 1.6vw, 22px)" }}>{order.order_number}</h1>
                    <p className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.muted }}><Radio className="h-2.5 w-2.5 animate-pulse" style={{ color: "#059669" }} /> Live</p>
                </div>
                <StatusChip status={order.status} />
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
                className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Order status</p>
                <div className="mt-3"><Timeline status={order.status} events={events} /></div>
            </motion.div>

            <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Items</p>
                <div className="mt-3 flex flex-col gap-3">
                    {(order.items || []).map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                                {item.image_snapshot ? <img src={item.image_snapshot} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto h-5 w-5" style={{ color: C.muted }} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold" style={{ color: C.ink }}>{item.product_name_snapshot}</p>
                                <p className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{item.quantity} {item.unit} × ₹{item.unit_price}</p>
                            </div>
                            <p className="text-[13px] font-extrabold" style={{ color: C.ink }}>₹{item.line_total}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: C.hairSoft }}>
                    <p className="text-[12.5px] font-bold" style={{ color: C.muted }}>Total</p>
                    <p className="text-[15px] font-extrabold" style={{ color: C.primary }}>₹{order.total_amount}</p>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
                <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}><MapPin className="h-3 w-3" /> Shipping address</p>
                <p className="mt-2 text-[12.5px] font-bold" style={{ color: C.ink }}>{addr.contact_name}</p>
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: C.muted }}>{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}</p>
                {addr.contact_phone && <p className="mt-1 text-[12px] font-semibold" style={{ color: C.muted }}>{addr.contact_phone}</p>}
            </div>

            {order.buyer_notes && (
                <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
                    <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Note to seller</p>
                    <p className="mt-1.5 text-[12.5px] font-medium italic" style={{ color: C.ink }}>"{order.buyer_notes}"</p>
                </div>
            )}

            {order.status === "pending_confirmation" && (
                <button onClick={handleCancel} className="mt-5 w-full rounded-xl border px-5 py-3 text-[13px] font-bold" style={{ borderColor: C.hair, color: C.primary }}>Cancel order</button>
            )}
        </div>
    );
}