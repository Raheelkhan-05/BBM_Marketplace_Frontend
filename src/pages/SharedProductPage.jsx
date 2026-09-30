// src/pages/SharedProductPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2, PackageX, Lock } from "lucide-react";
import BuyNowModal from "../components/BuyNowModal.jsx";
import LandingPage from "./LandingPage.jsx";
import { fetchSharedProductLink } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const C = { ink: "#0B1116", muted: "#667077", secondary: "#006F83" };

// Same mapping as HomeProductFeed's toBuyerSellerPayload, so the shared-link flow
// and the inline flow never drift apart.
function toBuyerSellerPayload(s) {
    return {
        offerId: s.submission_id, sellerId: s.seller_id, display_name: s.display_name,
        unit: s.unit, moq: s.moq, price: s.price, gstPercent: s.gst_percent,
        availableStock: s.stock_quantity ?? null, stockType: s.stock_type,
        leadTime: s.stock_type === "made_to_order" ? s.production_lead_time_days : s.dispatch_time_days,
        transportPreference: s.transportPreference || null,
        transportPendingProposal: s.transportPendingProposal || null,
        dispatchTimeDays: s.dispatch_time_days, productionLeadTimeDays: s.production_lead_time_days,
        priceSlabs: s.price_slabs || [], quantityDiscounts: s.quantity_discounts || [],
        paymentTerms: s.payment_terms, returnPolicy: s.return_policy, warranty: s.warranty,
        deliveryTimeline: s.delivery_timeline, freightIncluded: s.freight_included,
        transportOptions: s.seller_profiles?.transport_options || s.transport_options || [],
        priceBasis: s.price_basis,
        dispatchOrigin: [s.dispatch_district, s.dispatch_state].filter(Boolean).join(", ") || null,
        dispatchPincode: s.dispatch_pincode, dispatchState: s.dispatch_state,
        packSize: s.pack_size, masterPackSize: s.units_per_master_pack,
        sampleAvailable: s.sample_available || false, sampleQuantity: s.sample_quantity ?? null,
        samplePrice: s.sample_price ?? null,
    };
}

function Overlay({ onBackdrop, children }) {
    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 px-6" onClick={onBackdrop}>
            <div onClick={(e) => e.stopPropagation()} className="flex max-w-xs flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center">
                {children}
            </div>
        </div>
    );
}

export default function SharedProductPage() {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token, effectiveLoggedIn } = useAuth();
    const [state, setState] = useState({ loading: true, error: null, code: null, data: null });
    const [showModal, setShowModal] = useState(true);

    useEffect(() => {
        // Must be logged in before the backend will say whether this buyer can see the product.
        if (!effectiveLoggedIn) {
            setState({ loading: false, error: null, code: "LOGIN_REQUIRED", data: null });
            return;
        }
        let cancelled = false;
        fetchSharedProductLink(submissionId, token).then((res) => {
            if (cancelled) return;
            if (!res?.success) {
                setState({ loading: false, error: res?.message || "This link is no longer available.", code: res?.code || null, data: null });
                return;
            }
            setState({ loading: false, error: null, code: null, data: res });
        });
        return () => { cancelled = true; };
    }, [submissionId, token, effectiveLoggedIn]);

    if (state.loading) {
        return (
            <>
                <LandingPage />
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/20">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
            </>
        );
    }

    if (state.code === "LOGIN_REQUIRED") {
        const back = `${location.pathname}${location.search}`;
        return (
            <>
                <LandingPage />
                <Overlay onBackdrop={() => navigate("/")}>
                    <Lock className="h-6 w-6" style={{ color: C.muted }} />
                    <p className="text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>Login to view this product</p>
                    <p className="text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>This link needs you to be signed in first.</p>
                    <button
                        // `from` is what AuthPage reads elsewhere in the app; `returnTo` kept for compatibility.
                        onClick={() => navigate("/login", { state: { from: back, returnTo: location.pathname } })}
                        className="mt-2 rounded-xl px-4 py-2 text-[13px] font-bold tracking-wide text-white"
                        style={{ background: C.secondary }}>
                        Login
                    </button>
                </Overlay>
            </>
        );
    }

    if (state.code === "RESTRICTED") {
        return (
            <>
                <LandingPage />
                <Overlay onBackdrop={() => navigate("/")}>
                    <Lock className="h-6 w-6" style={{ color: C.muted }} />
                    <p className="text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>Not available for your account</p>
                    <p className="text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>{state.error}</p>
                    <button onClick={() => navigate("/")} className="mt-2 text-[13px] font-bold tracking-wide" style={{ color: C.secondary }}>Browse other products</button>
                </Overlay>
            </>
        );
    }

    if (state.error) {
        return (
            <>
                <LandingPage />
                <Overlay onBackdrop={() => navigate("/")}>
                    <PackageX className="h-6 w-6" style={{ color: C.muted }} />
                    <p className="text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>{state.error}</p>
                    <button onClick={() => navigate("/")} className="mt-2 text-[13px] font-bold tracking-wide" style={{ color: C.secondary }}>Browse other products</button>
                </Overlay>
            </>
        );
    }

    const { product, seller } = state.data;
    return (
        <>
            <LandingPage />
            {showModal && (
                <BuyNowModal
                    seller={toBuyerSellerPayload(seller)}
                    // Spread keeps every field the API sends (image, model_no, category…);
                    // id + image are normalised so the modal can show the photo and load full details.
                    product={{
                        ...product,
                        id: product.id ?? product.brandItemId ?? product.brand_item_id ?? null,
                        name: product.name,
                        brand_name: product.brand_name ?? product.brandName,
                        brand_image: product.brand_image ?? product.brandImage,
                        image: product.image ?? product.images?.[0] ?? null,
                        model_no: product.model_no ?? product.modelNo,
                    }}
                    onClose={() => { setShowModal(false); navigate("/"); }}
                />
            )}
        </>
    );
}