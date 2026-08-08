import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, ArrowUpDown, Box } from "lucide-react";
import { searchCatalogSubcategories, searchCatalogGenericProducts } from "../utils/api";
import { resolveSearchRoute } from "../utils/searchResolve.js";
import { Link } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";

/* ------------------------------------------------------------------
   DESIGN NOTES — SubcategoryGenericProductsPage
   ------------------------------------------------------------------
   Third rung of the browse ladder: Category > Subcategory > Generic
   Product > Brand Item > Sellers. Reached from
   CategorySubcategoriesPage's tile grid (route:
   /subcategory/:idOrSlug/products). Same design system as every
   other rung: ink #0B1116, muted #667077, primary #D2462B, secondary
   #006F83, hairline rgba(11,17,22,0.09), font-sans/font-mono pairing,
   [0.16,1,0.3,1] easing. Structurally identical to
   CategorySubcategoriesPage — only the data source and the next-hop
   route change.
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
                style={{ background: '#f3f4f6ff' }}
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
                className="line-clamp-2 w-full text-center text-[11.5px] font-bold leading-tight tracking-[-0.005em]"
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

export default function SubcategoryGenericProductsPage() {
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    // Prefer the subcategory (and its parent category) handed off from the
    // previous tile click — instant header, no waterfall. Fall back to a
    // lookup by id/slug when reached directly (deep link, refresh, back).
    const [subcategory, setSubcategory] = useState(state?.subcategory || null);
    const [category, setCategory] = useState(state?.category || null);
    const [genericProducts, setGenericProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                let sub = subcategory;
                if (!sub) {
                    const subsRes = await searchCatalogSubcategories(undefined, idOrSlug, 5);
                    sub = subsRes?.items?.find((s) => s.slug === idOrSlug || s.id === idOrSlug) || subsRes?.items?.[0] || null;
                    if (!cancelled) setSubcategory(sub);
                }
                if (sub) {
                    const res = await searchCatalogGenericProducts(sub.id, "", 50);
                    if (!cancelled) setGenericProducts(res?.success ? res.items || [] : []);
                }
            } catch {
                if (!cancelled) setGenericProducts([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idOrSlug]);

    const filtered = query.trim()
        ? genericProducts.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
        : genericProducts;

    const handleSearchSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) navigate(route.pathname, { state: route.state });
        else navigate(`/browse-search?q=${encodeURIComponent(trimmedQuery)}`);
    };

    const openGenericProduct = (gp) => {
        navigate(`/product/${gp.slug || gp.id}/brands`, {
            state: { genericProduct: gp, subcategory, category },
        });
    };

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            {/* header: back + subcategory name */}
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
                    <Link to={category ? `/category/${category.slug || category.id}/subcategories` : "/categories"} className="block">
                        <h1
                            className="truncate font-extrabold leading-tight tracking-[-0.01em] cursor-pointer"
                            style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                        >
                            {subcategory?.name || "Products"}
                        </h1>
                    </Link>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                        {genericProducts.length} products
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

            {/* generic product grid */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    <TileGridSkeleton />
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-[13px] font-medium" style={{ color: C.muted }}>
                        {query ? `No products match "${query}".` : "No products available yet."}
                    </p>
                ) : (
                    <TileGrid>
                        {filtered.map((gp, i) => (
                            <IconTile
                                key={gp.id}
                                image={gp.image}
                                name={gp.name}
                                idx={i}
                                count={gp.brandCount}
                                onClick={() => openGenericProduct(gp)}
                            />
                        ))}
                    </TileGrid>
                )}
            </div>
        </div>
    );
}