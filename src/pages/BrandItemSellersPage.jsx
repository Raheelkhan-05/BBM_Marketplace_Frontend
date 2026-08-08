import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, ArrowUpDown, ShieldCheck, MapPin, Building2 } from "lucide-react";
import { searchCatalogBrandItems, searchCatalogSellers } from "../utils/api";
import { resolveSearchRoute } from "../utils/searchResolve.js";
import { Link } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";

/* ------------------------------------------------------------------
   DESIGN NOTES — BrandItemSellersPage
   ------------------------------------------------------------------
   Final rung: Category > Subcategory > Generic Product > Brand Item
   > Sellers. Reached from GenericProductBrandsPage's tile grid
   (route: /brand-item/:idOrSlug/sellers). Same header/search/chip
   shell as every rung above — but the results panel switches from
   icon tiles to seller list rows, since a seller needs a name,
   location, and "Visit shop" CTA rather than a square thumbnail.
   Card language borrowed from ShopPage's own header treatment (GST
   Verified pill, MapPin location line) so a seller looks the same
   here as it does once you land on their storefront.
   ------------------------------------------------------------------ */

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};

const EASE = [0.16, 1, 0.3, 1];

function SellerRow({ seller, idx }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
        >
            <Link
                to={`/shop/${seller.shop_slug}`}
                className="flex items-center gap-3 rounded-2xl border bg-white p-3 transition-colors duration-150 hover:bg-black/[0.02] sm:p-4"
                style={{ borderColor: C.hair }}
            >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.hair }}>
                    {seller.logo_url ? (
                        <img src={seller.logo_url} alt={seller.display_name} className="h-full w-full object-contain p-1" />
                    ) : (
                        <Building2 className="h-6 w-6" style={{ color: C.muted }} />
                    )}
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{seller.display_name}</p>
                        <span className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold text-white" style={{ background: C.secondary }}>
                            <ShieldCheck className="h-2.5 w-2.5" /> GST Verified
                        </span>
                    </div>
                    {(seller.city || seller.state) && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: C.muted }}>
                            <MapPin className="h-3 w-3 shrink-0" /> {[seller.city, seller.state].filter(Boolean).join(", ")}
                        </p>
                    )}
                    {(seller.price || seller.moq) && (
                        <p className="mt-1 text-[11.5px] font-bold" style={{ color: C.primary }}>
                            {seller.price ? `₹${seller.price}${seller.unit ? ` / ${seller.unit}` : ""}` : ""}
                            {seller.moq ? `  ·  MOQ ${seller.moq} ${seller.unit || ""}` : ""}
                        </p>
                    )}
                </div>
            </Link>
        </motion.div>
    );
}

function SellerListSkeleton() {
    return (
        <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border p-3 sm:p-4" style={{ borderColor: C.hair }}>
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
                    <div className="flex-1">
                        <div className="h-3 w-1/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                        <div className="mt-2 h-2.5 w-1/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function BrandItemSellersPage() {
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const [brand, setBrand] = useState(state?.brand || null);
    const [genericProduct] = useState(state?.genericProduct || null);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                let b = brand;
                if (!b) {
                    const brandsRes = await searchCatalogBrandItems(undefined, idOrSlug, 5);
                    b = brandsRes?.items?.find((x) => x.slug === idOrSlug || x.id === idOrSlug) || brandsRes?.items?.[0] || null;
                    if (!cancelled) setBrand(b);
                }
                if (b) {
                    const res = await searchCatalogSellers(b.id, "", 50);
                    if (!cancelled) setSellers(res?.success ? res.items || [] : []);
                }
            } catch {
                if (!cancelled) setSellers([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idOrSlug]);

    const filtered = query.trim()
        ? sellers.filter((s) => s.display_name.toLowerCase().includes(query.trim().toLowerCase()))
        : sellers;

    const handleSearchSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) navigate(route.pathname, { state: route.state });
        else navigate(`/browse-search?q=${encodeURIComponent(trimmedQuery)}`);
    };

    return (
        <div className="mx-auto max-w-7xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            {/* header: back + brand item name */}
            <div className="mt-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-black/[0.03]"
                    style={{ borderColor: C.hair, color: C.ink }}
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                    <Link
                        to={genericProduct ? `/product/${genericProduct.slug || genericProduct.id}/brands` : "/categories"}
                        state={{ genericProduct }}
                        className="block"
                    >
                        <h1
                            className="truncate font-extrabold leading-tight tracking-[-0.01em] cursor-pointer"
                            style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                        >
                            {brand?.name || "Sellers"}
                        </h1>
                    </Link>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                        {sellers.length} sellers
                    </p>
                </div>
            </div>

            {/* search — desktop only, reuses the app's existing search bar */}
            <div className="mt-4 hidden lg:block">
                <MarketplaceSearchBar value={query} onChange={setQuery} onSubmit={handleSearchSubmit} />
            </div>

            {/* filter / sort chips */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                    { icon: SlidersHorizontal, label: "Filter" },
                    { icon: ArrowUpDown, label: "Sort" },
                ].map(({ icon: Icon, label }) => (
                    <button
                        key={label}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: C.hair, color: C.ink }}
                    >
                        <Icon className="h-3.5 w-3.5" style={{ color: C.muted }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* seller list */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    <SellerListSkeleton />
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-[13px] font-medium" style={{ color: C.muted }}>
                        {query ? `No sellers match "${query}".` : "No sellers listing this item yet."}
                    </p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {filtered.map((s, i) => (
                            <SellerRow key={s.id} seller={s} idx={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}