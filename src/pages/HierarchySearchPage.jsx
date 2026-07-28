// pages/HierarchySearchPage.jsx
// Accessed from the Home Page search box. Unlike SearchResultsPage (flat
// keyword search over products+shops), this page drills down:
//   Category -> Subcategory -> Product -> Sellers
// Search only happens on an explicit action: pressing Enter, tapping the
// search button, or a resolved image search — never on every keystroke.
// If a scoped + smart search comes up empty, BBM's AI automatically
// classifies + creates the item (embedding-matched onto existing
// categories/subcategories first; only creates new ones when nothing fits).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, PackageSearch, Store, ShieldCheck, MapPin, Layers, Tag, Package, Sparkles, AlertTriangle, BadgeCheck } from "lucide-react";
import useHierarchySearch from "../hooks/useHierarchySearch";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";

const LEVEL_LABEL = {
    category: "Categories",
    subcategory: "Subcategories",
    product: "Products",
    brand: "Brand Items",
    seller: "Sellers",
};

const LEVEL_PLACEHOLDER = {
    category: "Search categories (e.g. Bearings, Lubricants)",
    subcategory: "Search subcategories",
    product: "Search products",
    brand: "Search brand items",
    seller: "Search sellers",
};

const CARD_GRID_LEVELS = new Set(["product", "brand"]);

const SUGGESTION_ICON = { category: Layers, subcategory: Tag, product: Package, brand: BadgeCheck };

