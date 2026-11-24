// src/context/HomeFiltersContext.jsx
//
// State shared between the header (search, GST switch, category drawer), the home sidebar
// and the product feed. Lives in Layout so it survives route changes: type on any page and the
// text/category are still there when /home mounts.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export function HomeFiltersProvider({ children }) {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);
    const [includeGst, setIncludeGst] = useState(true);
    const [shopName, setShopName] = useState(null);
    // HomePage registers itself while mounted, so the header knows whether results are visible.
    const [feedCount, setFeedCount] = useState(0);

    const registerFeed = useCallback(() => {
        setFeedCount((c) => c + 1);
        return () => setFeedCount((c) => Math.max(0, c - 1));
    }, []);

    const value = useMemo(
        () => ({
            query, setQuery,
            activeCategory, setActiveCategory,
            includeGst, setIncludeGst,
            shopName, setShopName,
            feedActive: feedCount > 0,
            registerFeed,
        }),
        [query, activeCategory, includeGst, shopName, feedCount, registerFeed]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHomeFilters() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useHomeFilters must be used inside <HomeFiltersProvider>");
    return v;
}