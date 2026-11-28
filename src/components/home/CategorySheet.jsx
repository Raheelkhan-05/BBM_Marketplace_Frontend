// src/components/home/CategorySheet.jsx
//
// Category picker for phones / tablets, opened from <CategoryFilterBar />. Built for 50+ categories:
//
//   ┌ Categories                                  ✕ ┐
//   │ 🔍 Find a category or subcategory             │
//   ├───────────────┬───────────────────────────────┤
//   │ All categories│ All in Lubricant & Industrial │
//   │ Automotive  › │ Engine oil                  ✓ │
//   │ Chemical    › │ Industrial & Automotive Grease│
//   │ Lubricant   › │ …                             │   both panes scroll on their own
//   │ Packaging   › │                               │
//   └───────────────┴───────────────────────────────┘
//
// - Left pane: categories (long names wrap). A category with subcategories (›) shows them on the right;
//   one without subcategories is applied at once. A blue dot marks the category that is currently applied.
// - Typing in the search box swaps both panes for one flat list of matching categories and subcategories.
// - Close: drag the top bar down, tap the backdrop, ✕, or Escape. The page behind is locked and the bottom dock
//   hides itself (it hides for any aria-modal dialog).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Check, ChevronRight, Search, X } from "lucide-react";
import { shortLabel } from "../../hooks/useCategories.js";

const C = {
    ink: "#17202E", sub: "#3F4A57", muted: "#5B6575", accent: "#0765CD", activeBg: "#EAF2FD",
    hair: "rgba(20,27,34,0.08)", pane: "#F3F5F8", soft: "rgba(20,27,34,0.06)",
};
const EASE = [0.16, 1, 0.3, 1];
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0765CD]/60";

function Row({ active, onClick, children, sub = null }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? "true" : undefined}
            className={`flex w-full items-center gap-2 px-4 py-3 text-left tracking-wide transition-colors duration-150 active:bg-black/[0.04] ${FOCUS}`}
            style={{ background: active ? C.activeBg : "transparent" }}
        >
            <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-snug" style={{ color: active ? C.accent : C.ink, fontWeight: active ? 800 : 600 }}>{children}</span>
                {sub && <span className="mt-0.5 block text-[11.5px] font-semibold leading-tight" style={{ color: C.muted }}>{sub}</span>}
            </span>
            {active && <Check className="h-4 w-4 shrink-0" style={{ color: C.accent }} strokeWidth={2.8} aria-hidden="true" />}
        </button>
    );
}

