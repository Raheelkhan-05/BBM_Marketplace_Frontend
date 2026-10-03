// components/home/FeedQuickActions.jsx
//
// Four colourful, matte action tiles shown above the feed:
//   1) Quick Buy (pinned items)   2) RFQ   3) Brands filter   4) My Shop
// Plus the Brands bottom sheet. Pure UI: the feed owns all state and requests.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, FileText, Tags, Store, ChevronRight, X, Check, Loader2 } from "lucide-react";
import { fetchFeedBrands } from "../../utils/api";

const EASE = [0.16, 1, 0.3, 1];
const INK = "#0B1116";
const MUTED = "#667077";

// Matte colours: flat tinted card + solid badge, no gloss / gradient / shadow.
//   bg = card tint, bd = card border, solid = badge + active fill, dark = text on tint
const TONES = {
    quick: { bg: "#FFF0E5", bd: "#FFD5B8", solid: "#D9480F", dark: "#8F3200" },   // orange
    rfq: { bg: "#E3F3F5", bd: "#BFE3E8", solid: "#0E7C8C", dark: "#00606F" },     // teal
    brands: { bg: "#ECEBFB", bd: "#CFCBF3", solid: "#5046C8", dark: "#3A3196" },  // indigo
    shop: { bg: "#E6F4EA", bd: "#C3E3CC", solid: "#2A8050", dark: "#1F6B3F" },    // green
};
// Colours used by the brand sheet below (matches the Brands tile)
const SHEET = { solid: TONES.brands.solid, bg: TONES.brands.bg };

// Same structure as the RFQ card (round icon badge, bold title, small
// subtitle, chevron) but in each tile's own colour.
// Active = solid fill of that colour with white text.
function Tile({ tone, Icon, label, sub, active = false, to, onClick, iconClass = "", fillIcon = false }) {
    const t = TONES[tone];
    const cls =
        "flex min-w-0 items-center gap-2 rounded-md border py-2.5 pl-2 pr-2 text-left transition-all duration-150 hover:brightness-[0.98] active:scale-[0.98]";
    const style = {
        background: active ? t.solid : t.bg,
        borderColor: active ? t.solid : t.bd,
    };
    const body = (
        <>
            <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: active ? "#fff" : t.solid }}
            >
                <Icon
                    className={`h-4 w-4 ${iconClass}`}
                    strokeWidth={2}
                    fill={fillIcon ? "currentColor" : "none"}
                    style={{ color: active ? t.solid : "#fff" }}
                />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
                <span
                    className="block truncate text-[12.5px] font-extrabold tracking-wide"
                    style={{ color: active ? "#fff" : t.dark }}
                >
                    {label}
                </span>
                <span
                    className="block truncate text-[10.5px] font-medium tracking-wide"
                    style={{ color: active ? "rgba(255,255,255,0.88)" : MUTED }}
                >
                    {sub}
                </span>
            </span>
            <ChevronRight
                className="h-4 w-4 shrink-0"
                strokeWidth={2.4}
                style={{ color: active ? "#fff" : t.solid }}
            />
        </>
    );
    return to ? (
        <Link to={to} className={cls} style={style} aria-label={label}>{body}</Link>
    ) : (
        <button type="button" onClick={onClick} aria-pressed={active} className={cls} style={style}>{body}</button>
    );
}

export default function FeedQuickActions({
    quickBuyOn, onQuickBuy,
    brandCount, onOpenBrands,
    myShopActive, onMyShop,
}) {
    return (
        <div className="grid grid-cols-2 gap-2 px-1 pb-2.5 md:grid-cols-4">
            {/* Pin icon matches the row Follow pin: tilted outline when off, upright + filled when on */}
            <Tile
                tone="quick"
                Icon={Pin}
                label="Quick Buy"
                sub={quickBuyOn ? "Showing pinned" : "Pinned items"}
                active={quickBuyOn}
                fillIcon={quickBuyOn}
                iconClass={quickBuyOn ? "" : "rotate-45"}
                onClick={onQuickBuy}
            />
            <Tile tone="rfq" Icon={FileText} label="RFQ" sub="Get multiple quotes" to="/rfq" />
            <Tile
                tone="brands"
                Icon={Tags}
                label="Brands"
                sub={brandCount ? `${brandCount} selected` : "Filter by brand"}
                active={brandCount > 0}
                onClick={onOpenBrands}
            />
            <Tile
                tone="shop"
                Icon={Store}
                label="My Shop"
                sub={myShopActive ? "Viewing" : "Open your store"}
                active={myShopActive}
                onClick={onMyShop}
            />
        </div>
    );
}

