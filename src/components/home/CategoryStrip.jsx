// components/home/CategoryStrip.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { searchCategories } from "../../utils/api";
import { supabase } from "../../utils/supabaseClient";
import { AllIcon, CategoryIcon } from "./CategoryIcons.jsx";

const C = {
    ink: "#4A5560",
    accent: "#0765CD",
    hairSoft: "rgba(20,27,34,0.07)",
};
const EASE = [0.16, 1, 0.3, 1];
const EASE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

// Tuning knobs — change these numbers to resize the whole strip.
const ICON_PX = 30;   // icon artwork size (expanded strip)
const ITEM_W_PX = 84; // width of each category cell (label wraps inside this)

// Collapse behaviour knobs.
const COLLAPSE_AFTER_PX = 48; // scroll DOWN this far (while stuck) -> collapse
const EXPAND_AFTER_PX = 56;   // scroll UP this far -> expand again
const ANIM_MS = 260;          // collapse/expand animation length
const LOCK_MS = 340;          // ignore scroll input this long after a change (> ANIM_MS)

const CACHE_KEY = "bbm_category_strip_cache_v1";

// The "Pending" category is a placeholder/default bucket, not something a
// shopper should ever be able to select from the strip — filter it out by
// name wherever the category list is built or updated below.
function isHiddenCategory(name) {
    return typeof name === "string" && name.trim().toLowerCase() === "pending";
}

// Display-only shortening: "Automotive and engineering" -> "Automotive & engineering".
// Matches "and" as a whole word only (so "Android" is safe) and never touches
// the real category name stored in the database / used for filtering.
function shortLabel(name) {
    return String(name ?? "").replace(/\band\b/gi, "&").replace(/\s{2,}/g, " ").trim();
}

function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
function writeCache(items) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch {
        // storage full/unavailable — just skip caching, not fatal
    }
}

