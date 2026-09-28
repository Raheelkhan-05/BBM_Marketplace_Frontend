// components/BottomNavStrip.jsx
//
// Mobile-only. Same nav items as Header's desktop row.
//
// CHANGED: tapping "Menu" now opens a FULL-SCREEN menu page (back arrow,
// shop-name title, icon-tile rows, dividers between groups, Helpline and
// Sign out as rows) instead of a half-height bottom sheet. The bottom bar
// stays visible underneath so "Menu" remains tappable (it toggles the page).
import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Menu, ArrowLeft, LogOut, ArrowUpRight,
    PackagePlus, Boxes, Store, FileText, HandCoins, Truck, ShoppingCart, MessageCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)" };

// Height of the fixed bottom bar (content) — the full-screen page reserves
// this much room at the bottom so nothing hides behind it.
const BOTTOM_BAR_HEIGHT = 56;

// Routes used by the mobile menu.
// TODO: confirm the two marked routes against your router — the rest are verified.
const MENU_ROUTES = {
    listProduct: "/seller/sell",
    manageProducts: "/seller/products",   // TODO confirm
    myStore: "/seller/store",
    // Sales + Purchase orders are the SAME page (/orders); the tab is chosen
    // by ?tab= so the menu lands directly on the right one.
    salesOrders: "/orders?tab=sales",
    creditRequest: "/seller/credit",      // TODO confirm
    transport: "/transport-library",
    cart: "/cart",
    purchaseOrders: "/orders?tab=purchases",
    chats: "/chat",
};

const badgeLabel = (n) => (n > 0 ? (n > 9 ? "9+" : n) : null);
const startsWithRoute = (route) => (p) => p === route || p.startsWith(route + "/");
const tabOf = (search) => new URLSearchParams(search || "").get("tab");
// Sales orders: /orders?tab=sales, or a sales order detail page.
const matchSalesOrders = (p, search) =>
    (p === "/orders" && tabOf(search) === "sales") || p.startsWith("/seller/orders");
// Purchase orders: /orders (any tab but sales) or a purchase order detail page.
const matchPurchaseOrders = (p, search) =>
    p.startsWith("/orders") && !(p === "/orders" && tabOf(search) === "sales");

// The mobile menu has its own item list (seller tools, buying, chats) —
// it is NOT NAV_ITEMS, which only has Home / My Store / Chat / Cart /
// My Orders / Transport Library for the desktop header.
function buildMenuItems({ isApprovedSeller, navigate, cartCount, chatUnread, purchaseUnread, salesUnread, productsBadge }) {
    const go = (to) => () => navigate(to);
    const item = (id, label, icon, to, rawBadge = 0, match = startsWithRoute(to)) => ({
        id, label, icon, to,
        badge: badgeLabel(rawBadge), rawBadge,
        onClick: go(to),
        match,
    });

    const sellerItems = isApprovedSeller
        ? [
            item("list-product", "List a product", PackagePlus, MENU_ROUTES.listProduct),
            item("manage-products", "Manage products", Boxes, MENU_ROUTES.manageProducts),
            item("my-store", "My store", Store, MENU_ROUTES.myStore, productsBadge),
            item("sales-orders", "Sales orders", FileText, MENU_ROUTES.salesOrders, salesUnread, matchSalesOrders),
            item("credit-request", "Credit request", HandCoins, MENU_ROUTES.creditRequest),
            item("transport", "Transport", Truck, MENU_ROUTES.transport),
        ]
        // Not an approved seller yet: My store is the entry point (it shows onboarding).
        : [item("my-store", "My store", Store, MENU_ROUTES.myStore)];

    return [
        ...sellerItems,
        item("cart", "Cart", ShoppingCart, MENU_ROUTES.cart, cartCount),
        item("purchase-orders", "Purchase orders", FileText, MENU_ROUTES.purchaseOrders, purchaseUnread, matchPurchaseOrders),
        item("chats", "Chats", MessageCircle, MENU_ROUTES.chats, chatUnread),
    ];
}

// Divider grouping, matched by lowercase label (NAV_ITEMS' ids aren't known
// here). A divider is drawn whenever the group changes between two
// consecutive items. Anything not listed falls into group 2.
//   group 0: seller tools   group 1: buying   group 2: everything else
const SELLER_LABELS = ["list a product", "manage products", "my store", "sales orders", "credit request", "transport"];
const BUYER_LABELS = ["cart", "purchase orders"];
function groupOf(item) {
    const label = String(item.label || "").trim().toLowerCase();
    if (SELLER_LABELS.includes(label)) return 0;
    if (BUYER_LABELS.includes(label)) return 1;
    return 2;
}

function formatShopName(slug) {
    if (!slug) return "";
    // Drop the numeric suffix added for slug uniqueness (e.g. "acme-traders-2").
    return slug
        .replace(/-\d+$/, "")
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function MenuRow({ item, active }) {
    const Icon = item.icon;
    return (
        <button
            onClick={item.onClick}
            aria-current={active ? "page" : undefined}
            className="relative flex w-full items-center gap-3 px-1 py-1.5 text-left transition-opacity duration-150 active:opacity-60"
        >
            {/* Active marker: thin accent bar flush with the screen's left edge
                (-left-5 cancels the list's px-5 padding). */}
            {active && (
                <span
                    aria-hidden="true"
                    className="absolute -left-5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ background: "#000" }}
                />
            )}
            <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: active ? "#000" : C.tile }}
            >
                <Icon className="h-4 w-4" style={{ color: active ? "#fff" : C.ink }} />
            </span>
            <span
                className={`flex-1 text-[14px] tracking-wide ${active ? "font-extrabold" : "font-semibold"}`}
                style={{ color: active ? "#000" : C.ink }}
            >
                {item.label}
            </span>
            {item.badge != null && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d2462b] px-1.5 text-[9.5px] font-bold text-white">
                    {item.badge}
                </span>
            )}
        </button>
    );
}

