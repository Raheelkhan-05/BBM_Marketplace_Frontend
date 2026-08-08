import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal, ArrowUpDown, Box, Store, ShieldCheck, MapPin, Building2 } from "lucide-react";
import useCatalogHierarchySearch from "../hooks/useCatalogHierarchySearch";
import useShopSearch from "../hooks/useShopSearch";

/* ------------------------------------------------------------------
   DESIGN NOTES — CatalogHierarchySearchPage
   ------------------------------------------------------------------
   Same design system as CategoriesPage / CategorySubcategoriesPage:
   ink #0B1116, muted #667077, primary #D2462B, secondary #006F83,
   hairline rgba(11,17,22,0.09), [0.16,1,0.3,1] easing, same IconTile
   square-grid rail for category/subcategory/generic_product/brand_item
   levels. The seller level (and the shop-match panel) swaps to a
   row-list layout since a seller card needs a name, location, and
   price line rather than a square thumbnail — but uses the same
   color tokens and card language as BrandItemSellersPage so a seller
   looks the same across every browse surface.
   ------------------------------------------------------------------ */

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};

const EASE = [0.16, 1, 0.3, 1];

const LEVEL_LABEL = {
    category: "Categories",
    subcategory: "Subcategories",
    generic_product: "Products",
    brand_item: "Brands",
    seller: "Sellers",
};
const LEVEL_PLACEHOLDER = {
    category: "Search categories (e.g. Bearings, Lubricants)",
    subcategory: "Search subcategories",
    generic_product: "Search products",
    brand_item: "Search brands",
    seller: "Search sellers",
};
const TILE_LEVELS = new Set(["category", "subcategory", "generic_product", "brand_item"]);

function tintFor(idx) {
    return idx % 2 === 0 ? `${C.primary}12` : `${C.secondary}12`;
}
function fgFor(idx) {
    return idx % 2 === 0 ? C.primary : C.secondary;
}

function IconTile({ image, name, idx, count, sub, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.3), ease: EASE }}
            whileTap={{ scale: 0.95 }}
            className="flex snap-start flex-col items-center gap-2 outline-none"
        >
            <span
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition-transform duration-150 active:scale-95"
                style={{ background: '#f3f4f6ff' }}
            >
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" draggable={false} />
                ) : (
                    <Box className="h-7 w-7" style={{ color: fgFor(idx) }} />
                )}
                {count != null && (
                    <span
                        className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white ring-2 ring-white"
                        style={{ background: fgFor(idx) }}
                    >
                        {count}
                    </span>
                )}
            </span>
            <p
                className="line-clamp-2 w-full text-center text-[11.5px] font-bold leading-tight tracking-[-0.005em]"
                style={{ color: C.ink }}
            >
                {name}
            </p>
            {sub && (
                <p className="line-clamp-1 w-full text-center text-[10px] font-semibold" style={{ color: C.muted }}>
                    {sub}
                </p>
            )}
        </motion.button>
    );
}

function TileGrid({ children }) {
    return (
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-6">
            {children}
        </div>
    );
}

function TileGridSkeleton() {
    return (
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                    <div className="aspect-square w-full animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />
                    <div className="h-2.5 w-3/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                </div>
            ))}
        </div>
    );
}

function SellerRow({ seller, idx, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            className="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors duration-150 hover:bg-black/[0.02] sm:p-4"
            style={{ borderColor: C.hair }}
        >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                {seller.logo_url ? (
                    <img src={seller.logo_url} alt={seller.display_name} className="h-full w-full object-contain p-1" />
                ) : (
                    <Building2 className="h-6 w-6" style={{ color: C.muted }} />
                )}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{seller.display_name}</p>
                    <span className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold text-white" style={{ background: C.secondary }}>
                        <ShieldCheck className="h-2.5 w-2.5" /> GST Verified
                    </span>
                </div>
                {(seller.city || seller.state) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: C.muted }}>
                        <MapPin className="h-3 w-3 shrink-0" /> {[seller.city, seller.state].filter(Boolean).join(", ")}
                    </p>
                )}
            </div>

            {seller.price != null && (
                <div className="shrink-0 text-right">
                    <p className="text-[13px] font-extrabold" style={{ color: C.primary }}>₹{seller.price}{seller.unit ? `/${seller.unit}` : ""}</p>
                    {seller.moq && <p className="text-[10px] font-semibold" style={{ color: C.muted }}>MOQ {seller.moq}</p>}
                </div>
            )}
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
        </motion.button>
    );
}