// Inserts/updates one category into an already name-sorted list, keeping
// it sorted — same order the backend query uses (.order("name")) — so a
// live-added category lands in its correct alphabetical slot instead of
// just being appended at the end.
function upsertSorted(list, category) {
    const withoutExisting = list.filter((c) => c.id !== category.id);
    const idx = withoutExisting.findIndex(
        (c) => c.name.localeCompare(category.name, undefined, { sensitivity: "base" }) > 0
    );
    if (idx === -1) return [...withoutExisting, category];
    return [...withoutExisting.slice(0, idx), category, ...withoutExisting.slice(idx)];
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLAPSE-ON-SCROLL
//
// How it stays glitch-free:
//  • It only collapses while the sticky toolbar is actually STUCK to the top.
//    Before that the strip is in normal page flow, so shrinking it would just
//    shove the page around. Near the top of the page it is always expanded.
//  • Direction is decided from an accumulated scroll distance with a reset on
//    direction change (48px down to collapse, 56px up to expand), so tiny
//    jitters, trackpad bounce and Lenis smoothing can't flip it.
//  • After every change it ignores scroll input for LOCK_MS. Collapsing shrinks
//    the page, which can nudge scrollY; that nudge must never be read as the
//    user scrolling the other way (that is what causes flicker loops).
//  • Browser scroll anchoring is switched off while the strip is mounted, so
//    the browser doesn't fight Lenis by "correcting" scroll when the height
//    changes.
// ─────────────────────────────────────────────────────────────────────────────
function findStickyAncestor(el) {
    let node = el?.parentElement;
    while (node && node !== document.body) {
        if (getComputedStyle(node).position === "sticky") return node;
        node = node.parentElement;
    }
    return null;
}

function useScrollCollapse(rootRef) {
    const [collapsed, setCollapsed] = useState(false);
    const s = useRef({ collapsed: false, lastY: 0, acc: 0, lockUntil: 0 });

    const apply = useCallback((next) => {
        const st = s.current;
        if (st.collapsed === next) return;
        st.collapsed = next;
        st.acc = 0;
        st.lockUntil = performance.now() + LOCK_MS;
        setCollapsed(next);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const prev = root.style.overflowAnchor;
        root.style.overflowAnchor = "none";
        return () => { root.style.overflowAnchor = prev; };
    }, []);

    useEffect(() => {
        const st = s.current;
        st.lastY = window.scrollY;
        const sticky = findStickyAncestor(rootRef.current);
        let raf = 0;

        const isStuck = () => {
            if (!sticky) return window.scrollY > 160; // not inside a sticky block: simple fallback
            const top = parseFloat(getComputedStyle(sticky).top) || 0;
            return sticky.getBoundingClientRect().top <= top + 1;
        };

        const tick = () => {
            raf = 0;
            const y = Math.max(0, window.scrollY);
            const dy = y - st.lastY;
            st.lastY = y;

            if (performance.now() < st.lockUntil) { st.acc = 0; return; }

            // Top of the page / toolbar not stuck yet: always show the full strip.
            if (y <= 2 || !isStuck()) {
                st.acc = 0;
                if (st.collapsed) apply(false);
                return;
            }

            if (dy === 0) return;
            if ((dy > 0 && st.acc < 0) || (dy < 0 && st.acc > 0)) st.acc = 0; // direction changed
            st.acc += dy;

            if (!st.collapsed && st.acc >= COLLAPSE_AFTER_PX) apply(true);
            else if (st.collapsed && st.acc <= -EXPAND_AFTER_PX) apply(false);
        };

        const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [apply, rootRef]);

    const expand = useCallback(() => apply(false), [apply]);
    return { collapsed, expand };
}

// Cross-fading, height-animating layer. Uses the grid 0fr <-> 1fr trick, so
// there's no JS height measuring and the strip's real height is always right,
// even when labels wrap to a different number of lines.
function layerStyle(visible, ms) {
    return {
        gridTemplateRows: visible ? "1fr" : "0fr",
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        transition: `grid-template-rows ${ms}ms ${EASE_CSS}, opacity ${Math.round(ms * 0.7)}ms ease ${visible ? Math.round(ms * 0.15) : 0}ms, visibility 0s linear ${visible ? 0 : ms}ms`,
    };
}

// Paytm-style cell: bare icon on top, centred label underneath, no box.
// The label wraps to as many lines as needed (balanced, so "Lubricant &
// Industrial Oil" breaks evenly) — names are never truncated.
// Active state = blue bold label + blue underline bar.
function CategoryItem({ active, onClick, label, children, motionProps = {} }) {
    const text = shortLabel(label);
    return (
        <motion.button
            type="button"
            onClick={onClick}
            whileTap={{ scale: 0.95 }}
            aria-pressed={active}
            title={text}
            className="group relative flex shrink-0 snap-start flex-col items-center gap-[5px] px-1 pb-2 pt-1 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-black/40 mb-2"
            style={{ width: ITEM_W_PX }}
            {...motionProps}
        >
            <span
                className="flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110"
                style={{ width: ICON_PX, height: ICON_PX }}
            >
                {children}
            </span>
            <span
                className="w-full text-center text-[11px] leading-[1.2] tracking-wide transition-colors duration-150"
                style={{
                    color: active ? C.accent : C.ink,
                    fontWeight: active ? 700 : 600,
                    textWrap: "balance",
                    wordBreak: "break-word",
                }}
            >
                {text}
            </span>
            <span
                aria-hidden
                className="absolute inset-x-5 bottom-0 h-[2.5px] origin-center rounded-full transition-transform duration-200"
                style={{
                    background: C.accent,
                    transform: active ? "scaleX(1)" : "scaleX(0)",
                }}
            />
        </motion.button>
    );
}

function ItemSkeleton() {
    return (
        <div
            className="flex shrink-0 flex-col items-center gap-[5px] px-1 pb-2 pt-1"
            style={{ width: ITEM_W_PX }}
        >
            <div
                className="animate-pulse rounded-full"
                style={{ width: ICON_PX, height: ICON_PX, background: C.hairSoft }}
            />
            <div className="h-2.5 w-14 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

function ArrowButton({ dir, onClick }) {
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={dir < 0 ? "Scroll categories left" : "Scroll categories right"}
            className={`absolute z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700 shadow-md transition hover:scale-105 hover:bg-slate-50 active:scale-95 md:flex ${dir < 0 ? "left-1.5" : "right-1.5"
                }`}
            // vertically centred on the icon row (not the label)
            style={{ top: 6 + 4 + ICON_PX / 2 }}
        >
            <Icon size={16} strokeWidth={2.5} />
        </button>
    );
}

// Collapsed state: ONE row — active category icon on the left, its name on the
// right, chevron at the end. Tapping it re-opens the full strip.
function CompactBar({ category, onExpand }) {
    const label = category ? shortLabel(category.name) : "All categories";
    return (
        <button
            type="button"
            onClick={onExpand}
            aria-expanded={false}
            aria-label={`${label}. Show all categories`}
            className="group flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-black/40"
        >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                {/* {category ? <CategoryIcon name={category.name} slug={category.slug} /> : <AllIcon />} */}
                {category ? <CategoryIcon name={category.name} slug={category.slug} active /> : <AllIcon active />}
            </span>
            <span
                className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold tracking-wide"
                style={{ color: category ? C.accent : C.ink }}
            >
                {label}
            </span>
            <ChevronDown
                size={16}
                strokeWidth={2.5}
                className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-y-0.5"
                aria-hidden
            />
        </button>
    );
}

export default function CategoryStrip({ activeCategoryId, onSelect }) {
    const cached = readCache();
    const [categories, setCategories] = useState(cached || []);
    const [loading, setLoading] = useState(!cached);

    const rootRef = useRef(null);
    const expandedRef = useRef(null);
    const compactRef = useRef(null);
    const scrollRef = useRef(null);
    const [edge, setEdge] = useState({ left: false, right: false });

    const reduceMotion = useReducedMotion();
    const animMs = reduceMotion ? 0 : ANIM_MS;
    const { collapsed, expand } = useScrollCollapse(rootRef);

    // Hidden layer must not be focusable / tappable. (`inert` is set as a DOM
    // property so it works on both React 18 and 19.)
    useEffect(() => {
        if (expandedRef.current) expandedRef.current.inert = collapsed;
        if (compactRef.current) compactRef.current.inert = !collapsed;
    }, [collapsed]);

    const updateEdges = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const left = el.scrollLeft > 4;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
        setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateEdges();
        el.addEventListener("scroll", updateEdges, { passive: true });
        let ro;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(updateEdges);
            ro.observe(el);
        } else {
            window.addEventListener("resize", updateEdges);
        }
        return () => {
            el.removeEventListener("scroll", updateEdges);
            if (ro) ro.disconnect();
            else window.removeEventListener("resize", updateEdges);
        };
    }, [updateEdges]);

    // Content width changes when categories load / are added live.
    useEffect(() => {
        const raf = requestAnimationFrame(updateEdges);
        return () => cancelAnimationFrame(raf);
    }, [categories, loading, updateEdges]);

    // When the full strip comes back, make sure the active category is in view.
    useEffect(() => {
        if (collapsed) return;
        const sc = scrollRef.current;
        const btn = sc?.querySelector('[aria-pressed="true"]');
        if (!sc || !btn) return;
        const left = btn.offsetLeft;
        const right = left + btn.offsetWidth;
        if (left < sc.scrollLeft) sc.scrollLeft = Math.max(0, left - 8);
        else if (right > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = right - sc.clientWidth + 8;
    }, [collapsed, activeCategoryId]);

    const scrollByDir = (dir) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
    };

    useEffect(() => {
        // Always revalidate against the network, even when a cached list
        // exists — the cache is only there to avoid an empty/loading flash
        // on first paint, not to skip fetching forever. Without this, a
        // category added after the cache was written never appears until
        // the tab is closed, since sessionStorage survives normal reloads.
        let cancelled = false;
        searchCategories("", 16)
            .then((res) => {
                if (cancelled || !res?.success) return;
                const items = (res.items || []).filter((c) => !isHiddenCategory(c.name));
                setCategories(items);
                writeCache(items);
            })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live updates — a category being inserted, or an existing one
    // flipping to/from review_status = 'approved', is reflected in the
    // strip immediately without a refetch or page reload. Runs once per
    // mount; cleaned up on unmount so switching pages doesn't leak
    // subscriptions.
    useEffect(() => {
        // Deferred subscribe: opening a websocket on mount competes with the
        // category fetch and the product feed fetch during the page's most
        // latency-sensitive window. A short defer (mirrors the DeferredMount
        // pattern in App.jsx) lets the above-the-fold content finish first.
        let cancelled = false;
        let channel = null;
        const timer = setTimeout(() => {
            if (cancelled) return;
            channel = supabase
                .channel("category-strip-live")
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "hs_categories" },
                    (payload) => {
                        const row = payload.new;
                        if (row.review_status !== "approved") return;
                        if (isHiddenCategory(row.name)) return;
                        setCategories((prev) => {
                            const next = upsertSorted(prev, { id: row.id, name: row.name, slug: row.slug, image: row.image });
                            writeCache(next);
                            return next;
                        });
                    }
                )
                .on(
                    "postgres_changes",
                    { event: "UPDATE", schema: "public", table: "hs_categories" },
                    (payload) => {
                        const row = payload.new;
                        setCategories((prev) => {
                            let next;
                            if (row.review_status === "approved" && !isHiddenCategory(row.name)) {
                                next = upsertSorted(prev, { id: row.id, name: row.name, slug: row.slug, image: row.image });
                            } else {
                                next = prev.filter((c) => c.id !== row.id);
                            }
                            writeCache(next);
                            return next;
                        });
                    }
                )
                .subscribe();
        }, 2000);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const allActive = !activeCategoryId;
    const activeCategory = activeCategoryId
        ? categories.find((c) => c.id === activeCategoryId) || null
        : null;

    return (
        <div ref={rootRef} className="md:mt-1">
            {/* FULL STRIP — collapses to 0 height + fades out */}
            <div className="grid" style={layerStyle(!collapsed, animMs)}>
                <div
                    ref={expandedRef}
                    aria-hidden={collapsed}
                    className="relative min-h-0 overflow-hidden pt-1.5"
                >
                    {edge.left && <ArrowButton dir={-1} onClick={() => scrollByDir(-1)} />}
                    {edge.right && <ArrowButton dir={1} onClick={() => scrollByDir(1)} />}

                    <div
                        ref={scrollRef}
                        className="relative flex snap-x items-stretch gap-0.5 overflow-x-auto scroll-smooth px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <CategoryItem active={allActive} onClick={() => onSelect(null)} label="All">
                            <AllIcon active={allActive} />
                        </CategoryItem>

                        {loading
                            ? Array.from({ length: 7 }).map((_, i) => <ItemSkeleton key={i} />)
                            : categories.map((cat, i) => {
                                const active = activeCategoryId === cat.id;
                                return (
                                    <CategoryItem
                                        key={cat.id}
                                        active={active}
                                        onClick={() => onSelect(active ? null : cat)}
                                        label={cat.name}
                                        motionProps={{
                                            layout: true,
                                            initial: { opacity: 0, x: 8 },
                                            animate: { opacity: 1, x: 0 },
                                            transition: { duration: 0.25, delay: Math.min(i * 0.02, 0.2), ease: EASE },
                                        }}
                                    >
                                        <CategoryIcon name={cat.name} slug={cat.slug} active={active} />
                                    </CategoryItem>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* COMPACT ROW — grows from 0 height + fades in */}
            <div className="grid" style={layerStyle(collapsed, animMs)}>
                <div ref={compactRef} aria-hidden={!collapsed} className="min-h-0 overflow-hidden pt-1">
                    <CompactBar category={activeCategory} onExpand={expand} />
                </div>
            </div>
        </div>
    );
}