// components/home/HomeShelves.jsx — Deal of the Day, Featured picks, Limited stock, New arrivals.
// The server (catalog_home_sections) decides what is in each shelf: paid products first (labelled
// "Sponsored"), then honest organic fill. Every card carries a "reason", so nothing is padded silently.
// A shelf with too few cards is dropped by the server; products stay reachable in the main feed below.
//
// How paid products look (the seller preview in Growth Center > Promote mirrors this exactly):
//   * Featured picks  : open to any number of sellers. Sponsored cards lead the row in the order the server returns
//                       them (highest bid per hour first), each with a dark "Sponsored" badge, then the organic picks.
//   * Deal of the Day : the top shelf on Home (most-seen spot) with LIMITED seats. Same card, but every sponsored card
//                       here gets an orange border and an orange "Deal of the Day" badge on a warm highlighted shelf.
//   * Other shelves   : unchanged.
// Order is decided by the server (catalog_home_sections); this component never re-sorts.
// Product images sit on a white background in every shelf card.
import { Link } from "react-router-dom";
import { Flame, Sparkles, Timer, Star } from "lucide-react";
import { useHomeFilters } from "../../context/HomeFiltersContext.jsx";
import { resizedImageUrl } from "../../utils/imageUrl";

const SHELF_ICON = { deal: Flame, featured: Star, limited: Timer, new: Sparkles };

// Chip colour by what the reason says.
function reasonTone(reason) {
    const r = String(reason || "").toLowerCase();
    if (r.includes("below")) return { bg: "#E7F6EE", fg: "#12794A" };
    if (r.includes("only") || r.includes("low")) return { bg: "#FDECEA", fg: "#B3261E" };
    if (r === "new" || r.includes("recent")) return { bg: "#E6F3F5", fg: "#0B5563" };
    return { bg: "#F1F4F6", fg: "#34414A" };
}

const inr = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function priceInfo(item, includeGst) {
    const gst = Number(item.gst_percent) || 0;
    const shown = includeGst ? Number(item.price) : Number(item.price) / (1 + gst / 100);
    const basis = Number(item.master_pack_size) >= 1 ? "master pack" : "pack";
    return { shown, basis };
}

const itemHref = (item) => `/brand-item/${encodeURIComponent(item.slug || item.id)}/sellers`;

function Card({ item, includeGst, priority, deal: inDeal = false }) {
    const deal = inDeal && !!item.sponsored; // highlight only the paid card, not the organic ones beside it
    const { shown, basis } = priceInfo(item, includeGst);
    const tone = reasonTone(item.reason);
    return (
        <Link
            to={itemHref(item)}
            rel={item.sponsored ? "sponsored" : undefined}
            aria-label={`${item.name}${item.sponsored ? ", sponsored" : ""}. From ₹${inr(shown)} per ${basis}.`}
            className={`group flex w-[158px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white outline-none transition-shadow hover:shadow-md focus-visible:ring-2 sm:w-[190px] ${deal ? "border-2 shadow-[0_8px_20px_-12px_rgba(222,50,7,.7)] focus-visible:ring-[#de3207]" : "focus-visible:ring-[#0B7285]"}`}
            style={{ borderColor: deal ? "#de3207" : "rgba(20,27,34,.09)" }}
        >
            <div className="relative aspect-square w-full border-b border-slate-100 bg-white">
                {item.image && (
                    <img
                        src={resizedImageUrl(item.image, { width: 400 })}
                        alt=""
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                )}
                {item.sponsored && !deal && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-wide text-white">Sponsored</span>
                )}
                {item.sponsored && deal && (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[#de3207] px-2 py-[3px] text-[9.5px] font-extrabold uppercase tracking-wide text-white">
                        <Flame className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />Deal of the Day
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
                {item.reason && !item.sponsored && (
                    <span className="self-start rounded-md px-1.5 py-[2px] text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.reason}</span>
                )}
                <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-900">{item.name}</p>
                {item.brand_name && <p className="truncate text-[11px] text-slate-500">{item.brand_name}</p>}
                {item.sponsored && deal && <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#de3207]">Sponsored</span>}
                <div className="mt-auto pt-1">
                    <p className="text-[15px] font-extrabold leading-tight text-slate-900">
                        {item.sponsored ? "" : "from "}₹{inr(shown)}
                        <span className="text-[10px] font-semibold text-slate-500"> / {basis}</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500">
                        {includeGst ? "incl." : "excl."} GST{item.sponsored && item.shop_name ? ` · ${item.shop_name}` : ""}
                    </p>
                </div>
            </div>
        </Link>
    );
}

function Shelf({ shelf, includeGst, first }) {
    const Icon = SHELF_ICON[shelf.key] || Star;
    const items = shelf.items || [];
    const isDeal = shelf.key === "deal";
    return (
        <section
            aria-labelledby={`shelf-${shelf.key}`}
            className={isDeal ? "mx-2.5 my-3 rounded-2xl bg-gradient-to-b from-[#FFF1E6] to-white px-2.5 py-3 sm:mx-3 sm:px-3" : "px-2.5 py-3 sm:px-3"}
        >
            <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
                <h2 id={`shelf-${shelf.key}`} className="flex items-center gap-1.5 text-[17px] font-extrabold leading-tight tracking-tight text-slate-900">
                    <Icon className="h-4 w-4 text-[#de3207]" strokeWidth={2.4} aria-hidden="true" />
                    {shelf.title}
                </h2>
                {shelf.subtitle && <span className="text-[11px] font-semibold text-slate-400">{shelf.subtitle}</span>}
            </div>
            <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3">
                {items.map((it, i) => (
                    <Card key={`${it.submission_id}-${it.booking_id || "o"}`} item={it} includeGst={includeGst} priority={first && i < 3} deal={isDeal} />
                ))}
            </div>
        </section>
    );
}

// Real loading state (data is genuinely being fetched), so this one keeps its pulse.
function ShelfSkeleton() {
    return (
        <section className="px-2.5 py-3 sm:px-3" aria-hidden="true">
            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="flex gap-2.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[230px] w-[158px] shrink-0 animate-pulse rounded-2xl bg-slate-100 sm:w-[190px]" />)}
            </div>
        </section>
    );
}

export default function HomeShelves({ shelves, loading }) {
    const { includeGst } = useHomeFilters();
    if (!shelves?.length) return loading ? <ShelfSkeleton /> : null; // shelves are an extra: never an error banner
    return (
        <>
            {shelves.map((s, i) => <Shelf key={s.key} shelf={s} includeGst={includeGst} first={i === 0} />)}
        </>
    );
}