export default function CategorySheet({
    open, onClose, categories = [], loading = false, error = null, onRetry,
    activeCategory, activeSubcategory, scope, onSelect,
}) {
    const controls = useDragControls();
    const panelRef = useRef(null);
    const paneRowRef = useRef(null);
    const [q, setQ] = useState("");
    const [pane, setPane] = useState(null);   // category whose subcategories show on the right

    useEffect(() => { if (open) { setQ(""); setPane(null); } }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const raf = requestAnimationFrame(() => {
            panelRef.current?.focus({ preventScroll: true });
            paneRowRef.current?.scrollIntoView({ block: "center" });
        });
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
            cancelAnimationFrame(raf);
        };
    }, [open, onClose]);

    if (typeof document === "undefined") return null;

    const paneId = pane ?? activeCategory?.id ?? categories[0]?.id ?? null;
    const paneCat = categories.find((c) => c.id === paneId) || null;
    const paneSubs = paneCat?.subcategories || [];

    const term = q.trim().toLowerCase();
    const results = term
        ? categories.flatMap((c) => {
            const out = [];
            if (c.name.toLowerCase().includes(term)) out.push({ key: `c${c.id}`, cat: c, sub: null });
            (c.subcategories || []).forEach((s) => {
                if (s.name.toLowerCase().includes(term)) out.push({ key: `s${s.id}`, cat: c, sub: s });
            });
            return out;
        })
        : null;

    const tapCategory = (c) => {
        if ((c.subcategories || []).length > 0) setPane(c.id);
        else onSelect(c, null);
    };

    let body;
    if (loading && categories.length === 0) {
        body = (
            <div className="space-y-3 p-4">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-4 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: C.soft, width: `${60 + ((i * 13) % 35)}%` }} />
                ))}
            </div>
        );
    } else if (error && categories.length === 0) {
        body = (
            <div className="px-6 py-12 text-center">
                <p className="text-[13.5px] font-bold" style={{ color: C.ink }}>Couldn't load categories.</p>
                <button type="button" onClick={onRetry} className="mt-3 rounded-full px-4 py-2 text-[13px] font-extrabold tracking-wide text-white" style={{ background: C.accent }}>
                    Try again
                </button>
            </div>
        );
    } else if (results) {
        body = (
            <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
                {results.length === 0 ? (
                    <p className="px-6 py-12 text-center text-[13.5px] font-semibold" style={{ color: C.muted }}>No category matches “{q.trim()}”.</p>
                ) : (
                    <ul className="divide-y" style={{ borderColor: C.hair }}>
                        {results.map((r) => (
                            <li key={r.key}>
                                <Row
                                    active={r.sub
                                        ? activeSubcategory?.id === r.sub.id
                                        : activeCategory?.id === r.cat.id && !activeSubcategory}
                                    sub={r.sub ? `in ${shortLabel(r.cat.name)}` : "Category"}
                                    onClick={() => onSelect(r.cat, r.sub)}
                                >
                                    {shortLabel((r.sub || r.cat).name)}
                                </Row>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    } else {
        body = (
            <div className="flex min-h-0 flex-1 border-t" style={{ borderColor: C.hair }}>
                <div data-lenis-prevent className="w-[40%] max-w-[220px] shrink-0 overflow-y-auto overscroll-contain" style={{ background: C.pane, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
                    <button
                        type="button"
                        onClick={() => onSelect(null, null)}
                        aria-current={!activeCategory ? "true" : undefined}
                        className={`relative flex w-full items-center px-3 py-3 text-left text-[13px] leading-snug tracking-wide ${FOCUS}`}
                        style={{ background: !activeCategory ? "#fff" : "transparent", color: !activeCategory ? C.accent : C.ink, fontWeight: !activeCategory ? 800 : 600 }}
                    >
                        All categories
                    </button>
                    {categories.map((c) => {
                        const isPane = c.id === paneId;
                        const isFilter = activeCategory?.id === c.id;
                        const hasSubs = (c.subcategories || []).length > 0;
                        return (
                            <button
                                key={c.id}
                                ref={isPane ? paneRowRef : undefined}
                                type="button"
                                onClick={() => tapCategory(c)}
                                aria-current={isPane ? "true" : undefined}
                                className={`relative flex w-full items-center gap-1.5 px-3 py-3 text-left text-[13px] leading-snug tracking-wide ${FOCUS}`}
                                style={{ background: isPane ? "#fff" : "transparent", color: isPane || isFilter ? C.accent : C.ink, fontWeight: isPane ? 800 : 600 }}
                            >
                                {isPane && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full" style={{ background: C.accent }} />}
                                <span className="min-w-0 flex-1" style={{ overflowWrap: "anywhere" }}>{shortLabel(c.name)}</span>
                                {isFilter && <span aria-label="applied" className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.accent }} />}
                                {hasSubs && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-45" strokeWidth={2.6} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>

                <div data-lenis-prevent className="min-w-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
                    {paneCat && (
                        <ul className="divide-y" style={{ borderColor: C.hair }}>
                            <li>
                                <Row active={activeCategory?.id === paneCat.id && !activeSubcategory} onClick={() => onSelect(paneCat, null)}>
                                    All in {shortLabel(paneCat.name)}
                                </Row>
                            </li>
                            {paneSubs.map((s) => (
                                <li key={s.id}>
                                    <Row active={activeSubcategory?.id === s.id} onClick={() => onSelect(paneCat, s)}>
                                        {shortLabel(s.name)}
                                    </Row>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    }

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="bd"
                        aria-hidden="true"
                        className="fixed inset-0 z-[9994] bg-black/40"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    <motion.div
                        key="sheet"
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Choose a category"
                        tabIndex={-1}
                        className="fixed inset-x-0 bottom-0 z-[9995] mx-auto flex h-[82dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] outline-none"
                        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                        transition={{ duration: 0.28, ease: EASE }}
                        drag="y"
                        dragControls={controls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 650) onClose(); }}
                    >
                        <div className="shrink-0 px-4 pb-3 pt-2" style={{ touchAction: "none" }} onPointerDown={(e) => controls.start(e)}>
                            <div className="mx-auto h-1 w-10 rounded-full" style={{ background: "rgba(20,27,34,0.18)" }} />
                            <div className="mt-2 flex items-center justify-between">
                                <h2 className="text-[18px] font-extrabold tracking-wide" style={{ color: C.ink }}>Categories</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    aria-label="Close"
                                    className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full outline-none hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
                                >
                                    <X className="h-5 w-5" style={{ color: C.ink }} />
                                </button>
                            </div>
                        </div>

                        {/* Search. 16px text so iOS doesn't zoom the page on focus. */}
                        <div className="relative shrink-0 px-4 pb-3" onPointerDown={(e) => e.stopPropagation()}>
                            <Search className="pointer-events-none absolute left-7 top-[calc(50%-6px)] h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} strokeWidth={2.2} />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Find a category or subcategory"
                                aria-label="Find a category or subcategory"
                                autoComplete="off"
                                className="h-11 w-full rounded-xl border bg-[#F6F8FA] pl-10 pr-10 text-[16px] font-semibold tracking-wide outline-none placeholder:text-[#8A94A0] focus:border-[#0765CD] focus:bg-white focus:ring-2 focus:ring-[#0765CD]/20"
                                style={{ borderColor: C.hair, color: C.ink }}
                            />
                            {q && (
                                <button
                                    type="button"
                                    onClick={() => setQ("")}
                                    aria-label="Clear search"
                                    className="absolute right-6 top-[calc(50%-6px)] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/[0.06]"
                                >
                                    <X className="h-4 w-4" style={{ color: C.muted }} strokeWidth={2.4} />
                                </button>
                            )}
                        </div>

                        {scope && (
                            <div className="mx-4 mb-3 flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: C.activeBg }}>
                                <span className="min-w-0 truncate text-[12.5px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                    Based on <b className="font-extrabold" style={{ color: C.accent }}>{scope.name}</b>
                                </span>
                                <button type="button" onClick={scope.onClear} className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-extrabold tracking-wide active:scale-95" style={{ color: C.accent }}>
                                    Show all
                                </button>
                            </div>
                        )}

                        {body}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}