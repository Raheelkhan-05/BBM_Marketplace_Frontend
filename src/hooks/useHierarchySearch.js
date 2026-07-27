// hooks/useHierarchySearch.js
import { useState, useEffect, useCallback, useRef } from "react";
import { searchHierarchyLevel, searchSmart } from "../utils/api";

const LEVELS = ["category", "subcategory", "product", "seller"];
const DEBOUNCE_MS = 200;
const SMART_MIN_CHARS = 2;

// `stack` holds the breadcrumb trail the user has drilled into, e.g.:
// [{ level: "category", id, name }, { level: "subcategory", id, name }]
// The *current* level being searched/listed is LEVELS[stack.length].
export default function useHierarchySearch(initialQuery = "") {
    const [stack, setStack] = useState([]);
    const [query, setQuery] = useState(initialQuery);
    const [items, setItems] = useState([]);
    // Cross-level "did you mean" suggestions — only populated when the
    // scoped search at the current level comes up empty. Each entry carries
    // { level, id, name, subtitle, jumpStack } so the UI can render + tap it.
    const [suggestions, setSuggestions] = useState([]);
    // Starts true so the very first paint shows a skeleton, never EmptyState.
    const [loading, setLoading] = useState(true);
    const debounceRef = useRef(null);
    // Bumped on every new request so stale/out-of-order responses are ignored —
    // prevents a slow earlier request from overwriting a faster later one.
    const requestIdRef = useRef(0);

    const currentLevel = LEVELS[stack.length]; // undefined once past "seller"
    const parent = stack[stack.length - 1]; // { level, id, name } or undefined

    // Turns a smart-search suggestion (category/subcategory/product shape)
    // into the ancestor stack needed to jump straight to it.
    const buildJumpStack = (level, item) => {
        if (level === "category") {
            return [{ level: "category", id: item.id, name: item.name }];
        }
        if (level === "subcategory") {
            return [
                item.categoryId && { level: "category", id: item.categoryId, name: item.categoryName },
                { level: "subcategory", id: item.id, name: item.name },
            ].filter(Boolean);
        }
        // product
        return [
            item.categoryId && { level: "category", id: item.categoryId, name: item.categoryName },
            item.subcategoryId && { level: "subcategory", id: item.subcategoryId, name: item.subcategoryName },
            { level: "product", id: item.id, name: item.name },
        ].filter(Boolean);
    };

    const runSearch = useCallback(async (level, parentId, q) => {
        if (!level) { setLoading(false); return; }
        const myRequestId = ++requestIdRef.current;

        const scopedRes = await searchHierarchyLevel(level, parentId, q);
        if (myRequestId !== requestIdRef.current) return; // superseded
        const scopedItems = scopedRes?.success ? scopedRes.items : [];

        // Scoped results found -> use them, no need for cross-level fallback.
        if (scopedItems.length > 0 || q.trim().length < SMART_MIN_CHARS) {
            setItems(scopedItems);
            setSuggestions([]);
            setLoading(false);
            return;
        }

        // Scoped search came up empty — try a smart cross-level search so a
        // query like a product name typed while browsing a different category
        // still resolves, either by jumping straight there (exact match) or by
        // surfacing tappable suggestions instead of a dead-end EmptyState.
        const smartRes = await searchSmart(q);
        if (myRequestId !== requestIdRef.current) return; // superseded

        if (smartRes?.success && smartRes.exact) {
            // Confident match — jump straight past intermediate levels, landing
            // one level below the match (its children get fetched by the effect
            // below once `stack`/`query` change).
            setStack(smartRes.exact.stack);
            setQuery("");
            return;
        }

        if (smartRes?.success) {
            const { categories = [], subcategories = [], products = [] } = smartRes.suggestions || {};
            const combined = [
                ...categories.map((c) => ({ ...c, level: "category", jumpStack: buildJumpStack("category", c) })),
                ...subcategories.map((s) => ({ ...s, level: "subcategory", jumpStack: buildJumpStack("subcategory", s) })),
                ...products.map((p) => ({ ...p, level: "product", jumpStack: buildJumpStack("product", p) })),
            ];
            setItems([]);
            setSuggestions(combined);
            setLoading(false);
            return;
        }

        setItems([]);
        setSuggestions([]);
        setLoading(false);
    }, []);

    // Re-run search whenever the level, parent, or query changes.
    // `loading` flips to true synchronously (same render) so the UI never
    // has a frame where loading=false and items=[] — that frame is what
    // was rendering EmptyState before results arrived.
    useEffect(() => {
        setLoading(true);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            runSearch(currentLevel, parent?.id, query);
        }, DEBOUNCE_MS);
        return () => clearTimeout(debounceRef.current);
    }, [currentLevel, parent?.id, query, runSearch]);

    // User taps an item in the list -> drill one level deeper.
    // Selecting a "seller" is a terminal action (open the shop), not a drill.
    const selectItem = useCallback((item) => {
        if (currentLevel === "seller") return; // caller should navigate to the shop
        setStack((prev) => [...prev, { level: currentLevel, id: item.id, name: item.name }]);
        setQuery(""); // reset the search box for the new level
    }, [currentLevel]);

    // User taps a cross-level suggestion -> jump straight to its ancestor
    // chain, landing one level below it (same behavior as an exact match).
    const selectSuggestion = useCallback((suggestion) => {
        setStack(suggestion.jumpStack);
        setQuery("");
    }, []);

    // Back button: pop one level off the stack.
    const goBack = useCallback(() => {
        setStack((prev) => prev.slice(0, -1));
        setQuery("");
    }, []);

    // Jump directly to a breadcrumb (e.g. clicking "Bearings" in the trail).
    const goToBreadcrumb = useCallback((index) => {
        setStack((prev) => prev.slice(0, index + 1));
        setQuery("");
    }, []);

    const reset = useCallback(() => {
        setStack([]);
        setQuery("");
    }, []);

    return {
        stack,           // breadcrumb trail
        currentLevel,    // "category" | "subcategory" | "product" | "seller"
        parent,          // the breadcrumb item we're currently listing children of
        query,
        setQuery,
        items,
        suggestions,     // cross-level "did you mean" results, only when items is empty
        loading,
        selectItem,
        selectSuggestion,
        goBack,
        goToBreadcrumb,
        reset,
        canGoBack: stack.length > 0,
    };
}