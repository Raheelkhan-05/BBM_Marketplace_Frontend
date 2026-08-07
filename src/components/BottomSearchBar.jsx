// src/components/BottomSearchBar.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";
import { searchHierarchyLevel, searchSmart } from "../utils/api.js";
import { resolveSearchRoute } from "../utils/searchResolve.js";



export default function BottomSearchBar() {
    const [query, setQuery] = useState("");
    const [barTop, setBarTop] = useState(null); // exact px from top of layout viewport
    const barRef = useRef(null);
    const navigate = useNavigate();

    // iOS Safari has a long-standing bug where `position: fixed; bottom: 0`
    // elements don't move when the keyboard opens — they stay anchored to
    // the bottom of the full layout viewport (the area now hidden behind
    // the keyboard), even though visualViewport itself reports correctly.
    // Android doesn't have this bug, but computing position explicitly
    // here works correctly on both instead of needing two code paths.
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const reposition = () => {
            const barHeight = barRef.current?.offsetHeight || 0;
            // Bottom edge of what's actually visible right now, in layout
            // viewport coordinates.
            const visibleBottom = vv.height + vv.offsetTop;
            setBarTop(visibleBottom - barHeight);
        };

        reposition();
        vv.addEventListener("resize", reposition);
        vv.addEventListener("scroll", reposition);
        window.addEventListener("orientationchange", reposition);
        return () => {
            vv.removeEventListener("resize", reposition);
            vv.removeEventListener("scroll", reposition);
            window.removeEventListener("orientationchange", reposition);
        };
    }, []);

    // Resolve BEFORE navigating anywhere, so we only ever land on the
    // right screen once — never flash the browse page for a frame while
    // HierarchySearchPage figures out it should've redirected to a
    // product. Mirrors the same first-step lookups the hook does
    // (top-level scoped search, then smart search) but keeps the result
    // here so we can pick the destination route up front. If a scoped
    // top-level match exists (e.g. it's actually a category name) or
    // nothing resolves cleanly, we fall through to /browse as before —
    // that page's own "Searching with BBM AI" state is the right UI for
    // genuinely ambiguous searches, since that step is inherently slower.
    const resolveAndNavigate = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) {
            navigate(route.pathname, { state: route.state });
            return;
        }
        navigate(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
    };

    const handleSubmit = (trimmedQuery) => {
        resolveAndNavigate(trimmedQuery);
    };

    const handleImageResolved = (result) => {
        navigate("/browse", { state: { imageResult: result } });
    };

    return (
        <div
            ref={barRef}
            className="fixed inset-x-0 z-50 md:hidden"
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 35%, #ffffff 100%)",
                paddingTop: "14px",
                paddingBottom: "max(10px, env(safe-area-inset-bottom))",
                // Until the first measurement lands, sit at the bottom like normal.
                ...(barTop != null ? { top: `${barTop}px`, bottom: "auto" } : { bottom: 0 }),
            }}
        >
            <div className="px-3">
                <MarketplaceSearchBar
                    value={query}
                    onChange={setQuery}
                    onSubmit={handleSubmit}
                    onImageResolved={handleImageResolved}
                    suggestionsDirection="up"
                />
            </div>
        </div>
    );
}