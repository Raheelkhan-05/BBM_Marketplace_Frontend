import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchCategories, searchSubcategories, searchProductsInSubcategory } from "../../utils/api";

/* ------------------------------------------------------------------
   DESIGN NOTES — v4, switched to Geist Sans / Geist Mono
   ------------------------------------------------------------------
   The project's Tailwind config already maps `font-sans` -> Geist
   Sans and `font-mono` -> Geist Mono, so this pass uses those
   utility classes directly instead of hardcoded fontFamily strings —
   no more guessing at a typeface that isn't actually in the project.

   This also changes a real design decision, not just a token swap:
   Geist Mono is designed as a companion face to Geist Sans (same
   family Vercel/Linear-adjacent products use it for), so mono
   captions are now the RIGHT call — unlike the earlier Rubik pass,
   where a generic system mono next to Rubik headings was a mismatch.
   Captions, counts, and meta labels go back to `font-mono` uppercase,
   tracked wide; headings and body stay on `font-sans` at the weight
   scale from the previous pass (bold / semibold / medium by level).

   Colors and the brand-duotone image treatment are unchanged from
   last pass. All state, fetch logic, caching, and the desktop split
   are unchanged.
   ------------------------------------------------------------------ */

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};

function InlineLoadingRow({ label }) {
    return (
        <div className="flex items-center gap-2.5 px-7 py-4 font-sans">
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.muted }} />
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>
                {label}
            </span>
        </div>
    );
}

function SectionHeader({ title, subtitle, showViewAll = true, viewAllTo }) {
    const navigate = useNavigate();

    return (
        <div className="flex items-center justify-between pt-1">
            <div>
                <h2
                    className="text-left font-extrabold leading-tight tracking-[-0.01em]"
                    style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                >
                    {title}
                </h2>

                {subtitle && (
                    <p className="mx-auto mt-0 sm:mt-0.5 max-w-xs text-center text-[12.5px] font-medium leading-relaxed" style={{ color: C.muted }}>
                        {subtitle}
                    </p>
                )}
            </div>

            {showViewAll && (
                <button
                    onClick={() => viewAllTo && navigate(viewAllTo)}
                    className="group flex items-center gap-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150"
                    style={{ color: C.primary }}
                >
                    See all
                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
            )}
        </div>
    );
}

