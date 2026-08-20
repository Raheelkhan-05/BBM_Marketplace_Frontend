// components/MarketplaceSearchBar.jsx

import { useRef, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Layers, Tag, Package, BadgeCheck } from "lucide-react";
import { fetchAutocomplete } from "../utils/api";

const AUTOCOMPLETE_MIN_CHARS = 2;
const DEBOUNCE_MS = 100;

// Static resting-state border — your original 3 stops, untouched.
const BAR_GRADIENT = "linear-gradient(90deg, #0B8A93 0%, #3B82F6 50%, #FF6A00 100%)";

// Running-border gradient, a CONIC gradient rotated via the --bbm-angle
// custom property.
//
// These stops are NOT copied from BAR_GRADIENT's own 0%/50%/100% order —
// they're derived from what BAR_GRADIENT actually looks like at each of
// the four cardinal points (top/right/bottom/left) of a wide pill:
//   - top-center and bottom-center sit at the same horizontal position
//     (the middle of the bar) on a left-to-right linear gradient, so
//     both must be BLUE (the 50% stop), not different colors.
//   - right-center is the far-right edge  -> ORANGE (100% stop)
//   - left-center  is the far-left edge   -> TEAL   (0% stop)
// Laying the conic stops out this way (blue, orange, blue, teal, blue)
// means every quarter-arc of the ring sweeps colors in the same
// direction the linear bar actually sweeps them (e.g. left-center to
// top-center goes teal->blue, same as sliding from x=0% to x=50% on
// BAR_GRADIENT). Since the spin is a clean 0deg->360deg loop, this is
// also exactly the frame the animation starts on and lands back on —
// so crossfading in/out of BAR_GRADIENT reads as a continuation, not a
// jump to an unrelated color arrangement.
const RUNNING_BORDER_GRADIENT_STOPS =
    "#3B82F6 0%, #FF6A00 25%, #3B82F6 50%, #0B8A93 75%, #3B82F6 100%";

const BORDER_WIDTH_PX = 2;
const SPIN_CYCLE_MS = 3000;
const INTRO_ANIMATION_MS = SPIN_CYCLE_MS;

// Symmetric ease-in-out — the spin gently accelerates away from each
// checkpoint and gently decelerates into the next one.
const SPIN_EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

