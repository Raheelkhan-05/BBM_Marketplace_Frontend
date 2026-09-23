// pages/CartPage.jsx
//
// TWO-PHASE FLOW (this revision):
//   "review"   — item list per seller, quantities, pricing, stock/MOQ
//                 notices. No shipping address, no transport preference,
//                 no location-serviceability notices (those depend on an
//                 address we don't have yet).
//   "shipping" — shipping address (shared <AddressBook>, same component
//                 BuyNowModal uses) + one "Preferred transport" panel per
//                 seller group + location-serviceability notices. The
//                 actual checkoutCart() call only ever fires from here.
//
// Clicking "Continue to shipping" in "review" just advances the phase —
// nothing is charged or booked yet. "shipping" has its own Back button
// (returns to "review" without losing anything) and its own primary CTA,
// "Proceed to pay", which is what actually calls checkoutCart().
//
// Everything else (pricing, stock, MOQ, order-window / location
// constraints, debounced quantity writes) is unchanged.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Store, ShoppingCart, MapPin, Minus, Plus, Clock, Truck, AlertCircle, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCart, updateCartItem, removeFromCart, checkoutCart } from "../utils/cartApi.js";
import { fetchOrderConstraints } from "../utils/api.js";
import { fetchBuyerTransportPreference } from "../utils/api.transport.js";
import { C } from "../components/catalog/tokens";
import GroupPaymentQRModal from "../components/GroupPaymentQRModal.jsx";
import AddressBook from "../components/shipping/AddressBook.jsx";
import TransportPreferenceModal from "../components/transport/TransportPreferenceModal.jsx";
import { useCart } from "../context/CartContext.jsx";

import { purchaseQtyToSaleUnitQty, saleUnitLabel, round2 } from "../shared/packUnits.js";
import { checkOrderWindow, checkLocationServiceable } from "../shared/orderConstraints.js";
import { routeTransportModeLabel } from "../../shared/routeTransportFields.js";

