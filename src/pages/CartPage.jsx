import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Store, ShoppingCart, MapPin, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCart, updateCartItem, removeFromCart, checkoutCart } from "../utils/cartApi.js";
import { fetchBuyerAddresses, createBuyerAddress } from "../utils/api.js";
import { C } from "../components/catalog/tokens";
import GroupPaymentQRModal from "../components/GroupPaymentQRModal.jsx";
import { TextField } from "../components/seller/listingForm/FormPrimitives.jsx";

import { purchaseQtyToSaleUnitQty, saleUnitLabel, round2, hasOuterPack } from "../shared/packUnits.js";

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
// purchase_basis can, in principle, differ from the seller's canonical
// sale unit, so always convert through purchaseQtyToSaleUnitQty rather
// than assuming they match.
function priceFor(item) {
    const saleQty = purchaseQtyToSaleUnitQty(item.quantity, item.purchase_basis, item.pack_size, item.units_per_master_pack);

    const basePricePerSaleUnit = resolveSlabUnitPrice(item.price_slabs, saleQty, Number(item.price));
    const discountPercent = resolveDiscountPercent(item.quantity_discounts, saleQty);
    const unitPrice = round2(basePricePerSaleUnit * (1 - discountPercent / 100));

    const moqSaleUnits = Number(item.moq) || 0;
    const meetsMoq = moqSaleUnits ? saleQty >= moqSaleUnits : true;

    return { saleQty, lineTotal: round2(unitPrice * saleQty), discountPercent, meetsMoq, moqSaleUnits };
}

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

const EMPTY_ADDRESS = { label: "Office", contact_name: "", contact_phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "" };

