// utils/searchResolve.js
//
// Shared "resolve a typed search term to the most specific existing page"
// logic, used by both BottomSearchBar (mobile) and HierarchySearchPage's
// own search box (desktop/drill-down view). Single source of truth so a
// fix in one place doesn't quietly miss the other entry point.
//
// Resolution order: try a scoped top-level (category) match first — if
// the term IS a category name, staying on /browse to drill down is
// actually the right UX (a category has no useful "detail page" beyond
// what CategoryLandingPage already shows via Explore). Otherwise, run
// smart search; if it resolves to an EXACT match at brand/product/
// subcategory level, that specific level gets its own dedicated route —
// jump straight there. Only genuinely ambiguous or no-match terms fall
// through to /browse, where the "Searching with BBM AI" / suggestions
// flow is the right UI.

import { searchHierarchyLevel, searchSmart } from "./api";

// Maps a resolved stack's deepest level to its dedicated detail route.
// Category is intentionally excluded — /category/:slug is a landing/
// marketing page, not a drill-in target, and a raw category-name search
// is better served by staying in the browse/drill-down flow.
function routeForStackTail(stack) {
    const last = stack?.[stack.length - 1];
    if (!last) return null;
    if (last.level === "brand") return `/brand/${last.slug || last.id}`;
    if (last.level === "product") return `/product/${last.id}`;
    if (last.level === "subcategory") return `/subcategory/${last.slug || last.id}`;
    return null;
}

// Returns a route string to navigate to, or null if the caller should
// fall back to /browse?q=... themselves (no exact match, or the match
// was a category — both are legitimately "stay in browse" cases).
export async function resolveSearchRoute(trimmedQuery) {
    if (!trimmedQuery) return null;

    try {
        // If the term matches an existing CATEGORY name directly, prefer
        // staying in the drill-down browse flow — that's still the
        // fastest way to explore a whole category's tree, and
        // CategoryLandingPage is reachable from there via "Explore".
        const scoped = await searchHierarchyLevel("category", undefined, trimmedQuery, 5);
        if (scoped?.success && scoped.items?.length > 0) {
            return null;
        }

        if (trimmedQuery.length >= 2) {
            const smart = await searchSmart(trimmedQuery, 5);
            const exactStack = smart?.success ? smart.exact?.stack : null;
            const route = routeForStackTail(exactStack);
            if (route) return route;
        }
    } catch {
        // any lookup failure -> fall through to /browse, same as before
    }
    return null;
}