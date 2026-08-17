// src/pages/HomePage.jsx — redesigned shell (v2)
//
// Top to bottom: NavStrip -> search bar (icons hidden) -> CategoryStrip
// (filter, not a link) -> HomeProductFeed (paginated hs_generic_products).
// Hero, Welcome, QuickActions, SellerQuickManage, TrustStrip,
// CategoryIconExplorer, HomeProductShelves, StartSellingBanner: all removed.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import HomePageSkeleton from "../components/skeletons/HomePageSkeleton.jsx";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { performSearchNavigation } from "../utils/searchResolve.js";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

export default function HomePage() {
    const [ready, setReady] = useState(false);
    const [isRfqOpen, setIsRfqOpen] = useState(false); // kept for NavStrip's Post RFQ tab — modal itself lives outside this file
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null); // { id, name, slug } | null
    const navigate = useNavigate();

    useEffect(() => {
        const id = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    if (!ready) return <HomePageSkeleton />;

    const handleSubmit = (trimmedQuery) => performSearchNavigation(navigate, trimmedQuery);
    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });

    return (
        <div className="min-h-screen bg-[#FCFBF9] text-slate-900 antialiased overflow-x-hidden" style={{ fontFamily: FONT_BODY }}>
            <SmoothScrollProvider>

                <main className="mx-auto max-w-7xl px-2.5 mt-2 sm:px-4 lg:px-6 pb-5 sm:pb-20 pt-3 space-y-4">
                    <MarketplaceSearchBar
                        value={query}
                        onChange={setQuery}
                        onSubmit={handleSubmit}
                        onImageResolved={handleImageResolved}
                        showMediaButtons={false}
                    />

                    <CategoryStrip activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />

                    <HomeProductFeed category={activeCategory} />
                </main>
            </SmoothScrollProvider>
        </div>
    );
}