// src/components/BottomSearchBar.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";

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

    const handleSubmit = (trimmedQuery) => {
        navigate(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
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