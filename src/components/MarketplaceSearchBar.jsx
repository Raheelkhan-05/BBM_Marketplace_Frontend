// components/MarketplaceSearchBar.jsx

import { useRef, useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Layers, Tag, Package, BadgeCheck } from "lucide-react";
import { fetchAutocomplete } from "../utils/api";

const AUTOCOMPLETE_MIN_CHARS = 2;
const DEBOUNCE_MS = 100;

// Static resting-state border — your original 3 stops, untouched.
const BAR_GRADIENT = "linear-gradient(90deg, #0B8A93 0%, #3B82F6 50%, #FF6A00 100%)";

// Full-ring color map, STATIC (never rotates). These stops are derived
// from what BAR_GRADIENT actually looks like at each of the four
// cardinal points (top/right/bottom/left) of a wide pill — see the
// original reasoning below — so that no matter where the traveling
// comet light currently sits on the ring, the color it reveals matches
// the color the resting border already shows at that exact spot.
//   - top-center and bottom-center sit at the same horizontal position
//     (the middle of the bar) on a left-to-right linear gradient, so
//     both must be BLUE (the 50% stop), not different colors.
//   - right-center is the far-right edge  -> ORANGE (100% stop)
//   - left-center  is the far-left edge   -> TEAL   (0% stop)
const RUNNING_BORDER_GRADIENT_STOPS =
    "#3B82F6 0%, #FF6A00 25%, #3B82F6 50%, #0B8A93 75%, #3B82F6 100%";

const BORDER_WIDTH_PX = 2;
const SPIN_CYCLE_MS = 2000;
const GLOW_HOLD_MS = 800;
const GLOW_FADE_MS = 800;

// How long, at the tail end of the spin, the leading-edge feather takes
// to close from 22deg down to 0deg. Kept short and run as its own
// independent animation (see bbm-comet-feather-close below) so it never
// interferes with the main sweep's easing curve.
const FEATHER_CLOSE_MS = 260;

// Symmetric ease-in-out — the comet gently accelerates away from each
// checkpoint and gently decelerates into the next one.
const SPIN_EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

// Default outward reach of the glow, in px, beyond the crisp border.
// Passed in as the `glowSpread` prop — tune per-instance without
// touching this file.
const DEFAULT_GLOW_SPREAD_PX = 6;
const GLOW_RING_COUNT = 6;
const GLOW_PEAK_OPACITY = 0.5;

