import {
    Home,
    LayoutGrid,
    ShoppingBag,
    Store,
    FileText,
    Package,
    ListChecks,
    PackagePlus,
    ChartNoAxesCombined,
} from "lucide-react";

export function NAV_ITEMS({ isLoggedIn, isApprovedSeller, onOpenRfq, navigate }) {
    return [
        {
            id: "home",
            label: "Home",
            icon: Home,
            onClick: () => navigate("/home"),
            match: (p) => p === "/home",
        },
        {
            id: "sellprod",
            label: "Sell Product",
            icon: PackagePlus,
            onClick: () => navigate("/seller/sell"),
            match: (p) => p === "/seller/sell",
        },
        {
            id: "sellerlist",
            label: "Seller Listing",
            icon: Store,
            onClick: () => navigate("/seller/listings"),
            match: (p) => p === "/seller/listings",
        },
        {
            id: "listings",
            label: "Listings",
            icon: ListChecks,
            onClick: () => navigate("/admin/listings"),
            match: (p) => p.startsWith("/admin/listings"),
        },
        {
            id: "categories",
            label: "Categories",
            icon: LayoutGrid,
            onClick: () => navigate("/categories"),
            match: (p) => p.startsWith("/categor"),
        },
        {
            id: "orders",
            label: "My Orders",
            icon: ShoppingBag,
            onClick: () =>
                navigate(isLoggedIn ? "/orders" : "/login", {
                    state: { from: "/orders" },
                }),
            match: (p) => p.startsWith("/orders"),
        },
        {
            id: "rfq",
            label: "Post RFQ",
            icon: FileText,
            onClick: onOpenRfq,
            match: () => false,
        },
        isApprovedSeller
            ? {
                id: "sales",
                label: "My Sales",
                icon: ChartNoAxesCombined,
                onClick: () => navigate("/seller/orders"),
                match: (p) => p.startsWith("/seller/orders"),
            }
            : {
                id: "sell",
                label: "Start Selling",
                icon: Store,
                onClick: () => navigate("/seller/onboarding"),
                match: (p) => p.startsWith("/seller"),
            },
    ];
}