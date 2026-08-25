// pages/SellerOrderDetailPage.jsx — RESTYLED to match SellerListingForm's
// type scale and card language. Also adds what was missing versus the
// sales-orders list: pack-quantity display (was raw unit qty only),
// delivery estimate, stock-shortfall note, and sample badge/free-sample
// handling. Keeps this page seller-relevant only — buyer contact +
// address + GST verification (their concern), payout breakdown (their
// concern) — no buyer-side navigation chrome.
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, User, Phone, Mail, ShieldCheck, Loader2, MapPin, IndianRupee, Radio, CheckCircle2, Circle, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerOrderById, confirmSellerOrder, rejectSellerOrder, processSellerOrder, shipSellerOrder, deliverSellerOrder } from "../utils/api.js";
import useRealtimeOrder from "../hooks/useRealtimeOrder.js";
import { C, EASE } from "../components/catalog/tokens";
import { StatusChip, SampleBadge, ItemQuantityLine, DeliveryEstimate, displayAmount, StockShortfallNote, shouldShowDelivery, shouldShowShortfall } from "../components/orders/OrderDisplayHelpers.jsx";

const NEXT_ACTION = {
    pending_confirmation: [{ key: "confirm", label: "Confirm order", fn: confirmSellerOrder, primary: true }, { key: "reject", label: "Reject", fn: rejectSellerOrder, needsReason: true }],
    confirmed: [{ key: "process", label: "Mark as processing", fn: processSellerOrder, primary: true }],
    processing: [{ key: "ship", label: "Mark as shipped", fn: shipSellerOrder, primary: true }],
    shipped: [{ key: "deliver", label: "Mark as delivered", fn: deliverSellerOrder, primary: true }],
};
const TIMELINE_STEPS = ["pending_confirmation", "confirmed", "processing", "shipped", "delivered"];

function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

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
                            <p className="text-[13.5px] font-bold capitalize tracking-wide" style={{ color: done ? C.ink : C.muted }}>{step.replace("_", " ")}</p>
                            {event?.created_at && <p className="text-[11.5px] font-medium tracking-wide" style={{ color: C.muted }}>{new Date(event.created_at).toLocaleString("en-IN")}</p>}
                        </div>
                    </div>
                );
            })}
            {isTerminalBad && (
                <div className="flex gap-3">
                    <XCircle className="h-5 w-5" style={{ color: C.primary }} />
                    <p className="text-[12.5px] font-bold tracking-wide" style={{ color: C.primary }}>{status === "cancelled" ? "Cancelled by buyer" : "Rejected"}</p>
                </div>
            )}
        </div>
    );
}

function Card({ title, children }) {
    return (
        <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "#4A535B" }}>{title}</p>
            <div className="mt-3">{children}</div>
        </div>
    );
}