function Divider() {
    return <div className="-mx-5 my-2 h-px" style={{ background: C.hair }} />;
}

export default function BottomNavStrip({ onOpenRfq }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const { isLoggedIn, profile, signOut } = useAuth();
    const { purchaseUnreadCount, salesUnreadCount } = useNotifications();
    const { cartCount } = useCart();
    const { unreadTotal: chatUnreadTotal } = useChatContext();
    const { totalBadgeCount: productsBadgeCount } = useListings();
    const isApprovedSeller = profile?.seller_status === "approved";

    const stopScrollPropagation = useCallback((e) => { e.stopPropagation(); }, []);

    const items = buildMenuItems({
        isApprovedSeller, navigate,
        cartCount,
        chatUnread: chatUnreadTotal,
        purchaseUnread: purchaseUnreadCount,
        salesUnread: salesUnreadCount,
        productsBadge: productsBadgeCount,
    });

    const [pageOpen, setPageOpen] = useState(false);

    // Close automatically on route change so it never lingers over the next page.
    useEffect(() => { setPageOpen(false); }, [pathname]);

    // Lock background scroll while the full-screen menu is open.
    useEffect(() => {
        if (!pageOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = original; };
    }, [pageOpen]);

    const badgeTotal = items.reduce((sum, it) => sum + (it.rawBadge || 0), 0);
    const badgeDisplay = badgeTotal > 0 ? (badgeTotal > 9 ? "9+" : badgeTotal) : null;

    return (
        <>
            {/* Bottom bar — z-40, sits ABOVE the full-screen page (z-[39]) so
                the Menu button stays visible and works as a toggle. */}
            <nav
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
                style={{ backgroundColor: "#fff", borderColor: C.hair, paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex items-center justify-center px-3" style={{ height: BOTTOM_BAR_HEIGHT }}>
                    {isLoggedIn ? (
                        <button
                            onClick={() => setPageOpen((v) => !v)}
                            aria-label={badgeDisplay ? `${pageOpen ? "Close" : "Open"} menu, ${badgeTotal} unread` : `${pageOpen ? "Close" : "Open"} menu`}
                            aria-expanded={pageOpen}
                            className="relative flex items-center justify-center gap-2 py-1 text-[15px] font-bold"
                            style={{ color: "#000" }}
                        >
                            <Menu className="h-4 w-4" />
                            Menu
                            {badgeDisplay != null && !pageOpen && (
                                <span className="absolute -right-5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#d2462b] px-1 text-[9px] font-bold text-white">
                                    {badgeDisplay}
                                </span>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate("/login")}
                            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #2a2a2aff 0%, #000000 100%)" }}
                        >
                            Sign In
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </nav>

            {/* Full-screen menu page */}
            <div
                className={`fixed inset-0 z-[39] flex flex-col bg-white transition-transform duration-300 ease-out md:hidden ${pageOpen ? "" : "pointer-events-none"}`}
                style={{
                    transform: pageOpen ? "translateY(0)" : "translateY(100%)",
                    paddingTop: "env(safe-area-inset-top)",
                }}
                aria-hidden={!pageOpen}
            >
                {/* Back arrow + title */}
                <div className="shrink-0 px-5 pt-3">
                    <button
                        onClick={() => setPageOpen(false)}
                        aria-label="Close menu"
                        className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full active:bg-black/[0.05]"
                        style={{ color: C.ink }}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="mt-2 truncate text-[20px] font-extrabold leading-tight tracking-tight" style={{ color: C.ink }}>
                        {profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM"}
                    </h1>
                </div>

                {/* Scrollable list — bottom padding clears the fixed bottom bar */}
                <div
                    className="flex-1 overflow-y-auto px-5 pt-3"
                    style={{
                        overscrollBehavior: "contain",
                        paddingBottom: `calc(${BOTTOM_BAR_HEIGHT}px + env(safe-area-inset-bottom) + 16px)`,
                    }}
                    data-lenis-prevent=""
                    onWheel={stopScrollPropagation}
                    onTouchStart={stopScrollPropagation}
                    onTouchMove={stopScrollPropagation}
                >
                    <div className="flex flex-col gap-1">
                        {items.map((it, i) => {
                            const showDivider = i > 0 && groupOf(items[i - 1]) !== groupOf(it);
                            return (
                                <div key={it.id}>
                                    {showDivider && <Divider />}
                                    <MenuRow
                                        item={{
                                            ...it,
                                            onClick: () => {
                                                setPageOpen(false);
                                                it.onClick();
                                            },
                                        }}
                                        active={it.match(pathname, search)}
                                    />
                                </div>
                            );
                        })}

                        {isLoggedIn && (
                            <>
                                {items.length > 0 && groupOf(items[items.length - 1]) !== 2 && <Divider />}

                                {/* Helpline — HelpBulb keeps its own tap behaviour */}
                                <div className="flex w-full items-center gap-3 px-1 py-1.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: C.tile }}>
                                        <HelpBulb inline />
                                    </span>
                                    <span className="flex-1 text-[14px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                        Helpline
                                    </span>
                                </div>

                                {/* Sign out */}
                                <button
                                    onClick={() => { setPageOpen(false); signOut(); }}
                                    className="flex w-full items-center gap-3 px-1 py-1.5 text-left active:opacity-60"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: C.tile }}>
                                        <LogOut className="h-4 w-4" style={{ color: C.ink }} />
                                    </span>
                                    <span className="flex-1 text-[14px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                        Sign out
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}