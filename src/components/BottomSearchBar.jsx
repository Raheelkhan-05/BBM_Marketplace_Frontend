// src/components/BottomSearchBar.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";

export default function BottomSearchBar() {
    const [query, setQuery] = useState("");
    const [bottomEdge, setBottomEdge] = useState(null); // px from top of layout viewport to bottom of visible area
    const navigate = useNavigate();

    // Places the bar's bottom edge exactly at the bottom of the *visible*
    // area (vv.offsetTop + vv.height), computed directly from the visual
    // viewport rather than inferred from window.innerHeight — this works
    // correctly whether the browser resizes the layout viewport for the
    // keyboard (iOS Safari) or overlays it (Chrome/Android), instead of
    // assuming one model and getting the math wrong on the other.
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const handleResize = () => {
            setBottomEdge(vv.height + vv.offsetTop);
        };

        handleResize();
        vv.addEventListener("resize", handleResize);
        vv.addEventListener("scroll", handleResize);
        return () => {
            vv.removeEventListener("resize", handleResize);
            vv.removeEventListener("scroll", handleResize);
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
            className="fixed inset-x-0 left-0 right-0 z-50 md:hidden"
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 35%, #ffffff 100%)",
                paddingTop: "14px",
                paddingBottom: "max(10px, env(safe-area-inset-bottom))",
                // Fall back to plain bottom-0 until the first viewport
                // measurement lands, then pin to the real visible bottom.
                ...(bottomEdge != null
                    ? { top: `${bottomEdge}px`, transform: "translateY(-100%)" }
                    : { bottom: 0 }),
                transition: "top 0.15s ease-out",
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