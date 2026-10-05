// src/pages/HomePage.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import ShopBanner from "../components/home/ShopBanner.jsx";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

// Same blue the RFQ tile always used.
const RFQ_BLUE = "#0A5FB0";

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

// RFQ entry point. Takes the slot the search bar used to have: pinned to the
// bottom of the screen on mobile, normal flow on desktop.
function RfqBar({ isMobile }) {
    return (
        <div
            className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/90 to-transparent px-2.5 pb-3 pt-6 md:static md:z-auto md:bg-none md:p-0 md:pb-2.5"
            style={isMobile ? { paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" } : undefined}
        >
            <Link
                to="/rfq"
                aria-label="RFQ - get multiple quotes"
                className="group flex h-[55px] w-full items-center gap-3 rounded-full py-0 pl-3 pr-4 text-left text-white shadow-lg shadow-black/10 transition-transform active:scale-[0.98] md:h-14"
                style={{ background: RFQ_BLUE }}
            >
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                >
                    <FileText className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-extrabold tracking-wide">RFQ</span>
                    <span className="mt-0.5 block truncate text-[10.5px] font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Get multiple quotes
                    </span>
                </span>
                <ChevronRight
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2.4}
                />
            </Link>
        </div>
    );
}

export default function HomePage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

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
                {/* extra bottom padding on mobile so the last feed items clear the fixed RFQ bar */}
                <main className="mx-auto max-w-7xl px-2.5 sm:mt-2 sm:px-4 lg:px-6 pb-28 md:pb-20 pt-3">

                    {shopSlug && !viaSellers && <ShopBanner shopSlug={shopSlug} onClear={clearShop} onLoaded={setShopName} />}

                    {/* Mobile: pinned to the bottom of the screen. Desktop: normal flow. */}
                    <RfqBar isMobile={isMobile} />

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