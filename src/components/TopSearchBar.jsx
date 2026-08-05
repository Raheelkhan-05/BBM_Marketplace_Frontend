// components/TopSearchBar.jsx
//
// Desktop-only global search. Renders under Header on every page except
// landing/admin/browse/search (those already have their own search UI).
// Fixes the fact that Header.jsx has no search input at all — until now,
// desktop users on category/subcategory/product/brand pages had no way
// to start a new search except going back to the homepage.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar.jsx";
import { resolveSearchRoute } from "../utils/searchResolve.js";

export default function TopSearchBar({ className = "" }) {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) { navigate(route); return; }
        navigate(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
    };
    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });
    const handleFileImport = () => navigate("/browse");

    return (
        <div className={`sticky top-0 z-30 border-b border-slate-100 bg-white/90 py-3 backdrop-blur-md ${className}`}>
            <div className="mx-auto max-w-2xl px-4 lg:px-8">
                <MarketplaceSearchBar
                    value={query}
                    onChange={setQuery}
                    onSubmit={handleSubmit}
                    onImageResolved={handleImageResolved}
                    onFileImport={handleFileImport}
                    placeholder="Search any product, brand, category..."
                />
            </div>
        </div>
    );
}