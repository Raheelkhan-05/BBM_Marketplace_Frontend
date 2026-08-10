import {
    searchCategories, searchSubcategories,
    searchCatalogSubcategories, searchCatalogGenericProducts, searchCatalogBrandItems,
} from "../utils/api";
import { LEVEL_ROUTES, ROOT_ROUTE } from "../components/catalog/catalogRoutes";

// Everything that differs between the 4 tile-grid pages lives here.
// CatalogLevelPage.jsx is the only component; this is just data.
export const CATALOG_LEVEL_CONFIGS = {
    categories: {
        level: "category",
        label: "categories",
        isRoot: true,
        fetchItems: () => searchCategories("", 100),
        itemCountField: "subcategoryCount",
        onSelectRoute: (item) => ({ pathname: LEVEL_ROUTES.category(item), state: { category: item } }),
    },
    subcategories: {
        level: "subcategory",
        label: "subcategories",
        parentLevel: "category",
        lookupParent: async (idOrSlug) => {
            const res = await searchCategories(idOrSlug, 5);
            return res?.items?.find((c) => c.slug === idOrSlug || c.id === idOrSlug) || res?.items?.[0] || null;
        },
        fetchItems: (parent) => searchSubcategories(parent.id, "", 50),
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
        fetchItems: (parent) => searchCatalogGenericProducts(parent.id, "", 50),
        itemCountField: "brandCount",
        onSelectRoute: (item, { parent, grandparent }) => ({
            pathname: LEVEL_ROUTES.generic_product(item),
            state: { genericProduct: item, subcategory: parent, category: grandparent },
        }),
        upRoute: (grandparent) => grandparent
            ? { pathname: LEVEL_ROUTES.category(grandparent) }
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
        fetchItems: (parent) => searchCatalogBrandItems(parent.id, "", 50),
        itemCountField: "sellerCount",
        onSelectRoute: (item, { parent, grandparent }) => ({
            pathname: LEVEL_ROUTES.brand_item(item),
            state: { brand: item, genericProduct: parent, subcategory: grandparent?.subcategory, category: grandparent?.category },
        }),
        upRoute: (grandparent) => grandparent
            ? { pathname: LEVEL_ROUTES.subcategory(grandparent), state: { subcategory: grandparent } }
            : { pathname: ROOT_ROUTE },
    },
};