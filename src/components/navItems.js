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
    Wallet,
} from "lucide-react";

export function NAV_ITEMS({ isLoggedIn, isApprovedSeller, onOpenRfq, navigate }) {
    return [
        isLoggedIn ? {
            id: "home",
            label: "Home",
            icon: Home,
            to: "/home",
            onClick: () => navigate("/home"),
            match: (p) => p === "/home",
        } : null,
        isLoggedIn ? {
            id: "sellerlist",
            label: "Seller Listing",
            icon: Store,
            to: "/seller/listings",
            onClick: () => navigate("/seller/listings"),
            match: (p) => p === "/seller/listings",
        } : null,
        isLoggedIn ? {
            id: "chat",
            label: "Chat",
            icon: MessageCircle,
            to: "/chat",
            onClick: () => navigate("/chat"),
            match: (p) => p === "/chat",
        } : null,
        isLoggedIn ? {
            id: "cart",
            label: "Cart",
            icon: ShoppingCart,
            to: "/cart",
            onClick: () => navigate("/cart"),
            match: (p) => p === "/cart",
        } : null,
        isLoggedIn ? {
            id: "orders",
            label: "My Orders",
            icon: ShoppingBag,
            to: "/orders",
            onClick: () =>
                navigate(isLoggedIn ? "/orders" : "/login", {
                    state: { from: "/orders" },
                }),
            match: (p) => p.startsWith("/orders"),
        } : null,
        isApprovedSeller
            ? {
                id: "wallet",
                label: "Wallet",
                icon: Wallet,
                to: "/seller/wallet",
                onClick: () => navigate("/seller/wallet"),
                match: (p) => p.startsWith("/seller/wallet"),
            }
            : null,
    ].filter(Boolean);
}