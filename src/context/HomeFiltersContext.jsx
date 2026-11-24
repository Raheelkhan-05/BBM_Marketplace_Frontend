// src/context/HomeFiltersContext.jsx
//
// State shared between the header (search, GST switch, category drawer), the home sidebar,
// the product feed and the Brands / Sellers pages. Lives in AppShell so it survives route changes.
//
// CATEGORY FILTER = one category, optionally narrowed to one of its subcategories.
//   setCategoryFilter(cat, sub?)  sets both at once (cat = null clears everything)
//   setActiveCategory(cat)        kept for old callers: selects a whole category (clears the subcategory)
//
// VIEW SCOPE = the seller / brand the Home page is currently showing. HomePage publishes it
// here so the header's mobile drawer can list only what that seller / brand sells.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export const NO_VIEW_SCOPE = Object.freeze({ shopSlug: null, brandName: null, clear: null });

const slimCategory = (c) => ({ id: c.id, name: c.name, slug: c.slug, image: c.image });
const slimSub = (s) => ({ id: s.id, name: s.name, slug: s.slug });

export function HomeFiltersProvider({ children }) {
    const [query, setQuery] = useState("");
    const [activeCategory, setCategoryState] = useState(null);
    const [activeSubcategory, setSubcategoryState] = useState(null);
    const [includeGst, setIncludeGst] = useState(true);
    const [shopName, setShopName] = useState(null);
    const [viewScope, setViewScopeState] = useState(NO_VIEW_SCOPE);
    // HomePage registers itself while mounted, so the header knows whether results are visible.
    const [feedCount, setFeedCount] = useState(0);

    const registerFeed = useCallback(() => {
        setFeedCount((c) => c + 1);
        return () => setFeedCount((c) => Math.max(0, c - 1));
    }, []);

    // Same id keeps the same object, so effects that depend on the object don't re-run needlessly.
    const setCategoryFilter = useCallback((cat, sub = null) => {
        if (!cat) {
            setCategoryState(null);
            setSubcategoryState(null);
            return;
        }
        setCategoryState((prev) => (prev && prev.id === cat.id ? prev : slimCategory(cat)));
        setSubcategoryState((prev) => {
            if (!sub) return null;
            return prev && prev.id === sub.id ? prev : slimSub(sub);
        });
    }, []);

    const setActiveCategory = useCallback((cat) => setCategoryFilter(cat, null), [setCategoryFilter]);

    const setViewScope = useCallback((scope) => setViewScopeState(scope || NO_VIEW_SCOPE), []);

    const value = useMemo(
        () => ({
            query, setQuery,
            activeCategory, activeSubcategory,
            setCategoryFilter, setActiveCategory,
            includeGst, setIncludeGst,
            shopName, setShopName,
            viewScope, setViewScope,
            feedActive: feedCount > 0,
            registerFeed,
        }),
        [query, activeCategory, activeSubcategory, setCategoryFilter, setActiveCategory,
            includeGst, shopName, viewScope, setViewScope, feedCount, registerFeed]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHomeFilters() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useHomeFilters must be used inside <HomeFiltersProvider>");
    return v;
}