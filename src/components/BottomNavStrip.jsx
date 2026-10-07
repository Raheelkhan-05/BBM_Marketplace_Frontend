// components/BottomNavStrip.jsx
//
// Mobile-only. Menu items come from the shared ./menuItems.js (same list the
// desktop Header uses), so routes, badges, grouping and active matching live
// in one place. Approved sellers' "My store" goes to /seller/onboarding.
//
// Tapping the floating Menu button opens a BOTTOM SHEET (shop-name title,
// icon-tile rows, dividers between groups, Helpline and Sign out). The sheet
// is only as tall as its content needs, capped at SHEET_MAX_HEIGHT; if the
// items don't fit, the list inside scrolls. A dimmed backdrop sits behind it
// and tapping the backdrop closes the menu. The button stays visible on top
// and toggles the sheet.
//
// HOME PAGE LAYOUT: on /home the floating buttons are three round icon FABs
// (Grow, Save, Menu) laid out on a 5-column grid, using the middle 3 columns,
// so the group is centred on the screen. They hide while an input is focused
// (keyboard open). Grow/Save fade out while the menu sheet is open.
//
// EVERYWHERE ELSE: the original right-aligned column. While the menu is open,
// a black Home button springs up directly above the Menu button.
import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, ArrowUpRight, Home, LogIn, Megaphone, Boxes, Receipt } from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";
import { buildMenuItems, MENU_ROUTES } from "./menuItems.js";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)" };

// Max height of the menu sheet, as a share of the screen height.
const SHEET_MAX_HEIGHT = "min(85dvh, calc(100dvh - 130px))";

// FAB geometry, used to keep the last menu row clear of the floating buttons:
// Menu FAB 56px + gap 12px + Home FAB 56px + a little breathing room.
const FAB_STACK_HEIGHT = 12;
const FAB_SIZE = 56;
const FAB_BOTTOM_DEFAULT = 16;
// On /home nothing else is pinned to the bottom any more, so same as default.
const FAB_BOTTOM_HOME = 12;

const DOCK_HEIGHT = 84; // 60 (tallest button) + 18 padding + 3 border + 4 ring

// Same colours as .gl .dock in grow.css
const FAB_THEME = {
    grow: { bg: "#22A06B", fg: "#FFFFFF" },
    save: { bg: "#FFD60A", fg: "#06161C" },
    home: { bg: "#0B5563", fg: "#FFFFFF" },
    menu: { bg: "#0B5563", fg: "#FFFFFF" },
    login: { bg: "#08222B", fg: "#FFFFFF" }, // dark, so it never looks like Save
};

const svgBase = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const GrowIcon = () => <svg {...svgBase}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>;
const SaveIcon = () => <span style={{ font: "900 1.5rem 'Figtree', system-ui, sans-serif", lineHeight: 1 }}>₹</span>;
const HomeIcon = () => <Home size={22} strokeWidth={1.8} aria-hidden="true" />;

// size 52 / 60 and the raised Save button match .dock a / .dock .dy
const TILES = {
    home: { key: "home", label: "Home", Icon: HomeIcon, to: "/home", theme: FAB_THEME.home, size: 52 },
    grow: { key: "grow", label: "Grow", Icon: GrowIcon, to: "/grow", theme: FAB_THEME.grow, size: 52 },
    save: { key: "save", label: "Save", Icon: SaveIcon, to: "/save", theme: FAB_THEME.save, size: 60 },
};

const DOCK_BTN = "relative grid shrink-0 place-items-center rounded-full";


const SELLER_TILES = [
    { key: "enq", label: "Enquiries", Icon: Megaphone, to: "/grow/enquiries", bg: "#F4511E", fg: "#FFFFFF" },
    { key: "prod", label: "Products", Icon: Boxes, to: "/grow/products", bg: "#FFD60A", fg: "#06161C" },
    { key: "ord", label: "Orders", Icon: Receipt, to: "/grow/orders", bg: "#22A06B", fg: "#FFFFFF" },
];

// Dock surface colours (change here to re-theme the dock).
const DOCK_BG = "#ffffff";      // petrol blue
const DOCK_RING = "#ffffff";    // the ring colour where the comet isn't passing
const DOCK_SHADOW = "rgba(255,255,255)";

// Dock animation: a bright comet travelling around a dark pill, plus a shine sweep,
// a ping on Save and a nudge on Grow. All CSS, no JS, and all switched off for
// reduced-motion users.
const DOCK_CONIC =
    "conic-gradient(from 0deg, rgba(31,122,77,0) 0deg, rgba(31,122,77,0) 110deg, rgba(31,122,77,0.55) 200deg, #34C77B 275deg, #F5C75A 325deg, #FFFFFF 350deg, rgba(255,255,255,0) 360deg)";