const LEVEL_META = {
    category: { icon: Layers, label: "Category", color: "#047084", bg: "rgba(4,112,132,0.08)" },
    subcategory: { icon: Tag, label: "Subcategory", color: "#047084", bg: "rgba(4,112,132,0.08)" },
    product: { icon: Package, label: "Product", color: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
    brand: { icon: BadgeCheck, label: "Brand", color: "#F15A24", bg: "rgba(241,90,36,0.08)" },
    brandFamily: { icon: BadgeCheck, label: "Brand", color: "#F15A24", bg: "rgba(241,90,36,0.08)" },
};

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
    value, onChange, onSubmit,
    placeholder = "Search any product, brand, category...",
    suggestionsDirection = "down",
    clearOnSubmit = true,
}) {
    const navigate = useNavigate();

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const containerRef = useRef(null);

    const [introActive, setIntroActive] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setIntroActive(false), INTRO_ANIMATION_MS);
        return () => clearTimeout(t);
    }, []);

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
        setShowSuggestions(false);
        if (clearOnSubmit) onChange("");
        onSubmit(trimmed);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (highlightIndex >= 0 && suggestions[highlightIndex]) {
            handleSuggestionClick(suggestions[highlightIndex]);
        } else {
            commitSearch(value);
        }
    };

    const handleSuggestionClick = (s) => {
        if (s.level === "brandFamily") {
            setShowSuggestions(false);
            onChange("");
            navigate(`/brand-family/${encodeURIComponent(s.name)}`);
            return;
        }
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

    return (
        <div className="w-full relative" ref={containerRef}>
            <style>{`
                /* Registering the angle as a real animatable type is what
                   makes the conic-gradient rotation interpolate smoothly
                   frame-by-frame instead of jumping in steps. Without
                   this, browsers treat --bbm-angle as an opaque string
                   and can't tween between 0deg and 360deg. */
                @property --bbm-angle {
                    syntax: '<angle>';
                    inherits: false;
                    initial-value: 0deg;
                }

                @keyframes bbm-border-spin {
                    from { --bbm-angle: 0deg; }
                    to   { --bbm-angle: 360deg; }
                }

                .bbm-border-static {
                    border: ${BORDER_WIDTH_PX}px solid transparent;
                    border-radius: 9999px;
                    background-image: ${BAR_GRADIENT};
                    background-origin: border-box;
                    background-clip: border-box;
                }

                /* Sits directly on top of the static border (same box,
                   offset out by the border width so its own border ring
                   overlays exactly). Starts transparent and crossfades
                   in on mount / out at the end of the intro via the CSS
                   transition, instead of hard-mounting/unmounting.

                   Increasing --bbm-angle from 0deg to 360deg rotates the
                   conic pattern CLOCKWISE (conic-gradient angles run
                   clockwise from "from"). Because the stop layout is
                   built to match BAR_GRADIENT at rest (see the stops
                   comment above), and 0deg/360deg are the same frame,
                   the very first frame shown and the frame it lands
                   back on before crossfading out are both a close match
                   to BAR_GRADIENT — no unrelated colors popping in, no
                   abrupt jump when it hands off to the static border. */
                .bbm-border-dynamic {
                    position: absolute;
                    border: ${BORDER_WIDTH_PX}px solid transparent;
                    border-radius: 9999px;
                    --bbm-angle: 0deg;
                    background-image: conic-gradient(from var(--bbm-angle), ${RUNNING_BORDER_GRADIENT_STOPS});
                    background-origin: border-box;
                    background-clip: border-box;
                    opacity: 0;
                    transition: opacity 700ms ease;
                }
                .bbm-border-dynamic-on {
                    opacity: 1;
                    animation: bbm-border-spin ${SPIN_CYCLE_MS}ms ${SPIN_EASING} infinite;
                }

                /* Static glass-style sheen along the top — a small,
                   permanent highlight (not tied to the color cycle) that
                   reads as a glossy premium finish on the pill regardless
                   of animation state. */
                .bbm-glass-sheen {
                    background: linear-gradient(to bottom, rgba(255,255,255,.65) 0%, rgba(255,255,255,0) 55%);
                    opacity: .55;
                }
                @media (prefers-reduced-motion: reduce) {
                    .bbm-border-dynamic-on { animation: none; opacity: 0; }
                }
            `}</style>

            {/* Static border always renders underneath; the animated
                border overlays it exactly (inset outward by the border
                width so its own border ring lines up) and crossfades its
                opacity out at the end of the intro, revealing the static
                one beneath with no jump. */}
            <div className="relative rounded-full shadow-lg bbm-border-static">
                <div
                    aria-hidden="true"
                    className={`absolute rounded-full bbm-border-dynamic ${introActive ? "bbm-border-dynamic-on" : ""}`}
                    style={{ inset: `-${BORDER_WIDTH_PX}px` }}
                />

                <form onSubmit={handleSubmit} className="relative flex h-[55px] items-center overflow-hidden rounded-full bg-white px-3 pl-5 lg:h-[62px] lg:px-5 lg:pl-7 xl:h-[64px]">
                    <div aria-hidden="true" className="bbm-glass-sheen pointer-events-none absolute inset-0 rounded-full" />

                    <div className="relative flex shrink-0 items-center pr-3 lg:pr-4">
                        <Link to="/home">
                            <img src="/Logo.png" alt="BBM" className="h-6 w-6 lg:h-8 lg:w-8 object-contain" />
                        </Link>
                    </div>

                    <div className="relative mr-3 lg:mr-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    <div className="relative flex min-w-0 flex-1 items-center">
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
                            className="w-full min-w-0 bg-transparent text-[12px] lg:text-[14px] text-slate-700 placeholder:text-slate-400 outline-none tracking-wide"
                        />
                    </div>

                    <button
                        type="submit"
                        className="relative ml-2 lg:ml-3 flex h-9 w-9 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-full bg-[#F15A24] text-white transition hover:scale-105"
                    >
                        <Search size={16} className="lg:!w-[16px] lg:!h-[16px]" />
                    </button>
                </form>
            </div>

            <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: suggestionsDirection === "up" ? 6 : -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: suggestionsDirection === "up" ? 6 : -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border-2 border-[#0B8A93]/15 bg-white shadow-[0_-4px_20px_-6px_rgba(4,112,132,0.35)] ring-1 ring-black/5 ${suggestionsDirection === "up"
                            ? "bottom-[calc(100%+8px)]"
                            : "top-[calc(100%+8px)]"
                            }`}
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
                                        className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left transition last:border-b-0 ${i === highlightIndex ? "bg-[#F4FBFB]" : "bg-white"
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
        </div>
    );
}