function TopCategoriesAccordion() {
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    const [openCategory, setOpenCategory] = useState(null);
    const [openSubcategory, setOpenSubcategory] = useState(null);

    // Lazy caches: fetched once per id, reused on re-open
    const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({});
    const [productsBySubcategory, setProductsBySubcategory] = useState({});
    const [loadingSubFor, setLoadingSubFor] = useState(null);
    const [loadingProductsFor, setLoadingProductsFor] = useState(null);

    // Initial top categories
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setCategoriesLoading(true);
            try {
                const res = await searchCategories("", 6);
                if (!cancelled && res?.success) setCategories(res.items || []);
            } catch {
                if (!cancelled) setCategories([]);
            } finally {
                if (!cancelled) setCategoriesLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const toggleCategory = async (cat) => {
        const isOpen = openCategory === cat.id;
        setOpenCategory(isOpen ? null : cat.id);
        setOpenSubcategory(null);

        if (!isOpen && !subcategoriesByCategory[cat.id]) {
            setLoadingSubFor(cat.id);
            try {
                const res = await searchSubcategories(cat.id, "", 20);
                setSubcategoriesByCategory((prev) => ({
                    ...prev,
                    [cat.id]: res?.success ? res.items || [] : [],
                }));
            } catch {
                setSubcategoriesByCategory((prev) => ({ ...prev, [cat.id]: [] }));
            } finally {
                setLoadingSubFor(null);
            }
        }
    };

    const toggleSubcategory = async (sub) => {
        const subId = sub.id;
        const isOpen = openSubcategory === subId;
        setOpenSubcategory(isOpen ? null : subId);

        if (!isOpen && !productsBySubcategory[subId]) {
            setLoadingProductsFor(subId);
            try {
                const res = await searchProductsInSubcategory(subId, "", 6);
                setProductsBySubcategory((prev) => ({
                    ...prev,
                    [subId]: res?.success ? res.items || [] : [],
                }));
            } catch {
                setProductsBySubcategory((prev) => ({ ...prev, [subId]: [] }));
            } finally {
                setLoadingProductsFor(null);
            }
        }
    };

    const leftColumn = categories.filter((_, idx) => idx % 2 === 0);
    const rightColumn = categories.filter((_, idx) => idx % 2 !== 0);

    const renderCategory = (cat, idx, isFirstInColumn) => {
        const isOpen = openCategory === cat.id;
        const subcategories = subcategoriesByCategory[cat.id] || [];
        const subLoading = loadingSubFor === cat.id;

        return (
            <div key={cat.id} style={!isFirstInColumn ? { borderTop: `1px solid ${C.hair}` } : undefined}>
                {/* ---- Category Row: brand-duotone image, overlaid title ---- */}
                <button onClick={() => toggleCategory(cat)} className="group relative block w-full text-left">
                    <div className="relative aspect-[3/1] w-full overflow-hidden lg:aspect-[16/7]" style={{ background: C.hairSoft }}>
                        {cat.image ? (
                            <img
                                src={cat.image}
                                alt={cat.name}
                                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            />
                        ) : (
                            <div className="h-full w-full" style={{ background: C.hairSoft }} />
                        )}

                        {/* brand duotone: teal-graded, not a flat black wash */}
                        <div
                            className="absolute inset-0 mix-blend-multiply"
                            style={{ background: `linear-gradient(200deg, ${C.secondary} 0%, transparent 55%)`, opacity: 0.3 }}
                        />
                        <div
                            className="absolute inset-0"
                            style={{ background: "linear-gradient(to top, rgba(6,10,13,0.86) 0%, rgba(6,10,13,0.25) 48%, rgba(6,10,13,0) 60%)" }}
                        />

                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 py-3 sm:px-5 sm:py-3.5 lg:px-6 lg:py-4">
                            <div className="min-w-0">
                                <h4 className="truncate text-md font-bold leading-tight tracking-[0.01em] text-white sm:text-base lg:text-lg">
                                    {cat.name}
                                </h4>
                                <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/70 sm:text-[11px]">
                                    {cat.subcategoryCount != null ? `${cat.subcategoryCount} subcategories` : "Subcategories"}
                                </p>
                            </div>

                            <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full backdrop-blur-sm transition-colors duration-200 sm:h-8 sm:w-8"
                                style={{ background: isOpen ? C.primary : "rgba(255,255,255,0.16)" }}
                            >
                                <ChevronDown
                                    className={`h-4 w-4 text-white transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                                />
                            </span>
                        </div>
                    </div>
                </button>

                {/* ---- Subcategories (expand/collapse, lazy-fetched) ---- */}
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
                            className="overflow-hidden"
                            style={{ background: C.hairSoft }}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {subLoading ? (
                                    <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                        <InlineLoadingRow label="Loading subcategories" />
                                    </motion.div>
                                ) : subcategories.length === 0 ? (
                                    <motion.p
                                        key="empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="px-7 py-4 font-sans text-xs font-medium"
                                        style={{ color: C.muted }}
                                    >
                                        No subcategories yet.
                                    </motion.p>
                                ) : (
                                    <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.05 }}>
                                        {subcategories.map((sub) => {
                                            const isSubOpen = openSubcategory === sub.id;
                                            const products = productsBySubcategory[sub.id] || [];
                                            const productsLoading = loadingProductsFor === sub.id;

                                            return (
                                                <div key={sub.id} style={{ borderTop: `1px solid ${C.hair}` }}>
                                                    <button
                                                        onClick={() => toggleSubcategory(sub)}
                                                        className="flex w-full items-center justify-between py-3 pl-7 pr-4 text-left sm:pl-9 sm:pr-5 lg:py-3.5 lg:pl-11 lg:pr-6"
                                                    >
                                                        <div className="">
                                                            <span className="text-sm font-semibold tracking-[-0.015em] sm:text-sm lg:text-base" style={{ color: C.ink }}>
                                                                {sub.name}
                                                            </span>
                                                            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] lg:text-[10.5px]" style={{ color: C.muted }}>
                                                                {sub.productCount != null ? `${sub.productCount} products` : "Products"}
                                                            </p>
                                                        </div>
                                                        <ChevronDown
                                                            className="h-4 w-4 shrink-0 transition-transform duration-300 lg:h-5 lg:w-5"
                                                            style={{ color: isSubOpen ? C.primary : C.muted, transform: isSubOpen ? "rotate(180deg)" : undefined }}
                                                        />
                                                    </button>

                                                    {/* ---- Products (expand/collapse, lazy-fetched) ---- */}
                                                    <AnimatePresence initial={false}>
                                                        {isSubOpen && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.18 } }}
                                                                className="overflow-hidden bg-white"
                                                            >
                                                                <AnimatePresence mode="wait" initial={false}>
                                                                    {productsLoading ? (
                                                                        <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                                                            <InlineLoadingRow label="Loading products" />
                                                                        </motion.div>
                                                                    ) : products.length === 0 ? (
                                                                        <motion.p
                                                                            key="empty"
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            className="py-4 pl-9 font-sans text-[12px] tracking-wider font-medium sm:pl-12 lg:pl-14"
                                                                            style={{ color: C.muted }}
                                                                        >
                                                                            No products listed yet.
                                                                        </motion.p>
                                                                    ) : (
                                                                        <motion.div
                                                                            key="content"
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            transition={{ duration: 0.25, delay: 0.05 }}
                                                                            className="space-y-2 py-2 pl-9 pr-4 sm:pl-12 sm:pr-5 lg:space-y-2.5 lg:py-3 lg:pl-14 lg:pr-6"
                                                                        >
                                                                            {products.map((p) => (
                                                                                <div
                                                                                    key={p.id}
                                                                                    className="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-colors duration-200 lg:px-4 lg:py-2.5"
                                                                                    style={{ borderColor: C.hair }}
                                                                                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${C.primary}66`)}
                                                                                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.hair)}
                                                                                >
                                                                                    <div className="min-w-0 font-sans">
                                                                                        <p className="truncate text-[12.5px] font-medium sm:text-xs lg:text-sm" style={{ color: C.ink }}>
                                                                                            {p.name}
                                                                                        </p>
                                                                                        {p.description && (
                                                                                            <p className="mt-0 truncate text-[11.5px] tracking-[0.01em] font-medium lg:text-xs" style={{ color: C.muted }}>
                                                                                                {p.description}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                    {p.sellerCount != null && (
                                                                                        <span
                                                                                            className="ml-2 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums sm:text-[10.5px]"
                                                                                            style={{ background: `${C.primary}14`, color: C.primary }}
                                                                                        >
                                                                                            {p.sellerCount} sellers
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Explore Categories"
                subtitle="Explore our best-selling industrial departments"
                viewAllTo="/browse"
            />

            <div
                className="overflow-hidden rounded-[24px] border bg-white lg:flex lg:items-start"
                style={{ borderColor: C.hair }}
            >
                {categoriesLoading ? (
                    <div className="w-full space-y-3 p-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-20 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
                        ))}
                    </div>
                ) : categories.length === 0 ? (
                    <p className="w-full p-6 font-sans text-sm font-medium" style={{ color: C.muted }}>
                        No categories available yet.
                    </p>
                ) : (
                    <>
                        <div className="lg:hidden">
                            {categories.map((cat, idx) => renderCategory(cat, idx, idx === 0))}
                        </div>
                        <div className="hidden lg:block lg:min-w-0 lg:flex-1" style={{ borderRight: `1px solid ${C.hair}` }}>
                            {leftColumn.map((cat, idx) => renderCategory(cat, idx, idx === 0))}
                        </div>
                        <div className="hidden lg:block lg:min-w-0 lg:flex-1">
                            {rightColumn.map((cat, idx) => renderCategory(cat, idx, idx === 0))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default TopCategoriesAccordion;