// src/components/home/CategorySidebar.jsx
//
//   <CategorySidebar />  desktop (lg+) sticky left column, sits under the sticky header
//   <CategoryList />     the bare list, also used inside the header's mobile drawer
//
// Each category lists its subcategories underneath (collapsible). Picking a category filters by the
// whole category, picking a subcategory narrows it further. When a seller / brand page is open the
// list shows only what that seller / brand sells, with a notice and a one-tap "Show all categories".
//
// onSelect(category, subcategory):
//   onSelect(null, null)  -> everything      onSelect(cat, null) -> whole category
//   onSelect(cat, sub)    -> that subcategory
//
// scope (optional): { shopSlug, brandName, kind: "shop" | "brand", name, onClear }
import { useCallback, useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import useCategoryTree from "../../hooks/useCategoryTree.js";
import { shortLabel } from "../../hooks/useCategories.js";
import { AllIcon, CategoryIcon } from "./CategoryIcons.jsx";

const C = {
    ink: "#17202E", sub: "#3F4A57", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD",
    notice: "#C9DDF7", hair: "rgba(20,27,34,0.08)", hairSoft: "rgba(20,27,34,0.06)", dot: "rgba(20,27,34,0.2)",
};

// "Showing only what <seller/brand> sells" + the way back to the full list.
function ScopeNotice({ scope }) {
    const isBrand = scope.kind === "brand";
    return (
        <div role="status" className="mb-3 rounded-xl border px-3 py-2.5" style={{ background: C.activeBg, borderColor: C.notice }}>
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

function AllRow({ active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? "true" : undefined}
            className="group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
            style={{ background: active ? C.activeBg : undefined }}
        >
            <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full transition-opacity duration-150" style={{ background: C.accent, opacity: active ? 1 : 0 }} />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <AllIcon active={active} />
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-tight tracking-wide" style={{ color: active ? C.accent : C.ink, fontWeight: active ? 800 : 600 }}>
                All categories
            </span>
        </button>
    );
}

function Skeleton() {
    return (
        <>
            {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="pb-2">
                    <div className="flex items-center gap-3 px-2.5 py-2">
                        <div className="h-8 w-8 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.hairSoft }} />
                        <div className="h-3 w-32 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.hairSoft }} />
                    </div>
                    <div className="ml-[22px] space-y-2 border-l py-1 pl-4" style={{ borderColor: C.hair }}>
                        <div className="h-2.5 w-28 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.hairSoft }} />
                        <div className="h-2.5 w-24 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.hairSoft }} />
                    </div>
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
    const [collapsed, setCollapsed] = useState(() => new Set());

    const toggle = useCallback((id) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);
    const expand = useCallback((id) => {
        setCollapsed((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const pickCategory = (cat) => {
        expand(cat.id);
        const isOnlyThis = activeCategoryId === cat.id && !activeSubcategoryId;
        onSelect(isOnlyThis ? null : cat, null);          // tapping the active category clears it
    };
    const pickSub = (cat, sub) => {
        onSelect(cat, activeSubcategoryId === sub.id ? null : sub); // tapping the active subcategory goes back to the category
    };

    const allActive = !activeCategoryId;

    return (
        <nav aria-label="Categories">
            {scope && <ScopeNotice scope={scope} />}
            <ul className="flex flex-col gap-0.5">
                <li><AllRow active={allActive} onClick={() => onSelect(null, null)} /></li>

                {loading ? (
                    <Skeleton />
                ) : error ? (
                    <li className="px-2.5 py-4 text-center">
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
                ) : categories.length === 0 ? (
                    <li className="px-2.5 py-4 text-center text-[12.5px] font-semibold" style={{ color: C.muted }}>
                        {scope ? "Nothing to filter here yet." : "No categories yet."}
                    </li>
                ) : (
                    categories.map((cat) => {
                        const subs = cat.subcategories || [];
                        const isCat = activeCategoryId === cat.id;
                        const catOnly = isCat && !activeSubcategoryId;      // whole category selected
                        const highlighted = isCat;                          // category or one of its subs selected
                        const open = !collapsed.has(cat.id);

                        return (
                            <li key={cat.id}>
                                <div
                                    className="relative flex items-center rounded-xl transition-colors duration-150 hover:bg-black/[0.04]"
                                    style={{ background: catOnly ? C.activeBg : undefined }}
                                >
                                    <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full transition-opacity duration-150" style={{ background: C.accent, opacity: highlighted ? 1 : 0 }} />
                                    <button
                                        type="button"
                                        onClick={() => pickCategory(cat)}
                                        aria-current={catOnly ? "true" : undefined}
                                        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-110">
                                            <CategoryIcon name={cat.name} slug={cat.slug} active={highlighted} />
                                        </span>
                                        <span className="min-w-0 flex-1 text-[13.5px] leading-tight tracking-wide" style={{ color: highlighted ? C.accent : C.ink, fontWeight: highlighted ? 800 : 600 }}>
                                            {shortLabel(cat.name)}
                                        </span>
                                    </button>
                                    {subs.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => toggle(cat.id)}
                                            aria-expanded={open}
                                            aria-label={`${open ? "Collapse" : "Expand"} ${shortLabel(cat.name)} subcategories`}
                                            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
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
                                        <ul className="ml-[22px] min-h-0 overflow-hidden border-l pl-1.5" style={{ borderColor: C.hair }}>
                                            {subs.map((sub) => {
                                                const subActive = isCat && activeSubcategoryId === sub.id;
                                                return (
                                                    <li key={sub.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => pickSub(cat, sub)}
                                                            aria-current={subActive ? "true" : undefined}
                                                            className="flex w-full items-center gap-2 rounded-lg py-1.5 pl-2.5 pr-2 text-left text-[12.5px] leading-snug tracking-wide outline-none transition-colors duration-150 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                                                            style={{ background: subActive ? C.activeBg : undefined, color: subActive ? C.accent : C.sub, fontWeight: subActive ? 800 : 600 }}
                                                        >
                                                            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subActive ? C.accent : C.dot }} />
                                                            <span className="min-w-0 flex-1">{shortLabel(sub.name)}</span>
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
            className="hidden w-[248px] shrink-0 overflow-y-auto overscroll-contain border-r pb-24 pr-3 pt-3 [scrollbar-width:thin] lg:sticky lg:top-[var(--bbm-header-h,78px)] lg:block lg:h-[calc(100dvh-var(--bbm-header-h,78px))] xl:w-[264px]"
            style={{ borderColor: C.hair }}
        >
            <h2 className="px-2.5 pb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
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