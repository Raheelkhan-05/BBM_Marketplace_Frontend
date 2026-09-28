// components/BottomNavStrip.jsx
//
// Mobile-only. Menu items come from the shared ./menuItems.js (same list the
// desktop Header uses), so routes, badges, grouping and active matching live
// in one place. Approved sellers' "My store" goes to /seller/onboarding.
//
// Tapping the floating Menu button opens a FULL-SCREEN menu page (shop-name
// title, icon-tile rows, dividers between groups, Helpline and Sign out).
// The button stays visible on top and toggles the page.
import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";
import { buildMenuItems } from "./menuItems.js";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)" };

// Bottom clearance so the last menu row never hides behind the FAB.
const FAB_CLEARANCE = 88;
// On /home the search bar is pinned to the bottom, so the FAB sits above it.
const FAB_BOTTOM_DEFAULT = 16;
const FAB_BOTTOM_HOME = 84;

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
    const fabBottom = pathname === "/home" ? FAB_BOTTOM_HOME : FAB_BOTTOM_DEFAULT;

    return (
        <>
            {/* Floating menu button — z-40 sits ABOVE the full-screen page (z-[39]),
                so it stays visible and toggles the menu (Menu icon ↔ X). */}
            <div
                className="fixed right-4 z-40 md:hidden"
                style={{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom, 0px))` }}
            >
                {isLoggedIn ? (
                    <motion.button
                        type="button"
                        onClick={() => setPageOpen((v) => !v)}
                        aria-label={badgeDisplay ? `${pageOpen ? "Close" : "Open"} menu, ${badgeTotal} unread` : `${pageOpen ? "Close" : "Open"} menu`}
                        aria-expanded={pageOpen}
                        initial={{ opacity: 0, y: 14, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
                        whileTap={{ scale: 0.92 }}
                        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]"
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={pageOpen ? "x" : "menu"}
                                initial={{ rotate: pageOpen ? -90 : 90, opacity: 0, scale: 0.6 }}
                                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                                exit={{ rotate: pageOpen ? 90 : -90, opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.18 }}
                                className="flex"
                            >
                                {pageOpen ? <X size={24} strokeWidth={2.5} /> : <Menu size={24} strokeWidth={2.5} />}
                            </motion.span>
                        </AnimatePresence>

                        {badgeDisplay != null && !pageOpen && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#d2462b] px-1 text-[9px] font-bold text-white">
                                {badgeDisplay}
                            </span>
                        )}
                    </motion.button>
                ) : (
                    <motion.button
                        type="button"
                        onClick={() => navigate("/login")}
                        initial={{ opacity: 0, y: 14, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
                        whileTap={{ scale: 0.94 }}
                        className="flex h-12 items-center gap-1.5 rounded-full bg-black px-5 text-[13px] font-bold text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]"
                    >
                        Sign In
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </motion.button>
                )}
            </div>

            {/* Full-screen menu page */}
            <div
                className={`fixed inset-0 z-[39] flex flex-col bg-white transition-transform duration-300 ease-out md:hidden ${pageOpen ? "" : "pointer-events-none"}`}
                style={{
                    transform: pageOpen ? "translateY(0)" : "translateY(100%)",
                    paddingTop: "env(safe-area-inset-top)",
                }}
                aria-hidden={!pageOpen}
            >
                {/* Title */}
                <div className="shrink-0 px-5 pt-3">
                    <h1 className="mt-2 truncate text-[20px] font-extrabold leading-tight tracking-tight" style={{ color: C.ink }}>
                        {profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM"}
                    </h1>
                </div>

                {/* Scrollable list — bottom padding clears the floating button */}
                <div
                    className="flex-1 overflow-y-auto px-5 pt-3"
                    style={{
                        overscrollBehavior: "contain",
                        paddingBottom: `calc(${FAB_CLEARANCE}px + env(safe-area-inset-bottom) + 16px)`,
                    }}
                    data-lenis-prevent=""
                    onWheel={stopScrollPropagation}
                    onTouchStart={stopScrollPropagation}
                    onTouchMove={stopScrollPropagation}
                >
                    <div className="flex flex-col gap-1">
                        {items.map((it, i) => {
                            const showDivider = i > 0 && items[i - 1].group !== it.group;
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
                                {items.length > 0 && items[items.length - 1].group !== 2 && <Divider />}

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