import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalogHierarchyLevel, searchCatalogSmart } from "../utils/api.js";

const LEVEL_ORDER = ["category", "subcategory", "generic_product", "brand_item", "seller"];
const PAGE_SIZE = 20;

export default function useCatalogHierarchySearch(initialQuery = "") {
    const [stack, setStack] = useState([]);
    const [query, setQuery] = useState(initialQuery);
    const [items, setItems] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);

    const depth = stack.length;
    const currentLevel = LEVEL_ORDER[depth];
    const parent = stack[depth - 1] || null;

    // Pagination bookkeeping. runId identifies a "generation" of results
    // (bumped whenever level/parent/query changes or retry() is called);
    // any in-flight request whose runId no longer matches the current
    // one just discards its result instead of applying it. We deliberately
    // do NOT gate new requests behind a single "is anything in flight"
    // flag — that caused a hang under React 18 StrictMode's dev-only
    // double effect invocation (the first invocation's flag blocked the
    // second, "current" invocation from ever firing its own request).
    const runIdRef = useRef(0);
    const offsetRef = useRef(0);
    const hasMoreRef = useRef(false);
    const loadingRef = useRef(true);
    const loadingMoreRef = useRef(false);
    hasMoreRef.current = hasMore;
    loadingRef.current = loading;
    loadingMoreRef.current = loadingMore;

    const applyStack = useCallback((newStack) => {
        setStack((newStack || []).map((c) => ({
            level: c.level,
            id: c.id,
            name: c.name,
            image: c.image ?? null,
            images: c.images ?? null,
            brand_name: c.brand_name ?? c.brandName ?? null,
        })));
        setQuery("");
    }, []);

    const fetchScopedPage = useCallback((level, parentId, q, offset) => {
        return searchCatalogHierarchyLevel(level, parentId, q, PAGE_SIZE, offset);
    }, []);

    // isLoadMore=false → fresh load (level/parent/query changed, or retry).
    // isLoadMore=true → append the next page to the existing items.
    const load = useCallback(async (isLoadMore = false) => {
        if (!currentLevel) return;

        const runId = runIdRef.current;
        if (isLoadMore) {
            setLoadingMore(true);
            loadingMoreRef.current = true;
        } else {
            setLoading(true);
            loadingRef.current = true;
            setSuggestions([]);
            offsetRef.current = 0;
        }
        setError(null);

        try {
            const scoped = await fetchScopedPage(currentLevel, parent?.id, query, offsetRef.current);
            if (runId !== runIdRef.current) return; // a newer generation started — drop this result
            if (!scoped?.success) throw new Error("Request failed");
            const scopedItems = scoped.items || [];

            // Exact-match / suggestion fallback only applies to a fresh,
            // empty first page — never to a "load more" page.
            if (!isLoadMore && scopedItems.length === 0 && query.trim().length >= 2) {
                const smart = await searchCatalogSmart(query.trim());
                if (runId !== runIdRef.current) return;
                if (smart?.success) {
                    if (smart.exact) {
                        applyStack(smart.exact.stack);
                        return;
                    }
                    setSuggestions([
                        ...smart.suggestions.categories,
                        ...smart.suggestions.subcategories,
                        ...smart.suggestions.genericProducts,
                        ...smart.suggestions.brandItems,
                    ]);
                }
            }

            setItems((prev) => {
                if (!isLoadMore) return scopedItems;
                const seen = new Set(prev.map((p) => p.id));
                return [...prev, ...scopedItems.filter((i) => !seen.has(i.id))];
            });

            const nextHasMore = Boolean(scoped.hasMore);
            setHasMore(nextHasMore);
            hasMoreRef.current = nextHasMore;
            offsetRef.current = scoped.nextOffset ?? offsetRef.current + scopedItems.length;

            // Safety valve against an accidental infinite loop if the
            // backend ever says hasMore:true with an empty page.
            if (nextHasMore && scopedItems.length === 0) {
                setHasMore(false);
                hasMoreRef.current = false;
            }
        } catch (err) {
            if (runId !== runIdRef.current) return;
            setError(err?.message || "Something went wrong loading this page.");
            if (!isLoadMore) setItems([]);
        } finally {
            if (runId === runIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
                loadingRef.current = false;
                loadingMoreRef.current = false;
            }
        }
    }, [currentLevel, parent?.id, query, applyStack, fetchScopedPage]);

    // Fresh load whenever level, parent, or query changes.
    useEffect(() => {
        runIdRef.current += 1;
        load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLevel, parent?.id, query]);

    const loadMore = useCallback(() => {
        if (!hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return;
        load(true);
    }, [load]);

    const retry = useCallback(() => {
        runIdRef.current += 1;
        load(false);
    }, [load]);

    function selectItem(item) {
        setStack((s) => [
            ...s,
            {
                level: currentLevel,
                id: item.id,
                name: item.name,
                image: item.image ?? null,
                images: item.images ?? null,
                brand_name: item.brand_name ?? null,
            },
        ]);
        setQuery("");
    }
    function selectSuggestion(s) {
        const chain = [];
        if (s.categoryId) chain.push({ level: "category", id: s.categoryId, name: s.categoryName });
        if (s.subcategoryId) chain.push({ level: "subcategory", id: s.subcategoryId, name: s.subcategoryName });
        if (s.genericProductId) chain.push({ level: "generic_product", id: s.genericProductId, name: s.genericProductName });
        chain.push({
            level: s.level,
            id: s.id,
            name: s.name,
            image: s.image ?? null,
            images: s.images ?? null,
            brand_name: s.brandName ?? null, // note: suggestion objects use camelCase brandName
        });
        applyStack(chain);
    }
    function goBack() { setStack((s) => s.slice(0, -1)); setQuery(""); }
    function goToBreadcrumb(i) { setStack((s) => (i < 0 ? [] : s.slice(0, i + 1))); setQuery(""); }

    return {
        stack, currentLevel, parent, query, setQuery,
        items, suggestions, loading, loadingMore, hasMore, error, retry,
        loadMore,
        selectItem, selectSuggestion, jumpToStack: applyStack, goBack, goToBreadcrumb,
        canGoBack: stack.length > 0,
    };
}