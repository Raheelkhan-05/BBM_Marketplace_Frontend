// components/home/FeedQuickActions.jsx
//
// Four quick-action tiles above the feed: Quick Buy, RFQ, Brands, My Shop.
// Default = deep matte fill with white text. Active = light tint of the same
// hue with dark text. Only ONE tile is ever active (the parent passes `active`).
// Pure UI: the feed owns all state and navigation.

import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Pin, FileText, Tags, Store, ChevronRight } from "lucide-react";

// Deep, desaturated, flat colours. base = default fill, tint/bd = active look.
const TONES = {
    quick: { base: "#1F5A5E", tint: "#E3EEEE", bd: "#BFD4D4" }, // petrol
    rfq: { base: "#2B3F63", tint: "#E4E8F0", bd: "#C3CCDD" },   // ink blue
    brands: { base: "#53344D", tint: "#EEE6EC", bd: "#D6C5D2" }, // aubergine
    shop: { base: "#2D5240", tint: "#E4EDE8", bd: "#BFD3C7" },   // pine
};
const MUTED = "#5F6B73";
const ON_DARK_SUB = "rgba(255,255,255,0.72)";

// Same pin as the product rows: tilted outline when off; on activation it
// lifts, drives straight down, settles upright, and fills in (fill fades,
// it doesn't snap).
function PinGlyph({ active }) {
    const reduce = useReducedMotion();
    const animateTo = active
        ? (reduce ? { rotate: 0, y: 0, scaleY: 1 } : { rotate: [45, 20, 0, 0], y: [0, -5, 1.5, 0], scaleY: [1, 1.06, 0.9, 1] })
        : { rotate: 45, y: 0, scaleY: 1 };
    return (
        <motion.span
            className="flex items-center justify-center"
            style={{ originX: 0.5, originY: 0.5 }}
            initial={false}
            animate={animateTo}
            transition={active
                ? { duration: 0.42, times: [0, 0.35, 0.7, 1], ease: "easeOut" }
                : { type: "spring", stiffness: 420, damping: 30 }}
        >
            <Pin
                className="h-4 w-4"
                strokeWidth={2}
                fill="currentColor"
                style={{ fillOpacity: active ? 1 : 0, transition: "fill-opacity 250ms ease" }}
            />
        </motion.span>
    );
}

function Tile({ tone, icon, label, sub, active = false, to, onClick }) {
    const t = TONES[tone];
    const cls =
        "flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left " +
        "transition-[background-color,border-color,transform] duration-300 ease-out active:scale-[0.98]";
    const style = {
        background: active ? t.tint : t.base,
        borderColor: t.base,
    };
    const body = (
        <>
            <span
                className="flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full transition-colors duration-300"
                style={{ background: active ? t.base : "rgba(255,255,255,0.16)", color: "#fff" }}
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
                <span
                    className="block truncate text-[12.5px] font-extrabold tracking-wide transition-colors duration-300"
                    style={{ color: active ? t.base : "#fff" }}
                >
                    {label}
                </span>
                <span
                    className="block truncate text-[10.5px] font-medium tracking-wide transition-colors duration-300"
                    style={{ color: active ? MUTED : ON_DARK_SUB }}
                >
                    {sub}
                </span>
            </span>
            <ChevronRight
                className="h-4 w-4 shrink-0 transition-colors duration-300"
                strokeWidth={2.4}
                style={{ color: active ? t.base : "rgba(255,255,255,0.85)" }}
            />
        </>
    );
    return to ? (
        <Link to={to} className={cls} style={style} aria-label={label}>{body}</Link>
    ) : (
        <button type="button" onClick={onClick} aria-pressed={active} className={cls} style={style}>{body}</button>
    );
}

// active: "quick" | "brands" | "shop" | null
export default function FeedQuickActions({ active = null, brandLabel, onQuickBuy, onBrands, onMyShop }) {
    return (
        <div className="grid grid-cols-2 gap-2 px-1 pb-2.5 md:grid-cols-4">
            <Tile
                tone="quick"
                icon={<PinGlyph active={active === "quick"} />}
                label="Quick Buy"
                sub={active === "quick" ? "Showing pinned" : "Pinned items"}
                active={active === "quick"}
                onClick={onQuickBuy}
            />
            <Tile
                tone="rfq"
                icon={<FileText className="h-4 w-4" strokeWidth={2} />}
                label="RFQ"
                sub="Get multiple quotes"
                to="/rfq"
            />
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
                label="My Shop"
                sub={active === "shop" ? "Viewing" : "Open your store"}
                active={active === "shop"}
                onClick={onMyShop}
            />
        </div>
    );
}