export default function CartPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addresses, setAddresses] = useState([]);
    const [addressId, setAddressId] = useState(null);
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);
    const [payingGroupId, setPayingGroupId] = useState(null);
    const pendingWrites = useRef({});

    const pendingWritePromises = useRef({});

    const load = useCallback(async () => {
        const res = await fetchCart(token);
        if (res?.success) setItems(res.items);
        setLoading(false);
    }, [token]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        fetchBuyerAddresses(token).then((res) => {
            if (res?.success) {
                setAddresses(res.addresses || []);
                const def = res.addresses?.find((a) => a.is_default) || res.addresses?.[0];
                if (def) setAddressId(def.id);
                else setShowNewAddress(true); // no saved addresses yet — go straight to the form, same as BuyNowModal
            }
        });
    }, [token]);

    const grouped = items.reduce((acc, it) => {
        (acc[it.seller_id] ||= { seller: it, items: [] }).items.push(it);
        return acc;
    }, {});

    const grandTotal = items.reduce((sum, it) => sum + priceFor(it).lineTotal, 0);

    useEffect(() => {
        // Clean up any in-flight debounce timers on unmount so they don't
        // fire updateCartItem calls against an unmounted page.
        return () => { Object.values(pendingWrites.current).forEach(clearTimeout); };
    }, []);

    const handleQty = (submissionId, quantity, moq) => {
        const floor = Number(moq) > 0 ? Number(moq) : 1;
        if (quantity < floor) return;

        setItems((prev) => prev.map((it) => (it.submission_id === submissionId ? { ...it, quantity } : it)));

        clearTimeout(pendingWrites.current[submissionId]);

        // Wrap the debounced write in a promise we can await elsewhere (checkout).
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

    const flushPendingWrites = async () => {
        const submissionIds = Object.keys(pendingWrites.current);
        submissionIds.forEach((id) => clearTimeout(pendingWrites.current[id]));

        // Re-run each write immediately (bypassing the timer) for anything
        // still pending, then wait for all of them.
        const flushes = submissionIds.map(async (submissionId) => {
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
        // Optimistic removal too — drop it from view immediately.
        setItems((prev) => prev.filter((it) => it.submission_id !== submissionId));
        removeFromCart(token, submissionId).then((res) => {
            if (res && res.success === false) {
                setError(res.message || "Couldn't remove item.");
                load(); // reconcile — it's still actually in the cart server-side
            }
        });
    };

    const setAddrField = (key, value) => setNewAddress((a) => ({ ...a, [key]: value }));

    const handleSaveNewAddress = async () => {
        const missing = ["contact_name", "contact_phone", "address_line1", "city", "state", "pincode"].filter((k) => !newAddress[k].trim());
        if (missing.length) { setError("Please fill in the shipping address completely."); return null; }
        setError(null);
        const res = await createBuyerAddress(token, { ...newAddress, is_default: addresses.length === 0 });
        if (!res?.success) { setError(res?.message || "Couldn't save address."); return null; }
        setAddresses((prev) => [res.address, ...prev]);
        setAddressId(res.address.id);
        setShowNewAddress(false);
        setNewAddress(EMPTY_ADDRESS);
        return res.address.id;
    };

    const handleCheckout = async () => {
        if (!addressId) return setError("Please select a shipping address.");

        setChecking(true);

        // Make sure every optimistic quantity change actually landed in the DB
        // before place_cart_order reads cart_items — otherwise it can price
        // off a stale quantity that doesn't match what's shown on screen.
        await flushPendingWrites();

        let effectiveAddressId = addressId;
        if (showNewAddress || !effectiveAddressId) {
            effectiveAddressId = await handleSaveNewAddress();
            if (!effectiveAddressId) { setChecking(false); return; }
        }

        const res = await checkoutCart(token, { shippingAddressId: effectiveAddressId });
        setChecking(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");
        setPayingGroupId(res.orderGroupId);
    };

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>;

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-2.5 pb-32 pt-3 sm:px-4">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate('/home')} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair }}><ArrowLeft className="h-4 w-4" /></button>
                <h1 className="font-extrabold" style={{ color: C.ink, fontSize: "clamp(20px,1.8vw,26px)" }}>Cart</h1>
            </div>

            {items.length === 0 ? (
                <div className="mt-16 flex flex-col items-center text-center">
                    <ShoppingCart className="h-10 w-10" style={{ color: C.muted }} />
                    <p className="mt-3 font-bold" style={{ color: C.ink }}>Your cart is empty</p>
                </div>
            ) : (
                <>
                    {Object.values(grouped).map((g) => (
                        <div key={g.seller.seller_id} className="mt-4 rounded-2xl border p-3.5" style={{ borderColor: C.hair }}>
                            <p className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.ink }}><Store className="h-3.5 w-3.5" /> {g.seller.seller_name}</p>
                            <div className="mt-3 flex flex-col gap-3">
                                {g.items.map((it) => {
                                    const p = priceFor(it);
                                    const floor = Number(it.moq) > 0 ? Number(it.moq) : 1;
                                    const atFloor = it.quantity <= floor;
                                    return (
                                        <div key={it.cart_item_id} className="flex flex-col gap-1">
                                            <div className="flex items-center gap-3">
                                                <img src={it.product_image} className="h-12 w-12 rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13.5px] font-bold" style={{ color: C.ink }}>{it.product_name}</p>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleQty(it.submission_id, it.quantity - 1, it.moq)}
                                                            disabled={atFloor}
                                                            className="h-6 w-6 rounded border text-xs disabled:opacity-30"
                                                            style={{ borderColor: C.hair }}
                                                        >
                                                            −
                                                        </button>
                                                        <span className="text-[12.5px] font-bold tabular-nums">{it.quantity}</span>
                                                        <button onClick={() => handleQty(it.submission_id, it.quantity + 1, it.moq)} className="h-6 w-6 rounded border text-xs" style={{ borderColor: C.hair }}>+</button>
                                                        <span className="text-[11px] font-semibold" style={{ color: C.muted }}>{saleUnitLabel(it.units_per_master_pack)}(s)</span>
                                                    </div>
                                                    {atFloor && floor > 1 && (
                                                        <p className="mt-0.5 text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                            At the seller's MOQ ({floor} {saleUnitLabel(it.units_per_master_pack)}{floor === 1 ? "" : "s"}) — remove the item instead of going lower.
                                                        </p>
                                                    )}
                                                </div>
                                                <p className="text-[13.5px] font-extrabold tabular-nums">₹{inr(p.lineTotal)}</p>
                                                <button onClick={() => handleRemove(it.submission_id)}><Trash2 className="h-4 w-4" style={{ color: C.muted }} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="mt-4 rounded-2xl border p-3.5" style={{ borderColor: C.hair }}>
                        <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase" style={{ color: C.muted }}>
                            <MapPin className="h-3.5 w-3.5" /> Shipping address
                        </p>

                        {!showNewAddress && addresses.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                                {addresses.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => setAddressId(a.id)}
                                        className="rounded-xl border p-2.5 text-left"
                                        style={{ borderColor: addressId === a.id ? C.secondary : C.hair, background: addressId === a.id ? `${C.secondary}08` : "#fff" }}
                                    >
                                        <p className="text-[12.5px] font-bold">{a.label} — {a.contact_name}</p>
                                        <p className="text-[11.5px]" style={{ color: C.muted }}>{a.address_line1}, {a.city}, {a.state} - {a.pincode}</p>
                                    </button>
                                ))}
                                <button type="button" onClick={() => setShowNewAddress(true)} className="flex w-fit items-center gap-1.5 text-[12px] font-bold tracking-wide" style={{ color: C.secondary }}>
                                    <Plus className="h-3.5 w-3.5" /> Add a new address
                                </button>
                            </div>
                        )}

                        {showNewAddress && (
                            <div className="mt-2 flex flex-col gap-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <TextField dense label="Contact name" value={newAddress.contact_name} onChange={(v) => setAddrField("contact_name", v)} />
                                    <TextField dense label="Phone" value={newAddress.contact_phone} onChange={(v) => setAddrField("contact_phone", v)} />
                                </div>
                                <TextField dense label="Address line 1" value={newAddress.address_line1} onChange={(v) => setAddrField("address_line1", v)} />
                                <TextField dense label="Address line 2 (optional)" value={newAddress.address_line2} onChange={(v) => setAddrField("address_line2", v)} />
                                <div className="grid grid-cols-3 gap-2.5">
                                    <TextField dense label="City" value={newAddress.city} onChange={(v) => setAddrField("city", v)} />
                                    <TextField dense label="State" value={newAddress.state} onChange={(v) => setAddrField("state", v)} />
                                    <TextField dense label="Pincode" value={newAddress.pincode} onChange={(v) => setAddrField("pincode", v)} />
                                </div>
                                {addresses.length > 0 && (
                                    <button type="button" onClick={() => setShowNewAddress(false)} className="w-fit text-[12px] font-bold tracking-wide" style={{ color: C.muted }}>
                                        Use a saved address instead
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</p>}

                    <div className="fixed z-[1] bottom-0 md:bottom-0 left-0 right-0 border-t bg-white/95 px-4 py-3 backdrop-blur">
                        <div className="mx-auto flex max-w-3xl items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase" style={{ color: C.muted }}>Total</p>
                                <p className="text-[18px] font-extrabold tabular-nums">₹{inr(grandTotal)}</p>
                            </div>
                            <button onClick={handleCheckout} disabled={checking}
                                className="rounded-xl px-6 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to pay"}
                            </button>
                        </div>
                    </div>
                </>
            )}
            {payingGroupId && (
                <GroupPaymentQRModal
                    token={token}
                    groupId={payingGroupId}
                    onClose={() => { setPayingGroupId(null); load(); }}
                    onDoneViewOrders={() => navigate("/orders")}
                />
            )}

        </div>
    );
}