// The glow is a stack of thin, fully-filled, un-tricked rings at growing
// offsets — never a single blurred ring, since blurring the old
// border-box/transparent-border trick is what caused a washed-out,
// slightly-white haze. Each ring is genuinely painted with the conic
// gradient (not just blurred transparency), so the color survives all
// the way out.
//
// Rings are generated from `spreadPx` using a smooth quadratic falloff:
// opacity drops off as (1 - t)^2, which reads as a natural, continuous
// glow rather than visible discrete steps, and every ring's offset is
// strictly >= 0 and increasing, so the spread only ever grows outward —
// it can never fold back in on the crisp border.
function buildGlowRings(spreadPx) {
    const safeSpread = Math.max(0, spreadPx);
    return Array.from({ length: GLOW_RING_COUNT }, (_, i) => {
        const t = (i + 1) / GLOW_RING_COUNT; // (0, 1]
        return {
            extra: +(t * safeSpread).toFixed(2),
            opacity: +(GLOW_PEAK_OPACITY * Math.pow(1 - t, 2)).toFixed(3),
            blur: +(1.5 + t * 3.5).toFixed(2),
        };
    });
}

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
    // How far outward (px) the glow reaches beyond the crisp border.
    // 0 turns the glow off entirely; the ring count/falloff stay smooth
    // at any value since buildGlowRings scales continuously.
    glowSpread = DEFAULT_GLOW_SPREAD_PX,
}) {
    const navigate = useNavigate();
    const glowRings = useMemo(() => buildGlowRings(glowSpread), [glowSpread]);

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const containerRef = useRef(null);

    // The border trail itself never resets — it paints once and holds
    // (animation-fill-mode: forwards), no fade-in swap needed. Only the
    // outer glow is timed: it stays lit through the trail animation,
    // holds for GLOW_HOLD_MS after that, then fades out on its own.
    const [glowFading, setGlowFading] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setGlowFading(true), SPIN_CYCLE_MS + GLOW_HOLD_MS);
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
                   makes the comet's sweep interpolate smoothly frame-by-
                   frame instead of jumping in steps. Without this,
                   browsers treat --bbm-angle as an opaque string and
                   can't tween between 0deg and 360deg. */
                @property --bbm-angle {
                    syntax: '<angle>';
                    inherits: false;
                    initial-value: 0deg;
                }

                /* The soft leading-edge fade (the comet's "tip") is this
                   many degrees wide. It stays constant while the comet is
                   mid-flight, but MUST collapse to 0deg right before the
                   animation ends — otherwise the fade zone lands exactly
                   on the loop seam (where the comet started) and, since
                   the animation holds forever via forwards fill, that
                   sliver of the ring stays semi-transparent permanently.
                   That was the source of the lingering "white part" even
                   after the comet finished its lap. */
                @property --bbm-feather {
                    syntax: '<angle>';
                    inherits: false;
                    initial-value: 22deg;
                }

                @keyframes bbm-comet-spin {
                    from { --bbm-angle: 0deg; }
                    to   { --bbm-angle: 360deg; }
                }

                /* Runs as its OWN short animation, delayed to land exactly
                   at the tail of the main sweep (see the "animation"
                   shorthand below). Kept fully separate from
                   bbm-comet-spin on purpose: cramming this into the same
                   keyframes as the angle sweep (as an extra 90%/100% stop)
                   made the browser ease the sweep to a near-stop AT that
                   stop and then jerk forward again for the last bit — a
                   visible stutter. Two independent animations avoid that
                   entirely; the angle keeps one continuous, uninterrupted
                   ease-in-out from start to finish. */
                @keyframes bbm-comet-feather-close {
                    from { --bbm-feather: 22deg; }
                    to   { --bbm-feather: 0deg; }
                }

                /* Shared "painted ring" layer used by BOTH the crisp trail
                   and every glow ring below. Deliberately NOT using the
                   border:solid-transparent + background-clip:border-box
                   trick — on a fully rounded (9999px) pill that trick
                   anti-aliases inconsistently at the curve and leaves a
                   thin unpainted seam (the "white part" on the completed
                   path). Instead this fills the ENTIRE box with the
                   gradient; the actual ring shape comes for free from the
                   white search-bar form sitting on top at inset:0 —
                   whatever this layer paints outside the form's edge is
                   all that's ever visible, with no seam because there's
                   no border curve to anti-alias against.

                   The mask is the same as before: black (fully opaque)
                   from 0deg up to the current --bbm-angle — so color the
                   comet has already swept past stays permanently painted
                   — with a short ~22deg soft feather right at the leading
                   edge blending into the untouched part still ahead.
                   animation-fill-mode: forwards holds --bbm-angle at
                   360deg once the one-shot animation ends, so the ring
                   stays fully painted with no extra state/class toggling
                   needed after mount. */
                .bbm-comet-fill {
                    position: absolute;
                    border-radius: 9999px;
                    --bbm-angle: 0deg;
                    background-image: conic-gradient(from 0deg, ${RUNNING_BORDER_GRADIENT_STOPS});
                    -webkit-mask-image: conic-gradient(
                        from 0deg,
                        black 0deg,
                        black calc(var(--bbm-angle) - var(--bbm-feather)),
                        transparent var(--bbm-angle),
                        transparent 360deg
                    );
                    mask-image: conic-gradient(
                        from 0deg,
                        black 0deg,
                        black calc(var(--bbm-angle) - var(--bbm-feather)),
                        transparent var(--bbm-angle),
                        transparent 360deg
                    );
                    animation:
                        bbm-comet-spin ${SPIN_CYCLE_MS}ms ${SPIN_EASING} 1 forwards,
                        bbm-comet-feather-close ${FEATHER_CLOSE_MS}ms linear ${SPIN_CYCLE_MS - FEATHER_CLOSE_MS}ms 1 forwards;
                }

                /* Wrapper for the stacked glow rings — this is the only
                   thing that fades. Once the trail finishes its lap, the
                   whole glow (all rings together, still in sync) holds
                   for GLOW_HOLD_MS then dissolves over GLOW_FADE_MS,
                   leaving just the plain gradient trail behind. */
                .bbm-comet-glow-wrap {
                    position: absolute;
                    pointer-events: none;
                    transition: opacity ${GLOW_FADE_MS}ms ease;
                }
                .bbm-comet-glow-fade-out {
                    opacity: 0;
                }

                /* Static glass-style sheen along the top — a small,
                   permanent highlight (not tied to the comet) that reads
                   as a glossy premium finish on the pill regardless of
                   animation state. */
                .bbm-glass-sheen {
                    background: linear-gradient(to bottom, rgba(255,255,255,.65) 0%, rgba(255,255,255,0) 55%);
                    opacity: .55;
                }
                @media (prefers-reduced-motion: reduce) {
                    .bbm-comet-fill { animation: none; --bbm-angle: 360deg; --bbm-feather: 0deg; }
                    .bbm-comet-glow-wrap { opacity: 0; }
                }
            `}</style>

            {/* The trail paints the border once and holds — no swap, no
                fade-in. The glow rings light up the pill while the trail
                is drawing, hold briefly, then dissolve together, leaving
                just the plain gradient border behind. */}
            <div className="relative rounded-full shadow-lg">
                <div
                    aria-hidden="true"
                    className={`bbm-comet-glow-wrap ${glowFading ? "bbm-comet-glow-fade-out" : ""}`}
                    style={{ inset: `-${BORDER_WIDTH_PX}px` }}
                >
                    {glowRings.map((ring, i) => (
                        <div
                            key={i}
                            aria-hidden="true"
                            className="absolute rounded-full bbm-comet-fill"
                            style={{
                                inset: `-${ring.extra}px`,
                                opacity: ring.opacity,
                                filter: `blur(${ring.blur}px)`,
                            }}
                        />
                    ))}
                </div>
                <div
                    aria-hidden="true"
                    className="absolute rounded-full bbm-comet-fill"
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