// Mirrors resolveSlabUnitPrice/resolveDiscountPercent used everywhere else
// (BuyNowModal, orders.controller) — kept local since there's no shared
// pricing module yet, but the logic must stay identical to those.
function resolveSlabUnitPrice(slabs, saleQty, fallbackPrice) {
    if (!Array.isArray(slabs) || !slabs.length) return fallbackPrice;
    const applicable = slabs
        .filter((s) => Number(s.minQty) > 0 && saleQty >= Number(s.minQty) && (!s.maxQty || saleQty <= Number(s.maxQty)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return applicable.length ? Number(applicable[0].price) : fallbackPrice;
}
function resolveDiscountPercent(tiers, saleQty) {
    if (!Array.isArray(tiers) || !tiers.length) return 0;
    const applicable = tiers
        .filter((d) => Number(d.minQty) > 0 && saleQty >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return applicable.length ? Number(applicable[0].discountPercent) || 0 : 0;
}

// item.price is ALREADY per sale unit (Pack, or Master Pack when this
// listing hasOuterPack) — see shared/packUnits.js. Never re-multiply it
// by pack_size again, that's the double-scaling bug this replaces.
function priceFor(item) {
    const saleQty = purchaseQtyToSaleUnitQty(item.quantity, item.purchase_basis, item.pack_size, item.units_per_master_pack);

    const basePricePerSaleUnit = resolveSlabUnitPrice(item.price_slabs, saleQty, Number(item.price));
    const discountPercent = resolveDiscountPercent(item.quantity_discounts, saleQty);
    const unitPrice = round2(basePricePerSaleUnit * (1 - discountPercent / 100));

    const moqSaleUnits = Number(item.moq) || 0;
    const meetsMoq = moqSaleUnits ? saleQty >= moqSaleUnits : true;

    return { saleQty, lineTotal: round2(unitPrice * saleQty), discountPercent, meetsMoq, moqSaleUnits };
}

function stockInfoFor(item) {
    const capped = item.stock_type === "ready_stock" && item.available_stock != null;
    const max = capped ? Number(item.available_stock) : null;
    const moq = Number(item.moq) || 0;
    return {
        capped,
        max,
        outOfStock: capped && (moq > 0 ? max < moq : max <= 0),
        exceeds: capped && Number(item.quantity) > max,
    };
}

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

// Builds the minimal "seller" shape TransportPreferenceModal expects,
// out of whatever getCart attached to the cart items for this seller
// (see cart.controller.js — seller_dispatch_city/state/transport_options).
function sellerObjFor(group) {
    const first = group.items[0];
    const city = first.seller_dispatch_city || "";
    const state = first.seller_dispatch_state || "";
    return {
        sellerId: group.seller.seller_id,
        display_name: group.seller.seller_name,
        dispatchOrigin: city && state ? `${city}, ${state}` : city || state || "",
        dispatchState: state,
        transportOptions: first.seller_transport_options || [],
    };
}

// Lightweight local Notice, same tones/shape as BuyNowModal's, kept
// local here since this page doesn't import from BuyNowModal.
function Notice({ tone = "warn", children }) {
    const tones = {
        warn: { background: "#FEF6E7", color: "#92600A" },
        danger: { background: "#FDECEC", color: "#B3261E" },
    };
    const t = tones[tone] || tones.warn;
    return (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: t.background }}>
            <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" style={{ color: t.color }} />
            <p className="text-[11.5px] font-semibold leading-snug tracking-wider" style={{ color: t.color }}>{children}</p>
        </div>
    );
}

// One cohesive notice block for "can't order right now" — mirrors
// BuyNowModal's ConstraintNotice so the two flows read consistently.
// Reasons is a flat list of { icon, message }; falsy entries are dropped
// so a single active reason still renders cleanly.
function ConstraintNotice({ reasons }) {
    const active = reasons.filter(Boolean);
    if (!active.length) return null;
    return (
        <div className="mt-2.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(199,31,17,0.08)" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "#c71f11" }}>
                Can't include this seller's items right now
            </p>
            <div className="mt-1.5 flex flex-col gap-1">
                {active.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                        <r.icon className="mt-[1px] h-3 w-3 shrink-0" style={{ color: "#c71f11" }} />
                        <span className="text-[11.5px] font-semibold leading-snug tracking-wider" style={{ color: "#c71f11" }}>{r.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Same visual stepper BuyNowModal uses for quantity, instead of the
// old plain "−"/"+" text buttons — keeps the two order flows looking
// and feeling identical.
function QtyStepper({ value, onChange, min, disabled }) {
    const atMin = Number(value) <= Number(min);
    return (
        <div className="flex items-center overflow-hidden rounded-lg border" style={{ borderColor: C.hair }}>
            <button type="button" disabled={disabled || atMin} onClick={() => onChange(Number(value) - 1)}
                className="flex h-7 w-7 items-center justify-center transition-colors duration-150 hover:bg-black/[0.03] disabled:opacity-30">
                <Minus className="h-3 w-3" style={{ color: C.ink }} />
            </button>
            <span className="w-8 text-center text-[12.5px] font-bold tabular-nums">{value}</span>
            <button type="button" disabled={disabled} onClick={() => onChange(Number(value) + 1)}
                className="flex h-7 w-7 items-center justify-center transition-colors duration-150 hover:bg-black/[0.03] disabled:opacity-30">
                <Plus className="h-3 w-3" style={{ color: C.ink }} />
            </button>
        </div>
    );
}

// Small step indicator, same visual language as BuyNowModal's PhaseSteps,
// so both order flows in the app read consistently.
function PhaseSteps({ phase }) {
    const steps = [
        { key: "review", label: "Review cart" },
        { key: "shipping", label: "Shipping & confirm" },
    ];
    return (
        <div className="flex items-center gap-2">
            {steps.map((s, i) => {
                const active = s.key === phase;
                const done = steps.findIndex((x) => x.key === phase) > i;
                return (
                    <div key={s.key} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                                style={active || done
                                    ? { background: C.secondary, color: "#fff" }
                                    : { background: C.hairSoft || "#eee", color: C.muted }}
                            >
                                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                            </span>
                            <span className="text-[11.5px] font-bold tracking-wide" style={{ color: active ? C.ink : C.muted }}>
                                {s.label}
                            </span>
                        </div>
                        {i < steps.length - 1 && <div className="h-px w-6" style={{ background: C.hairSoft || "#eee" }} />}
                    </div>
                );
            })}
        </div>
    );
}

export default function CartPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);
    const [payingGroupId, setPayingGroupId] = useState(null);
    const pendingWrites = useRef({});
    const { reload: reloadCartBadge, setCountOptimistic } = useCart();

    const pendingWritePromises = useRef({});

    // ---- Two-phase flow ----
    // "review": items/pricing only, no address. "shipping": address +
    // per-seller transport preference, and the only phase from which
    // checkout can actually fire.
    const [phase, setPhase] = useState("review");
    const goToShipping = () => { setError(null); setPhase("shipping"); };
    const goBackToReview = () => { setError(null); setPhase("review"); };

    // ---- Shipping address — same shared component & behavior as
    // BuyNowModal (see components/shipping/AddressBook.jsx). Picking or
    // saving an address here marks it as the buyer's default, so Buy Now
    // elsewhere in the app picks up the same one automatically, and vice
    // versa. ----
    const [desiredAddressId, setDesiredAddressId] = useState(null);
    const [effectiveAddress, setEffectiveAddress] = useState(null);
    const addressBookRef = useRef(null);
    const handleAddressChange = (addr) => {
        setEffectiveAddress(addr);
        if (addr && !addr.isDraft) setDesiredAddressId(addr.id);
    };
    const selectedAddressId = effectiveAddress && !effectiveAddress.isDraft ? effectiveAddress.id : null;

    const load = useCallback(async () => {
        const res = await fetchCart(token);
        if (res?.success) {
            setItems(res.items);
            setCountOptimistic(res.items.length); // keep badge in sync on full loads too
        }
        setLoading(false);
    }, [token, setCountOptimistic]);

    useEffect(() => { load(); }, [load]);

    const grouped = useMemo(() => (
        items.reduce((acc, it) => {
            (acc[it.seller_id] ||= { seller: it, items: [] }).items.push(it);
            return acc;
        }, {})
    ), [items]);

    const grandTotal = items.reduce((sum, it) => sum + priceFor(it).lineTotal, 0);

    // ---------------------------------------------------------------
    // Order-window + delivery-serviceability constraints, per seller/item.
    // Same rationale/behavior as before: the backend (checkoutCart) hard-
    // blocks all of this at the RPC boundary regardless, this just gives
    // the buyer the same "can't order right now" signal BuyNowModal gives
    // for a single-seller purchase, before they ever reach checkout.
    // ---------------------------------------------------------------
    const submissionIds = useMemo(
        () => [...new Set(items.map((i) => i.submission_id).filter(Boolean))],
        [items]
    );
    const submissionIdsKey = submissionIds.join(",");

    const [constraintsBySubmission, setConstraintsBySubmission] = useState({});
    useEffect(() => {
        if (!submissionIds.length) { setConstraintsBySubmission({}); return; }
        let cancelled = false;
        (async () => {
            const results = await Promise.all(submissionIds.map((id) => fetchOrderConstraints(id)));
            if (cancelled) return;
            const map = {};
            submissionIds.forEach((id, idx) => {
                if (results[idx]?.success) map[id] = results[idx];
            });
            setConstraintsBySubmission(map);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submissionIdsKey]);

    // Re-evaluate the working-hours window every 30s, same as BuyNowModal.
    const [clockTick, setClockTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setClockTick((t) => t + 1), 30000);
        return () => clearInterval(id);
    }, []);

    // Per-seller-group constraint status: working-hours window (shared
    // across all of a seller's items) + per-item location serviceability.
    const groupConstraintStatus = useMemo(() => {
        const result = {};
        for (const [sellerId, group] of Object.entries(grouped)) {
            const first = group.items[0];
            const constraints = constraintsBySubmission[first.submission_id];
            const windowStatus = checkOrderWindow(constraints ? {
                workingDays: constraints.workingDays,
                orderAcceptanceStart: constraints.orderAcceptanceStart,
                orderAcceptanceEnd: constraints.orderAcceptanceEnd,
                holidays: constraints.holidays,
            } : null);

            const itemLocationStatuses = group.items.map((it) => {
                const c = constraintsBySubmission[it.submission_id];
                return { item: it, status: checkLocationServiceable(c?.dispatchingLocations, effectiveAddress) };
            });
            const blockedItems = itemLocationStatuses.filter((x) => !x.status.serviceable);

            result[sellerId] = {
                windowStatus,
                blockedItems,
                blocked: blockedItems.length > 0,
            };
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouped, constraintsBySubmission, effectiveAddress?.state, effectiveAddress?.city, clockTick]);

    // Only meaningful once an address has actually been chosen (phase
    // "shipping") — before that, effectiveAddress is null and this stays
    // false so it never blocks the "review" phase.
    const anyGroupBlocked = !!effectiveAddress && Object.values(groupConstraintStatus).some((g) => g.blocked);

    // ---------------------------------------------------------------
    // Per-seller transport preference — same flow as BuyNowModal, run
    // independently for every seller in the cart. Keyed by sellerId.
    // ---------------------------------------------------------------
    const [transportPreferences, setTransportPreferences] = useState({});
    const [pendingTransportProposals, setPendingTransportProposals] = useState({});
    const [transportRemovedNotices, setTransportRemovedNotices] = useState({});
    const [activeTransportSellerId, setActiveTransportSellerId] = useState(null);
    const lastCheckedRouteBySellerRef = useRef({});

    useEffect(() => {
        const city = effectiveAddress?.city;
        const state = effectiveAddress?.state;
        if (!city || !state) return;
        const sellerIds = Object.keys(grouped);
        if (!sellerIds.length) return;

        const routeKey = `${state.trim().toLowerCase()}::${city.trim().toLowerCase()}`;

        sellerIds.forEach(async (sellerId) => {
            if (lastCheckedRouteBySellerRef.current[sellerId] === routeKey) return;
            lastCheckedRouteBySellerRef.current[sellerId] = routeKey;

            const res = await fetchBuyerTransportPreference(sellerId, state, city, token);
            const pendingProposal = res?.pendingProposal
                ? { ...res.pendingProposal, destCity: city, destState: state }
                : null;
            setPendingTransportProposals((prev) => ({ ...prev, [sellerId]: pendingProposal }));

            if (res?.rejectedNotice) {
                setTransportPreferences((prev) => ({ ...prev, [sellerId]: null }));
                setTransportRemovedNotices((prev) => ({
                    ...prev,
                    [sellerId]: `Your proposed transport option (${res.rejectedNotice.summary}) wasn't accepted by this seller.`,
                }));
                return;
            }

            if (res?.success && res.decided) {
                setTransportPreferences((prev) => ({
                    ...prev,
                    [sellerId]: res.preference ? { ...res.preference, destCity: city, destState: state } : null,
                }));
                setTransportRemovedNotices((prev) => ({ ...prev, [sellerId]: null }));
            } else {
                setTransportPreferences((prev) => ({ ...prev, [sellerId]: null }));
                setTransportRemovedNotices((prev) => ({
                    ...prev,
                    [sellerId]: res?.invalidated ? "The seller no longer offers your previously selected transport option." : null,
                }));
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveAddress?.city, effectiveAddress?.state, token, Object.keys(grouped).join(",")]);

    const handleTransportResolved = (sellerId, result) => {
        if (result?.pending) {
            setTransportPreferences((prev) => ({ ...prev, [sellerId]: null }));
            setPendingTransportProposals((prev) => ({ ...prev, [sellerId]: result }));
        } else {
            setTransportPreferences((prev) => ({ ...prev, [sellerId]: result }));
            setPendingTransportProposals((prev) => ({ ...prev, [sellerId]: null }));
        }
        setTransportRemovedNotices((prev) => ({ ...prev, [sellerId]: null }));
        setActiveTransportSellerId(null);
    };

    useEffect(() => {
        // Clean up any in-flight debounce timers on unmount so they don't
        // fire updateCartItem calls against an unmounted page.
        return () => { Object.values(pendingWrites.current).forEach(clearTimeout); };
    }, []);

    const handleQty = (submissionId, quantity, moq) => {
        const floor = Number(moq) > 0 ? Number(moq) : 1;
        if (quantity < floor) return;

        setItems((prev) => {
            const next = prev.map((it) => (it.submission_id === submissionId ? { ...it, quantity } : it));
            return next;
        });

        clearTimeout(pendingWrites.current[submissionId]);

        pendingWritePromises.current[submissionId] = new Promise((resolve) => {
            pendingWrites.current[submissionId] = setTimeout(async () => {
                const res = quantity <= 0
                    ? await removeFromCart(token, submissionId)
                    : await updateCartItem(token, submissionId, { quantity });
                if (res && res.success === false) {
                    setError(res.message || "Couldn't update quantity.");
                    load();
                }
                delete pendingWritePromises.current[submissionId];
                resolve();
            }, 350);
        });
    };

    const anyTransportMissing = Object.keys(grouped).some((sellerId) => !transportPreferences[sellerId]);

    const flushPendingWrites = async () => {
        const ids = Object.keys(pendingWrites.current);
        ids.forEach((id) => clearTimeout(pendingWrites.current[id]));

        const flushes = ids.map(async (submissionId) => {
            const it = items.find((i) => i.submission_id === submissionId);
            if (!it) return;
            const res = it.quantity <= 0
                ? await removeFromCart(token, submissionId)
                : await updateCartItem(token, submissionId, { quantity: it.quantity });
            if (res && res.success === false) {
                setError(res.message || "Couldn't update quantity.");
            }
        });

        await Promise.all(flushes);
        pendingWrites.current = {};
        pendingWritePromises.current = {};
    };

    const handleRemove = (submissionId) => {
        setItems((prev) => {
            const next = prev.filter((it) => it.submission_id !== submissionId);
            setCountOptimistic(next.length);
            return next;
        });
        removeFromCart(token, submissionId).then((res) => {
            if (res && res.success === false) {
                setError(res.message || "Couldn't remove item.");
                load();
            }
        });
    };

    const hasStockBlock = items.some((it) => {
        const s = stockInfoFor(it);
        return s.outOfStock || s.exceeds;
    });

    const handleCheckout = async () => {
        if (hasStockBlock) {
            setError("One or more items in your cart exceed what's available from the seller. Please adjust the quantities.");
            return;
        }

        // Hard guard — never trust the disabled prop alone, same pattern
        // as BuyNowModal's handleSubmit. The backend re-checks this again
        // inside checkoutCart regardless.
        if (anyGroupBlocked) {
            const blockedGroup = Object.values(groupConstraintStatus).find((g) => g.blocked);
            setError(blockedGroup.blockedItems[0]?.status.message || "One or more sellers in your cart don't deliver to your selected address.");
            return;
        }

        const missingTransportSellerId = Object.keys(grouped).find((sellerId) => !transportPreferences[sellerId]);
        if (missingTransportSellerId) {
            const sellerName = grouped[missingTransportSellerId]?.seller?.seller_name || "one of your sellers";
            setError(
                pendingTransportProposals[missingTransportSellerId]
                    ? `Waiting for ${sellerName} to approve your transport option before you can check out.`
                    : `Please set a transport preference for ${sellerName} before checking out.`
            );
            return;
        }


        // Make sure every optimistic quantity change actually landed in the
        // DB before place_cart_order reads cart_items.
        await flushPendingWrites();

        let effectiveAddressId = selectedAddressId;
        if (!effectiveAddressId) {
            effectiveAddressId = await addressBookRef.current?.ensureSavedAddress();
            if (!effectiveAddressId) { setChecking(false); return; }
        }

        // Per-seller transport preferences the buyer locked in via each
        // seller group's "Preferred transport" panel. Sellers with no
        // preference set are simply left out — the seller chooses.
        const transportPreferencesPayload = Object.entries(transportPreferences)
            .filter(([, pref]) => pref?.routeOptionId)
            .map(([sellerId, pref]) => ({ sellerId, routeOptionId: pref.routeOptionId }));

        const res = await checkoutCart(token, {
            shippingAddressId: effectiveAddressId,
            transportPreferences: transportPreferencesPayload,
        });
        setChecking(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");
        setPayingGroupId(res.orderGroupId);
    };

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>;

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-2.5 pb-32 pt-3 sm:px-4">
            <div className="mt-3 ps-2 flex items-center justify-between gap-3">
                <h1 className="font-extrabold" style={{ color: C.ink, fontSize: "clamp(20px,1.8vw,26px)" }}>Cart</h1>
                {/* {items.length > 0 && <PhaseSteps phase={phase} />} */}
            </div>

            {items.length === 0 ? (
                <div className="mt-16 flex flex-col items-center text-center">
                    <ShoppingCart className="h-10 w-10" style={{ color: C.muted }} />
                    <p className="mt-3 font-bold" style={{ color: C.ink }}>Your cart is empty</p>
                    <button onClick={() => navigate("/")} className="mt-4 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                        Continue shopping
                    </button>
                </div>
            ) : (
                <>
                    {phase === "shipping" && (
                        <button type="button" onClick={goBackToReview} className="mt-3 flex items-center gap-1 text-[12.5px] font-bold tracking-wide" style={{ color: C.secondary }}>
                            <ChevronLeft className="h-3.5 w-3.5" /> Back to cart review
                        </button>
                    )}

                    {Object.entries(grouped).map(([sellerId, g]) => {
                        const groupStatus = groupConstraintStatus[sellerId];
                        const sellerObj = sellerObjFor(g);
                        const pref = transportPreferences[sellerId];
                        const pendingProposal = pendingTransportProposals[sellerId];
                        const removedNotice = transportRemovedNotices[sellerId];

                        return (
                            <div key={g.seller.seller_id} className="mt-4 rounded-2xl border p-3.5" style={{ borderColor: C.hair }}>
                                <p className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.ink }}><Store className="h-3.5 w-3.5" /> {g.seller.seller_name}</p>
                                <div className="mt-3 flex flex-col gap-3">
                                    {g.items.map((it) => {
                                        const p = priceFor(it);
                                        const floor = Number(it.moq) > 0 ? Number(it.moq) : 1;
                                        const atFloor = it.quantity <= floor;
                                        const stock = stockInfoFor(it);
                                        const atCeiling = stock.capped && it.quantity >= stock.max;
                                        const itemBlockedByLocation = groupStatus?.blockedItems?.some((b) => b.item.cart_item_id === it.cart_item_id);
                                        return (
                                            <div key={it.cart_item_id} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <img src={it.product_image} className="h-12 w-12 rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[13.5px] font-bold" style={{ color: C.ink }}>{it.product_name}</p>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <QtyStepper
                                                                value={it.quantity}
                                                                min={floor}
                                                                disabled={phase !== "review" || (atCeiling && !atFloor ? false : undefined)}
                                                                onChange={(v) => handleQty(it.submission_id, v, it.moq)}
                                                            />
                                                            <span className="text-[11px] font-semibold" style={{ color: C.muted }}>{saleUnitLabel(it.units_per_master_pack)}(s)</span>
                                                        </div>
                                                        {atFloor && floor > 1 && (
                                                            <p className="mt-0.5 text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                                At the seller's MOQ ({floor} {saleUnitLabel(it.units_per_master_pack)}{floor === 1 ? "" : "s"}) — remove the item instead of going lower.
                                                            </p>
                                                        )}
                                                        {stock.outOfStock && (
                                                            <p className="mt-0.5 text-[10.5px] font-bold tracking-wide text-red-600">
                                                                Out of stock with this seller — remove to continue.
                                                            </p>
                                                        )}
                                                        {!stock.outOfStock && stock.exceeds && (
                                                            <p className="mt-0.5 text-[10.5px] font-bold tracking-wide text-red-600">
                                                                Only {stock.max} {saleUnitLabel(it.units_per_master_pack)}{stock.max === 1 ? "" : "s"} available from this seller — reduce quantity to continue.
                                                            </p>
                                                        )}
                                                        {phase === "shipping" && itemBlockedByLocation && (
                                                            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold tracking-wide" style={{ color: "#c71f11" }}>
                                                                <MapPin className="h-2.5 w-2.5" /> Not deliverable to your selected address.
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="text-[13.5px] font-extrabold tabular-nums">₹{inr(p.lineTotal)}</p>
                                                    {phase === "review" && (
                                                        <button onClick={() => handleRemove(it.submission_id)}><Trash2 className="h-4 w-4" style={{ color: C.muted }} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {groupStatus?.windowStatus && !groupStatus.windowStatus.open && (
                                    <div className="mt-2.5 flex items-start gap-1.5 rounded-lg px-3 py-2" style={{ background: "#fef3c7" }}>
                                        <Clock className="mt-[1px] h-3 w-3 shrink-0" style={{ color: "#a16207" }} />
                                        <span className="text-[11.5px] font-semibold leading-snug tracking-wider" style={{ color: "#a16207" }}>
                                            {groupStatus.windowStatus.message}
                                        </span>
                                    </div>
                                )}
                                {phase === "shipping" && groupStatus?.blocked && (
                                    <ConstraintNotice reasons={[
                                        groupStatus.blockedItems.length > 0 && {
                                            icon: MapPin,
                                            message: groupStatus.blockedItems.length === 1
                                                ? groupStatus.blockedItems[0].status.message
                                                : `${groupStatus.blockedItems.length} items from this seller aren't deliverable to your selected address.`,
                                        },
                                    ]} />
                                )}

                                {/* ---------------- Per-seller transport preference (shipping phase only) ---------------- */}
                                {phase === "shipping" && (
                                    <div className="mt-3 flex flex-col gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: C.hair }}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color: C.muted }}>
                                                <Truck className="h-3.5 w-3.5" /> Preferred transport
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTransportSellerId(sellerId)}
                                                className="shrink-0 text-[12px] font-bold tracking-wide"
                                                style={{ color: C.secondary }}
                                            >
                                                {pref || pendingProposal ? "Change" : "Set preference"}
                                            </button>
                                        </div>

                                        {pref ? (
                                            <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                {routeTransportModeLabel(pref.mode)}
                                            </p>
                                        ) : pendingProposal ? (
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                    {routeTransportModeLabel(pendingProposal.mode)}
                                                </p>
                                                <p className="text-[11px] font-semibold tracking-wide" style={{ color: "#92600A" }}>
                                                    Awaiting the seller's approval. You can check out with this seller once it's approved.
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[12px] font-bold tracking-wide" style={{ color: "#B3261E" }}>
                                                Required — set a transport preference to check out with this seller.
                                            </p>
                                        )}

                                        {removedNotice && <Notice tone="warn">{removedNotice}</Notice>}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {phase === "shipping" && (
                        <div className="mt-4 rounded-2xl border p-3.5" style={{ borderColor: C.hair }}>
                            <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase" style={{ color: C.muted }}>
                                <MapPin className="h-3.5 w-3.5" /> Shipping address
                            </p>
                            <div className="mt-2.5">
                                <AddressBook
                                    ref={addressBookRef}
                                    token={token}
                                    value={desiredAddressId}
                                    onChange={handleAddressChange}
                                    disabled={checking}
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</p>}

                    <div className="fixed z-[1] bottom-16 md:bottom-0 left-0 right-0 border-t bg-white/95 px-4 py-3 backdrop-blur">
                        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase" style={{ color: C.muted }}>Total</p>
                                <p className="text-[18px] font-extrabold tabular-nums">₹{inr(grandTotal)}</p>
                            </div>
                            {phase === "review" ? (
                                <button onClick={goToShipping} disabled={hasStockBlock}
                                    className="rounded-xl px-6 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
                                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                    Continue to shipping
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button onClick={goBackToReview} disabled={checking}
                                        className="flex items-center gap-1 rounded-xl border px-4 py-3 text-[13px] font-bold disabled:opacity-50"
                                        style={{ borderColor: C.hair, color: C.ink }}>
                                        <ChevronLeft className="h-4 w-4" /> Back
                                    </button>
                                    <button onClick={handleCheckout} disabled={checking || hasStockBlock || anyGroupBlocked || anyTransportMissing}
                                        className="rounded-xl px-6 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
                                        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to pay"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
            {payingGroupId && (
                <GroupPaymentQRModal
                    token={token}
                    groupId={payingGroupId}
                    onClose={() => { setPayingGroupId(null); load(); reloadCartBadge(); }}
                    onDoneViewOrders={() => navigate("/orders")}
                />
            )}

            {activeTransportSellerId && grouped[activeTransportSellerId] && (
                <TransportPreferenceModal
                    open
                    seller={sellerObjFor(grouped[activeTransportSellerId])}
                    destAddressId={selectedAddressId}
                    removedNotice={transportRemovedNotices[activeTransportSellerId]}
                    onClose={() => setActiveTransportSellerId(null)}
                    onAddressChange={setDesiredAddressId}
                    onResolved={(result) => handleTransportResolved(activeTransportSellerId, result)}
                />
            )}
        </div>
    );
}