function SellerListSkeleton() {
    return (
        <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border p-3 sm:p-4" style={{ borderColor: C.hair }}>
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
                    <div className="flex-1">
                        <div className="h-3 w-1/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                        <div className="mt-2 h-2.5 w-1/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ShopRow({ shop, idx }) {
    const navigate = useNavigate();
    return (
        <motion.button
            onClick={() => navigate(`/shop/${shop.shop_slug}`)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            className="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors duration-150 hover:bg-black/[0.02] sm:p-4"
            style={{ borderColor: C.hair }}
        >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                {shop.logo_url ? (
                    <img src={shop.logo_url} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                    <Building2 className="h-5 w-5" style={{ color: C.muted }} />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{shop.display_name}</p>
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] font-semibold" style={{ color: C.muted }}>
                    {shop.business_type && <span>{shop.business_type} · </span>}
                    <MapPin className="h-3 w-3 shrink-0" />{shop.city}, {shop.state}
                </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
        </motion.button>
    );
}

function EmptyState({ level, query }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                <Box className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold" style={{ color: C.ink }}>
                No {LEVEL_LABEL[level]?.toLowerCase()} found{query ? ` for "${query}"` : ""}
            </h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>
                Try a different keyword, or use the back button to go up a level.
            </p>
        </motion.div>
    );
}

export default function CatalogHierarchySearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialQuery = searchParams.get("q") || "";

    const {
        stack, currentLevel, parent, query, setQuery,
        items, suggestions, loading,
        selectItem, selectSuggestion, goBack, goToBreadcrumb, canGoBack,
    } = useCatalogHierarchySearch(initialQuery);

    const [inputValue, setInputValue] = useState(initialQuery);
    const { shops, loading: shopsLoading } = useShopSearch(stack.length === 0 ? query : "");

    useEffect(() => setInputValue(query), [query]);
    useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [query]);

    function handleSubmit(e) {
        e.preventDefault();
        setQuery(inputValue.trim());
    }
    function handleBack() {
        if (canGoBack) goBack();
        else navigate(-1);
    }
    function handleSelect(item) {
        if (currentLevel === "seller") {
            navigate(`/shop/${item.shop_slug}`);
            return;
        }
        selectItem(item);
    }

    const showingSuggestions = !loading && items.length === 0 && suggestions.length > 0;
    const showShops = stack.length === 0 && !!query.trim() && shops.length > 0;

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            {/* header: back + title */}
            <div className="mt-3 flex items-center gap-3 sm:mb-1">
                <button
                    onClick={handleBack}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-black/[0.03]"
                    style={{ borderColor: C.hair, color: C.ink }}
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                    <h1
                        className="truncate font-extrabold leading-tight tracking-[-0.01em]"
                        style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                    >
                        {showingSuggestions ? "Did you mean" : LEVEL_LABEL[currentLevel]}
                    </h1>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                        {parent ? `in ${parent.name}` : `${items.length} results`}
                    </p>
                </div>
            </div>

            {/* breadcrumbs */}
            {stack.length > 0 && (
                <div className="mt-3 flex min-h-[18px] flex-wrap items-center gap-1 text-[11.5px] font-semibold" style={{ color: C.muted }}>
                    <button onClick={() => goToBreadcrumb(-1)} style={{ color: C.secondary }} className="hover:underline">All Categories</button>
                    {stack.map((crumb, i) => (
                        <span key={crumb.id} className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" style={{ color: C.muted, opacity: 0.5 }} />
                            <button
                                onClick={() => goToBreadcrumb(i)}
                                style={{ color: i === stack.length - 1 ? C.ink : C.secondary }}
                                className={i !== stack.length - 1 ? "hover:underline" : ""}
                            >
                                {crumb.name}
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* search — same bar shape as MarketplaceSearchBar, always visible here since this IS the search page */}
            <form onSubmit={handleSubmit} className="mt-4 hidden sm:flex items-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                <Search className="ml-3.5 h-4 w-4 shrink-0" style={{ color: C.muted }} />
                <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={LEVEL_PLACEHOLDER[currentLevel]}
                    className="w-full bg-transparent px-3 py-3 text-[13.5px] font-medium focus:outline-none"
                    style={{ color: C.ink }}
                />
            </form>

            {/* filter / sort chips */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                    { icon: SlidersHorizontal, label: "Filter" },
                    { icon: ArrowUpDown, label: "Sort" },
                ].map(({ icon: Icon, label }) => (
                    <button
                        key={label}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: C.hair, color: C.ink }}
                    >
                        <Icon className="h-3.5 w-3.5" style={{ color: C.muted }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* shop matches, shown above the hierarchy results at the root level */}
            {showShops && (
                <div className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.ink }}>
                        <Store className="h-4 w-4" style={{ color: C.secondary }} /> Shops matching "{query}"
                    </h3>
                    <div className="mt-2.5 flex flex-col gap-2">
                        {shops.map((shop, i) => <ShopRow key={shop.id} shop={shop} idx={i} />)}
                    </div>
                </div>
            )}

            {/* results panel — same rounded card shell as the category grid */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    currentLevel === "seller" ? <SellerListSkeleton /> : <TileGridSkeleton />
                ) : items.length === 0 && suggestions.length === 0 && !showShops ? (
                    <EmptyState level={currentLevel} query={query} />
                ) : showingSuggestions ? (
                    <TileGrid>
                        {suggestions.map((s, i) => (
                            <IconTile
                                key={`${s.level}-${s.id ?? i}`}
                                image={s.image}
                                name={s.name}
                                idx={i}
                                sub={s.categoryName || s.subcategoryName || s.genericProductName}
                                onClick={() => selectSuggestion(s)}
                            />
                        ))}
                    </TileGrid>
                ) : currentLevel === "seller" ? (
                    <div className="flex flex-col gap-2.5">
                        {items.map((seller, i) => (
                            <SellerRow key={seller.offerId ?? i} seller={seller} idx={i} onClick={() => handleSelect(seller)} />
                        ))}
                    </div>
                ) : TILE_LEVELS.has(currentLevel) ? (
                    <TileGrid>
                        {items.map((item, i) => (
                            <IconTile
                                key={item.id ?? i}
                                image={item.image}
                                name={item.name}
                                idx={i}
                                count={item.subcategoryCount ?? item.productCount ?? item.brandCount ?? item.sellerCount}
                                sub={currentLevel === "brand_item" ? item.brand_name : null}
                                onClick={() => handleSelect(item)}
                            />
                        ))}
                    </TileGrid>
                ) : null}
            </div>
        </div>
    );
}