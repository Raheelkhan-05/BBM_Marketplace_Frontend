// components/home/CategoryStrip.jsx
//
// No more navigation — tapping a category (or "All") tells HomePage which
// categoryId to scope the feed to, and the feed re-queries in place.
// Active state = soft tinted background + solid accent border (not a
// full-fill pill), matching the page's light, airy feel. Only one accent
// color does the tinting — no more alternating primary/secondary per
// index, which was the main source of visual noise before.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Box, LayoutGrid } from "lucide-react";
import { searchCategories } from "../../utils/api";

const C = {
    ink: "#141B22",
    muted: "#5B6672",
    accent: "#ffffff",
    accentTint: "#D2462B",   // flat, pre-mixed tint — not an alpha overlay
    accentTintIcon: "#ffffff",
    hair: "rgba(20,27,34,0.10)",
    hairSoft: "rgba(20,27,34,0.07)",
};
const EASE = [0.16, 1, 0.3, 1];

export default function CategoryStrip({ activeCategoryId, onSelect }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        searchCategories("", 16)
            .then((res) => { if (!cancelled && res?.success) setCategories(res.items || []); })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
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
                                    ? <img src={cat.image} alt="" className="h-full w-full object-cover" loading="lazy" />
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