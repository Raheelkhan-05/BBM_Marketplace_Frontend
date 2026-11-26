// components/home/AdBannerBlock.jsx — PAID banner placements on Home (bought in Growth Center > Promote).
//   home_hero  : full-width 16:9 CAROUSEL: up to 3 advertisers rotate, 1 banner visible at a time
//   home_duo   : "Spotlight pair" — 2 cards per row. ONE advertiser still gets ONE half-width card.
//   home_strip : "Square tiles" — 3 tiles per row. Tiles keep their size, never stretched.
// Rule: card size comes from the placement's capacity (`lanes`), never from how many ads happen to be live.
// `ghosts` (preview only) draws dashed "another advertiser" slots so the seller sees the spot is shared.
// Renders nothing when no ad is live. `preview` + `compact` are used by the seller-side live preview:
// preview renders non-clickable tiles, compact forces the phone layout (the preview frame is narrow, so
// viewport breakpoints like sm: would otherwise pick the wrong layout).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { resizedImageUrl } from "../../utils/imageUrl";
import { pickImage } from "./bannerShapes.js";

const RATIO = { home_hero: 16 / 9, home_duo: 4 / 3, home_strip: 1 };
const MAX = { home_hero: 3, home_duo: 2, home_strip: 3 };
// Banners per ROW, fixed by the layout: hero 1, spotlight pair 2, square tiles 3.
export const PER_ROW = { home_hero: 1, home_duo: 2, home_strip: 3 };
const AUTOPLAY_MS = 5500;

// Class helper: in compact (phone-frame) mode only the base classes apply.
const R = (compact, base, wide) => (compact ? base : `${base} ${wide}`);

// Where a tap goes: the advertiser's own shop, or the product the seller chose.
export function adHref(ad) {
    const l = ad?.creative?.link;
    if (l?.type === "brand_item" && l.brand_item_id) return `/brand-item/${encodeURIComponent(l.brand_item_id)}/sellers`;
    const slug = l?.shop_slug || ad?.shop_slug;
    return slug ? `/seller/${encodeURIComponent(slug)}` : "/home";
}

export const adCta = (ad) => (ad?.creative?.link?.type === "brand_item" ? "View product" : "Visit store");

function AdTag({ name, short = false }) {
    return (
        <span className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[80%] items-center gap-1 rounded-full bg-black/60 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            Ad{!short && name ? <span className="truncate font-semibold normal-case tracking-normal opacity-90">· {name}</span> : null}
        </span>
    );
}

function Frame({ preview, ad, className, children }) {
    const label = `Ad from ${ad.shop_name || "a seller"}${ad.creative?.alt ? `: ${ad.creative.alt}` : ""}`;
    if (preview) return <div aria-label={label} className={className}>{children}</div>;
    return <Link to={adHref(ad)} rel="sponsored" aria-label={label} className={className}>{children}</Link>;
}

function Img({ ad, pick, width, priority }) {
    return (
        <img
            src={resizedImageUrl(pick.url, { width })}
            alt={ad.creative?.alt || ad.shop_name || ""}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
    );
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#de3207] focus-visible:ring-offset-2";

function Head({ title, hint }) {
    return (
        <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <h2 className="text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{hint}</span>
        </div>
    );
}

/* ---------------- hero carousel ---------------- */
function HeroSlide({ item, priority, preview, compact }) {
    const { ad, pick } = item;
    return (
        <Frame
            preview={preview}
            ad={ad}
            className={`group relative block w-full overflow-hidden rounded-2xl bg-[#F4F5F6] ${FOCUS} ${R(compact, "aspect-[16/9]", "sm:aspect-[2/1]")}`}
        >
            <Img ad={ad} pick={pick} width={1280} priority={priority} />
            <AdTag name={ad.shop_name} />
            <span className="absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-white/95 py-1.5 pl-3 pr-2 text-[11.5px] font-extrabold text-slate-900 shadow-md backdrop-blur transition-transform group-hover:translate-x-0.5">
                {adCta(ad)} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.8} />
            </span>
        </Frame>
    );
}

