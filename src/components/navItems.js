// components/navItems.js
//
// Single source of truth for the primary nav — consumed by Header's
// desktop row and BottomNavStrip's mobile row so both stay in sync.
// A factory (not a static array) because a couple of entries need
// runtime state: isLoggedIn/isApprovedSeller change what "My Orders"
// and the last item point to.
import { Home, LayoutGrid, ShoppingBag, Store, FileText, Package, ListChecks } from "lucide-react";

export function NAV_ITEMS({ isLoggedIn, isApprovedSeller, onOpenRfq, navigate }) {
    return [
        { id: "home", label: "Home", icon: Home, onClick: () => navigate("/home"), match: (p) => p === "/home" },
        { id: "listings", label: "Listings", icon: ListChecks, onClick: () => navigate("/admin/listings"), match: (p) => p.startsWith("/admin/listings") },
        { id: "categories", label: "Categories", icon: LayoutGrid, onClick: () => navigate("/categories"), match: (p) => p.startsWith("/categor") },
        { id: "orders", label: "My Orders", icon: ShoppingBag, onClick: () => navigate(isLoggedIn ? "/orders" : "/login", { state: { from: "/orders" } }), match: (p) => p.startsWith("/orders") },
        { id: "rfq", label: "Post RFQ", icon: FileText, onClick: onOpenRfq, match: () => false },
        isApprovedSeller
            ? { id: "sales", label: "My Sales", icon: Package, onClick: () => navigate("/seller/orders"), match: (p) => p.startsWith("/seller/orders") }
            : { id: "sell", label: "Start Selling", icon: Store, onClick: () => navigate("/seller/onboarding"), match: (p) => p.startsWith("/seller") },
    ];
}