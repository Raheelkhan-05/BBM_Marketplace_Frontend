// src/pages/HomePage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { performSearchNavigation } from "../utils/searchResolve.js";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

export default function HomePage() {
    const [isRfqOpen, setIsRfqOpen] = useState(false); // kept for NavStrip's Post RFQ tab — modal itself lives outside this file
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null); // { id, name, slug } | null
    const navigate = useNavigate();

    const handleSuggestionSelect = (s) => {
        if (s.level === "brandFamily") {
            navigate(`/brand-family/${encodeURIComponent(s.name)}`);
            return;
        }
        setQuery(s.name);
    };

    const handleSubmit = (trimmedQuery) => performSearchNavigation(navigate, trimmedQuery);
    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });

    // No artificial "ready" gate here anymore. By the time this component
    // mounts, its own JS chunk (and App.jsx's route-level Suspense) has
    // already resolved, and every child below shows its own lightweight
    // skeleton while its data loads — CategoryStrip shows pill shimmers,
    // HomeProductFeed shows row shimmers. Gating the whole page behind one
    // more requestAnimationFrame + a full-page skeleton (that no longer
    // even matched this layout) only delayed first paint for nothing.
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
                        onSuggestionSelect={handleSuggestionSelect}
                    />

                    <CategoryStrip activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />

                    <HomeProductFeed category={activeCategory} q={query} />
                </main>
            </SmoothScrollProvider>
            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}