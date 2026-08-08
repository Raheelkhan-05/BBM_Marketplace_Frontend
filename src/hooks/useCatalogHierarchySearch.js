import { useState, useEffect, useCallback } from "react";
import { searchCatalogHierarchyLevel, searchCatalogSmart } from "../utils/api.js";

const LEVEL_ORDER = ["category", "subcategory", "generic_product", "brand_item", "seller"];

// Same interface shape as the original useHierarchySearch (stack,
// currentLevel, items, suggestions, selectItem, goBack, etc.) so it drops
// into a page built the same way — but every level here is filtered to
// admin-approved rows only. No AI resolve step, no auto-creation, no
// image search: this hook only ever surfaces what an admin has already
// approved.
export default function useCatalogHierarchySearch(initialQuery = "") {
    const [stack, setStack] = useState([]); // [{level, id, name}]
    const [query, setQuery] = useState(initialQuery);
    const [items, setItems] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);

    const depth = stack.length;
    const currentLevel = LEVEL_ORDER[depth];
    const parent = stack[depth - 1] || null;

    const applyStack = useCallback((newStack) => {
        setStack((newStack || []).map((c) => ({ level: c.level, id: c.id, name: c.name })));
        setQuery("");
    }, []);

    const load = useCallback(async () => {
        if (!currentLevel) return;
        setLoading(true);
        setSuggestions([]);

        const scoped = await searchCatalogHierarchyLevel(currentLevel, parent?.id, query);
        const scopedItems = scoped?.success ? scoped.items : [];

        if (scopedItems.length === 0 && query.trim().length >= 2) {
            const smart = await searchCatalogSmart(query.trim());
            if (smart?.success) {
                if (smart.exact) {
                    applyStack(smart.exact.stack);
                    setLoading(false);
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

        setItems(scopedItems);
        setLoading(false);
    }, [currentLevel, parent?.id, query, applyStack]);

    useEffect(() => { load(); }, [load]);

    function selectItem(item) {
        setStack((s) => [...s, { level: currentLevel, id: item.id, name: item.name }]);
        setQuery("");
    }

    function selectSuggestion(s) {
        const chain = [];
        if (s.categoryId) chain.push({ level: "category", id: s.categoryId, name: s.categoryName });
        if (s.subcategoryId) chain.push({ level: "subcategory", id: s.subcategoryId, name: s.subcategoryName });
        if (s.genericProductId) chain.push({ level: "generic_product", id: s.genericProductId, name: s.genericProductName });
        chain.push({ level: s.level, id: s.id, name: s.name });
        applyStack(chain);
    }

    function goBack() {
        setStack((s) => s.slice(0, -1));
        setQuery("");
    }

    function goToBreadcrumb(i) {
        setStack((s) => (i < 0 ? [] : s.slice(0, i + 1)));
        setQuery("");
    }

    return {
        stack, currentLevel, parent, query, setQuery,
        items, suggestions, loading,
        selectItem, selectSuggestion, jumpToStack: applyStack, goBack, goToBreadcrumb,
        canGoBack: stack.length > 0,
    };
}