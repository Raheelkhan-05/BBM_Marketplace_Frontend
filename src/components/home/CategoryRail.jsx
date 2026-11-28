// src/components/home/CategoryRail.jsx
//
// Mobile / tablet (< lg) category filter. Lives inside the sticky Header (see ActiveFilterBar). Text only.
//
//   Full (page at the top):
//   [▦] [ All ] [ Automotive & engineering ] [ Chemical & solvents ] [ Lubricant … →   [✕]   (40px)
//       [ All ] [ Engine oil ] [ Industrial & Automotive Grease ] …                          (28px, only after a category is picked)
//
//   Compact (after scrolling, `compact` prop):
//   [ Category | Lubricant › Engine oil  (v) ] [✕]                                           (36px + 4px padding)
//
// - [▦] / the compact line open the searchable category sheet (pass onBrowse).
// - [✕] clears the whole category filter. It only shows while a category is picked.
// - Picked category = solid blue chip. Picked subcategory = tinted chip. Everything else = plain outline.
// - Each row scrolls sideways; a fade on the right edge shows there is more. The picked chip is scrolled to the middle.
// - Tapping the picked category (or the picked subcategory) steps back one level, same as the desktop sidebar.
// Data comes from the parent, so there is no extra request.
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, LayoutGrid, X } from "lucide-react";
import { shortLabel } from "../../hooks/useCategories.js";

const C = {
    ink: "#17202E", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD",
    line: "rgba(20,27,34,0.16)", lineStrong: "rgba(20,27,34,0.30)", soft: "rgba(20,27,34,0.06)",
    rest: "#F1F4F8",
};
const EASE = [0.16, 1, 0.3, 1];
const FADE_RIGHT = "linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)";
const SCROLL = "relative flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const ROW_STYLE = { paddingRight: 24, WebkitMaskImage: FADE_RIGHT, maskImage: FADE_RIGHT };
const SWAP = { duration: 0.12, ease: "easeOut" };

function Chip({ level, active, onClick, chipRef, children }) {
    const main = level === "main";
    const look = active
        ? (main
            ? { background: C.accent, borderColor: C.accent, color: "#fff", fontWeight: 800 }
            : { background: C.activeBg, borderColor: C.accent, color: C.accent, fontWeight: 800 })
        : { background: "#fff", borderColor: C.line, color: C.ink, fontWeight: 600 };
    return (
        <button
            ref={chipRef}
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap rounded-full border tracking-wide outline-none transition-colors duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50 ${main ? "h-8 px-3 text-[13px]" : "h-7 px-2.5 text-[12.5px]"}`}
            style={look}
        >
            {children}
        </button>
    );
}

function ClearButton({ onClick, size = "h-8 w-8", rounded = "rounded-full" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Clear category filter"
            className={`flex ${size} shrink-0 items-center justify-center ${rounded} border bg-white outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#0765CD]/50`}
            style={{ borderColor: C.lineStrong, color: C.ink }}
        >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
    );
}

// One slim line: the current filter + a way to open the sheet + a clear button.
// Built to read as a dropdown button even when nothing is picked: filled background, strong border,
// dark label, a blue chevron badge, and enough padding that the header border never touches it.
function CompactLine({ label, active, onBrowse, onClear }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1 sm:px-4">
            <button
                type="button"
                onClick={onBrowse}
                aria-haspopup="dialog"
                aria-label={active ? `Category: ${label}. Change category` : "Category: all categories. Choose a category"}
                className="relative flex h-9 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xl border pl-3 pr-1.5 text-left outline-none transition-colors duration-150 active:brightness-95 focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                style={{
                    background: active ? C.activeBg : C.rest,
                    borderColor: active ? C.accent : C.lineStrong,
                    boxShadow: "0 1px 2px rgba(20,27,34,0.08)",
                }}
            >
                {active && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: C.accent }} />}
                <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: active ? C.accent : C.ink }} strokeWidth={2.2} aria-hidden="true" />
                <span className="shrink-0 text-[12.5px] font-bold tracking-wide" style={{ color: active ? C.accent : C.ink }}>Category</span>
                <span aria-hidden className="h-4 w-px shrink-0" style={{ background: active ? "rgba(7,101,205,0.35)" : C.lineStrong }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold tracking-wide" style={{ color: active ? C.accent : C.ink }}>{label}</span>
                <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: C.accent }}
                >
                    <ChevronDown className="h-4 w-4 text-white" strokeWidth={2.8} />
                </span>
            </button>
            {active && <ClearButton onClick={onClear} size="h-9 w-9" rounded="rounded-xl" />}
        </div>
    );
}

