// src/pages/HomePage.jsx
//
// Search, category, GST, Deliver-to and cart now live in the header / sidebar. This page only lays
// out [sidebar | feed] and registers itself so the header knows results are on screen.
import { useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import PromoHero from "../components/home/PromoHero.jsx";
import CategorySidebar from "../components/home/CategorySidebar.jsx";
import ShopHeader from "../components/home/ShopHeader.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { useAuth } from "../context/AuthContext.jsx";
import { useHomeFilters } from "../context/HomeFiltersContext.jsx";

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

import { useState } from "react";

export default function HomePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { effectiveLoggedIn, needsOnboarding } = useAuth();
    const { query, activeCategory, setActiveCategory, setShopName, registerFeed } = useHomeFilters();

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

    const [promoDismissed, setPromoDismissed] = useState(readPromoDismissed);
    const showPromo = !effectiveLoggedIn && !promoDismissed;
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
                    <CategorySidebar activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />

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