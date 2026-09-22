// components/BottomNavStrip.jsx
//
// Mobile-only. Same nav items as Header's desktop row.
//
// CHANGED: no more "fit what you can inline, overflow the rest" logic.
// The bottom bar now shows a single trigger button. Tapping it slides up
// a sheet (from the bottom, capped at half the viewport height) listing
// every nav item directly, plus HelpBulb and Sign out/Sign in.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { NAV_ITEMS } from "./navItems.js";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)" };

function NavPill({ item, active }) {
    const Icon = item.icon;
    return (
        <button
            onClick={item.onClick}
            className="relative flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-[14px] font-bold transition-colors duration-150"
            style={{
                color: active ? "#fff" : C.ink,
                background: active ? "#000000" : "rgba(20,27,34,0.045)",
            }}
        >
            <Icon className="h-4 w-4 shrink-0" style={{ color: active ? "#fff" : C.muted }} />
            <span>{item.label}</span>
            {item.badge != null && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#d2462b] px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                </span>
            )}
        </button>
    );
}

function formatShopName(slug) {
    if (!slug) return "";
    // Shop slugs get a numeric suffix appended when the base name is
    // already taken (e.g. "acme-traders-2", "acme-traders-3") to keep the
    // slug unique — that's a backend uniqueness detail, not something a
    // user should see as part of their shop's display name.
    const withoutDuplicateSuffix = slug.replace(/-\d+$/, "");

    return withoutDuplicateSuffix
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}


export default function BottomNavStrip({ onOpenRfq }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { isLoggedIn, profile, signOut } = useAuth();
    const { orderUnreadCount } = useNotifications();
    const { cartCount } = useCart();
    const { unreadTotal: chatUnreadTotal } = useChatContext();
    const { totalBadgeCount: productsBadgeCount } = useListings();
    const isApprovedSeller = profile?.seller_status === "approved";

    const items = NAV_ITEMS({
        isLoggedIn, isApprovedSeller, onOpenRfq, navigate,
        ordersBadgeCount: orderUnreadCount,
        cartBadgeCount: cartCount,
        chatBadgeCount: chatUnreadTotal,
        productsBadgeCount: productsBadgeCount,
    });

    const [sheetOpen, setSheetOpen] = useState(false);

    // Close the sheet automatically on route change so it never lingers
    // over the next page.
    useEffect(() => {
        setSheetOpen(false);
    }, [pathname]);

    // Sum of unread/pending counts across every nav item, shown as a
    // badge on the trigger button itself since nothing is visible inline
    // anymore to carry its own badge.
    const badgeTotal = items.reduce((sum, it) => sum + (it.rawBadge || 0), 0);
    const badgeDisplay = badgeTotal > 0 ? (badgeTotal > 9 ? "9+" : badgeTotal) : null;

    return (
        <>
            <nav
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
                style={{ backgroundColor: "#000", borderColor: C.hair, paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex items-center justify-center px-3 py-2 pb-2.5 -mt-2 pt-4">
                    {isLoggedIn ? (
                        <button
                            onClick={() => setSheetOpen(true)}
                            aria-label={badgeDisplay ? `Open menu, ${badgeTotal} unread` : "Open menu"}
                            aria-expanded={sheetOpen}
                            className="relative flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold"
                            style={{ color: "#fff" }}
                        >
                            <Menu className="h-4 w-4" />
                            Menu

                            {badgeDisplay != null && (
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

            {/* Sheet: slides up from the bottom, capped at half the viewport
                height, every nav item listed vertically along with Help and
                Sign out/Sign in. */}
            <div
                className={`fixed inset-0 z-50 md:hidden ${sheetOpen ? "" : "pointer-events-none"}`}
                aria-hidden={!sheetOpen}
            >
                <div
                    onClick={() => setSheetOpen(false)}
                    className="absolute inset-0 bg-black/30 transition-opacity duration-200"
                    style={{ opacity: sheetOpen ? 1 : 0 }}
                />
                <div
                    className="absolute inset-x-0 bottom-0 flex max-h-[65vh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-250 ease-out"
                    style={{
                        transform: sheetOpen ? "translateY(0)" : "translateY(100%)",
                        paddingBottom: "env(safe-area-inset-bottom)",
                    }}
                >
                    <div className="flex items-center justify-between px-5 pt-4 pb-3">
                        <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                            {profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM"}
                        </span>
                        <button
                            onClick={() => setSheetOpen(false)}
                            aria-label="Close"
                            className="rounded-full p-2"
                            style={{ background: "rgba(20,27,34,0.045)", color: C.ink }}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-5">
                        {items.map((it) => (
                            <NavPill
                                key={it.id}
                                item={{
                                    ...it,
                                    onClick: () => {
                                        setSheetOpen(false);
                                        it.onClick();
                                    },
                                }}
                                active={it.match(pathname)}
                            />
                        ))}
                        <div className="mt-2 flex items-center gap-3 border-t pt-3" style={{ borderColor: C.hair }}>
                            {isLoggedIn ? (
                                <div className="flex shrink-0 items-center gap-2">
                                    <HelpBulb inline />
                                    <span className="text-[14px] font-bold" style={{ color: C.ink }}>
                                        Help Desk
                                    </span>
                                </div>
                            ) : (
                                null
                            )}

                            <div className="flex flex-1 justify-end">
                                {isLoggedIn ? (
                                    <button
                                        onClick={() => { setSheetOpen(false); signOut(); }}
                                        className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[14px] font-bold text-rose-600"

                                    >
                                        <LogOut className="h-4 w-4 shrink-0" />
                                        Sign out
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { setSheetOpen(false); navigate("/login"); }}
                                        className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3.5 text-[14px] font-bold text-white"
                                        style={{ background: "linear-gradient(135deg, #2a2a2aff 0%, #000000 100%)" }}
                                    >
                                        Sign In
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}