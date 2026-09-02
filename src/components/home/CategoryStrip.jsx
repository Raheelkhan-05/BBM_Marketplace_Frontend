// components/home/CategoryStrip.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Box, LayoutGrid } from "lucide-react";
import { searchCategories } from "../../utils/api";
import { resizedImageUrl } from "../../utils/imageUrl";

const C = {
    ink: "#141B22",
    muted: "#5B6672",
    accent: "#ffffff",
    accentTint: "#D2462B",
    accentTintIcon: "#ffffff",
    hair: "rgba(20,27,34,0.10)",
    hairSoft: "rgba(20,27,34,0.07)",
};
const EASE = [0.16, 1, 0.3, 1];

// Categories change rarely (an admin action, not a per-request thing), so
// there's no reason to re-fetch and re-download every category thumbnail
// on every mount of this component — which happens on every "/" -> "/home"
// visit. Cache the list in sessionStorage for the tab's lifetime; worst
// case a brand-new category is one refresh away from showing up, which is
// a fine trade for cutting ~16 requests off every navigation after the
// first.
const CACHE_KEY = "bbm_category_strip_cache_v1";

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

export default function CategoryStrip({ activeCategoryId, onSelect }) {
    const cached = readCache();
    const [categories, setCategories] = useState(cached || []);
    const [loading, setLoading] = useState(!cached);

    useEffect(() => {
        if (cached) return; // already have a cached list, skip the round trip entirely
        let cancelled = false;
        searchCategories("", 16)
            .then((res) => {
                if (cancelled || !res?.success) return;
                setCategories(res.items || []);
                writeCache(res.items || []);
            })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allActive = !activeCategoryId;

    return (
        <div className="flex gap-2 overflow-x-auto px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <motion.button
                onClick={() => onSelect(null)}
                whileTap={{ scale: 0.96 }}
                className="flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 transition-colors duration-150"
                style={{
                    background: allActive ? C.accentTint : "#fff",
                    border: `1.5px solid ${allActive ? C.accent : C.hair}`,
                }}
            >
                <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: allActive ? C.accentTintIcon : "#F1F3F4" }}
                >
                    <LayoutGrid className="h-3 w-3" style={{ color: C.muted }} />
                </span>
                <span className="whitespace-nowrap text-[12.5px] font-bold tracking-wide" style={{ color: allActive ? C.accent : C.ink }}>
                    All
                </span>
            </motion.button>

            {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                ))
                : categories.map((cat, i) => {
                    const active = activeCategoryId === cat.id;
                    return (
                        <motion.button
                            key={cat.id}
                            onClick={() => onSelect(active ? null : cat)}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2), ease: EASE }}
                            whileTap={{ scale: 0.96 }}
                            className="flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 transition-colors duration-150"
                            style={{
                                background: active ? C.accentTint : "#fff",
                                border: `1.5px solid ${active ? C.accent : C.hair}`,
                            }}
                        >
                            <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                style={{ background: active ? C.accentTintIcon : "#F1F3F4" }}
                            >
                                {cat.image
                                    ? (
                                        <img
                                            src={resizedImageUrl(cat.image, { width: 48 })}
                                            alt=""
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    )
                                    : <Box className="h-3 w-3" style={{ color: active ? C.accent : C.muted }} />}
                            </span>
                            <span className="whitespace-nowrap text-[12.5px] font-bold tracking-wide" style={{ color: active ? C.accent : C.ink }}>
                                {cat.name}
                            </span>
                        </motion.button>
                    );
                })}
        </div>
    );
}