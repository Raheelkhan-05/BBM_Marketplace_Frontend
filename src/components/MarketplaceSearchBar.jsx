// components/MarketplaceSearchBar.jsx

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Camera, FileText, Loader2, Layers, Tag, Package, BadgeCheck } from "lucide-react";
import { searchByImage, fetchAutocomplete } from "../utils/api";
import { resizeImageForSearch } from "../utils/resizeImageForSearch";

const AUTOCOMPLETE_MIN_CHARS = 2;
const DEBOUNCE_MS = 100;

const LEVEL_META = {
    category: { icon: Layers, label: "Category", color: "#047084", bg: "rgba(4,112,132,0.08)" },
    subcategory: { icon: Tag, label: "Subcategory", color: "#047084", bg: "rgba(4,112,132,0.08)" },
    product: { icon: Package, label: "Product", color: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
    brand: { icon: BadgeCheck, label: "Brand", color: "#F15A24", bg: "rgba(241,90,36,0.08)" },
};

// Bolds the portion of `name` that matches `term`, so the dropdown visually
// shows *why* each row matched — same trick Google/Amazon use.
function HighlightedName({ name, term }) {
    if (!term.trim()) return <>{name}</>;
    const idx = name.toLowerCase().indexOf(term.trim().toLowerCase());
    if (idx === -1) return <>{name}</>;
    const before = name.slice(0, idx);
    const match = name.slice(idx, idx + term.trim().length);
    const after = name.slice(idx + term.trim().length);
    return (
        <>
            {before}
            <span className="text-slate-900">{match}</span>
            {after}
        </>
    );
}

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

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const containerRef = useRef(null);

    // Debounced + truly cancellable (AbortController, not just a stale-flag)
    // fetch — old requests are killed outright the moment a new keystroke
    // comes in, so the network never has more than one suggestion request
    // in flight. That's what makes this feel real-time.
    useEffect(() => {
        clearTimeout(debounceRef.current);
        abortRef.current?.abort();

        const term = value.trim();
        if (term.length < AUTOCOMPLETE_MIN_CHARS) {
            setSuggestions([]);
            setShowSuggestions(false);
            setSuggestionsLoading(false);
            return;
        }

        setSuggestionsLoading(true);
        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const res = await fetchAutocomplete(term, 8, controller.signal);
                const list = res?.success ? res.suggestions : [];
                setSuggestions(list);
                setShowSuggestions(list.length > 0);
                setHighlightIndex(-1);
            } catch (err) {
                if (err?.name !== "AbortError") {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                setSuggestionsLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceRef.current);
    }, [value]);

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
    };

    const handleImageButtonClick = () => {
        if (imageSearching) return;
        setImageError(null);
        fileInputRef.current?.click();
    };

    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
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
                    <div className="flex shrink-0 items-center pr-3 lg:pr-4">
                        <img src="./Logo.png" alt="Logo" className="h-6 w-6 lg:h-8 lg:w-8 object-contain" />
                    </div>

                    <div className="mr-3 lg:mr-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    <div className="flex min-w-0 flex-1 items-center">
                        {suggestionsLoading ? (
                            <Loader2 size={16} className="mr-2 lg:mr-3 shrink-0 animate-spin text-[#0B8A93] lg:!w-4 lg:!h-4" />
                        ) : (
                            <Search size={16} className="mr-2 lg:mr-3 shrink-0 text-slate-400 lg:!w-4 lg:!h-4" />
                        )}
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

                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
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

                    <button type="button" className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 pr-0 lg:px-2 lg:pr-1">
                        <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#F1EEFF]">
                            <FileText size={15} className="text-[#6655D8] lg:!w-[15px] lg:!h-[15px]" />
                        </div>
                        <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#6655D8]">PDF</span>
                    </button>

                    <button
                        type="submit"
                        className="ml-2 lg:ml-3 flex h-9 w-9 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-full bg-[#F15A24] text-white transition hover:scale-105"
                    >
                        <Search size={14} className="lg:!w-[16px] lg:!h-[16px]" />
                    </button>
                </div>
            </form>

            {/* Autocomplete dropdown — restyled to match brand: teal/orange accents, motion, matched-text bolding */}
            <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_-14px_rgba(4,112,132,0.35)]"
                    >
                        <div className="max-h-[340px] overflow-y-auto py-1.5">
                            {suggestions.map((s, i) => {
                                const meta = LEVEL_META[s.level] || LEVEL_META.product;
                                const Icon = meta.icon;
                                return (
                                    <motion.button
                                        key={`${s.level}-${s.id}`}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSuggestionClick(s)}
                                        onMouseEnter={() => setHighlightIndex(i)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.12, delay: i * 0.02 }}
                                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${i === highlightIndex ? "bg-[#F4FBFB]" : "bg-white"
                                            }`}
                                    >
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                            style={{ background: meta.bg, color: meta.color }}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13.5px] font-semibold text-slate-500">
                                                <HighlightedName name={s.name} term={value} />
                                            </span>
                                            {s.brandName && (
                                                <span className="mt-0.5 block truncate text-[10.5px] font-bold text-[#F15A24]">
                                                    {s.brandName}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                                            style={{ background: meta.bg, color: meta.color }}
                                        >
                                            {meta.label}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {imageError && <p className="mt-2 px-4 text-[11.5px] font-medium text-amber-600">{imageError}</p>}
        </div>
    );
}