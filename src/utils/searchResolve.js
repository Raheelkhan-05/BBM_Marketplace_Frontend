// utils/searchResolve.js
import { searchHierarchyLevel, searchSmart } from "./api";

function routeForStackTail(stack) {
    const last = stack?.[stack.length - 1];
    if (!last) return null;
    if (last.level === "brand") return `/brand/${last.slug || last.id}`;
    if (last.level === "product") return `/product/${last.id}`;
    if (last.level === "subcategory") return `/subcategory/${last.slug || last.id}`;
    return null;
}

// NEW: does the term match a known brand FAMILY name (e.g. "Castrol"),
// as opposed to one specific brand-item SKU? smartSearch's `suggestions.brands`
// already carries `brandName` on every row, so we reuse that instead of
// firing a second network call — if any suggestion's brandName matches the
// typed term, it's a real brand family worth its own page.
function findBrandFamilyMatch(smart, term) {
    const brands = smart?.suggestions?.brands || [];
    const lower = term.trim().toLowerCase();
    const hit = brands.find((b) => (b.brandName || "").trim().toLowerCase() === lower);
    return hit ? hit.brandName : null;
}

export async function resolveSearchRoute(trimmedQuery) {
    if (!trimmedQuery) return null;

    try {
        const scoped = await searchHierarchyLevel("category", undefined, trimmedQuery, 5);
        if (scoped?.success && scoped.items?.length > 0) {
            return null;
        }

        if (trimmedQuery.length >= 2) {
            const smart = await searchSmart(trimmedQuery, 5);

            // Brand-family match takes priority over a single exact
            // brand-item match — searching "Castrol" should land on the
            // family page (all products carrying that brand), not one
            // arbitrarily-chosen SKU that happens to be named "Castrol".
            const familyBrandName = findBrandFamilyMatch(smart, trimmedQuery);
            if (familyBrandName) {
                return `/brand-family/${encodeURIComponent(familyBrandName)}`;
            }

            const exactStack = smart?.success ? smart.exact?.stack : null;
            const route = routeForStackTail(exactStack);
            if (route) return route;
        }
    } catch {
        // any lookup failure -> fall through to /browse, same as before
    }
    return null;
}