// src/components/BottomSearchBar.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";

export default function BottomSearchBar() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();

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