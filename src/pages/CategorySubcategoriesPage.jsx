import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, ArrowUpDown, Box } from "lucide-react";
import { searchCategories, searchSubcategories } from "../utils/api";
import { resolveSearchRoute } from "../utils/searchResolve.js";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";

/* ------------------------------------------------------------------
   DESIGN NOTES — CategorySubcategoriesPage
   ------------------------------------------------------------------
   Reached from CategoryIconExplorer's tile grid on the home page
   (route: /category/:idOrSlug/subcategories). Same design system as
   the rest of the home surfaces: ink #0B1116, muted #667077, primary
   #D2462B, secondary #006F83, hairline rgba(11,17,22,0.09),
   font-sans/font-mono pairing, [0.16,1,0.3,1] easing.

   - Header: back button + category name + subcategory count, same
     shape as the section headers used across the home page.
   - Search: reuses the app's existing MarketplaceSearchBar (the same
     component HomePage's AmazonSearchHeader wraps) — but ONLY on
     desktop (hidden below lg), matching how HomePage already gates
     its inline search header with `hidden md:block`. Mobile has no
     search bar here; it relies on the app's existing bottom search
     bar rather than duplicating it.
   - Filter/sort chip row, visual only for now (see caveats).
   - Subcategories render in the exact same 2-row, horizontally-
     scrollable icon-tile rail as the category grid on the home page,
     4 columns visible at a time on mobile.
   ------------------------------------------------------------------ */

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};

const EASE = [0.16, 1, 0.3, 1];

function tintFor(idx) {
    return idx % 2 === 0 ? `${C.primary}12` : `${C.secondary}12`;
}
function fgFor(idx) {
    return idx % 2 === 0 ? C.primary : C.secondary;
}

function IconTile({ image, name, idx, count, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.3), ease: EASE }}
            whileTap={{ scale: 0.95 }}
            className="flex snap-start flex-col items-center gap-2 outline-none"
        >
            <span
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition-transform duration-150 active:scale-95"
                style={{ background: tintFor(idx) }}
            >
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" draggable={false} />
                ) : (
                    <Box className="h-7 w-7" style={{ color: fgFor(idx) }} />
                )}
                {count != null && (
                    <span
                        className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white ring-2 ring-white"
                        style={{ background: fgFor(idx) }}
                    >
                        {count}
                    </span>
                )}
            </span>
            <p
                className="line-clamp-2 w-full text-center text-[11px] sm:text-[13.5px] font-bold leading-tight tracking-[0.01em]"
                style={{ color: C.ink }}
            >
                {name}
            </p>
        </motion.button>
    );
}

function TileGrid({ children }) {
    return (
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-6">
            {children}
        </div>
    );
}

function TileGridSkeleton() {
    return (
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                    <div className="aspect-square w-full animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />
                    <div className="h-2.5 w-3/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                </div>
            ))}
        </div>
    );
}

export default function CategorySubcategoriesPage() {
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    // Prefer the category object handed off from the home page tile click
    // (instant header, no waterfall) — fall back to a lookup by id/slug
    // when the page is reached directly (deep link, refresh, back-forward).
    const [category, setCategory] = useState(state?.category || null);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                let cat = category;
                if (!cat) {
                    const catsRes = await searchCategories(idOrSlug, 5);
                    cat = catsRes?.items?.find((c) => c.slug === idOrSlug || c.id === idOrSlug) || catsRes?.items?.[0] || null;
                    if (!cancelled) setCategory(cat);
                }
                if (cat) {
                    const res = await searchSubcategories(cat.id, "", 50);
                    if (!cancelled) setSubcategories(res?.success ? res.items || [] : []);
                }
            } catch {
                if (!cancelled) setSubcategories([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idOrSlug]);

    const filtered = query.trim()
        ? subcategories.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
        : subcategories;

    // Same pre-flight resolution the home page search uses — land on an
    // exact route when possible instead of always bouncing through /browse.
    const handleSearchSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        navigate(route || `/browse?q=${encodeURIComponent(trimmedQuery)}`);
    };

    return (
        <div className="mx-auto max-w-[1400px] px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            {/* header: back + category name */}
            <div className="mt-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-black/[0.03]"
                    style={{ borderColor: C.hair, color: C.ink }}
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                    <h1
                        className="truncate font-extrabold leading-tight tracking-[-0.01em]"
                        style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                    >
                        {category?.name || "Category"}
                    </h1>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                        {subcategories.length} subcategories
                    </p>
                </div>
            </div>

            {/* search — desktop only, reuses the app's existing search bar */}
            <div className="mt-4 hidden lg:block">
                <MarketplaceSearchBar value={query} onChange={setQuery} onSubmit={handleSearchSubmit} />
            </div>

            {/* filter / sort chips */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                    { icon: SlidersHorizontal, label: "Filter" },
                    { icon: ArrowUpDown, label: "Sort" },
                ].map(({ icon: Icon, label }) => (
                    <button
                        key={label}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: C.hair, color: C.ink }}
                    >
                        <Icon className="h-3.5 w-3.5" style={{ color: C.muted }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* subcategory grid */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    <TileGridSkeleton />
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-[13px] font-medium" style={{ color: C.muted }}>
                        {query ? `No subcategories match "${query}".` : "No subcategories available yet."}
                    </p>
                ) : (
                    <TileGrid>
                        {filtered.map((sub, i) => (
                            <IconTile
                                key={sub.id}
                                image={sub.image}
                                name={sub.name}
                                idx={i}
                                count={sub.productCount}
                                onClick={() => navigate(`/subcategory/${sub.slug || sub.id}`)}
                            />
                        ))}
                    </TileGrid>
                )}
            </div>
        </div>
    );
}