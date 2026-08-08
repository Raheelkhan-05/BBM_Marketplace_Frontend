import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, PackageSearch, Store, ShieldCheck, MapPin, Layers, Tag, Package, BadgeCheck, IndianRupee } from "lucide-react";
import useCatalogHierarchySearch from "../hooks/useCatalogHierarchySearch";
import useShopSearch from "../hooks/useShopSearch";
import ShopResultCard from "../components/search/ShopResultCard";
import { FONT_BODY } from "./ui.jsx";

const LEVEL_LABEL = {
    category: "Categories",
    subcategory: "Subcategories",
    generic_product: "Generic Products",
    brand_item: "Brand Items",
    seller: "Sellers",
};
const LEVEL_PLACEHOLDER = {
    category: "Search categories (e.g. Bearings, Lubricants)",
    subcategory: "Search subcategories",
    generic_product: "Search products",
    brand_item: "Search brands",
    seller: "Search sellers",
};
const CARD_GRID_LEVELS = new Set(["generic_product", "brand_item"]);

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
        <div className="mx-auto max-w-4xl min-h-screen px-4 pt-4 sm:px-6 lg:px-8 pb-10">
            <div className="flex items-center gap-3">
                <button onClick={handleBack} aria-label="Go back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <form onSubmit={handleSubmit} className="flex flex-1 items-center overflow-hidden rounded-xl border-2 border-slate-100 bg-white shadow-[0_8px_20px_-12px_rgba(4,112,132,0.28)] focus-within:border-[#7fb3bd]">
                    <Search className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={LEVEL_PLACEHOLDER[currentLevel]}
                        className="w-full bg-transparent px-3 py-3 text-[13.5px] font-medium text-slate-700 focus:outline-none"
                    />
                </form>
            </div>

            <div className="mt-3 flex min-h-[18px] flex-wrap items-center gap-1 text-[11.5px] font-semibold text-slate-500">
                {stack.length > 0 && (
                    <>
                        <button onClick={() => goToBreadcrumb(-1)} className="text-[#047084] hover:underline">All Categories</button>
                        {stack.map((crumb, i) => (
                            <span key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3 text-slate-300" />
                                <button onClick={() => goToBreadcrumb(i)} className={i === stack.length - 1 ? "text-slate-900" : "text-[#047084] hover:underline"}>
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </>
                )}
            </div>

            <div className="mt-3">
                <h2 className="text-[19px] font-extrabold tracking-tight text-slate-900" style={{ fontFamily: FONT_BODY }}>
                    {showingSuggestions ? "Did you mean" : LEVEL_LABEL[currentLevel]}
                    {!showingSuggestions && parent ? ` in "${parent.name}"` : ""}
                </h2>
                {showingSuggestions && (
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                        No {LEVEL_LABEL[currentLevel]?.toLowerCase()} matched "{query}" here, but we found this elsewhere:
                    </p>
                )}
            </div>

            {showShops && (
                <div className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-900">
                        <Store className="h-4 w-4 text-[#047084]" /> Shops matching "{query}"
                    </h3>
                    <div className="mt-2.5 flex flex-col gap-2">
                        {shops.map((shop) => <ShopResultCard key={shop.id} shop={shop} />)}
                    </div>
                </div>
            )}

            {loading ? (
                CARD_GRID_LEVELS.has(currentLevel) ? (
                    <div className="mt-4 grid grid-cols-3 gap-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <div className="mt-4 space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                )
            ) : items.length === 0 && suggestions.length === 0 && !showShops ? (
                <EmptyState level={currentLevel} query={query} />
            ) : showingSuggestions ? (
                <div className="mt-4 space-y-2">
                    {suggestions.map((s, i) => (
                        <SuggestionRow key={`${s.level}-${s.id ?? i}`} suggestion={s} onClick={() => selectSuggestion(s)} />
                    ))}
                </div>
            ) : currentLevel === "seller" ? (
                <div className="mt-4 space-y-2">
                    {items.map((seller, i) => (
                        <SellerRow key={seller.offerId ?? i} seller={seller} onClick={() => handleSelect(seller)} />
                    ))}
                </div>
            ) : CARD_GRID_LEVELS.has(currentLevel) ? (
                <div className="mt-4 grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
                    {items.map((item, i) => (
                        <HierarchyCard key={item.id ?? i} item={item} level={currentLevel} onClick={() => handleSelect(item)} />
                    ))}
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    {items.map((item, i) => (
                        <HierarchyRow key={item.id ?? i} item={item} onClick={() => handleSelect(item)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function HierarchyCard({ item, level, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="relative w-full aspect-[3/4] overflow-hidden bg-slate-200">
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300"><PackageSearch className="h-6 w-6" /></div>
                )}
            </div>
            <div className="px-2 py-2">
                <p className="line-clamp-2 text-[12px] font-extrabold leading-tight text-slate-900">{item.name}</p>
                {level === "brand_item" && item.brand_name && (
                    <span className="mt-1 inline-block truncate rounded-full bg-[#F15A24]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#F15A24]">
                        {item.brand_name}
                    </span>
                )}
                {level === "brand_item" && item.sellerCount > 0 && (
                    <p className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                        <IndianRupee className="h-2.5 w-2.5" />{item.lowestPrice} · {item.sellerCount} seller{item.sellerCount === 1 ? "" : "s"}
                    </p>
                )}
            </div>
        </motion.button>
    );
}

function HierarchyRow({ item, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="w-full overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="relative w-full aspect-[2.67/1] overflow-hidden bg-slate-200">
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300"><PackageSearch className="h-8 w-8" /></div>
                )}
            </div>
            <div className="px-3.5 py-3">
                <p className="truncate text-[13.5px] font-extrabold text-slate-900">{item.name}</p>
            </div>
        </motion.button>
    );
}

function SuggestionRow({ suggestion, onClick }) {
    const parts = [];
    if (suggestion.level !== "category" && suggestion.categoryName) parts.push(suggestion.categoryName);
    if ((suggestion.level === "generic_product" || suggestion.level === "brand_item") && suggestion.subcategoryName) parts.push(suggestion.subcategoryName);
    if (suggestion.level === "brand_item" && suggestion.genericProductName) parts.push(suggestion.genericProductName);
    const location = parts.join(" › ");

    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                {suggestion.image ? <img src={suggestion.image} alt="" className="h-full w-full object-cover" /> : <PackageSearch className="h-5 w-5 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-slate-900">{suggestion.name}</p>
                {location && <p className="mt-0.5 truncate text-[11px] font-semibold text-[#047084]">Found in {location}</p>}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </motion.button>
    );
}

function SellerRow({ seller, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                {seller.logo_url ? <img src={seller.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Store className="h-5 w-5 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-extrabold text-slate-900">{seller.display_name}</p>
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] font-medium text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />{seller.city}, {seller.state}
                </p>
            </div>
            {seller.price != null && (
                <div className="shrink-0 text-right">
                    <p className="text-[13px] font-extrabold text-[#047084]">₹{seller.price}/{seller.unit}</p>
                    {seller.moq && <p className="text-[10px] font-medium text-slate-400">MOQ {seller.moq}</p>}
                </div>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </motion.button>
    );
}

function SkeletonCard() {
    return (
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <div className="aspect-[3/4] bg-slate-100" />
            <div className="px-2 py-2 space-y-1.5"><div className="h-3 w-4/5 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
        </motion.div>
    );
}
function SkeletonRow() {
    return (
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <div className="w-full aspect-[2.67/1] bg-slate-100" />
            <div className="px-3.5 py-3 space-y-2"><div className="h-3.5 w-2/3 rounded bg-slate-100" /><div className="h-3 w-1/3 rounded bg-slate-100" /></div>
        </motion.div>
    );
}

function EmptyState({ level, query }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center rounded-2xl px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(4,112,132,0.08)", color: "#047084" }}>
                <PackageSearch className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold text-slate-900">No {LEVEL_LABEL[level]?.toLowerCase()} found{query ? ` for "${query}"` : ""}</h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium text-slate-500">Try a different keyword, or use the back button to go up a level.</p>
        </motion.div>
    );
}