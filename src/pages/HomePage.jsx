// src/pages/HomePage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

// Matches Tailwind's `md` breakpoint
function useIsMobile() {
    const query = "(max-width: 767px)";
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== "undefined" && window.matchMedia(query).matches
    );
    useEffect(() => {
        const mq = window.matchMedia(query);
        const onChange = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);
    return isMobile;
}

export default function HomePage() {
    const [isRfqOpen, setIsRfqOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const handleSuggestionSelect = (s) => {
        if (s.level === "brandFamily") {
            navigate(`/brand-family/${encodeURIComponent(s.name)}`);
            return;
        }
        setQuery(s.name);
    };

    const handleSubmit = (trimmedQuery) => setQuery(trimmedQuery);

    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });

    return (
        <div className="min-h-screen bg-[#FFFFFF] text-slate-900 antialiased overflow-x-hidden" style={{ fontFamily: FONT_BODY }}>
            <SmoothScrollProvider>
                {/* extra bottom padding on mobile so the last feed items clear the fixed search bar */}
                <main className="mx-auto max-w-7xl px-2.5 sm:mt-2 sm:px-4 lg:px-6 pb-28 md:pb-20 pt-3 space-y-4">

                    {/* Mobile: pinned to the bottom of the screen. Desktop: normal flow, as before. */}
                    <div
                        className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/90 to-transparent px-2.5 pb-3 pt-6 md:static md:z-auto md:bg-none md:p-0"
                        style={isMobile ? { paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" } : undefined}
                    >
                        <MarketplaceSearchBar
                            value={query}
                            onChange={setQuery}
                            onSubmit={handleSubmit}
                            onImageResolved={handleImageResolved}
                            showMediaButtons={false}
                            onSuggestionSelect={handleSuggestionSelect}
                            clearOnSubmit={false}
                            suggestionsDirection={isMobile ? "up" : "down"}
                        />
                    </div>

                    <CategoryStrip activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />

                    <HomeProductFeed category={activeCategory} q={query} />
                </main>
            </SmoothScrollProvider>

            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}