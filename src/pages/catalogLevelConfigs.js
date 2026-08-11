import {
    searchCatalogCategories,
    searchCatalogSubcategories,
    searchCatalogGenericProducts,
    searchCatalogBrandItems,
} from "../utils/api";
import { LEVEL_ROUTES, ROOT_ROUTE } from "../components/catalog/catalogRoutes";

// Everything that differs between the 4 tile-grid pages lives here.
// CatalogLevelPage.jsx is the only component; this is just data.
//
// IMPORTANT: every fetchItems below must go through the *paginated*
// searchCatalog* helpers (which accept and respect offset/limit and
// return { items, hasMore, nextOffset }). Plain searchCategories /
// searchSubcategories ignore offset entirely, which is why pagination
// previously got stuck after the first page.
export const CATALOG_LEVEL_CONFIGS = {
    categories: {
        level: "category",
        label: "categories",
        isRoot: true,
        fetchItems: (_parent, { offset = 0, limit = 20 } = {}) =>
            searchCatalogCategories("", limit, offset),
        itemCountField: "subcategoryCount",
        onSelectRoute: (item) => ({
            pathname: LEVEL_ROUTES.category(item),
            state: { category: item },
        }),
    },
    subcategories: {
        level: "subcategory",
        label: "subcategories",
        parentLevel: "category",
        lookupParent: async (idOrSlug) => {
            const res = await searchCatalogCategories(idOrSlug, 5);
            return res?.items?.find((c) => c.slug === idOrSlug || c.id === idOrSlug) || res?.items?.[0] || null;
        },
        fetchItems: (parent, { offset = 0, limit = 20 } = {}) =>
            searchCatalogSubcategories(parent.id, "", limit, offset),
        itemCountField: "productCount",
        onSelectRoute: (item, { parent }) => ({
            pathname: LEVEL_ROUTES.subcategory(item),
            state: { subcategory: item, category: parent },
        }),
        upRoute: () => ({ pathname: ROOT_ROUTE }),
    },
    products: {
        level: "generic_product",
        label: "products",
        parentLevel: "subcategory",
        lookupParent: async (idOrSlug) => {
            const res = await searchCatalogSubcategories(undefined, idOrSlug, 5);
            return res?.items?.find((s) => s.slug === idOrSlug || s.id === idOrSlug) || res?.items?.[0] || null;
        },
        fetchItems: (parent, { offset = 0, limit = 30 } = {}) =>
            searchCatalogGenericProducts(parent.id, "", limit, offset),
        itemCountField: "brandCount",
        onSelectRoute: (item, { parent, grandparent }) => ({
            pathname: LEVEL_ROUTES.generic_product(item),
            state: { genericProduct: item, subcategory: parent, category: grandparent },
        }),
        upRoute: (grandparent) => grandparent
            ? { pathname: LEVEL_ROUTES.category(grandparent), state: { category: grandparent } }
            : { pathname: ROOT_ROUTE },
    },
    brands: {
        level: "brand_item",
        label: "brands",
        parentLevel: "generic_product",
        lookupParent: async (idOrSlug) => {
            const res = await searchCatalogGenericProducts(undefined, idOrSlug, 5);
            return res?.items?.find((g) => g.slug === idOrSlug || g.id === idOrSlug) || res?.items?.[0] || null;
        },
        fetchItems: (parent, { offset = 0, limit = 30 } = {}) =>
            searchCatalogBrandItems(parent.id, "", limit, offset),
        itemCountField: "sellerCount",
        onSelectRoute: (item, { parent, grandparent }) => ({
            pathname: LEVEL_ROUTES.brand_item(item),
            state: { brand: item, genericProduct: parent, subcategory: grandparent?.subcategory, category: grandparent?.category },
        }),
        // NOTE: on the brands page, `grandparent` is the wrapper object
        // { subcategory, category } built in CatalogLevelPage.jsx —
        // NOT the subcategory itself. Must unwrap it here, otherwise
        // the "up" navigation hands the next page a fake parent whose
        // .name is undefined ("Products in undefined") and whose .id
        // is missing, breaking the next fetch.
        upRoute: (grandparent) => grandparent?.subcategory
            ? {
                pathname: LEVEL_ROUTES.subcategory(grandparent.subcategory),
                state: { subcategory: grandparent.subcategory, category: grandparent.category },
            }
            : { pathname: ROOT_ROUTE },
    },
};