// src/components/home/CategorySidebar.jsx
//
//   <CategorySidebar />  desktop (lg+) sticky left column, under the sticky header. Phones / tablets use <CategoryFilterBar /> + <CategorySheet />.
//
// Text only, tight rows. Only the picked category is open by default; the chevron opens or closes any other.
// Long lists get a "Find a category" box (sticky at the top) that filters categories AND subcategories.
// Picking a category filters by the whole category, picking a subcategory narrows it. When a seller / brand
// page is open the list shows only what that seller / brand sells, with a notice and "Show all categories".
//
// onSelect(category, subcategory):
//   onSelect(null, null)  -> everything      onSelect(cat, null) -> whole category
//   onSelect(cat, sub)    -> that subcategory
//
// scope (optional): { shopSlug, brandName, kind: "shop" | "brand", name, onClear }
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ListFilter, Search, X } from "lucide-react";
import useCategoryTree from "../../hooks/useCategoryTree.js";
import { shortLabel } from "../../hooks/useCategories.js";

const C = {
    ink: "#17202E", sub: "#3F4A57", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD",
    notice: "#C9DDF7", hair: "rgba(20,27,34,0.08)", hairSoft: "rgba(20,27,34,0.06)",
};

const SEARCH_MIN_NODES = 15; // categories + subcategories before the search box appears

const ROW = "relative flex w-full items-center rounded-lg text-left outline-none transition-colors duration-150 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50";

// "Showing only what <seller/brand> sells" + the way back to the full list.
function ScopeNotice({ scope }) {
    const isBrand = scope.kind === "brand";
    return (
        <div role="status" className="mb-2.5 rounded-xl border px-3 py-2.5" style={{ background: C.activeBg, borderColor: C.notice }}>
            <div className="flex items-start gap-2">
                <ListFilter className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.accent }} strokeWidth={2.4} />
                <p className="min-w-0 text-[12px] font-semibold leading-snug tracking-wide" style={{ color: C.ink }}>
                    {isBrand ? "Categories shown are based on " : "Categories shown are based on what "}
                    <b className="font-extrabold" style={{ color: C.accent, overflowWrap: "anywhere" }}>{scope.name}</b>
                    {isBrand ? " products." : " sells."}
                </p>
            </div>
            <button
                type="button"
                onClick={scope.onClear}
                className="mt-2 w-full rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold tracking-wide transition hover:bg-[#F4F8FE] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                style={{ color: C.accent }}
            >
                Show all categories
            </button>
        </div>
    );
}

function Skeleton() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-3 py-2">
                    <div className="h-3 w-36 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.hairSoft }} />
                </li>
            ))}
        </>
    );
}

