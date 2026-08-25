import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Store, ShoppingCart, MapPin, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCart, updateCartItem, removeFromCart, checkoutCart } from "../utils/cartApi.js";
import { fetchBuyerAddresses, createBuyerAddress } from "../utils/api.js";
import { C } from "../components/catalog/tokens";
import GroupPaymentQRModal from "../components/GroupPaymentQRModal.jsx";

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

// Same slab/discount resolution as BuyNowModal, kept local & simple.
function priceFor(item) {
    const packSize = Number(item.pack_size) > 0 ? Number(item.pack_size) : 1;
    const packQty = item.purchase_basis === "per_master_pack"
        ? item.quantity * (Number(item.units_per_master_pack) || 1) : item.quantity;
    const pricePerPack = Math.round(Number(item.price) * packSize * 100) / 100;
    const slabs = Array.isArray(item.price_slabs) ? item.price_slabs : [];
    const applicable = slabs.filter(s => Number(s.minQty) > 0 && packQty >= Number(s.minQty) && (!s.maxQty || packQty <= Number(s.maxQty)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    const basePrice = applicable[0] ? Number(applicable[0].price) : pricePerPack;
    const discounts = Array.isArray(item.quantity_discounts) ? item.quantity_discounts : [];
    const applicableD = discounts.filter(d => Number(d.minQty) > 0 && packQty >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    const discountPercent = applicableD[0] ? Number(applicableD[0].discountPercent) : 0;
    const unitPrice = Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100;
    return { lineTotal: Math.round(unitPrice * packQty * 100) / 100, discountPercent };
}

export default function CartPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addresses, setAddresses] = useState([]);
    const [addressId, setAddressId] = useState(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);
    const [payingGroupId, setPayingGroupId] = useState(null);

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
            }
        });
    }, [token]);

    const grouped = items.reduce((acc, it) => {
        (acc[it.seller_id] ||= { seller: it, items: [] }).items.push(it);
        return acc;
    }, {});

    const grandTotal = items.reduce((sum, it) => sum + priceFor(it).lineTotal, 0);

    const handleQty = async (submissionId, quantity) => {
        if (quantity <= 0) { await removeFromCart(token, submissionId); } else { await updateCartItem(token, submissionId, { quantity }); }
        load();
    };
    const handleRemove = async (submissionId) => { await removeFromCart(token, submissionId); load(); };

    const handleCheckout = async () => {
        if (!addressId) return setError("Please select a shipping address.");
        setChecking(true);
        const res = await checkoutCart(token, { shippingAddressId: addressId });
        setChecking(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");
        setPayingGroupId(res.orderGroupId); // works for both fresh and resumed groups
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
                                    return (
                                        <div key={it.cart_item_id} className="flex items-center gap-3">
                                            <img src={it.product_image} className="h-12 w-12 rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13.5px] font-bold" style={{ color: C.ink }}>{it.product_name}</p>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <button onClick={() => handleQty(it.submission_id, it.quantity - 1)} className="h-6 w-6 rounded border text-xs" style={{ borderColor: C.hair }}>−</button>
                                                    <span className="text-[12.5px] font-bold tabular-nums">{it.quantity}</span>
                                                    <button onClick={() => handleQty(it.submission_id, it.quantity + 1)} className="h-6 w-6 rounded border text-xs" style={{ borderColor: C.hair }}>+</button>
                                                    <span className="text-[11px] font-semibold" style={{ color: C.muted }}>{it.purchase_basis === "per_master_pack" ? "master pack(s)" : "pack(s)"}</span>
                                                </div>
                                            </div>
                                            <p className="text-[13.5px] font-extrabold tabular-nums">₹{inr(p.lineTotal)}</p>
                                            <button onClick={() => handleRemove(it.submission_id)}><Trash2 className="h-4 w-4" style={{ color: C.muted }} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="mt-4 rounded-2xl border p-3.5" style={{ borderColor: C.hair }}>
                        <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase" style={{ color: C.muted }}><MapPin className="h-3.5 w-3.5" /> Shipping address</p>
                        <div className="mt-2 flex flex-col gap-2">
                            {addresses.map((a) => (
                                <button key={a.id} onClick={() => setAddressId(a.id)} className="rounded-xl border p-2.5 text-left" style={{ borderColor: addressId === a.id ? C.secondary : C.hair }}>
                                    <p className="text-[12.5px] font-bold">{a.label} — {a.contact_name}</p>
                                    <p className="text-[11.5px]" style={{ color: C.muted }}>{a.address_line1}, {a.city}, {a.state} - {a.pincode}</p>
                                </button>
                            ))}
                        </div>
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