export default function SellerOrderDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [busy, setBusy] = useState(null);

    const fetcher = useCallback((orderId) => fetchSellerOrderById(token, orderId), [token]);
    const { order, events, loading, reload } = useRealtimeOrder({ orderId: id, fetcher });

    const deliveredEvent = events.find((e) => e.to_status === "delivered");

    const actions = NEXT_ACTION[order?.status] || [];
    const runAction = async (action) => {
        let reason;
        if (action.needsReason) {
            reason = window.prompt("Reason for rejecting this order (shown to the buyer):");
            if (reason === null) return;
        }
        setBusy(action.key);
        const res = await action.fn(token, id, reason);
        setBusy(null);
        if (res?.success) reload(); else window.alert(res?.message || "Couldn't update the order.");
    };

    if (loading && !order) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>;
    if (!order) return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
            <p className="text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>Order not found.</p>
            <button onClick={() => navigate("/seller/orders")} className="mt-4 text-[12.5px] font-bold tracking-wide" style={{ color: C.secondary }}>Back to sales orders</button>
        </div>
    );

    const addr = order.shipping_address_snapshot || {};
    const isSample = order.order_type === "sample";
    const firstItem = order.items?.[0];

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair, color: C.ink }} aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h1 className="truncate font-extrabold tracking-[0.01em]" style={{ color: C.ink, fontSize: "clamp(17px, 1.6vw, 22px)" }}>{order.order_number}</h1>
                        {isSample && <SampleBadge size="lg" />}
                    </div>
                    <p className="flex items-center gap-1 text-[11.5px] font-semibold tracking-wider" style={{ color: C.muted }}><Radio className="h-2.5 w-2.5 animate-pulse" style={{ color: "#059669" }} /> Live</p>
                </div>
                <StatusChip status={order.status} size="lg" />
            </div>

            <Card title="Order status">
                <Timeline status={order.status} events={events} />
            </Card>

            {(shouldShowDelivery(order, firstItem) || shouldShowShortfall(order)) && (
                <Card title="Fulfilment">
                    <div className="flex flex-col gap-2">
                        {shouldShowShortfall(order) && <StockShortfallNote audience="seller" />}
                        {shouldShowDelivery(order, firstItem) && (
                            <DeliveryEstimate order={order} item={firstItem} deliveredAt={deliveredEvent?.created_at} label="Buyer's est. delivery" />
                        )}
                    </div>
                </Card>
            )}

            <Card title="Items">
                <div className="flex flex-col gap-3">
                    {(order.items || []).map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white" style={{ borderColor: C.hair }}>
                                {item.image_snapshot ? <img src={item.image_snapshot} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto h-4 w-4" style={{ color: C.muted }} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14.5px] font-extrabold tracking-wider" style={{ color: C.ink }}>{item.product_name_snapshot}</p>
                                <p className="text-[12px] font-semibold tracking-wider" style={{ color: C.muted }}>
                                    <ItemQuantityLine item={item} mutedColor={C.muted} /> × {displayAmount(item.unit_price, { isSample })}
                                </p>
                            </div>
                            {/* <p className="text-[15px] font-extrabold tabular-nums" style={{ color: C.ink }}>{displayAmount(item.line_total, { isSample })}</p> */}
                        </div>
                    ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-xl p-3" style={{ background: isSample ? "#7c3aed08" : `${C.primary}08` }}>
                    {isSample ? (
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                Free sample · no platform fee
                            </span>
                            <p className="flex items-center gap-0.5 text-[14px] font-extrabold tabular-nums" style={{ color: "#7c3aed" }}>
                                <IndianRupee className="h-3.5 w-3.5" />
                                {inr(order.seller_payout_amount)}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold tracking-wide" style={{ color: C.muted }}>Order total</span>
                                <span className="text-[13.5px] font-extrabold tabular-nums tracking-wide" style={{ color: C.ink }}>₹{inr(order.subtotal_amount)}</span>
                            </div>
                            {/* 
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                    Platform fee ({order.platform_fee_percent}%)
                                </span>
                                <span className="text-[13.5px] font-extrabold tabular-nums tracking-wide" style={{ color: C.muted }}>
                                    − ₹{inr(order.platform_fee_amount)}
                                </span>
                            </div> */}

                            <div className="my-0.5 h-px" style={{ background: C.hair }} />

                            <div className="flex items-center justify-between">
                                <span className="text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>You'll receive</span>
                                <p className="flex items-center gap-0.5 text-[15.5px] font-extrabold tabular-nums" style={{ color: C.primary }}>
                                    <IndianRupee className="h-3.5 w-3.5" />
                                    {inr(order.seller_payout_amount)}
                                </p>


                                <span className="text-[13px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                    Platform commission ({order.platform_fee_percent}%) — added to wallet
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            <Card title="Buyer">
                <p className="flex items-center gap-1.5 text-[13.5px] font-bold tracking-wider" style={{ color: C.ink }}>
                    <User className="h-3.5 w-3.5" /> {order.buyer_contact_name}
                    {/* {order.buyer_gst_verified && <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold text-white" style={{ background: C.secondary }}><ShieldCheck className="h-2.5 w-2.5" /> GST Verified</span>} */}
                </p>
                {order.buyer_business_name && <p className="mt-1 text-[12px] font-semibold tracking-wider" style={{ color: C.muted }}>{order.buyer_business_name}{order.buyer_gstin ? ` · ${order.buyer_gstin}` : ""}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] font-semibold tracking-wider" style={{ color: C.muted }}>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.buyer_contact_phone}</span>
                    {order.buyer_contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{order.buyer_contact_email}</span>}
                </p>
                <div className="mt-3 border-t pt-3" style={{ borderColor: C.hairSoft }}>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}><MapPin className="h-3 w-3" /> Ship to</p>
                    <p className="mt-1 text-[12.5px] font-medium leading-relaxed tracking-wide" style={{ color: C.ink }}>{addr.contact_name}, {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}</p>
                </div>
                {order.buyer_notes && <p className="mt-2 text-[12.5px] font-medium italic tracking-wide" style={{ color: C.muted }}>"{order.buyer_notes}"</p>}
            </Card>

            {actions.length > 0 && (
                <div className="mt-5 flex gap-2">
                    {actions.map((a) => (
                        <button key={a.key} disabled={busy !== null} onClick={() => runAction(a)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-[13px] font-bold tracking-wide ${a.primary ? "text-white" : ""}`}
                            style={a.primary ? { background: `linear-gradient(135deg, ${C.secondary} 0%, #047084 100%)` } : { border: `1px solid ${C.hair}`, color: C.primary }}>
                            {busy === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : a.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}