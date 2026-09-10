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

// ordersBadgeCount: total unread order notifications (purchase + sales
// combined) — see NotificationsContext's `orderUnreadCount`. Rendered by
// Header.jsx (desktop) and BottomNavStrip.jsx (mobile) as a small badge
// on the "My Orders" pill. Clamped to "9+" the same way the bell's badge
// is, for consistency.

export function NAV_ITEMS({ isLoggedIn, isApprovedSeller, onOpenRfq, navigate, ordersBadgeCount = 0, cartBadgeCount = 0, chatBadgeCount = 0 }) {
    return [
        isLoggedIn ? {
            id: "home",
            label: "Home",
            icon: Home,
            to: "/home",
            onClick: () => navigate("/home"),
            match: (p) => p === "/home",
        } : null,
        isLoggedIn
            ? {
                id: "myproducts",
                label: "My Products",
                icon: Package,
                to: "/seller/listings",
                onClick: () => navigate("/seller/listings"),
                match: (p) => p === "/seller/listings",
            }
            : null,
        isLoggedIn ? {
            id: "chat",
            label: "Chat",
            icon: MessageCircle,
            to: "/chat",
            badge: chatBadgeCount > 0 ? (chatBadgeCount > 9 ? "9+" : chatBadgeCount) : null,
            onClick: () => navigate("/chat"),
            match: (p) => p === "/chat" || p.startsWith("/chat/"),
        } : null,
        isLoggedIn ? {
            id: "cart",
            label: "Cart",
            icon: ShoppingCart,
            to: "/cart",
            badge: cartBadgeCount > 0 ? (cartBadgeCount > 9 ? "9+" : cartBadgeCount) : null,
            onClick: () => navigate("/cart"),
            match: (p) => p === "/cart",
        } : null,
        isLoggedIn ? {
            id: "orders",
            label: "My Orders",
            icon: ShoppingBag,
            to: "/orders",
            badge: ordersBadgeCount > 0 ? (ordersBadgeCount > 9 ? "9+" : ordersBadgeCount) : null,
            onClick: () =>
                navigate(isLoggedIn ? "/orders" : "/login", {
                    state: { from: "/orders" },
                }),
            match: (p) => p.startsWith("/orders"),
        } : null,

    ].filter(Boolean);
}