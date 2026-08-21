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
            id: "orders",
            label: "My Orders",
            icon: ShoppingBag,
            onClick: () =>
                navigate(isLoggedIn ? "/orders" : "/login", {
                    state: { from: "/orders" },
                }),
            match: (p) => p.startsWith("/orders"),
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