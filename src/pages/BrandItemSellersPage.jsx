import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
    ChevronRight, ArrowLeft, Package, Plus, X, Loader2, CheckCircle2, Lock, Clock, IndianRupee,
    Maximize2, Users, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { searchCatalogBrandItems, searchCatalogSellers, fetchSellerAccessStatus, createSellerListingForBrand, uploadSellerFile } from "../utils/api";
import { resolveSearchRoute } from "../utils/searchResolve.js";
import StackedImagePreview from "../components/StackedImagePreview.jsx";
import { Link } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import { useAuth } from "../context/AuthContext.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import { SellerRow, SellerListSkeleton, FilterSortChips, CatalogHeader, CatalogLoadError } from "../components/catalog/CatalogUI";
import { C, EASE } from "../components/catalog/tokens";
import useAsyncCatalogData from "../hooks/useAsyncCatalogData";
import BuyNowModal from "../components/BuyNowModal.jsx";
import SellThisItemModal from "../components/catalog/SellThisItemModal.jsx";


/* ------------------------------------------------------------------
   DESIGN NOTES — BrandItemSellersPage v2
   ------------------------------------------------------------------
   Rebuilt as an image-led "product hero" instead of a text header
   with a bolted-on thumbnail — closer to how IndiaMART/TradeIndia
   frame a single catalog item before showing suppliers. The hero
   card carries: breadcrumb trail, tappable image (opens
   ImageLightbox), title + brand, a "starting from ₹X" price signal
   computed from the seller list itself, and a seller-count stat.

   CTA hierarchy: on desktop the "I want to sell this" button lives
   inside the hero card. On mobile it's promoted to a fixed bottom
   action bar (safe-area aware) so it's always one thumb-reach away
   while scrolling the seller list — the same pattern used for
   "Contact Supplier" bars industry-wide, and much stronger than a
   button that scrolls out of view.
   ------------------------------------------------------------------ */

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];

function HeroSkeleton() {
    return (
        <div className="flex gap-4 rounded-[28px] border bg-white p-4 sm:p-5" style={{ borderColor: C.hair }}>
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl sm:h-28 sm:w-28" style={{ background: C.hairSoft }} />
            <div className="flex-1 py-1">
                <div className="h-2.5 w-1/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            </div>
        </div>
    );
}

/* ---------------- page ---------------- */

