import { useState, useEffect, useCallback, useRef } from "react";
import { searchHierarchyLevel, searchSmart, resolveWithAI, fetchImageStatuses } from "../utils/api";

const LEVELS = ["category", "subcategory", "product", "seller"];
const SMART_MIN_CHARS = 2;
const AI_MIN_CHARS = 3;

export default function useHierarchySearch(initialQuery = "") {
    const [stack, setStack] = useState([]);
    const [query, setQuery] = useState(initialQuery);
    const [items, setItems] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [aiResolving, setAiResolving] = useState(false);
    const [aiRejection, setAiRejection] = useState(null);
    const [justAiCreated, setJustAiCreated] = useState(false);

    // NEW: images still being generated in the background for the
    // current stack — [{ level, id }]. Populated by trackPendingImages
    // whenever a resolver response (AI text-resolve or image-search)
    // includes a `pendingImages` array; drained as they finish.
    const [pendingImages, setPendingImages] = useState([]);

    const requestIdRef = useRef(0);
    const aiInFlightRef = useRef(false);

    const currentLevel = LEVELS[stack.length];
    const parent = stack[stack.length - 1];

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
        return [
            item.categoryId && { level: "category", id: item.categoryId, name: item.categoryName },
            item.subcategoryId && { level: "subcategory", id: item.subcategoryId, name: item.subcategoryName },
            { level: "product", id: item.id, name: item.name },
        ].filter(Boolean);
    };

    // NEW: single place that starts/replaces image polling. Call this
    // any time a result carries a `pendingImages` array (or doesn't —
    // pass [] to clear it).
    const trackPendingImages = useCallback((list) => {
        setPendingImages(Array.isArray(list) && list.length ? list : []);
    }, []);

    // NEW: polls the backend for images still generating, and patches
    // `stack` in place as each one finishes — this is what makes the
    // image "pop in" without a full reload.
    useEffect(() => {
        if (!pendingImages.length) return;

        let cancelled = false;
        let tries = 0;

        const iv = setInterval(async () => {
            tries += 1;
            try {
                const { images = [] } = await fetchImageStatuses(pendingImages);
                if (cancelled) return;

                const resolved = images.filter((i) => i.image);
                if (resolved.length) {
                    setStack((prev) =>
                        prev.map((crumb) => {
                            const match = resolved.find(
                                (i) => i.level === crumb.level && String(i.id) === String(crumb.id)
                            );
                            return match ? { ...crumb, image: match.image } : crumb;
                        })
                    );
                    setPendingImages((prev) =>
                        prev.filter((p) => !resolved.some((r) => r.level === p.level && String(r.id) === String(p.id)))
                    );
                }

                const stillMissing = images.filter((i) => !i.image);
                if (stillMissing.length === 0 || tries >= 6) clearInterval(iv);
            } catch {
                if (tries >= 6) clearInterval(iv);
            }
        }, 2000);

        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, [pendingImages]);

    const performAIResolve = useCallback(async (term, level, parentId, myRequestId) => {
        if (aiInFlightRef.current) return;
        aiInFlightRef.current = true;
        setAiResolving(true);
        setAiRejection(null);
        try {
            const result = await resolveWithAI({ query: term, level, parentId });
            if (myRequestId !== requestIdRef.current) return;
            if (result?.success && result.resolved) {
                setStack(result.stack);
                setQuery("");
                setJustAiCreated(true);
                trackPendingImages(result.pendingImages); // <-- the fix, added here
            } else {
                setAiRejection(result?.reason || "We couldn't add this item right now. Please try a different search.");
            }
        } catch {
            if (myRequestId === requestIdRef.current) {
                setAiRejection("Something went wrong while searching. Please try again.");
            }
        } finally {
            aiInFlightRef.current = false;
            setAiResolving(false);
        }
    }, [trackPendingImages]); // <-- added to deps array

    const runSearch = useCallback(async (level, parentId, q) => {
        if (!level) { setLoading(false); return; }
        const myRequestId = ++requestIdRef.current;

        const scopedRes = await searchHierarchyLevel(level, parentId, q);
        if (myRequestId !== requestIdRef.current) return;
        const scopedItems = scopedRes?.success ? scopedRes.items : [];

        if (scopedItems.length > 0 || q.trim().length < SMART_MIN_CHARS) {
            setItems(scopedItems);
            setSuggestions([]);
            setLoading(false);
            return;
        }

        const smartRes = await searchSmart(q);
        if (myRequestId !== requestIdRef.current) return;

        if (smartRes?.success && smartRes.exact) {
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
            if (combined.length > 0) {
                setItems([]);
                setSuggestions(combined);
                setLoading(false);
                return;
            }
        }

        setItems([]);
        setSuggestions([]);
        setLoading(false);

        if (q.trim().length >= AI_MIN_CHARS) {
            performAIResolve(q.trim(), level, parentId, myRequestId);
        }
    }, [performAIResolve]);

    useEffect(() => {
        setLoading(true);
        setAiRejection(null);
        setJustAiCreated(false);
        runSearch(currentLevel, parent?.id, query);
    }, [currentLevel, parent?.id, query, runSearch]);

    const selectItem = useCallback((item) => {
        if (currentLevel === "seller") return;
        setStack((prev) => [...prev, { level: currentLevel, id: item.id, name: item.name }]);
        setQuery("");
    }, [currentLevel]);

    const selectSuggestion = useCallback((suggestion) => {
        setStack(suggestion.jumpStack);
        setQuery("");
    }, []);

    // Used when a result already arrives as a full stack — e.g. an image
    // search result. Now also accepts `pendingImages` so callers (the
    // page component) can pass along whichever new rows still need a
    // generated photo.
    const jumpToStack = useCallback((newStack, { markAiCreated = false, pendingImages: incoming = [] } = {}) => {
        setStack(newStack);
        setQuery("");
        setJustAiCreated(markAiCreated);
        trackPendingImages(incoming); // <-- the fix, added here
    }, [trackPendingImages]); // <-- added to deps array

    const goBack = useCallback(() => {
        setStack((prev) => prev.slice(0, -1));
        setQuery("");
    }, []);

    const goToBreadcrumb = useCallback((index) => {
        setStack((prev) => prev.slice(0, index + 1));
        setQuery("");
    }, []);

    const reset = useCallback(() => {
        setStack([]);
        setQuery("");
    }, []);

    return {
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
        reset,
        canGoBack: stack.length > 0,
        aiResolving,
        aiRejection,
        justAiCreated,
        pendingImages, // exposed in case the page wants to show a subtle "photo loading" hint
    };
}