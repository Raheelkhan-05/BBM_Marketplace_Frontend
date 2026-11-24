// src/components/home/CategorySidebar.jsx
//
//   <CategorySidebar />  desktop (lg+) sticky left column, sits under the sticky header
//   <CategoryList />     the bare list, also used inside the header's mobile drawer
import useCategories, { shortLabel } from "../../hooks/useCategories.js";
import { AllIcon, CategoryIcon } from "./CategoryIcons.jsx";

const C = { ink: "#17202E", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD", hair: "rgba(20,27,34,0.08)", hairSoft: "rgba(20,27,34,0.06)" };

function Row({ active, label, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? "true" : undefined}
            className="group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
            style={{ background: active ? C.activeBg : undefined }}
        >
            <span
                aria-hidden
                className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full transition-opacity duration-150"
                style={{ background: C.accent, opacity: active ? 1 : 0 }}
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-110">
                {children}
            </span>
            <span
                className="min-w-0 flex-1 text-[13.5px] leading-tight tracking-wide"
                style={{ color: active ? C.accent : C.ink, fontWeight: active ? 800 : 600 }}
            >
                {label}
            </span>
        </button>
    );
}

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="h-8 w-8 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            <div className="h-3 w-32 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

export function CategoryList({ activeCategoryId, onSelect }) {
    const { items, loading } = useCategories();
    const allActive = !activeCategoryId;
    return (
        <nav aria-label="Categories">
            <ul className="flex flex-col gap-0.5">
                <li>
                    <Row active={allActive} label="All categories" onClick={() => onSelect(null)}>
                        <AllIcon active={allActive} />
                    </Row>
                </li>
                {loading && items.length === 0
                    ? Array.from({ length: 7 }).map((_, i) => <li key={i}><RowSkeleton /></li>)
                    : items.map((cat) => {
                        const active = activeCategoryId === cat.id;
                        return (
                            <li key={cat.id}>
                                <Row active={active} label={shortLabel(cat.name)} onClick={() => onSelect(active ? null : cat)}>
                                    <CategoryIcon name={cat.name} slug={cat.slug} active={active} />
                                </Row>
                            </li>
                        );
                    })}
            </ul>
        </nav>
    );
}

export default function CategorySidebar({ activeCategoryId, onSelect }) {
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
            <CategoryList activeCategoryId={activeCategoryId} onSelect={onSelect} />
        </aside>
    );
}