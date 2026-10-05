// components/home/FeedQuickActions.jsx
//
// Two quick-action tiles above the feed: Brands and Sellers.
// (Quick Buy is gone — pinned products are now always listed first in the
// feed itself — and RFQ moved to the fixed bottom bar on HomePage.)
//
// Default = deep matte fill with white text. Active = light tint of the same
// hue with dark text. Only ONE tile is ever active (the parent passes `active`).
// Colors are the ones the old Quick Buy (orange) and RFQ (blue) tiles used:
//   Brands  -> orange   Sellers -> blue
// Pure UI: the feed owns all state and navigation.

import { Tags, Store, ChevronRight } from "lucide-react";

const MUTED = "#5F6B73";
const ON_DARK_SUB = "rgba(255,255,255,0.78)";

// base = default fill (white text), tint = active fill (base-coloured text).
const TONES = {
    brands: { base: "#D84315", tint: "#FFE9E2" },
    shop: { base: "#0A5FB0", tint: "#E3EEFA" },
};

function Tile({ tone, icon, label, sub, active = false, onClick }) {
    const t = TONES[tone];
    const cls =
        "group flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left " +
        "transition-[background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]";
    const style = {
        background: active ? t.tint : t.base,
        borderColor: t.base,
    };
    return (
        <button type="button" onClick={onClick} aria-pressed={active} className={cls} style={style}>
            <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
                style={{ background: active ? t.base : "rgba(255,255,255,0.25)", color: "#fff" }}
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-extrabold tracking-wide transition-colors duration-200"
                    style={{ color: active ? t.base : "#fff" }}>
                    {label}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] font-medium tracking-wide transition-colors duration-200"
                    style={{ color: active ? MUTED : ON_DARK_SUB }}>
                    {sub}
                </span>
            </span>
            <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.4}
                style={{ color: active ? t.base : "rgba(255,255,255,0.9)" }}
            />
        </button>
    );
}

// active: "brands" | "shop" | null
export default function FeedQuickActions({ active = null, brandLabel, onBrands, onMyShop }) {
    return (
        <div className="grid grid-cols-2 gap-1 pb-0">
            <Tile
                tone="brands"
                icon={<Tags className="h-4 w-4" strokeWidth={2} />}
                label="Brands"
                sub={active === "brands" && brandLabel ? brandLabel : "Browse by brand"}
                active={active === "brands"}
                onClick={onBrands}
            />
            <Tile
                tone="shop"
                icon={<Store className="h-4 w-4" strokeWidth={2} />}
                label="Sellers"
                sub={active === "shop" ? "Viewing store" : "Browse all sellers"}
                active={active === "shop"}
                onClick={onMyShop}
            />
        </div>
    );
}