// src/pages/HomePage.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";

import HomePageSkeleton from "../components/skeletons/HomePageSkeleton.jsx";
import StartSellingBanner from "../components/home/StartSellingBanner.jsx";
import Hero16by9Banner from "../components/home/Hero16by9Banner.jsx";
import QuickActionsJustBelowBanner from "../components/home/QuickActionsJustBelowBanner.jsx";
import TrustStripLogos from "../components/home/TrustStripLogos.jsx";
// import TopCategoriesAccordion from "../components/home/TopCategoriesAccordion.jsx";
import CategoryIconExplorer from "../components/home/CategoryIconExplorer.jsx";
import WelcomeBanner from "../components/home/WelcomeBanner.jsx";
import TrustStrip from "../components/home/TrustStrip.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { resolveSearchRoute } from "../utils/searchResolve.js";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return <HomePageSkeleton />;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 antialiased overflow-x-hidden" style={{ fontFamily: FONT_BODY }}>
      <SmoothScrollProvider>
        <main className="mx-auto max-w-[1400px] px-2.5 sm:px-4 lg:px-6 pb-5 sm:pb-20 pt-3 space-y-6">

          {/* 16:9 Aspect Ratio Hero Banner */}
          <Hero16by9Banner onOpenRfq={() => setIsRfqOpen(true)} />

          <span className="hidden md:block">
            <AmazonSearchHeader onOpenRfq={() => setIsRfqOpen(true)} />
          </span>

          {/* Personalized Buyer Command Center */}
          <WelcomeBanner />

          {/* Quick Action Bar JUST BELOW THE HERO BANNER (8 Items in 2x4 Grid) */}
          <QuickActionsJustBelowBanner onOpenRfq={() => setIsRfqOpen(true)} />

          <TrustStripLogos />

          {/* Industrial Category Department Explorer */}
          {/* <TopCategoriesAccordion /> */}
          <CategoryIconExplorer />

          {/* Signature 4-Point Trust & Guarantee Strip */}
          <TrustStrip />

          {/* Start Selling Banner */}
          <StartSellingBanner />
        </main>
      </SmoothScrollProvider>
    </div>
  );
}

// Home page search bar. Submitting a typed search navigates to /browse?q=.
// A resolved image search already carries a ready-to-display breadcrumb
// stack (computed server-side), so it's passed along via navigation state
// instead of being re-encoded into a query string.
function AmazonSearchHeader() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Same pre-flight resolution BottomSearchBar and HierarchySearchPage already
  // do — resolve to an exact product/brand/subcategory route BEFORE navigating,
  // instead of always landing on /browse and letting it redirect a moment later.
  // That redirect-after-mount is what caused the visible page flash.
  const handleSubmit = async (trimmedQuery) => {
    const route = await resolveSearchRoute(trimmedQuery);
    if (route) {
      navigate(route.pathname, { state: route.state });
      return;
    }
    navigate(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleImageResolved = (result) => {
    navigate("/browse", { state: { imageResult: result } });
  };

  return (
    <MarketplaceSearchBar
      value={query}
      onChange={setQuery}
      onSubmit={handleSubmit}
      onImageResolved={handleImageResolved}
    />
  );
}