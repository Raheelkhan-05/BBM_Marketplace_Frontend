import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";

export default function BottomSearchBar() {
    const [query, setQuery] = useState("");
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const navigate = useNavigate();

    // Tracks the on-screen keyboard via the VisualViewport API and
    // translates the bar up by exactly that much, so it floats right
    // above the keyboard instead of the whole page jumping/resizing.
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const handleResize = () => {
            const offset = window.innerHeight - vv.height - vv.offsetTop;
            setKeyboardOffset(Math.max(0, offset));
        };

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
            className="fixed inset-x-0 bottom-0 z-50 md:hidden"
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 35%, #ffffff 100%)",
                paddingTop: "14px",
                paddingBottom: "max(10px, env(safe-area-inset-bottom))",
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