// The full two-row rail. Mounts fresh each time it replaces the compact line, so its scroll effect re-centres the picked chip.
function FullRail({
    categories, loading, activeCat, subs,
    activeCategoryId, activeSubcategoryId,
    onSelect, onBrowse, onClear,
}) {
    const reduce = useReducedMotion();
    const railRef = useRef(null);
    const chipRefs = useRef({});
    const mounted = useRef(false);

    // Bring the picked chip to the middle of its row (only the row scrolls, never the page).
    useEffect(() => {
        const rail = railRef.current;
        if (!rail) return;
        const chip = activeCategoryId ? chipRefs.current[activeCategoryId] : null;
        const left = chip ? chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2 : 0;
        rail.scrollTo({ left: Math.max(0, left), behavior: reduce || !mounted.current ? "auto" : "smooth" });
        mounted.current = true;
    }, [activeCategoryId, categories.length, reduce]);

    const pickCategory = (cat) => {
        const onlyThis = activeCategoryId === cat.id && !activeSubcategoryId;
        onSelect(onlyThis ? null : cat, null);
    };
    const pickSub = (sub) => onSelect(activeCat, activeSubcategoryId === sub.id ? null : sub);

    return (
        <>
            <div className="flex items-center gap-1.5 pl-3 pr-3 sm:pl-4 sm:pr-4">
                {onBrowse && (
                    <button
                        type="button"
                        onClick={onBrowse}
                        aria-haspopup="dialog"
                        aria-label="Browse all categories"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                        style={{ borderColor: C.lineStrong, color: C.ink }}
                    >
                        <LayoutGrid className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />
                    </button>
                )}
                <div ref={railRef} className={`${SCROLL} flex-1 py-1`} style={ROW_STYLE}>
                    {loading && categories.length === 0 ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <span key={i} aria-hidden className="h-8 w-24 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.soft }} />
                        ))
                    ) : (
                        <>
                            <Chip level="main" active={!activeCategoryId} onClick={() => onSelect(null, null)}>All</Chip>
                            {categories.map((cat) => (
                                <Chip
                                    key={cat.id}
                                    level="main"
                                    chipRef={(el) => { if (el) chipRefs.current[cat.id] = el; }}
                                    active={activeCategoryId === cat.id}
                                    onClick={() => pickCategory(cat)}
                                >
                                    {shortLabel(cat.name)}
                                </Chip>
                            ))}
                        </>
                    )}
                </div>
                {activeCategoryId && <ClearButton onClick={onClear} />}
            </div>

            <AnimatePresence initial={false}>
                {subs.length > 0 && (
                    <motion.div
                        key={activeCat.id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="overflow-hidden"
                    >
                        <div className={`${SCROLL} px-3 pb-1.5 pt-0.5 sm:px-4`} style={ROW_STYLE}>
                            <Chip level="sub" active={!activeSubcategoryId} onClick={() => onSelect(activeCat, null)}>All</Chip>
                            {subs.map((sub) => (
                                <Chip key={sub.id} level="sub" active={activeSubcategoryId === sub.id} onClick={() => pickSub(sub)}>
                                    {shortLabel(sub.name)}
                                </Chip>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default function CategoryRail({
    categories = [], loading = false,
    activeCategoryId = null, activeSubcategoryId = null,
    compact = false,
    onSelect, onBrowse, className = "",
}) {
    const activeCat = categories.find((c) => c.id === activeCategoryId) || null;
    const subs = activeCat?.subcategories || [];
    const activeSub = subs.find((s) => s.id === activeSubcategoryId) || null;

    if (!loading && categories.length === 0) return null;

    const clearAll = () => onSelect(null, null);
    const compactLabel = activeCat
        ? (activeSub ? `${shortLabel(activeCat.name)} › ${shortLabel(activeSub.name)}` : shortLabel(activeCat.name))
        : "All categories";

    return (
        <nav aria-label="Categories" className={className}>
            <AnimatePresence initial={false} mode="wait">
                {compact ? (
                    <motion.div key="compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP}>
                        <CompactLine label={compactLabel} active={!!activeCat} onBrowse={onBrowse} onClear={clearAll} />
                    </motion.div>
                ) : (
                    <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP}>
                        <FullRail
                            categories={categories}
                            loading={loading}
                            activeCat={activeCat}
                            subs={subs}
                            activeCategoryId={activeCategoryId}
                            activeSubcategoryId={activeSubcategoryId}
                            onSelect={onSelect}
                            onBrowse={onBrowse}
                            onClear={clearAll}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}