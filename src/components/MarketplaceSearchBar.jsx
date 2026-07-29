// components/MarketplaceSearchBar.jsx
//
// The one search bar UI, shared between the Home page and the results
// (HierarchySearchPage) so both offer identical text + image search.
// Fully controlled (value/onChange from the parent) and submit-only for
// the actual search: a keystroke never triggers a search, only
// Enter/the search button/a resolved image search does, via onSubmit /
// onImageResolved.
//
// Autocomplete is separate: as the user types, we fetch cheap DB-only
// prefix-match suggestions (no AI) and show them in a dropdown, purely
// as a typing aid — picking one just fills the input and submits.

import { useRef, useState, useEffect } from "react";
import { Search, Camera, FileText, Loader2, Layers, Tag, Package, BadgeCheck } from "lucide-react";
import { searchByImage, fetchAutocomplete } from "../utils/api";
import { resizeImageForSearch } from "../utils/resizeImageForSearch";

const AUTOCOMPLETE_MIN_CHARS = 2;
const DEBOUNCE_MS = 150;

const LEVEL_ICON = { category: Layers, subcategory: Tag, product: Package, brand: BadgeCheck };

export default function MarketplaceSearchBar({
    value,
    onChange,
    onSubmit,
    onImageResolved,
    placeholder = "Search any product, brand, category...",
}) {
    const [imageSearching, setImageSearching] = useState(false);
    const [imageError, setImageError] = useState(null);
    const fileInputRef = useRef(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const debounceRef = useRef(null);
    const requestIdRef = useRef(0);
    const containerRef = useRef(null);

    // Debounced, race-safe fetch of suggestions on every keystroke.
    // Purely DB-backed (fetchAutocomplete -> /search/autocomplete) —
    // no AI call, so this stays fast even as the user types quickly.
    useEffect(() => {
        clearTimeout(debounceRef.current);
        const term = value.trim();

        if (term.length < AUTOCOMPLETE_MIN_CHARS) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const myRequestId = ++requestIdRef.current;
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetchAutocomplete(term);
                if (myRequestId !== requestIdRef.current) return; // stale response
                const list = res?.success ? res.suggestions : [];
                setSuggestions(list);
                setShowSuggestions(list.length > 0);
                setHighlightIndex(-1);
            } catch {
                if (myRequestId === requestIdRef.current) {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceRef.current);
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const commitSearch = (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        setImageError(null);
        setShowSuggestions(false);
        onSubmit(trimmed);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // If a suggestion is highlighted via keyboard, use it; otherwise use typed text.
        if (highlightIndex >= 0 && suggestions[highlightIndex]) {
            onChange(suggestions[highlightIndex].name);
            commitSearch(suggestions[highlightIndex].name);
        } else {
            commitSearch(value);
        }
    };

    const handleSuggestionClick = (s) => {
        onChange(s.name);
        commitSearch(s.name);
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
            setHighlightIndex(-1);
        }
        // Enter is handled by form onSubmit above
    };

    const handleImageButtonClick = () => {
        if (imageSearching) return;
        setImageError(null);
        fileInputRef.current?.click();
    };

    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file next time
        if (!file) return;

        setImageSearching(true);
        setImageError(null);
        try {
            const { base64, mimeType } = await resizeImageForSearch(file);
            const result = await searchByImage(base64, mimeType);

            if (result?.success && result.resolved && result.stack) {
                onImageResolved(result);
            } else {
                setImageError(result?.reason || "We couldn't identify a product in that photo.");
            }
        } catch {
            setImageError("Something went wrong reading that photo. Please try again.");
        } finally {
            setImageSearching(false);
        }
    };

    return (
        <div className="w-full relative" ref={containerRef}>
            <form
                onSubmit={handleSubmit}
                className="w-full rounded-full p-[2px] bg-gradient-to-r from-[#0B8A93] via-[#3B82F6] to-[#FF6A00] shadow-lg"
            >
                <div className="flex h-[60px] lg:h-[62px] xl:h-[64px] items-center rounded-full bg-white px-3 pl-5 lg:px-5 lg:pl-7">

                    {/* Logo */}
                    <div className="flex shrink-0 items-center pr-3 lg:pr-4">
                        <img src="./Logo.png" alt="Logo" className="h-6 w-6 lg:h-8 lg:w-8 object-contain" />
                    </div>

                    <div className="mr-3 lg:mr-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    {/* Search — updates local text only, never triggers a search itself */}
                    <div className="flex min-w-0 flex-1 items-center">
                        <Search size={16} className="mr-2 lg:mr-3 shrink-0 text-slate-400 lg:!w-4 lg:!h-4" />
                        <input
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            placeholder={placeholder}
                            autoComplete="off"
                            className="w-full min-w-0 bg-transparent text-[10px] lg:text-base text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                    </div>

                    <div className="mx-3 lg:mx-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    {/* Image search */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                    />
                    <button
                        type="button"
                        onClick={handleImageButtonClick}
                        disabled={imageSearching}
                        className="flex shrink-0 flex-col items-center justify-center gap-1 px-0 lg:px-2 disabled:opacity-60"
                    >
                        <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#E7F7F7]">
                            {imageSearching ? (
                                <Loader2 size={15} className="animate-spin text-[#00838F] lg:!w-[15px] lg:!h-[15px]" />
                            ) : (
                                <Camera size={15} className="text-[#00838F] lg:!w-[15px] lg:!h-[15px]" />
                            )}
                        </div>
                        <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#00838F]">
                            {imageSearching ? "Scanning" : "Image"}
                        </span>
                    </button>

                    {/* PDF */}
                    <button
                        type="button"
                        className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 pr-0 lg:px-2 lg:pr-1"
                    >
                        <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#F1EEFF]">
                            <FileText size={15} className="text-[#6655D8] lg:!w-[15px] lg:!h-[15px]" />
                        </div>
                        <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#6655D8]">
                            PDF
                        </span>
                    </button>

                    {/* Search Button — only way (besides Enter) to submit */}
                    <button
                        type="submit"
                        className="ml-2 lg:ml-3 flex h-9 w-9 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-full bg-[#F15A24] text-white transition hover:scale-105"
                    >
                        <Search size={14} className="lg:!w-[16px] lg:!h-[16px]" />
                    </button>

                </div>
            </form>

            {/* Autocomplete dropdown — pure DB suggestions, no AI */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_16px_40px_-12px_rgba(4,112,132,0.25)]">
                    {suggestions.map((s, i) => {
                        const Icon = LEVEL_ICON[s.level] || Search;
                        return (
                            <button
                                key={`${s.level}-${s.id}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // keep input focus, avoid blur race
                                onClick={() => handleSuggestionClick(s)}
                                onMouseEnter={() => setHighlightIndex(i)}
                                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition ${i === highlightIndex ? "bg-slate-50" : "bg-white"
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate text-[13px] font-medium text-slate-700">{s.name}</span>
                                {s.brand_name && (
                                    <span className="ml-auto shrink-0 text-[10.5px] font-semibold text-[#F15A24]">
                                        {s.brand_name}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {imageError && (
                <p className="mt-2 px-4 text-[11.5px] font-medium text-amber-600">{imageError}</p>
            )}
        </div>
    );
}