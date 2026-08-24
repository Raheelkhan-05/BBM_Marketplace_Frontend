import {
    Home,
    LayoutGrid,
    ShoppingBag,
    Store,
    FileText,
    Package,
    MessageCircle,
    ListChecks,
    PackagePlus,
    ShoppingCart,
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
            id: "sellerlist",
            label: "Seller Listing",
            icon: Store,
            onClick: () => navigate("/seller/listings"),
            match: (p) => p === "/seller/listings",
        },
        {
            id: "chat",
            label: "Chat",
            icon: MessageCircle,
            onClick: () => navigate("/chat"),
            match: (p) => p === "/chat",
        },
        {
            id: "cart",
            label: "Cart",
            icon: ShoppingCart,
            onClick: () => navigate("/cart"),
            match: (p) => p === "/cart",
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
        // Only show "My Sales" for approved sellers — no fallback
        // "Start Selling" item for anyone else.
        isApprovedSeller
            ? {
                id: "sales",
                label: "My Sales",
                icon: ChartNoAxesCombined,
                onClick: () => navigate("/seller/orders"),
                match: (p) => p.startsWith("/seller/orders"),
            }
            : null,
    ].filter(Boolean);
}