const DOCK_AURA_CSS = `
.bbm-dock-spin {
    transform: translate(-50%, -50%);
    animation: bbm-dock-spin 6s linear infinite;
    will-change: transform;
}
@keyframes bbm-dock-spin {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(360deg); }
}
.bbm-dock-ping {
    animation: bbm-dock-ping 3.5s ease-out infinite;
}
@keyframes bbm-dock-ping {
    0%, 55% { transform: scale(1);   opacity: 0; }
    60%     { transform: scale(1);   opacity: 0.8; }
    100%    { transform: scale(1.75); opacity: 0; }
}
.bbm-dock-nudge {
    animation: bbm-dock-nudge 3.5s ease-in-out infinite;
}
@keyframes bbm-dock-nudge {
    0%, 60%, 100% { transform: translate(0, 0); }
    78%           { transform: translate(2.5px, -2.5px); }
}
@media (prefers-reduced-motion: reduce) {
    .bbm-dock-spin, .bbm-dock-ping, .bbm-dock-nudge { animation: none; }
    .bbm-dock-ping { display: none; }
}
body:has(.gs .bar) .bbm-dock { bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important; }
`;

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

// True while any text field is focused (i.e. the mobile keyboard is up).
function useTypingActive() {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const isField = (el) =>
            !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
        const onIn = (e) => { if (isField(e.target)) setActive(true); };
        const onOut = () => setTimeout(() => { if (!isField(document.activeElement)) setActive(false); }, 50);
        document.addEventListener("focusin", onIn);
        document.addEventListener("focusout", onOut);
        return () => {
            document.removeEventListener("focusin", onIn);
            document.removeEventListener("focusout", onOut);
        };
    }, []);
    return active;
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
    const { isLoggedIn, effectiveLoggedIn, profile, signOut } = useAuth();
    const { purchaseUnreadCount, salesUnreadCount, creditUnreadCount } = useNotifications();
    const { cartCount } = useCart();
    const { unreadTotal: chatUnreadTotal } = useChatContext();
    const { totalBadgeCount: productsBadgeCount } = useListings();
    const isApprovedSeller = profile?.seller_status === "approved";

    const stopScrollPropagation = useCallback((e) => { e.stopPropagation(); }, []);

    const allItems = buildMenuItems({
        isApprovedSeller, navigate,
        cartCount,
        chatUnread: chatUnreadTotal,
        purchaseUnread: purchaseUnreadCount,
        salesUnread: salesUnreadCount,
        productsBadge: productsBadgeCount,
        creditUnread: creditUnreadCount,
    });


    const isHome = pathname === "/home" || pathname === "/home/";
    const inGrow = pathname === "/grow" || pathname.startsWith("/grow/");
    const inSave = pathname === "/save" || pathname.startsWith("/save/");
    const inSellerArea = /^\/grow\/(enquiries|products|orders|wallet)(\/|$)/.test(pathname);
    const showSellerTabs = inSellerArea && effectiveLoggedIn;
    const sellerBadge = { prod: productsBadgeCount, ord: salesUnreadCount };
    const fabBottom = FAB_BOTTOM_HOME;

    // The module you're in swaps its FAB for Home.
    const dockTiles = [inGrow ? TILES.home : TILES.grow, inSave ? TILES.home : TILES.save];

    // Home is in the dock on module pages and is pointless on /home itself.
    const items = allItems.filter((it) => !(it.id === "home" && (isHome || inGrow || inSave)));

    const [pageOpen, setPageOpen] = useState(false);
    const typing = useTypingActive();

    // Close automatically on route change so it never lingers over the next page.
    useEffect(() => { setPageOpen(false); }, [pathname]);

    // Lock background scroll while the menu is open.
    useEffect(() => {
        if (!pageOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = original; };
    }, [pageOpen]);

    const badgeTotal = items.reduce((sum, it) => sum + (it.rawBadge || 0), 0);
    const badgeDisplay = badgeTotal > 0 ? (badgeTotal > 9 ? "9+" : badgeTotal) : null;

    const goHome = () => {
        setPageOpen(false);
        // Already on Home: just close the menu, no redundant navigation.
        if (pathname !== "/home") navigate(MENU_ROUTES.home);
    };

    // Defined once, used by both the Home grid and the default column.
    const menuButton = (
        <motion.button
            type="button"
            onClick={() => setPageOpen((v) => !v)}
            aria-label={badgeDisplay ? `${pageOpen ? "Close" : "Open"} menu, ${badgeTotal} unread` : `${pageOpen ? "Close" : "Open"} menu`}
            aria-expanded={pageOpen}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            className={DOCK_BTN}
            style={{ width: 52, height: 52, background: FAB_THEME.menu.bg, color: FAB_THEME.menu.fg }}
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
                    {pageOpen ? <X size={22} strokeWidth={2.4} /> : <Menu size={22} strokeWidth={2.4} />}
                </motion.span>
            </AnimatePresence>

            {badgeDisplay != null && !pageOpen && (
                <span className="absolute -right-0.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#d2462b] px-1 text-[9px] font-bold text-white">
                    {badgeDisplay}
                </span>
            )}
        </motion.button>
    );

    const signInButton = (
        <motion.button
            type="button"
            onClick={() => navigate("/login")}
            aria-label="Sign in"
            title="Sign in"
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            className={DOCK_BTN}
            style={{ width: 52, height: 52, background: FAB_THEME.login.bg, color: FAB_THEME.login.fg }}
        >
            <LogIn size={22} strokeWidth={2.4} />
        </motion.button>
    );

    return (
        <>
            <div
                className={`bbm-dock pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-opacity duration-150 ${typing ? "opacity-0" : ""}`}
                style={{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom, 0px))` }}
            >
                <div className={`${typing ? "pointer-events-none" : "pointer-events-auto"} relative isolate rounded-full`}>
                    <style>{DOCK_AURA_CSS}</style>

                    {/* aura: blurred halo */}
                    <span aria-hidden className={`pointer-events-none absolute -inset-[4px] -z-10 overflow-hidden rounded-full blur-[8px] transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-70"}`}>
                        <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                    </span>

                    {/* aura: comet ring */}
                    <span aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-100"}`} style={{ background: DOCK_RING }}>
                        <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                    </span>

                    {/* the dock itself: exactly .gl .dock */}
                    <div
                        className={`relative m-[2px] flex items-center justify-center rounded-full border-[1.5px] p-[9px] backdrop-blur-[14px] transition-[background-color,box-shadow,gap] duration-200 ${showSellerTabs ? "gap-2" : "gap-3"}`}
                        style={{
                            background: pageOpen ? "transparent" : "rgba(255,255,255,.92)",
                            borderColor: pageOpen ? "transparent" : "#DFE7EA",
                            boxShadow: pageOpen ? "none" : "0 18px 40px -12px rgba(8,34,43,.4)",
                        }}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            {dockTiles.map(({ key, label, Icon, to, theme, size }) => (
                                <motion.button
                                    key={key}
                                    layout
                                    type="button"
                                    onClick={() => navigate(to)}
                                    aria-label={label}
                                    title={label}
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: pageOpen ? 0 : 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                                    whileTap={{ scale: 0.92 }}
                                    style={{ width: size, height: size, marginTop: key === "save" ? -4 : 0, background: theme.bg, color: theme.fg }}
                                    className={`${DOCK_BTN} ${pageOpen ? "pointer-events-none" : ""}`}
                                >
                                    {key === "save" && (
                                        <span aria-hidden className="bbm-dock-ping pointer-events-none absolute inset-0 rounded-full border-2" style={{ borderColor: FAB_THEME.save.bg }} />
                                    )}
                                    <span className={`flex ${key === "grow" ? "bbm-dock-nudge" : ""}`}><Icon /></span>
                                </motion.button>
                            ))}
                        </AnimatePresence>

                        {/* seller tabs: keep the AnimatePresence block exactly as you have it */}

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div key={effectiveLoggedIn ? "menu" : "login"} className="contents"
                                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                                {effectiveLoggedIn ? menuButton : signInButton}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Backdrop — dims the page behind the sheet; tap to close */}
            <div
                aria-hidden="true"
                onClick={() => setPageOpen(false)}
                className={`fixed inset-0 z-[38] bg-black/35 transition-opacity duration-300 ${isHome ? "" : "md:hidden"} ${pageOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
            />

            {/* Bottom sheet — height follows its content, capped at SHEET_MAX_HEIGHT.
                Past the cap, the list inside scrolls.
                Desktop (Home only): a centred floating panel sitting above the FAB row. */}
            <div
                className={`fixed inset-x-0 bottom-0 z-[39] mx-auto flex flex-col overflow-hidden rounded-t-3xl bg-white transition-[transform,box-shadow] duration-300 ease-out ${isHome ? "md:bottom-[96px] md:max-h-[70dvh] md:max-w-[420px] md:rounded-3xl" : "md:hidden"} ${pageOpen ? "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]" : "pointer-events-none"}`}
                style={{
                    maxHeight: SHEET_MAX_HEIGHT,
                    transform: pageOpen ? "translateY(0)" : "translateY(calc(100% + 140px))",
                }}
                role="dialog"
                aria-label="Menu"
                aria-hidden={!pageOpen}
            >
                {/* Grab handle + title */}
                <div className="shrink-0 px-5 pt-2.5">
                    <div className="mx-auto h-1 w-10 rounded-full" style={{ background: C.hair }} />
                    <div role="heading" aria-level={2} className="mt-3 truncate text-[20px] font-extrabold leading-tight tracking-tight" style={{ color: C.ink }}>
                        {profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM"}
                    </div>
                </div>

                {/* List — min-h-0 lets it shrink and scroll when the sheet hits its max height.
                    Bottom padding clears the floating buttons. */}
                <div
                    className={`min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-[var(--sheet-pb)] md:pb-5 ${isHome ? "md:pb-5" : ""}`}
                    style={{
                        overscrollBehavior: "contain",
                        "--sheet-pb": `calc(${fabBottom + DOCK_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`,
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

                        {effectiveLoggedIn && (
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