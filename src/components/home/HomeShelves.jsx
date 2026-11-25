// components/home/HomeShelves.jsx — Deal of the Day, Featured picks, Limited stock, New arrivals.
// The server (catalog_home_sections) decides what is in each shelf: paid products first (labelled
// "Sponsored"), then honest organic fill. Every card carries a "reason", so nothing is padded silently.
// A shelf with too few cards is dropped by the server; products stay reachable in the main feed below.
import { Link } from "react-router-dom";
import { Flame, Sparkles, Timer, Star, ChevronRight } from "lucide-react";
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

function Card({ item, includeGst, priority }) {
    const gst = Number(item.gst_percent) || 0;
    const shown = includeGst ? Number(item.price) : Number(item.price) / (1 + gst / 100);
    const basis = Number(item.master_pack_size) >= 1 ? "master pack" : "pack";
    const tone = reasonTone(item.reason);
    return (
        <Link
            to={`/brand-item/${encodeURIComponent(item.slug || item.id)}/sellers`}
            rel={item.sponsored ? "sponsored" : undefined}
            aria-label={`${item.name}${item.sponsored ? ", sponsored" : ""}. From ₹${inr(shown)} per ${basis}.`}
            className="group flex w-[158px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0B7285] sm:w-[190px]"
            style={{ borderColor: "rgba(20,27,34,.09)" }}
        >
            <div className="relative aspect-square w-full bg-[#F4F5F6]">
                {item.image && (
                    <img
                        src={resizedImageUrl(item.image, { width: 400 })}
                        alt=""
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                )}
                {item.sponsored && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-white">Sponsored</span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
                {item.reason && !item.sponsored && (
                    <span className="self-start rounded-md px-1.5 py-[2px] text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.reason}</span>
                )}
                <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900">{item.name}</p>
                {item.brand_name && <p className="truncate text-[11.5px] font-medium text-slate-500">{item.brand_name}</p>}
                <div className="mt-auto pt-1">
                    <p className="text-[15px] font-extrabold text-slate-900">
                        <span className="text-[11px] font-semibold text-slate-500">{item.sponsored ? "" : "from "}</span>₹{inr(shown)}
                        <span className="text-[11px] font-semibold text-slate-500"> / {basis}</span>
                    </p>
                    <p className="text-[10.5px] font-medium text-slate-400">{includeGst ? "incl." : "excl."} GST{item.sponsored && item.shop_name ? ` · ${item.shop_name}` : ""}</p>
                </div>
            </div>
        </Link>
    );
}

function Shelf({ shelf, includeGst, first }) {
    const Icon = SHELF_ICON[shelf.key] || Star;
    const items = shelf.items || [];
    return (
        <section aria-labelledby={`shelf-${shelf.key}`} className="px-2.5 py-3 sm:px-3">
            <div className="mb-2.5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={`shelf-${shelf.key}`} className="flex items-center gap-1.5 text-[17px] font-extrabold leading-tight tracking-tight text-slate-900">
                        <Icon className="h-[18px] w-[18px] shrink-0 text-[#0B7285]" aria-hidden="true" />
                        <span className="truncate">{shelf.title}</span>
                    </h2>
                    {shelf.subtitle && <p className="mt-0.5 truncate text-[12.5px] font-medium text-slate-500">{shelf.subtitle}</p>}
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" aria-hidden="true" />
            </div>
            <div className="-mx-2.5 flex snap-x gap-2.5 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] sm:-mx-3 sm:gap-3 sm:px-3 [&::-webkit-scrollbar]:hidden">
                {items.map((it, i) => (
                    <Card key={`${it.submission_id}-${it.booking_id || "o"}`} item={it} includeGst={includeGst} priority={first && i < 3} />
                ))}
            </div>
        </section>
    );
}

function ShelfSkeleton() {
    return (
        <div className="px-2.5 py-3 sm:px-3" aria-hidden="true">
            <div className="mb-3 h-5 w-40 animate-pulse rounded bg-slate-100" />
            <div className="flex gap-2.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[250px] w-[158px] shrink-0 animate-pulse rounded-2xl bg-slate-100 sm:w-[190px]" />)}
            </div>
        </div>
    );
}

export default function HomeShelves({ shelves, loading }) {
    const { includeGst } = useHomeFilters();
    if (!shelves?.length) return loading ? <ShelfSkeleton /> : null; // shelves are an extra: never an error banner
    return (
        <div>
            {shelves.map((s, i) => <Shelf key={s.key} shelf={s} includeGst={includeGst} first={i === 0} />)}
        </div>
    );
}