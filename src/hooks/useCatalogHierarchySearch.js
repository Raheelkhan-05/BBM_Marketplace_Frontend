import { useState, useEffect, useCallback } from "react";
import { searchCatalogHierarchyLevel, searchCatalogSmart } from "../utils/api.js";

const LEVEL_ORDER = ["category", "subcategory", "generic_product", "brand_item", "seller"];

export default function useCatalogHierarchySearch(initialQuery = "") {
    const [stack, setStack] = useState([]);
    const [query, setQuery] = useState(initialQuery);
    const [items, setItems] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const depth = stack.length;
    const currentLevel = LEVEL_ORDER[depth];
    const parent = stack[depth - 1] || null;

    const applyStack = useCallback((newStack) => {
        setStack((newStack || []).map((c) => ({
            level: c.level,
            id: c.id,
            name: c.name,
            image: c.image ?? null,
            brand_name: c.brand_name ?? c.brandName ?? null,
        })));
        setQuery("");
    }, []);

    const load = useCallback(async () => {
        if (!currentLevel) return;
        setLoading(true);
        setError(null);
        setSuggestions([]);

        try {
            const scoped = await searchCatalogHierarchyLevel(currentLevel, parent?.id, query);
            if (!scoped?.success) throw new Error("Request failed");
            const scopedItems = scoped.items || [];

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
        } catch (err) {
            setError(err?.message || "Something went wrong loading this page.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentLevel, parent?.id, query, applyStack]);

    useEffect(() => { load(); }, [load]);

    function selectItem(item) {
        setStack((s) => [
            ...s,
            {
                level: currentLevel,
                id: item.id,
                name: item.name,
                image: item.image ?? null,
                brand_name: item.brand_name ?? null,
            },
        ]);
        setQuery("");
    }
    function selectSuggestion(s) {
        const chain = [];
        console.log("suggestion", s);

        if (s.categoryId) chain.push({ level: "category", id: s.categoryId, name: s.categoryName });
        if (s.subcategoryId) chain.push({ level: "subcategory", id: s.subcategoryId, name: s.subcategoryName });
        if (s.genericProductId) chain.push({ level: "generic_product", id: s.genericProductId, name: s.genericProductName });
        chain.push({
            level: s.level,
            id: s.id,
            name: s.name,
            image: s.image ?? null,
            brand_name: s.brandName ?? null, // note: suggestion objects use camelCase brandName
        });
        applyStack(chain);
    }
    function goBack() { setStack((s) => s.slice(0, -1)); setQuery(""); }
    function goToBreadcrumb(i) { setStack((s) => (i < 0 ? [] : s.slice(0, i + 1))); setQuery(""); }

    return {
        stack, currentLevel, parent, query, setQuery,
        items, suggestions, loading, error, retry: load,
        selectItem, selectSuggestion, jumpToStack: applyStack, goBack, goToBreadcrumb,
        canGoBack: stack.length > 0,
    };
}