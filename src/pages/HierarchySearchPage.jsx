// pages/HierarchySearchPage.jsx
// Accessed from the Home Page search box. Unlike SearchResultsPage (flat
// keyword search over products+shops), this page drills down:
//   Category -> Subcategory -> Product -> Sellers
// The search box searches "within" the current level. If that comes up
// empty, a cross-level smart search kicks in automatically: an exact name
// match jumps straight to the right depth (e.g. typing a product name
// jumps directly to its sellers, skipping the intermediate lists), and a
// partial match surfaces as tappable "Did you mean" suggestions instead of
// a dead end.

import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search, X, ChevronRight, PackageSearch, Store, ShieldCheck, MapPin, Layers, Tag, Package } from "lucide-react";
import useHierarchySearch from "../hooks/useHierarchySearch";

const LEVEL_LABEL = {
    category: "Categories",
    subcategory: "Subcategories",
    product: "Products",
    seller: "Sellers",
};

const LEVEL_PLACEHOLDER = {
    category: "Search categories (e.g. Bearings, Lubricants)",
    subcategory: "Search subcategories",
    product: "Search products",
    seller: "Search sellers",
};

const SUGGESTION_ICON = { category: Layers, subcategory: Tag, product: Package };

export default function HierarchySearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialQuery = searchParams.get("q") || "";

    useLayoutEffect(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "instant", // or simply omit the behavior option
        });
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
        goBack,
        goToBreadcrumb,
        canGoBack,
    } = useHierarchySearch(initialQuery);

    const [inputValue, setInputValue] = useState(initialQuery);

    // Keep the visible input in sync when the level changes (query resets)
    useEffect(() => setInputValue(query), [query]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setQuery(inputValue.trim());
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
                <form
                    onSubmit={handleSubmit}
                    className="flex flex-1 items-center overflow-hidden rounded-xl border-2 border-slate-100 bg-white shadow-[0_8px_20px_-12px_rgba(4,112,132,0.28)] focus-within:border-[#7fb3bd]"
                >
                    <Search className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        value={inputValue}
                        onChange={(e) => { setInputValue(e.target.value); setQuery(e.target.value); }}
                        placeholder={LEVEL_PLACEHOLDER[currentLevel]}
                        className="w-full bg-transparent px-3 py-3 text-[13.5px] font-medium text-slate-700 focus:outline-none"
                    />
                    {inputValue && (
                        <button type="button" onClick={() => { setInputValue(""); setQuery(""); }} className="mr-3 text-slate-400 hover:text-slate-600">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </form>
            </div>

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
                    {showingSuggestions ? "Did you mean" : LEVEL_LABEL[currentLevel]}
                    {!showingSuggestions && parent ? ` in "${parent.name}"` : ""}
                </h2>
                {showingSuggestions && (
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                        No {LEVEL_LABEL[currentLevel]?.toLowerCase()} matched "{query}" here, but we found this elsewhere:
                    </p>
                )}
            </div>

            {/* Result list */}
            <div className="mt-4 space-y-2">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : items.length === 0 && suggestions.length === 0 ? (
                    <EmptyState level={currentLevel} query={query} />
                ) : showingSuggestions ? (
                    suggestions.map((s, i) => (
                        <SuggestionRow key={`${s.level}-${s.id ?? i}`} suggestion={s} onClick={() => selectSuggestion(s)} />
                    ))
                ) : currentLevel === "seller" ? (
                    items.map((seller, i) => (
                        <SellerRow key={seller.offerId ?? seller.id ?? i} seller={seller} onClick={() => handleSelect(seller)} />
                    ))
                ) : (
                    items.map((item, i) => (
                        <HierarchyRow key={item.id ?? i} item={item} onClick={() => handleSelect(item)} />
                    ))
                )}
            </div>
        </div>
    );
}

function HierarchyRow({ item, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left shadow-[0_8px_20px_-16px_rgba(4,112,132,0.3)] transition hover:border-[#7fb3bd]"
        >
            {item.image ? (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                </div>
            ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300">
                    <PackageSearch className="h-5 w-5" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-slate-900">{item.name}</p>
                {item.description && (
                    <p className="mt-0.5 truncate text-[11.5px] font-medium text-slate-500">{item.description}</p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </motion.button>
    );
}

// A cross-level "did you mean" result — carries its own type badge +
// breadcrumb subtitle since it can come from any level. Shows the item's
// real image when available, falling back to a type icon otherwise.
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

function SkeletonRow() {
    return (
        <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="h-[68px] rounded-xl bg-slate-100"
        />
    );
}

function EmptyState({ level, query }) {
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
        </motion.div>
    );
}