export default function BrandItemSellersPage() {
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [brand, setBrand] = useState(state?.brand || null);
    const [genericProduct] = useState(state?.genericProduct || null);
    const [category] = useState(state?.category || null);
    const [buySeller, setBuySeller] = useState(null);

    const [query, setQuery] = useState("");
    const [showSellModal, setShowSellModal] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const { data: sellers, loading, error, retry } = useAsyncCatalogData(async () => {
        let b = brand;
        if (!b) {
            const brandsRes = await searchCatalogBrandItems(undefined, idOrSlug, 5);
            b = brandsRes?.items?.find((x) => x.slug === idOrSlug || x.id === idOrSlug) || brandsRes?.items?.[0] || null;
            setBrand(b);
        }
        if (!b) return [];
        const res = await searchCatalogSellers(b.id, "", 50, 0, token); // pass token through
        if (!res?.success) throw new Error("Request failed");
        return res.items || [];
    }, [idOrSlug, token]); // token added to deps so it refetches on login/logout

    const safeSellers = sellers || [];

    const filtered = query.trim()
        ? safeSellers.filter((s) => s.display_name.toLowerCase().includes(query.trim().toLowerCase()))
        : safeSellers;

    const lowestPrice = useMemo(() => {
        const priced = safeSellers.filter((s) => s.price != null && s.price > 0);
        if (!priced.length) return null;
        return priced.reduce((min, s) => (s.price < min.price ? s : min), priced[0]);
    }, [safeSellers]);

    const handleSearchSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) navigate(route.pathname, { state: route.state });
        else navigate(`/browse-search?q=${encodeURIComponent(trimmedQuery)}`);
    };

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-28 pt-3 sm:px-4 sm:pb-10 lg:px-6">
            {/* back */}
            <div className="mt-3 flex items-center justify-between gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-black/[0.03]"
                    style={{ borderColor: C.hair, color: C.ink }}
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
            </div>

            {/* breadcrumb trail */}
            {(category?.name || genericProduct?.name) && (
                <div className="mt-3 flex items-center gap-1 overflow-x-auto text-[11px] font-bold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ color: C.muted }}>
                    {category?.name && <span className="shrink-0 whitespace-nowrap">{category.name}</span>}
                    {category?.name && genericProduct?.name && <ChevronRightIcon className="h-3 w-3 shrink-0" />}
                    {genericProduct?.name && (
                        <Link
                            to={`/product/${genericProduct.slug || genericProduct.id}/brands`}
                            state={{ genericProduct, category }}
                            className="shrink-0 whitespace-nowrap hover:underline"
                            style={{ color: C.secondary }}
                        >
                            {genericProduct.name}
                        </Link>
                    )}
                </div>
            )}

            {/* hero card */}
            <div className="mt-3">
                {loading && !brand ? (
                    <HeroSkeleton />
                ) : (
                    <div
                        className="relative overflow-hidden rounded-[28px] border p-4 sm:p-5"
                        style={{
                            borderColor: C.hair,
                            background: `linear-gradient(160deg, ${C.secondary}08 0%, #fff 45%)`,
                        }}
                    >
                        <div className="flex gap-4">
                            <StackedImagePreview
                                images={brand?.images?.length ? brand.images : (brand?.image ? [brand.image] : [])}
                                name={brand?.name}
                                onOpen={(idx) => { setLightboxIndex(idx); setShowLightbox(true); }}
                            />

                            <div className="min-w-0 flex-1">
                                {brand?.brand_name && (
                                    <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: C.secondary }}>
                                        {brand.brand_name}
                                    </p>
                                )}
                                <h1
                                    className="mt-0.5 font-extrabold leading-tight tracking-[-0.01em]"
                                    style={{ color: C.ink, fontSize: "clamp(18px, 1.9vw, 25px)" }}
                                >
                                    {brand?.name || "Product"}
                                </h1>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.muted }}>
                                        <Users className="h-3 w-3" /> {safeSellers.length} seller{safeSellers.length === 1 ? "" : "s"}
                                    </span>
                                    {lowestPrice && (
                                        <span className="flex items-baseline gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: `${C.primary}12`, color: C.primary }}>
                                            From ₹{lowestPrice.price}{lowestPrice.unit ? `/${lowestPrice.unit}` : ""}
                                        </span>
                                    )}
                                </div>

                                {/* desktop CTA lives inside the hero */}
                                <button
                                    onClick={() => setShowSellModal(true)}
                                    className="mt-3 hidden items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white sm:inline-flex"
                                    style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}
                                >
                                    <Plus className="h-3.5 w-3.5" /> I want to sell this
                                </button>
                                <button
                                    onClick={() => setShowSellModal(true)}
                                    className="flex shrink-0 items-center gap-1 rounded-md px-3 py-1 mt-2 text-[12px] font-bold text-white sm:hidden"
                                    style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Sell this
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* search — desktop only, reuses the app's existing search bar */}
            <div className="mt-4 hidden lg:block">
                <MarketplaceSearchBar value={query} onChange={setQuery} onSubmit={handleSearchSubmit} />
            </div>

            {/* filter / sort chips */}
            <FilterSortChips />

            {/* seller list */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                    Sellers listing this item
                </p>
                {loading ? (
                    <SellerListSkeleton />
                ) : error ? (
                    <CatalogLoadError onRetry={retry} />
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-[13px] font-medium" style={{ color: C.muted }}>
                        {query ? `No sellers match "${query}".` : "No sellers listing this item yet."}
                    </p>
                ) : (
                    <div className="flex flex-col sm:gap-2.5">
                        {filtered.map((s, i) => (
                            <SellerRow key={s.id} seller={s} idx={i} isLast={i === filtered.length - 1} onClick={() => setBuySeller(s)} />
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showSellModal && brand && (
                    <SellThisItemModal brand={brand} onClose={() => setShowSellModal(false)} />
                )}
                {showLightbox && brand?.image && (
                    <ImageLightbox
                        images={brand.images?.length ? brand.images : [brand.image]}
                        initialIndex={lightboxIndex}
                        alt={brand.name}
                        onClose={() => setShowLightbox(false)}
                    />
                )}
                {buySeller && <BuyNowModal seller={buySeller} product={brand} onClose={() => setBuySeller(null)} />}
            </AnimatePresence>
        </div>
    );
}   