export default function HierarchySearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const initialQuery = searchParams.get("q") || "";

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, []);

    const {
        stack,
        currentLevel,
        parent,
        query,
        setQuery,
        items,
        suggestions,
        loading,
        selectItem,
        selectSuggestion,
        jumpToStack,
        goBack,
        goToBreadcrumb,
        canGoBack,
        aiResolving,
        aiRejection,
        justAiCreated,
    } = useHierarchySearch(initialQuery);

    const [inputValue, setInputValue] = useState(initialQuery);
    const [imageError, setImageError] = useState(null);

    // Keep the visible input in sync when the hook's query resets (e.g.
    // after drilling in, or after an AI/image resolution lands somewhere).
    useEffect(() => setInputValue(query), [query]);

    // Consume an image search result handed off from the Home page via
    // navigation state (only once, on arrival).
    const consumedNavState = useRef(false);
    useEffect(() => {
        if (consumedNavState.current) return;
        const imageResult = location.state?.imageResult;
        if (imageResult) {
            consumedNavState.current = true;
            if (imageResult.resolved && imageResult.stack) {
                jumpToStack(imageResult.stack, {
                    markAiCreated: !!imageResult.aiGenerated,
                    pendingImages: imageResult.pendingImages || [], // <-- add this line
                });
            } else {
                setImageError(imageResult.reason || "We couldn't identify a product in that photo.");
            }
            navigate(location.pathname + location.search, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchSubmit = (term) => {
        setImageError(null);
        setQuery(term);
    };

    const handleImageResolved = (result) => {
        setImageError(null);
        if (result.resolved && result.stack) {
            jumpToStack(result.stack, {
                markAiCreated: !!result.aiGenerated,
                pendingImages: result.pendingImages || [], // <-- add this line
            });
        } else {
            setImageError(result.reason || "We couldn't identify a product in that photo.");
        }
    };

    const handleBack = () => {
        if (canGoBack) goBack();
        else navigate(-1);
    };

    const handleSelect = (item) => {
        if (currentLevel === "seller") {
            navigate(`/shop/${item.shop_slug}`);
            return;
        }
        selectItem(item);
    };

    const showingSuggestions = !loading && items.length === 0 && suggestions.length > 0;
    const showingNoSellersYet = currentLevel === "seller" && !loading && items.length === 0 && justAiCreated;

    return (
        <div className="mx-auto max-w-4xl min-h-screen px-4 pt-4 sm:px-6 lg:px-8 pb-10">
            {/* Search row */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleBack}
                    aria-label="Go back"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <MarketplaceSearchBar
                        value={inputValue}
                        onChange={setInputValue}
                        onSubmit={handleSearchSubmit}
                        onImageResolved={handleImageResolved}
                        placeholder={LEVEL_PLACEHOLDER[currentLevel]}
                    />
                </div>
            </div>
            {imageError && (
                <p className="mt-2 flex items-center gap-1.5 pl-[52px] text-[11.5px] font-medium text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{imageError}
                </p>
            )}

            {/* Breadcrumb hierarchy trail */}
            {stack.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1 text-[11.5px] font-semibold text-slate-500">
                    <button onClick={() => goToBreadcrumb(-1)} className="text-[#047084] hover:underline">
                        All Categories
                    </button>
                    {stack.map((crumb, i) => (
                        <span key={crumb.id} className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 text-slate-300" />
                            <button
                                onClick={() => goToBreadcrumb(i)}
                                className={i === stack.length - 1 ? "text-slate-900" : "text-[#047084] hover:underline"}
                            >
                                {crumb.name}
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Results header */}
            <div className="mt-5">
                <h2 className="text-[19px] font-extrabold tracking-tight text-slate-900" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    {aiResolving ? "Searching with BBM AI" : showingSuggestions ? "Did you mean" : LEVEL_LABEL[currentLevel]}
                    {!aiResolving && !showingSuggestions && parent ? ` in "${parent.name}"` : ""}
                </h2>
                {showingSuggestions && (
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                        No {LEVEL_LABEL[currentLevel]?.toLowerCase()} matched "{query}" here, but we found this elsewhere:
                    </p>
                )}
                {aiResolving && (
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                        Checking whether "{query}" is a legitimate item we can list...
                    </p>
                )}
                {showingNoSellersYet && (
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#047084]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Just added to BBM Marketplace — no sellers are listing this yet.
                    </p>
                )}
            </div>

            {/* Result list */}
            {loading || aiResolving ? (
                CARD_GRID_LEVELS.has(currentLevel) ? (
                    <div className="mt-4 grid grid-cols-3 gap-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} pulse={aiResolving} />)}
                    </div>
                ) : (
                    <div className="mt-4 space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} pulse={aiResolving} />)}
                    </div>
                )
            ) : items.length === 0 && suggestions.length === 0 ? (
                <div className="mt-4">
                    <EmptyState level={currentLevel} query={query} aiRejection={aiRejection} />
                </div>
            ) : showingSuggestions ? (
                <div className="mt-4 space-y-2">
                    {suggestions.map((s, i) => (
                        <SuggestionRow key={`${s.level}-${s.id ?? i}`} suggestion={s} onClick={() => selectSuggestion(s)} />
                    ))}
                </div>
            ) : currentLevel === "seller" ? (
                <div className="mt-4 space-y-2">
                    {items.map((seller, i) => (
                        <SellerRow key={seller.offerId ?? seller.id ?? i} seller={seller} onClick={() => handleSelect(seller)} />
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
                        <HierarchyRow key={item.id ?? i} item={item} level={currentLevel} onClick={() => handleSelect(item)} />
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="relative w-full aspect-[3/4] overflow-hidden bg-slate-200">
                {item.image ? (
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <PackageSearch className="h-6 w-6" />
                    </div>
                )}
                {item.is_ai_generated && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#047084]">
                        <Sparkles className="h-2 w-2" /> New
                    </span>
                )}
            </div>
            <div className="px-2 py-2">
                <p className="line-clamp-2 text-[11px] font-extrabold leading-tight text-slate-900">{item.name}</p>
                {level === "brand" && item.brand_name && (
                    <span className="mt-1 inline-block truncate rounded-full bg-[#F15A24]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#F15A24]">
                        {item.brand_name}
                    </span>
                )}
            </div>
        </motion.button>
    );
}

function SkeletonCard({ pulse }) {
    return (
        <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: pulse ? 0.9 : 1.4, repeat: Infinity }}
            className="aspect-[3/4] rounded-xl bg-slate-100"
        />
    );
}

function HierarchyRow({ item, level, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="w-full overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="relative w-full aspect-[2.67/1] overflow-hidden bg-slate-200">
                {item.image ? (
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <PackageSearch className="h-8 w-8" />
                    </div>
                )}
                {item.is_ai_generated && (
                    <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#047084]">
                        <Sparkles className="h-2.5 w-2.5" /> New
                    </span>
                )}
            </div>
            <div className="px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-extrabold text-slate-900">{item.name}</p>
                </div>
                {level === "brand" && item.brand_name && (
                    <span className="mt-1 inline-block rounded-full bg-[#F15A24]/10 px-2 py-0.5 text-[10px] font-bold text-[#F15A24]">
                        {item.brand_name}
                    </span>
                )}
                {item.description && (
                    <p className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{item.description}</p>
                )}
            </div>
        </motion.button>
    );
}

function AiBadge() {
    return (
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#047084]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047084]">
            <Sparkles className="h-2.5 w-2.5" /> New
        </span>
    );
}

function SuggestionRow({ suggestion, onClick }) {
    const Icon = SUGGESTION_ICON[suggestion.level] || PackageSearch;
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#7fb3bd] bg-[#047084]/5 px-3.5 py-3 text-left transition hover:bg-[#047084]/10"
        >
            {suggestion.image ? (
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#7fb3bd] bg-white">
                    <img src={suggestion.image} alt="" className="h-full w-full object-cover" />
                </div>
            ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#7fb3bd] bg-white text-[#047084]">
                    <Icon className="h-5 w-5" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-extrabold text-slate-900">{suggestion.name}</p>
                    <span className="shrink-0 rounded-full bg-[#047084]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047084]">
                        {suggestion.level}
                    </span>
                </div>
                {suggestion.subtitle && (
                    <p className="mt-0.5 truncate text-[11.5px] font-medium text-slate-500">{suggestion.subtitle}</p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#047084]" />
        </motion.button>
    );
}

function SellerRow({ seller, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                {seller.logo_url ? (
                    <img src={seller.logo_url} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                    <Store className="h-5 w-5 text-slate-300" />
                )}
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

function SkeletonRow({ pulse }) {
    return (
        <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: pulse ? 0.9 : 1.4, repeat: Infinity }}
            className="h-[68px] rounded-xl bg-slate-100"
        />
    );
}

function EmptyState({ level, query, aiRejection }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center rounded-2xl px-6 py-14 text-center"
        >
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(4,112,132,0.08)", color: "#047084" }}>
                <PackageSearch className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold text-slate-900">
                No {LEVEL_LABEL[level]?.toLowerCase()} found{query ? ` for "${query}"` : ""}
            </h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium text-slate-500">
                Try a different keyword, or use the back button to go up a level.
            </p>

            {aiRejection && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 flex max-w-sm items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-[12px] font-medium text-amber-800">{aiRejection}</p>
                </motion.div>
            )}
        </motion.div>
    );
}