export function CategoryList({ activeCategoryId, activeSubcategoryId, onSelect, scope = null }) {
    const { categories, loading, error, retry } = useCategoryTree({
        shopSlug: scope?.shopSlug || null,
        brandName: scope?.brandName || null,
    });

    // Open categories. Starts with just the picked one.
    const [expanded, setExpanded] = useState(() => new Set(activeCategoryId ? [activeCategoryId] : []));
    const toggle = useCallback((id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);
    const expand = useCallback((id) => {
        setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }, []);

    // Whatever becomes the picked category (rail chip, sidebar, URL) opens its subcategories.
    useEffect(() => { if (activeCategoryId) expand(activeCategoryId); }, [activeCategoryId, expand]);

    const pickCategory = (cat) => {
        expand(cat.id);
        const isOnlyThis = activeCategoryId === cat.id && !activeSubcategoryId;
        onSelect(isOnlyThis ? null : cat, null);          // tapping the active category clears it
    };
    const pickSub = (cat, sub) => {
        onSelect(cat, activeSubcategoryId === sub.id ? null : sub); // tapping the active subcategory goes back to the category
    };

    const allActive = !activeCategoryId;

    // Search (long lists only). Matches category and subcategory names; a matching category keeps all its subcategories.
    const [q, setQ] = useState("");
    const term = q.trim().toLowerCase();
    const all = categories || [];
    const nodeCount = all.reduce((n, c) => n + 1 + (c.subcategories || []).length, 0);
    const showSearch = !loading && !error && nodeCount >= SEARCH_MIN_NODES;
    const list = useMemo(() => {
        if (!term) return categories || [];
        return (categories || []).map((c) => {
            if (c.name.toLowerCase().includes(term)) return c;
            const m = (c.subcategories || []).filter((s) => s.name.toLowerCase().includes(term));
            return m.length ? { ...c, subcategories: m } : null;
        }).filter(Boolean);
    }, [categories, term]);

    return (
        <nav aria-label="Categories">
            {scope && <ScopeNotice scope={scope} />}
            {showSearch && (
                <div className="sticky top-0 z-10 bg-white pb-2 pt-0.5">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} strokeWidth={2.2} />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Find a category"
                            aria-label="Find a category"
                            autoComplete="off"
                            className="h-9 w-full rounded-lg border bg-[#F6F8FA] pl-8 pr-8 text-[13px] font-semibold tracking-wide outline-none placeholder:text-[#8A94A0] focus:border-[#0765CD] focus:bg-white focus:ring-2 focus:ring-[#0765CD]/20"
                            style={{ borderColor: C.hair, color: C.ink }}
                        />
                        {q && (
                            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/[0.06]">
                                <X className="h-3.5 w-3.5" style={{ color: C.muted }} strokeWidth={2.4} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            <ul className="flex flex-col gap-px">
                {!term && (
                    <li>
                        <button
                            type="button"
                            onClick={() => onSelect(null, null)}
                            aria-current={allActive ? "true" : undefined}
                            className={`${ROW} px-3 py-2 text-[13.5px] leading-tight tracking-wide`}
                            style={{ background: allActive ? C.activeBg : undefined, color: allActive ? C.accent : C.ink, fontWeight: allActive ? 800 : 600 }}
                        >
                            <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full transition-opacity duration-150" style={{ background: C.accent, opacity: allActive ? 1 : 0 }} />
                            All categories
                        </button>
                    </li>
                )}

                {loading ? (
                    <Skeleton />
                ) : error ? (
                    <li className="px-3 py-4 text-center">
                        <p className="text-[12.5px] font-bold" style={{ color: C.ink }}>Couldn't load categories.</p>
                        <button
                            type="button"
                            onClick={retry}
                            className="mt-2 rounded-full px-3.5 py-1.5 text-[12px] font-extrabold tracking-wide text-white"
                            style={{ background: C.accent }}
                        >
                            Try again
                        </button>
                    </li>
                ) : all.length === 0 ? (
                    <li className="px-3 py-4 text-center text-[12.5px] font-semibold" style={{ color: C.muted }}>
                        {scope ? "Nothing to filter here yet." : "No categories yet."}
                    </li>
                ) : list.length === 0 ? (
                    <li className="px-3 py-4 text-center text-[12.5px] font-semibold" style={{ color: C.muted }}>
                        No category matches “{q.trim()}”.
                    </li>
                ) : (
                    list.map((cat) => {
                        const subs = cat.subcategories || [];
                        const isCat = activeCategoryId === cat.id;
                        const catOnly = isCat && !activeSubcategoryId;      // whole category selected
                        const open = term ? true : expanded.has(cat.id);

                        return (
                            <li key={cat.id}>
                                <div className="flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => pickCategory(cat)}
                                        aria-current={catOnly ? "true" : undefined}
                                        className={`${ROW} min-w-0 flex-1 px-3 py-2 text-[13.5px] leading-tight tracking-wide`}
                                        style={{ background: catOnly ? C.activeBg : undefined, color: isCat ? C.accent : C.ink, fontWeight: isCat ? 800 : 600 }}
                                    >
                                        <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full transition-opacity duration-150" style={{ background: C.accent, opacity: isCat ? 1 : 0 }} />
                                        <span className="min-w-0 flex-1">{shortLabel(cat.name)}</span>
                                    </button>
                                    {subs.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => toggle(cat.id)}
                                            aria-expanded={open}
                                            aria-label={`${open ? "Collapse" : "Expand"} ${shortLabel(cat.name)} subcategories`}
                                            className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                                        >
                                            <ChevronDown
                                                className="h-4 w-4 transition-transform duration-200 motion-reduce:transition-none"
                                                style={{ color: C.muted, transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                                                strokeWidth={2.4}
                                            />
                                        </button>
                                    )}
                                </div>

                                {subs.length > 0 && (
                                    <div
                                        className="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none"
                                        style={{ gridTemplateRows: open ? "1fr" : "0fr", visibility: open ? "visible" : "hidden" }}
                                    >
                                        <ul className="ml-3 min-h-0 overflow-hidden border-l pl-1" style={{ borderColor: C.hair }}>
                                            {subs.map((sub) => {
                                                const subActive = isCat && activeSubcategoryId === sub.id;
                                                return (
                                                    <li key={sub.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => pickSub(cat, sub)}
                                                            aria-current={subActive ? "true" : undefined}
                                                            className={`${ROW} px-2.5 py-1.5 text-[12.5px] leading-snug tracking-wide`}
                                                            style={{ background: subActive ? C.activeBg : undefined, color: subActive ? C.accent : C.sub, fontWeight: subActive ? 800 : 600 }}
                                                        >
                                                            {shortLabel(sub.name)}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        );
                    })
                )}
            </ul>
        </nav>
    );
}

export default function CategorySidebar({ activeCategoryId, activeSubcategoryId, onSelect, scope = null }) {
    return (
        <aside
            aria-label="Browse categories"
            data-lenis-prevent
            className="hidden w-[232px] shrink-0 overflow-y-auto overscroll-contain border-r pb-24 pr-3 pt-3 [scrollbar-width:thin] lg:sticky lg:top-[var(--bbm-header-h,78px)] lg:block lg:h-[calc(100dvh-var(--bbm-header-h,78px))] xl:w-[248px]"
            style={{ borderColor: C.hair }}
        >
            <h2 className="px-3 ps-1 pb-1.5 text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>
                Categories
            </h2>
            <CategoryList
                activeCategoryId={activeCategoryId}
                activeSubcategoryId={activeSubcategoryId}
                onSelect={onSelect}
                scope={scope}
            />
        </aside>
    );
}