// src/pages/HomePage.jsx
//
// Search, GST, Deliver-to, cart AND the mobile category rail live in the header. Categories live here only on lg+:
//   lg+      sticky sidebar (CategorySidebar)
//   < lg     the header's category rail + sheet (see Header.jsx -> ActiveFilterBar)
// This page lays out [sidebar | feed], registers itself so the header knows results are on screen,
// and publishes the seller / brand scope (setViewScope) so the header's rail follows it.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useSearchParams, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import PromoHero from "../components/home/PromoHero.jsx";
import CategorySidebar from "../components/home/CategorySidebar.jsx";
import ShopHeader from "../components/home/ShopHeader.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { useAuth } from "../context/AuthContext.jsx";
import { useHomeFilters } from "../context/HomeFiltersContext.jsx";
import useCategoryTree from "../hooks/useCategoryTree.js";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

// Promo banner dismissal lasts 1 hour.
const PROMO_KEY = "bbm_promo_hero_dismissed_v1";
const PROMO_TTL_MS = 1 * 60 * 60 * 1000;

const readPromoDismissed = () => {
    try {
        const t = Number(localStorage.getItem(PROMO_KEY));
        return t > 0 && Date.now() - t < PROMO_TTL_MS;
    } catch { return false; }
};
const writePromoDismissed = () => {
    try { localStorage.setItem(PROMO_KEY, String(Date.now())); } catch { /* private mode */ }
};

export default function HomePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { effectiveLoggedIn, needsOnboarding } = useAuth();
    const { query, activeCategory, activeSubcategory, setCategoryFilter, setViewScope, shopName, setShopName, registerFeed } = useHomeFilters();

    const [searchParams, setSearchParams] = useSearchParams();
    const { brandName: brandParam, shopSlug: shopParam } = useParams();

    const shopSlug = shopParam || searchParams.get("shop")?.trim() || null;
    const brandName = brandParam || searchParams.get("brand")?.trim() || null;
    const viaSellers = !!shopParam || searchParams.get("via") === "sellers";

    // Tell the header the feed is visible (so search doesn't redirect), and clear the shop name on exit.
    useEffect(() => registerFeed(), [registerFeed]);
    useEffect(() => { if (!shopSlug) setShopName(null); }, [shopSlug, setShopName]);
    useEffect(() => () => setShopName(null), [setShopName]);

    const clearShop = () => {
        if (shopParam) { navigate("/home"); return; }
        const next = new URLSearchParams(searchParams);
        next.delete("shop");
        setSearchParams(next, { replace: true });
    };

    // ── Seller / brand scope ─────────────────────────────────────────────────
    // The sidebar (here) and the header's rail + sheet list only what this seller / brand sells.
    const scopeName = brandName || shopName
        || (shopSlug
            ? shopSlug.replace(/-\d+$/, "").split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            : null);
    const clearScope = () => {
        if (shopParam || brandParam) { navigate("/home"); return; }
        const next = new URLSearchParams(searchParams);
        ["shop", "via", "brand", "group"].forEach((k) => next.delete(k));
        setSearchParams(next, { replace: true });
    };
    const clearScopeRef = useRef(clearScope);
    clearScopeRef.current = clearScope;
    useEffect(() => {
        setViewScope({ shopSlug, brandName, clear: () => clearScopeRef.current() });
        return () => setViewScope(null);
    }, [shopSlug, brandName, setViewScope]);

    // If the active category / subcategory isn't in this scope's list (e.g. you opened a seller that
    // doesn't sell it), drop it, so the feed never shows an empty page for a filter you can't see.
    const tree = useCategoryTree({ shopSlug, brandName });
    useEffect(() => {
        if (!tree.categories || !activeCategory) return;
        const cat = tree.categories.find((c) => c.id === activeCategory.id);
        if (!cat) { setCategoryFilter(null, null); return; }
        if (activeSubcategory && !(cat.subcategories || []).some((s) => s.id === activeSubcategory.id)) {
            setCategoryFilter(activeCategory, null);
        }
    }, [tree.categories, activeCategory, activeSubcategory, setCategoryFilter]);

    const scope = scopeName ? { shopSlug, brandName, kind: brandName ? "brand" : "shop", name: scopeName, onClear: clearScope } : null;

    const [promoDismissed, setPromoDismissed] = useState(readPromoDismissed);
    const showPromo = !effectiveLoggedIn && !promoDismissed && searchParams.get("pinned") !== "1";
    const dismissPromo = () => { setPromoDismissed(true); writePromoDismissed(); };
    const goSignIn = () =>
        navigate("/login", { state: { from: `${location.pathname}${location.search}${location.hash || ""}` } });
    const goSell = () => navigate("/sell");

    return (
        // overflow-x-clip (NOT hidden): overflow-x-hidden breaks `position: sticky` inside.
        <div className="min-h-screen overflow-x-clip bg-[#FFFFFF] text-slate-900 antialiased" style={{ fontFamily: FONT_BODY }}>
            <h1 className="sr-only">
                {brandName ? `${brandName} products` : shopSlug ? "Seller store" : "BBM – Wholesale marketplace for verified sellers"}
            </h1>
            <SmoothScrollProvider>
                <div className="flex items-start sm:mt-2 lg:gap-6 lg:px-6">
                    <CategorySidebar
                        activeCategoryId={activeCategory?.id}
                        activeSubcategoryId={activeSubcategory?.id}
                        onSelect={setCategoryFilter}
                        scope={scope}
                    />

                    <main className="min-w-0 flex-1 px-2.5 pb-28 pt-2 sm:px-4 md:pb-20 lg:px-0">
                        {shopSlug && <ShopHeader shopSlug={shopSlug} onClear={clearShop} onLoaded={setShopName} />}

                        <AnimatePresence initial={false}>
                            {showPromo && (
                                <PromoHero
                                    key="promo-hero"
                                    needsOnboarding={needsOnboarding}
                                    onSignIn={goSignIn}
                                    onSell={goSell}
                                    onDismiss={dismissPromo}
                                />
                            )}
                        </AnimatePresence>

                        <HomeProductFeed
                            category={activeCategory}
                            subcategory={activeSubcategory}
                            q={query}
                            shopSlug={shopSlug}
                            brandName={brandName}
                            viaSellers={viaSellers}
                        />
                    </main>
                </div>
            </SmoothScrollProvider>
        </div>
    );
}