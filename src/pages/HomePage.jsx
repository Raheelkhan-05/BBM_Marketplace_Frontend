// src/pages/HomePage.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ShopBanner from "../components/home/ShopBanner.jsx";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

export default function HomePage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);
    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();
    const shopSlug = searchParams.get("shop")?.trim() || null;
    const brandName = searchParams.get("brand")?.trim() || null;
    const viaSellers = searchParams.get("via") === "sellers";

    const clearShop = () => {
        const next = new URLSearchParams(searchParams);
        next.delete("shop");
        setSearchParams(next, { replace: true });
    };

    const [shopName, setShopName] = useState(null);
    useEffect(() => { if (!shopSlug) setShopName(null); }, [shopSlug]);

    const handleSuggestionSelect = (s) => {
        if (s.level === "brandFamily") {
            navigate(`/brand-family/${encodeURIComponent(s.name)}`);
            return;
        }
        setQuery(s.name);
    };

    const handleSubmit = (trimmedQuery) => setQuery(trimmedQuery);
    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });

    // Category strip + search bar. HomeProductFeed renders this inside its
    // sticky block, together with the Deliver-to / GST row, so all four stay
    // visible while the page scrolls.
    const toolbar = (
        <>
            <MarketplaceSearchBar
                value={query}
                onChange={setQuery}
                onSubmit={handleSubmit}
                onImageResolved={handleImageResolved}
                showMediaButtons={false}
                onSuggestionSelect={handleSuggestionSelect}
                placeholder={shopName ? `Search in ${shopName}…` : undefined}
                clearOnSubmit={false}
                suggestionsDirection="down"
            />
            <CategoryStrip activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />
        </>
    );

    return (
        // overflow-x-clip (NOT hidden): overflow-x-hidden turns this div into a
        // scroll container and silently breaks `position: sticky` for everything inside.
        <div className="min-h-screen bg-[#FFFFFF] text-slate-900 antialiased overflow-x-clip" style={{ fontFamily: FONT_BODY }}>

            <SmoothScrollProvider>
                {/* bottom padding so the last feed items clear the floating buttons (BottomNavStrip) */}
                <main className="mx-auto max-w-7xl px-2.5 sm:mt-2 sm:px-4 lg:px-6 pb-28 md:pb-20 pt-3">

                    {shopSlug && !viaSellers && <ShopBanner shopSlug={shopSlug} onClear={clearShop} onLoaded={setShopName} />}

                    <HomeProductFeed
                        category={activeCategory}
                        q={query}
                        shopSlug={shopSlug}
                        brandName={brandName}
                        toolbar={toolbar}
                    />
                </main>
            </SmoothScrollProvider>

            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}