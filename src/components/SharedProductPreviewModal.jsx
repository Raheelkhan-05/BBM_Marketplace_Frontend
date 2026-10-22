// Read-only product preview for logged-out visitors of a shared link to a PUBLIC listing.
// Shows product, shop, packing, MOQ, delivery and terms. It never reads or shows any price field.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Lock, X, Package, Share2, Store, Maximize2, Boxes, FileText, Info, ChevronDown, Beaker, Clock, ArrowRight } from "lucide-react";
import ImageLightbox from "./ImageLightbox.jsx";
import { fetchBrandItemDetail } from "../utils/api.js";
import { shareProductLink } from "../utils/share.js";
import { resizedImageUrl } from "../utils/imageUrl";
import { saleUnitLabel } from "../shared/packUnits.js";
import { shopNameOf } from "../utils/shopName.js";
import { C, EASE } from "./seller/listingForm/FormPrimitives.jsx";

const pick = (obj, ...keys) => {
    for (const k of keys) { const v = obj?.[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return null;
};
const isHiddenLabel = (n) => typeof n === "string" && n.trim().toLowerCase() === "pending";

function Fact({ label, value }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex items-baseline justify-between gap-3 border-b py-2 text-[12.5px] last:border-b-0" style={{ borderColor: C.hairSoft }}>
            <span className="shrink-0 font-semibold tracking-wide" style={{ color: C.muted }}>{label}</span>
            <span className="text-right font-bold tracking-wide" style={{ color: C.ink }}>{String(value)}</span>
        </div>
    );
}

function Collapse({ icon: Icon, title, defaultOpen = false, children }) {
    return (
        <details open={defaultOpen} className="group rounded-2xl border bg-white p-3.5 sm:p-4" style={{ borderColor: C.hair }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />}
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>{title}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: C.muted }} />
            </summary>
            <div className="mt-3 border-t pt-3" style={{ borderColor: C.hairSoft }}>{children}</div>
        </details>
    );
}