function Hero({ items, priority, preview, compact, total }) {
    const scroller = useRef(null);
    const [idx, setIdx] = useState(0);
    const paused = useRef(false);
    const many = items.length > 1;
    const dots = Math.max(total || items.length, items.length);

    const go = useCallback((i) => {
        const el = scroller.current;
        if (!el) return;
        el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    }, []);

    const onScroll = () => {
        const el = scroller.current;
        if (!el || !el.clientWidth) return;
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIdx((cur) => (cur === i ? cur : i));
    };

    useEffect(() => {
        if (!many || preview) return undefined;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
        const t = setInterval(() => {
            if (paused.current || document.visibilityState !== "visible") return;
            const el = scroller.current;
            if (!el) return;
            const cur = Math.round(el.scrollLeft / (el.clientWidth || 1));
            go((cur + 1) % items.length);
        }, AUTOPLAY_MS);
        return () => clearInterval(t);
    }, [many, preview, items.length, go]);

    // The set of ads changed (one ended): keep the index in range.
    useEffect(() => { if (idx >= items.length) { setIdx(0); scroller.current?.scrollTo({ left: 0 }); } }, [items.length, idx]);

    return (
        <div
            onMouseEnter={() => { paused.current = true; }}
            onMouseLeave={() => { paused.current = false; }}
            onFocus={() => { paused.current = true; }}
            onBlur={() => { paused.current = false; }}
            onTouchStart={() => { paused.current = true; }}
            onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 4000); }}
        >
            <div
                ref={scroller}
                onScroll={onScroll}
                className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-roledescription={many ? "carousel" : undefined}
            >
                {items.map((it, i) => (
                    <div key={it.ad.booking_id} className="w-full shrink-0 snap-center" role={many ? "group" : undefined} aria-label={many ? `Ad ${i + 1} of ${items.length}` : undefined}>
                        <HeroSlide item={it} priority={priority && i === 0} preview={preview} compact={compact} />
                    </div>
                ))}
            </div>
            {dots > 1 && (
                <div className="mt-2 flex justify-center gap-1.5">
                    {Array.from({ length: dots }).map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            aria-label={`Show ad ${i + 1}`}
                            aria-current={i === idx}
                            disabled={i >= items.length}
                            onClick={() => go(i)}
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: i === idx ? 18 : 6, background: i === idx ? "#de3207" : "rgba(11,17,22,0.18)" }}
                        />
                    ))}
                </div>
            )}
            {preview && dots > 1 && <p className="mt-1 text-center text-[10px] font-semibold text-slate-500">Ad 1 of {dots} · rotates automatically</p>}
        </div>
    );
}

/* ---------------- spotlight (home_duo) ---------------- */
function DuoCard({ item, preview, compact }) {
    const { ad, pick } = item;
    return (
        <Frame
            preview={preview}
            ad={ad}
            className={`group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md ${FOCUS}`}
        >
            <div className={`relative w-full bg-[#F4F5F6] ${R(compact, "aspect-square", "sm:aspect-[4/3]")}`}>
                <Img ad={ad} pick={pick} width={800} priority={false} />
                <AdTag short />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="truncate text-[12.5px] font-bold text-slate-900">{ad.shop_name || "Seller"}</span>
                <span className="inline-flex shrink-0 items-center text-[11px] font-extrabold text-[#C44705]">
                    {adCta(ad)} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.8} />
                </span>
            </div>
        </Frame>
    );
}

/* ---------------- sponsored stores (home_strip) ---------------- */
function stripBasis(cap, compact) {
    // exactly three tiles across, on phone and desktop alike
    return R(compact, "basis-[calc(33.333%-7px)]", "sm:basis-[calc(33.333%-8px)]");
}

function Ghost({ square = false, label = "Another advertiser" }) {
    return (
        <div aria-hidden="true" className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-slate-400"
            style={square ? { aspectRatio: "1" } : { minHeight: 96 }}>
            {label}
        </div>
    );
}

function StripTile({ item, preview, basis }) {
    const { ad, pick } = item;
    return (
        <div className={`shrink-0 grow-0 snap-start ${basis}`}>
            <Frame
                preview={preview}
                ad={ad}
                className={`group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md ${FOCUS}`}
            >
                <div className="relative aspect-square w-full bg-[#F4F5F6]">
                    <Img ad={ad} pick={pick} width={520} priority={false} />
                    <AdTag short />
                </div>
                <p className="truncate px-2.5 py-2 text-[12px] font-bold text-slate-900">{ad.shop_name || "Seller"}</p>
            </Frame>
        </div>
    );
}

/* ---------------- block ---------------- */
export default function AdBannerBlock({ placement, ads, priority = false, preview = false, compact = false, lanes, ghosts = 0 }) {
    const ratio = RATIO[placement];
    if (!ratio) return null;
    const cap = PER_ROW[placement];
    const items = (ads || [])
        .map((ad) => ({ ad, pick: pickImage({ images: ad.creative?.images || {} }, ratio) }))
        .filter((x) => x.pick)
        .slice(0, Math.min(MAX[placement], cap));
    if (!items.length) return null;

    let body;
    if (placement === "home_hero") {
        body = <Hero items={items} priority={priority} preview={preview} compact={compact} total={preview ? Math.max(items.length, Number(lanes) || MAX.home_hero) : items.length} />;
    } else if (placement === "home_duo") {
        // always two columns while the spot is shared, so one ad = one half-width card
        const cols = 2;
        body = (
            <>
                <Head title="Spotlight" hint="Sponsored" />
                <div className={`grid gap-2.5 sm:gap-3 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {items.map((it) => <DuoCard key={it.ad.booking_id} item={it} preview={preview} compact={compact} />)}
                    {Array.from({ length: preview ? ghosts : 0 }).map((_, i) => <Ghost key={`g${i}`} />)}
                </div>
            </>
        );
    } else {
        const basis = stripBasis(cap, compact);
        body = (
            <>
                <Head title="Sponsored stores" hint="Sponsored" />
                <div className={`flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${R(compact, "", "sm:gap-3")}`}>
                    {items.map((it) => <StripTile key={it.ad.booking_id} item={it} preview={preview} basis={basis} />)}
                    {Array.from({ length: preview ? ghosts : 0 }).map((_, i) => (
                        <div key={`g${i}`} className={`shrink-0 grow-0 ${basis}`}><Ghost square label="Open" /></div>
                    ))}
                </div>
            </>
        );
    }

    return (
        <section aria-label="Sponsored" className={preview ? "" : "px-2.5 py-3 sm:px-3"}>
            {body}
        </section>
    );
}