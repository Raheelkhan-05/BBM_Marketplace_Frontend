import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CatalogHeader, FilterSortChips, IconTile, TileGrid, TileGridSkeleton } from "../components/catalog/CatalogUI";
import { C } from "../components/catalog/tokens";
import { CATALOG_LEVEL_CONFIGS } from "./catalogLevelConfigs";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import { resolveSearchRoute } from "../utils/searchResolve.js";
import useAsyncCatalogData from "../hooks/useAsyncCatalogData";
import { CatalogLoadError } from "../components/catalog/CatalogUI";


// Replaces CategoriesPage, CategorySubcategoriesPage,
// SubcategoryGenericProductsPage, GenericProductBrandsPage.
// Which one it behaves as is picked purely by `configKey`, wired from App.jsx.
export default function CatalogLevelPage({ configKey }) {
    const config = CATALOG_LEVEL_CONFIGS[configKey];
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();


    // For non-root levels, state carries {category|subcategory|genericProduct}
    // from the tile that was clicked to get here — instant header, no waterfall.
    const stateParentKey = { subcategories: "category", products: "subcategory", brands: "genericProduct" }[configKey];
    const stateGrandparentKey = { products: "category", brands: "subcategory" }[configKey];

    const [parent, setParent] = useState(config.isRoot ? null : state?.[stateParentKey] || null);
    const [grandparent] = useState(
        configKey === "brands"
            ? { subcategory: state?.subcategory || null, category: state?.category || null }
            : state?.[stateGrandparentKey] || null
    );
    const { data: items, loading, error, retry } = useAsyncCatalogData(async () => {
        let p = parent;
        if (!config.isRoot && !p) {
            p = await config.lookupParent(idOrSlug);
            setParent(p);
        }
        const res = await config.fetchItems(p);
        if (!res?.success) throw new Error("Request failed");
        return res.items || [];
    }, [idOrSlug]);

    const safeItems = items || [];
    const [query, setQuery] = useState("");



    const filtered = query.trim()
        ? safeItems.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
        : safeItems;

    const handleSearchSubmit = async (trimmedQuery) => {
        const route = await resolveSearchRoute(trimmedQuery);
        if (route) navigate(route.pathname, { state: route.state });
        else navigate(`/browse-search?q=${encodeURIComponent(trimmedQuery)}`);
    };

    const openItem = (item) => {
        const { pathname, state } = config.onSelectRoute(item, { parent, grandparent });
        navigate(pathname, { state });
    };

    const title = config.isRoot ? "All Categories" : (parent?.name || "Loading…");

    console.log("Title : ", title);

    const titleHref = config.isRoot || !config.upRoute ? null : config.upRoute(grandparent);

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            <CatalogHeader
                title={title}
                titleHref={titleHref}
                subtitle={`${safeItems.length} ${config.label}`}
            />

            <div className="mt-4 hidden lg:block">
                <MarketplaceSearchBar value={query} onChange={setQuery} onSubmit={handleSearchSubmit} />
            </div>

            <FilterSortChips />

            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    <TileGridSkeleton />
                ) : error ? (
                    <CatalogLoadError onRetry={retry} />
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-[13px] font-medium" style={{ color: C.muted }}>
                        {query ? `No ${config.label} match "${query}".` : `No ${config.label} available yet.`}
                    </p>
                ) : (
                    <TileGrid>
                        {filtered.map((item, i) => (
                            <IconTile
                                key={item.id}
                                image={item.image}
                                name={item.name}
                                idx={i}
                                count={item[config.itemCountField]}
                                onClick={() => openItem(item)}
                            />
                        ))}
                    </TileGrid>
                )}
            </div>
        </div>
    );
}