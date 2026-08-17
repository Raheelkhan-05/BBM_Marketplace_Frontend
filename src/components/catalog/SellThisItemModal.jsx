import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, Lock, Package, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchSellerAccessStatus, createSellerListingForBrand, fetchBrandItemDetail } from "../../utils/api.js";
import SellerListingForm from "../seller/listingForm/SellerListingForm.jsx";
import { C, EASE } from "../catalog/tokens.js";

export default function SellThisItemModal({ brand, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(undefined);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(null);

    // The `brand` prop usually arrives from a lightweight list row
    // (name/brand_name/image only) — never has manufacturer, model
    // number, grade, specs, or the full image set. Fetch the real
    // record the moment this opens so the read-only summary below
    // actually has something to show, same as the (i) detail modal.
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(true);
    const [detailError, setDetailError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!brand?.id) { setDetailLoading(false); return; }
        setDetailLoading(true);
        setDetailError(false);
        fetchBrandItemDetail(brand.id).then((res) => {
            if (cancelled) return;
            if (res?.success) setDetail(res.item);
            else setDetailError(true);
        }).catch(() => { if (!cancelled) setDetailError(true); })
            .finally(() => { if (!cancelled) setDetailLoading(false); });
        return () => { cancelled = true; };
    }, [brand?.id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) { if (!cancelled) setAccess({ canPublish: false, reason: "NOT_AUTHENTICATED" }); return; }
            const res = await fetchSellerAccessStatus(token);
            if (!cancelled) setAccess(res?.success ? res : { canPublish: false, reason: "NOT_AUTHENTICATED" });
        })();
        return () => { cancelled = true; };
    }, [token]);

    // Lock the page underneath (and compensate scrollbar width so
    // nothing jumps), and mark the whole dialog with data-lenis-prevent
    // so the Lenis smooth-scroll instance running on the page never
    // intercepts wheel/touch input meant for this modal's own scroll area.
    useEffect(() => {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const { style } = document.body;
        const prevOverflow = style.overflow;
        const prevPaddingRight = style.paddingRight;
        style.overflow = "hidden";
        if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;
        return () => {
            style.overflow = prevOverflow;
            style.paddingRight = prevPaddingRight;
        };
    }, []);

    // Merge order: fetched detail > list-row brand prop > blank. This
    // means the summary renders instantly with whatever we already had,
    // then upgrades in place once the full record lands — no layout jump.
    const merged = {
        id: brand?.id,
        name: detail?.name || brand?.name,
        brand_name: detail?.brand_name || brand?.brand_name,
        image: detail?.image || brand?.image,
        images: detail?.images?.length ? detail.images : (brand?.images?.length ? brand.images : (brand?.image ? [brand.image] : [])),
        manufacturer: detail?.manufacturer || brand?.manufacturer,
        model_no: detail?.model_no || brand?.model_no,
        grade_variant: detail?.grade_variant || brand?.grade_variant,
        specifications: detail?.specifications?.length ? detail.specifications : (brand?.specifications || []),
    };

    const initialValues = {
        productName: merged.name || "",
        brandName: merged.brand_name || "",
        manufacturer: merged.manufacturer || "",
        modelNo: merged.model_no || "",
        gradeVariant: merged.grade_variant || "",
        specifications: Array.isArray(merged.specifications) ? merged.specifications : [],
        images: merged.images?.length ? merged.images : (merged.image ? [merged.image] : []),
    };

    const handleSubmit = async (form) => {
        setSubmitting(true);
        try {
            const res = await createSellerListingForBrand(token, { genericProductBrandId: brand.id, ...form });
            if (!res?.success) {
                if (["NOT_AUTHENTICATED", "SELLER_NOT_ONBOARDED", "SELLER_NOT_APPROVED"].includes(res?.code)) {
                    setAccess({ canPublish: false, reason: res.code, sellerStatus: res.sellerStatus });
                    return;
                }
                window.alert(res?.message || "Couldn't submit. Please check the required fields.");
                return;
            }
            setDone(res);
        } finally {
            setSubmitting(false);
        }
    };

    const gateContent = {
        NOT_AUTHENTICATED: { icon: Lock, title: "Sign in to sell this", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        SELLER_NOT_ONBOARDED: { icon: Package, title: "Set up your seller shop first", body: "Listing a product requires an approved seller shop. It only takes a few minutes.", cta: "Set up my shop", action: () => navigate("/seller/onboarding") },
        SELLER_NOT_APPROVED: {
            icon: Clock,
            title: access?.sellerStatus === "pending_review" ? "Your shop is under review" : "Your shop isn't approved yet",
            body: access?.sellerStatus === "pending_review" ? "We're verifying your details. You'll be able to list products once your shop is approved." : "Please check your shop status or contact support.",
            cta: "Check my shop status",
            action: () => navigate("/seller/status"),
        },
    }[access?.reason] || { icon: Lock, title: "Can't list right now", body: "Please try again in a moment.", cta: "Close", action: onClose };

    const stillLoading = access === undefined || detailLoading;

    return (
        <motion.div
            className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                data-lenis-prevent
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-white p-5 sm:rounded-[24px] sm:p-6"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
            >
                {done ? (
                    <div className="flex flex-col items-center py-6 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <CheckCircle2 className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>Submitted for review</h2>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{done.message || "We'll notify you once it's approved."}</p>
                        <button onClick={onClose} className="mt-6 rounded-xl border px-5 py-2.5 text-[13px] font-bold" style={{ borderColor: C.hair, color: C.ink }}>Done</button>
                    </div>
                ) : stillLoading ? (
                    <div className="flex items-center justify-center py-14">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
                    </div>
                ) : !access.canPublish ? (
                    <div className="flex flex-col items-center py-4 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <gateContent.icon className="h-6 w-6" />
                        </span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>{gateContent.title}</h2>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}>
                            {gateContent.cta}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>I want to sell this</p>
                                <h2 className="mt-0.5 truncate text-[17px] font-extrabold" style={{ color: C.ink }}>{merged.name}</h2>
                            </div>
                            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]">
                                <X className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                        </div>

                        {detailError && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11.5px] font-semibold" style={{ background: "#fef3c7", color: "#a16207" }}>
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Couldn't refresh full product details — showing what we have. You can still submit.
                            </div>
                        )}

                        <p className="mt-3 text-[12.5px] font-medium" style={{ color: C.muted }}>
                            The product identity is already approved — just add your commercial terms below.
                        </p>
                        <div className="mt-5">
                            <SellerListingForm
                                key={brand?.id}
                                mode="claim"
                                identityReadOnly
                                productReadOnly
                                initialValues={initialValues}
                                stickyFooter={false}
                                brandDisplay={{ name: merged.name, brandName: merged.brand_name, image: merged.image }}
                                onSubmit={handleSubmit}
                                submitting={submitting}
                                submitLabel="Submit for review"
                            />
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}