// Brands bottom sheet. Options come from the server, scoped to the SAME
// category / search / Following / store filters as the feed, so every brand
// listed is guaranteed to have at least one product in the current view.
export function BrandFilterSheet({ open, onClose, selected, onApply, scope }) {
    const [state, setState] = useState({ loading: true, brands: [], error: null });
    const [draft, setDraft] = useState([]);
    const { categoryId, q, followedOnly, shopSlug, token } = scope;

    useEffect(() => { if (open) setDraft(selected); }, [open, selected]);

    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prevOverflow; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setState({ loading: true, brands: [], error: null });
        fetchFeedBrands({ categoryId, q, followedOnly, shopSlug, token, signal: controller.signal })
            .then((res) => {
                if (!res?.success) { setState({ loading: false, brands: [], error: "Couldn't load brands." }); return; }
                setState({ loading: false, brands: res.brands || [], error: null });
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                setState({ loading: false, brands: [], error: "Couldn't load brands." });
            });
        return () => controller.abort();
    }, [open, categoryId, q, followedOnly, shopSlug, token]);

    const toggle = (name) =>
        setDraft((d) => (d.includes(name) ? d.filter((n) => n !== name) : [...d, name]));

    const t = SHEET;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 md:items-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex max-h-[78vh] w-full max-w-md flex-col rounded-t-[22px] bg-white md:rounded-[22px]"
                    >
                        <div className="flex items-center justify-between px-5 pb-2 pt-4">
                            <p className="text-[15px] font-extrabold tracking-wide" style={{ color: INK }}>Filter by brand</p>
                            <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/[0.05]">
                                <X className="h-4 w-4" style={{ color: MUTED }} />
                            </button>
                        </div>

                        <div className="min-h-[120px] flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
                            {state.loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: t.solid }} /></div>
                            ) : state.error ? (
                                <p className="py-8 text-center text-[12px] font-semibold" style={{ color: MUTED }}>{state.error}</p>
                            ) : state.brands.length === 0 ? (
                                <p className="py-8 text-center text-[12px] font-semibold" style={{ color: MUTED }}>No brands in this view.</p>
                            ) : (
                                state.brands.map((b) => {
                                    const on = draft.includes(b.brand_name);
                                    return (
                                        <button
                                            key={b.brand_name}
                                            type="button"
                                            onClick={() => toggle(b.brand_name)}
                                            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors"
                                            style={{ background: on ? t.bg : "transparent" }}
                                        >
                                            <span
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                                                style={{ background: on ? t.solid : "#fff", borderColor: on ? t.solid : "#D5DADE" }}
                                            >
                                                {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-wide" style={{ color: INK }}>{b.brand_name}</span>
                                            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: MUTED }}>{b.item_count}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: "rgba(11,17,22,0.08)" }}>
                            <button
                                type="button"
                                onClick={() => setDraft([])}
                                disabled={!draft.length}
                                className="flex-1 rounded-xl border py-2.5 text-[12.5px] font-bold tracking-wide disabled:opacity-40"
                                style={{ borderColor: "rgba(11,17,22,0.12)", color: INK }}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => { onApply(draft); onClose(); }}
                                className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold tracking-wide text-white"
                                style={{ background: t.solid }}
                            >
                                {draft.length ? `Show ${draft.length} brand${draft.length === 1 ? "" : "s"}` : "Show all brands"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}