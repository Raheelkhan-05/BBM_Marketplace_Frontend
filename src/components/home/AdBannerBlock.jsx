// components/home/AdBannerBlock.jsx — PAID banner placements on Home (bought in Growth Center > Promote).
//   home_hero  : full-width carousel (up to 3 advertisers, 16:9)
//   home_duo   : two half-width tiles (4:3; 1:1 on phones)
//   home_strip : a row of square tiles (up to 4)
// Renders nothing when no ad is live, so the admin-curated group banners keep filling that space.
// Every paid tile is labelled "Ad" with the advertiser's name.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { resizedImageUrl } from "../../utils/imageUrl";
import { pickImage } from "./bannerShapes.js";

const RATIO = { home_hero: 16 / 9, home_duo: 4 / 3, home_strip: 1 };
const WIDTH = { home_hero: 1280, home_duo: 800, home_strip: 520 };
const AUTOPLAY_MS = 5500;

// Where a tap goes: the advertiser's own shop, or the product the seller chose.
export function adHref(ad) {
    const l = ad?.creative?.link;
    if (l?.type === "brand_item" && l.brand_item_id) return `/brand-item/${encodeURIComponent(l.brand_item_id)}/sellers`;
    const slug = l?.shop_slug || ad?.shop_slug;
    return slug ? `/seller/${encodeURIComponent(slug)}` : "/home";
}

function AdTag({ name }) {
    return (
        <span className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[80%] items-center gap-1 rounded-full bg-black/60 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            Ad{name ? <span className="truncate font-semibold normal-case tracking-normal opacity-90">· {name}</span> : null}
        </span>
    );
}

function Tile({ ad, ratio, cls = "", width, priority = false }) {
    const pick = pickImage({ images: ad.creative?.images || {} }, ratio);
    if (!pick) return null;
    return (
        <Link
            to={adHref(ad)}
            rel="sponsored"
            aria-label={`Ad from ${ad.shop_name || "a seller"}${ad.creative?.alt ? `: ${ad.creative.alt}` : ""}`}
            className={`group relative block w-full overflow-hidden rounded-2xl bg-[#F4F5F6] outline-none focus-visible:ring-2 focus-visible:ring-[#0B7285] ${cls}`}
        >
            <img
                src={resizedImageUrl(pick.url, { width })}
                alt={ad.creative?.alt || ad.shop_name || ""}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <AdTag name={ad.shop_name} />
        </Link>
    );
}

/* ---------------- hero carousel ---------------- */
function Hero({ ads, priority }) {
    const scroller = useRef(null);
    const [idx, setIdx] = useState(0);
    const paused = useRef(false);
    const many = ads.length > 1;

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
        if (!many) return undefined;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
        const t = setInterval(() => {
            if (paused.current || document.visibilityState !== "visible") return;
            const el = scroller.current;
            if (!el) return;
            const cur = Math.round(el.scrollLeft / (el.clientWidth || 1));
            go((cur + 1) % ads.length);
        }, AUTOPLAY_MS);
        return () => clearInterval(t);
    }, [many, ads.length, go]);

    // The set of ads changed (one ended): keep the index in range.
    useEffect(() => { if (idx >= ads.length) { setIdx(0); scroller.current?.scrollTo({ left: 0 }); } }, [ads.length, idx]);

    return (
        <div
            className="relative"
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
                {ads.map((ad, i) => (
                    <div key={ad.booking_id} className="w-full shrink-0 snap-center" role={many ? "group" : undefined} aria-label={many ? `Ad ${i + 1} of ${ads.length}` : undefined}>
                        <Tile ad={ad} ratio={RATIO.home_hero} width={WIDTH.home_hero} priority={priority && i === 0} cls="aspect-[16/9] sm:aspect-[2/1]" />
                    </div>
                ))}
            </div>
            {many && (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
                    {ads.map((ad, i) => (
                        <button
                            key={ad.booking_id}
                            type="button"
                            aria-label={`Show ad ${i + 1}`}
                            aria-current={i === idx}
                            onClick={() => go(i)}
                            className="pointer-events-auto h-1.5 rounded-full bg-white/90 shadow transition-all"
                            style={{ width: i === idx ? 18 : 6, opacity: i === idx ? 1 : 0.6 }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ---------------- duo / strip ---------------- */
function Grid({ placement, ads }) {
    const n = ads.length;
    const ratio = RATIO[placement];
    const width = WIDTH[placement];

    // One lone advertiser: a wide 2:1 tile, never a half-empty row.
    if (n === 1) {
        return <Tile ad={ads[0]} ratio={ratio} width={placement === "home_strip" ? 800 : 1000} cls="aspect-[2/1]" />;
    }
    const cols = placement === "home_duo"
        ? "grid-cols-2"
        : n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
    const aspect = placement === "home_duo" ? "aspect-square sm:aspect-[4/3]" : "aspect-square";
    return (
        <div className={`grid ${cols} gap-2.5 sm:gap-3`}>
            {ads.map((ad) => <Tile key={ad.booking_id} ad={ad} ratio={ratio} width={width} cls={aspect} />)}
        </div>
    );
}

export default function AdBannerBlock({ placement, ads, priority = false }) {
    const list = (ads || []).filter((a) => pickImage({ images: a.creative?.images || {} }, RATIO[placement]));
    if (!list.length || !RATIO[placement]) return null;
    const max = placement === "home_hero" ? 3 : placement === "home_duo" ? 2 : 4;
    const shown = list.slice(0, max);
    return (
        <section aria-label="Sponsored banners" className="px-2.5 py-3 sm:px-3">
            {placement === "home_hero" ? <Hero ads={shown} priority={priority} /> : <Grid placement={placement} ads={shown} />}
        </section>
    );
}