export default function SharedProductPreviewModal({ seller, product, submissionId, onClose, onLogin }) {
    const [detail, setDetail] = useState(null);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [toast, setToast] = useState(null);

    // Same scroll handling as the Buy Now modal.
    useEffect(() => {
        const lenis = window.lenis;
        lenis?.stop?.();
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { lenis?.start?.(); document.body.style.overflow = original; };
    }, []);

    useEffect(() => {
        if (!product?.id) return undefined;
        let cancelled = false;
        fetchBrandItemDetail(product.id)
            .then((res) => { if (!cancelled && res?.success) setDetail(res.item); })
            .catch(() => { /* header still renders from `product` */ });
        return () => { cancelled = true; };
    }, [product?.id]);

    useEffect(() => {
        if (!toast) return undefined;
        const t = setTimeout(() => setToast(null), 2200);
        return () => clearTimeout(t);
    }, [toast]);

    const stop = useCallback((e) => e.stopPropagation(), []);

    const shopName = shopNameOf(seller);
    const productName = product?.name || pick(detail, "name");
    const brandName = product?.brand_name || pick(detail, "brand_name", "brandName");
    const brandNotApplicable = pick(detail, "brand_not_applicable", "brandNotApplicable");
    const modelNo = product?.model_no || pick(detail, "model_no", "modelNo");
    const gradeVariant = pick(detail, "grade_variant", "gradeVariant");
    const manufacturer = pick(detail, "manufacturer");
    const description = pick(detail, "description");
    const manufacturingDetails = pick(detail, "manufacturing_details", "manufacturingDetails");
    const specifications = detail?.specifications || [];
    const categoryLabel = [product?.category_name || pick(detail, "category_name"), product?.subcategory_name || pick(detail, "subcategory_name")]
        .filter((x) => x && !isHiddenLabel(x)).join(" · ");
    const galleryImages = detail?.images?.length ? detail.images : (detail?.image ? [detail.image] : []);
    const heroImage = product?.image || galleryImages[0] || null;
    const brandImage = product?.brand_image || pick(detail, "brand_image", "brandImage");
    const subLabel = [brandNotApplicable ? null : brandName, modelNo].filter(Boolean).join(" · ");

    const hasMaster = Number(seller?.masterPackSize) >= 1;
    const packagingLine = Number(seller?.packSize) > 0
        ? `1 pack = ${seller.packSize} ${seller.unit}${hasMaster ? ` · 1 master pack = ${seller.masterPackSize} packs` : ""}`
        : null;
    const moqN = Number(seller?.moq) || 0;
    const moqText = moqN > 0 ? `${moqN} ${saleUnitLabel(seller?.masterPackSize)}${moqN === 1 ? "" : "s"}` : null;
    const madeToOrder = seller?.stockType === "made_to_order";
    const leadDays = madeToOrder ? seller?.productionLeadTimeDays : seller?.dispatchTimeDays;
    const leadText = leadDays != null && leadDays !== "" && Number(leadDays) > 0
        ? `${leadDays} day${Number(leadDays) === 1 ? "" : "s"}` : null;

    const hasTerms = seller && (seller.deliveryTimeline || seller.returnPolicy || seller.warranty || seller.dispatchOrigin);
    const hasProductDetails = !!(manufacturer || modelNo || gradeVariant || description || manufacturingDetails || specifications.length || galleryImages.length > 1);

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div role="dialog" aria-modal="true" aria-label="Product details"
                className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[20px]"
                initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }} onClick={stop}>

                {/* HEADER */}
                <div className="shrink-0 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: C.hairSoft }}>
                    <div className="flex items-start gap-3">
                        <button type="button" disabled={!heroImage} onClick={() => heroImage && setLightboxSrc(heroImage)} aria-label="View product image"
                            className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                            style={{ background: "#F4F5F6", cursor: heroImage ? "zoom-in" : "default" }}>
                            {heroImage
                                ? <img src={resizedImageUrl(heroImage, { width: 256 })} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                                : <Package className="h-5 w-5" style={{ color: C.muted }} />}
                            {heroImage && (
                                <span className="absolute bottom-1 right-1 flex items-center justify-center rounded-full bg-black/60 p-[3px] text-white"><Maximize2 className="h-2.5 w-2.5" /></span>
                            )}
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.secondary }}>Product details</p>
                            <h2 className="mt-0.5 line-clamp-2 text-[15.5px] font-extrabold leading-tight tracking-wide" style={{ color: C.ink }}>{productName}</h2>
                            {subLabel && (
                                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] font-bold uppercase tracking-wider" style={{ color: "#006F83" }}>
                                    {brandImage && !brandNotApplicable && <img src={resizedImageUrl(brandImage, { width: 64 })} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />}
                                    <span className="truncate">{subLabel}</span>
                                </p>
                            )}
                            {categoryLabel && <p className="mt-0.5 truncate text-[10.5px] font-medium tracking-wide" style={{ color: C.muted }}>{categoryLabel}</p>}
                            <p className="mt-1 flex items-center gap-1 truncate text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                <Store className="h-3 w-3 shrink-0" />
                                <span className="truncate">Sold by {shopName}{seller?.dispatchOrigin ? ` · ${seller.dispatchOrigin}` : ""}</span>
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                            <button aria-label="Share this listing"
                                onClick={async () => {
                                    const r = await shareProductLink({ submissionId, productName, sellerName: shopName });
                                    if (r === "copied") setToast("Link copied!");
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.05]">
                                <Share2 className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.05]">
                                <X className="h-[18px] w-[18px]" style={{ color: C.muted }} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto" data-lenis-prevent onWheel={stop} onTouchStart={stop} onTouchMove={stop}>
                    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                        <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: `${C.secondary}0f` }}>
                            <Lock className="mt-[1px] h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                            <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: C.secondary }}>
                                Prices and ordering are available after you log in.
                            </p>
                        </div>

                        <section className="rounded-2xl border bg-white p-3.5 sm:p-4" style={{ borderColor: C.hair }}>
                            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>
                                <Boxes className="h-3.5 w-3.5" /> At a glance
                            </p>
                            {packagingLine && (
                                <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#FCFBF9] px-3 py-2">
                                    <Boxes className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                    <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.ink }}>{packagingLine}</p>
                                </div>
                            )}
                            <Fact label="Minimum order (MOQ)" value={moqText} />
                            <Fact label="Availability" value={madeToOrder ? "Made to order" : "Ready stock"} />
                            <Fact label={madeToOrder ? "Production time" : "Dispatch time"} value={leadText} />
                            {seller?.sampleAvailable && (
                                <div className="flex items-center gap-1.5 pt-2 text-[12px] font-bold" style={{ color: C.secondary }}>
                                    <Beaker className="h-3.5 w-3.5" /> Sample available
                                </div>
                            )}
                        </section>

                        {hasTerms && (
                            <Collapse icon={FileText} title="Seller terms">
                                <Fact label="Delivery" value={seller.deliveryTimeline} />
                                <Fact label="Returns" value={seller.returnPolicy} />
                                <Fact label="Warranty" value={seller.warranty} />
                                <Fact label="Ships from" value={seller.dispatchOrigin} />
                            </Collapse>
                        )}

                        {(hasProductDetails || (product?.id && !detail)) && (
                            <Collapse icon={Info} title="Product details" defaultOpen>
                                {!detail && product?.id ? (
                                    <div className="flex flex-col gap-2">
                                        {["60%", "90%", "75%"].map((w) => <span key={w} className="inline-block h-3.5 animate-pulse rounded" style={{ width: w, background: C.hairSoft }} />)}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3.5">
                                        {galleryImages.length > 1 && (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {galleryImages.slice(0, 8).map((src, i) => (
                                                    <button key={i} type="button" onClick={() => setLightboxSrc(src)} aria-label={`View image ${i + 1}`}
                                                        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: "#F4F5F6", cursor: "zoom-in" }}>
                                                        <img src={resizedImageUrl(src, { width: 128 })} alt="" loading="lazy" className="h-full w-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {(manufacturer || modelNo || gradeVariant) && (
                                            <div className="rounded-xl border px-3.5" style={{ borderColor: C.hair }}>
                                                <Fact label="Manufacturer" value={manufacturer} />
                                                <Fact label="Model / Part No." value={modelNo} />
                                                <Fact label="Grade / Variant" value={gradeVariant} />
                                            </div>
                                        )}
                                        {description && (
                                            <div>
                                                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>Description</p>
                                                <p className="text-[12.5px] font-medium leading-relaxed tracking-wide" style={{ color: C.ink }}>{description}</p>
                                            </div>
                                        )}
                                        {manufacturingDetails && (
                                            <div>
                                                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>Manufacturing</p>
                                                <p className="text-[12.5px] font-medium leading-relaxed tracking-wide" style={{ color: C.ink }}>{manufacturingDetails}</p>
                                            </div>
                                        )}
                                        {specifications.length > 0 && (
                                            <div>
                                                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>Specifications</p>
                                                <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.hair }}>
                                                    {specifications.map((s, i) => (
                                                        <div key={i} className="flex justify-between gap-3 px-3.5 py-2 text-[12px] font-semibold tracking-wide"
                                                            style={{ background: i % 2 === 0 ? "white" : C.hairSoft, color: C.ink }}>
                                                            <span style={{ color: C.muted }}>{s.key}</span><span className="text-right">{s.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Collapse>
                        )}
                    </div>
                </div>

                {/* FOOTER: the only action is login */}
                <div className="shrink-0 border-t bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5" style={{ borderColor: C.hairSoft }}>
                    <button type="button" onClick={onLogin}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold text-white shadow-sm"
                        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                        <Lock className="h-4 w-4" /> Login to view price &amp; buy <ArrowRight className="h-4 w-4" />
                    </button>
                    <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold" style={{ color: C.muted }}>
                        <Clock className="h-3 w-3" /> Takes about 30 seconds. No password needed.
                    </p>
                </div>

                {toast && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
                        <span className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-bold text-white shadow-lg">{toast}</span>
                    </div>
                )}
            </motion.div>

            {lightboxSrc && createPortal(
                <div className="fixed inset-0 z-[1200]" onClick={(e) => e.stopPropagation()}>
                    <ImageLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />
                </div>,
                document.body
            )}
        </motion.div>
    );
}