// src/components/home/CategoryFilterBar.jsx
//
// Mobile / tablet (< lg): ONE 40px selector row at the top of the feed. Scales to any number of categories,
// because the list itself lives in <CategorySheet /> (searchable, two panes).
//
//   [ Category | All categories        ⌄ ]                     nothing picked
//   [ Category | Lubricant › Engine oil ⌄ ] [ ✕ ]              a filter is active (tinted + clear button)
//
// The label "Category" + the chevron make it read as a dropdown; the value shows what is applied right now.
import { ChevronDown, X } from "lucide-react";
import { filterLabel } from "../../hooks/useCategories.js";

const C = { ink: "#17202E", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD", line: "rgba(20,27,34,0.18)", soft: "rgba(20,27,34,0.06)" };

export default function CategoryFilterBar({
    loading = false, hasCategories = true,
    activeCategory = null, activeSubcategory = null,
    onOpen, onClear, className = "",
}) {
    if (loading && !hasCategories) {
        return <div aria-hidden className={`h-10 animate-pulse rounded-xl motion-reduce:animate-none ${className}`} style={{ background: C.soft }} />;
    }
    if (!hasCategories) return null;

    const active = !!activeCategory;
    const value = active ? filterLabel(activeCategory, activeSubcategory) : "All categories";

    return (
        <div className={`flex items-stretch gap-2 ${className}`}>
            <button
                type="button"
                onClick={onOpen}
                aria-haspopup="dialog"
                aria-label={active ? `Category: ${value}. Change category` : "Category: all categories. Choose a category"}
                className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 text-left outline-none transition-colors duration-150 active:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                style={{ background: active ? C.activeBg : "#fff", borderColor: active ? C.accent : C.line }}
            >
                <span className="shrink-0 text-[12.5px] font-semibold tracking-wide" style={{ color: active ? C.accent : C.muted }}>Category</span>
                <span aria-hidden className="h-4 w-px shrink-0" style={{ background: active ? "rgba(7,101,205,0.3)" : C.line }} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold tracking-wide" style={{ color: active ? C.accent : C.ink }}>{value}</span>
                <ChevronDown className="h-4 w-4 shrink-0" style={{ color: active ? C.accent : C.muted }} strokeWidth={2.4} aria-hidden="true" />
            </button>
            {active && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear category filter"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                    style={{ borderColor: C.line }}
                >
                    <X className="h-4 w-4" style={{ color: C.ink }} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}