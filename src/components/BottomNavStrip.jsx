// components/BottomNavStrip.jsx
//
// Floating dock (FABs) + menu sheet. Menu items come from the shared ./menuItems.js.
//
// Menu: a bottom sheet list on mobile, a wide card with a grid of tiles on desktop (md+).
// A dimmed backdrop sits behind it; tapping the backdrop (or pressing Escape) closes it.
//
// "List a product", "Manage products" and "Sales orders" are NOT in the menu any more
// (see HIDDEN_MENU_IDS): sellers reach them from the Grow module. Their notification
// counts are added together and shown as one badge on the Grow button in the dock.
//
// While the menu is open the other FABs collapse OUT of the dock (they take no space),
// so the dock shrinks to just the X button, which stays exactly where the Menu button was.
//
// Dock, backdrop and sheet are rendered through a portal on document.body.
// Only ONE instance ever renders (an extra copy renders nothing).
//
// Seller area (/grow/enquiries, /grow/products, /grow/orders, /grow/wallet):
// the dock shows Home, Enquiries, Products, Orders, then Menu.
import { Fragment, useEffect, useId, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, Home, LogIn, Megaphone, Boxes, Receipt } from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";
import { buildMenuItems } from "./menuItems.js";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)", tile: "rgba(20,27,34,0.06)" };

// Menu rows that now live in the Grow module (ids come from menuItems.js).
const HIDDEN_MENU_IDS = ["list-product", "manage-products", "sales-orders"];

const FAB_BOTTOM_HOME = 12;
const DOCK_HEIGHT = 84; // 60 (tallest button) + 18 padding + 3 border + 4 ring

// Layers (portal on document.body). Kept very high so page-level fixed bars sit underneath.
const Z_BACKDROP = 9990;
const Z_SHEET = 9991;
const Z_DOCK = 9992;

// Same timing for the tiles collapsing and the dock sliding, so they move together.
const DOCK_COLLAPSE = { duration: 0.22, ease: "easeOut" };

// Page elements that must disappear while the menu is open. Add selectors here
// if some page has its own bottom bar that stays visible over the dimmed page.
const HIDE_WHEN_MENU_OPEN = [".gl .dock"];

const FAB_THEME = {
    grow: { bg: "#22A06B", fg: "#FFFFFF" },
    save: { bg: "#FFD60A", fg: "#06161C" },
    home: { bg: "#114072", fg: "#FFFFFF" },
    menu: { bg: "#0B5563", fg: "#FFFFFF" },
    login: { bg: "#08222B", fg: "#FFFFFF" },
};

const SLOT = [
    { size: 52, icon: 22 },
    { size: 60, icon: 26, raised: true }, // the "Save" slot: bigger, raised, with the ping ring
];
const SLOT_PLAIN = { size: 52, icon: 22 };
// Seller tiles: same size and lift as the Save button, but no ping ring (`lift`, not `raised`).
const SLOT_SELLER = { size: 56, icon: 26, lift: true };

const svgBase = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const GrowIcon = () => <svg {...svgBase}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>;
const SaveIcon = () => <span style={{ font: "900 1.5rem 'Figtree', system-ui, sans-serif", lineHeight: 1 }}>₹</span>;
const HomeIcon = ({ size = 22 }) => <Home size={size} strokeWidth={1.8} aria-hidden="true" />;

const TILES = {
    home: { key: "home", label: "Home", Icon: HomeIcon, to: "/home", theme: FAB_THEME.home },
    grow: { key: "grow", label: "Grow", Icon: GrowIcon, to: "/grow", theme: FAB_THEME.grow },
    save: { key: "save", label: "Save", Icon: SaveIcon, to: "/save", theme: FAB_THEME.save },
};

const DOCK_BTN = "relative grid shrink-0 place-items-center rounded-full";

const SELLER_TILES = [
    { key: "enq", label: "Enquiries", Icon: Megaphone, to: "/grow/enquiries", bg: "#F4511E", fg: "#FFFFFF" },
    { key: "prod", label: "Products", Icon: Boxes, to: "/grow/products", bg: "#FFD60A", fg: "#06161C" },
    { key: "ord", label: "Orders", Icon: Receipt, to: "/grow/orders", bg: "#22A06B", fg: "#FFFFFF" },
];

const DOCK_RING = "#ffffff"; // ring colour where the comet isn't passing

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
.bbm-tile { outline: none; -webkit-tap-highlight-color: transparent; }
.bbm-tile:focus-visible { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #141B22 !important; }
`;

// While the menu is open: our own tiles are forced hidden, plus any selectors listed above.
const MENU_OPEN_CSS = `
body[data-bbm-menu="open"] .bbm-tile { opacity: 0 !important; pointer-events: none !important; }
${HIDE_WHEN_MENU_OPEN.map((s) => `body[data-bbm-menu="open"] ${s}`).join(",\n")} { visibility: hidden !important; }
`;

// Hide the dock while a GrowStartPage screen with its own sticky action bar is open
// (.app.hb = seller onboarding + Add Product wizard).
const HIDE_DOCK_CSS = `
body:has(.gs .app.hb) .bbm-dock { display: none !important; }
`;

// Mobile: bottom sheet. Desktop (md+): a wide card above the dock.
const SHEET_CSS = `
.bbm-sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: ${Z_SHEET};
    margin-inline: auto; display: flex; flex-direction: column; overflow: hidden;
    background: #fff; border-radius: 24px 24px 0 0;
    max-height: min(85dvh, calc(100dvh - 130px));
    transform: translateY(calc(100% + 140px));
    visibility: hidden; pointer-events: none;
    transition: transform .3s ease-out, box-shadow .3s ease-out, visibility 0s linear .3s;
}
.bbm-sheet[data-open="true"] {
    transform: translateY(0); visibility: visible; pointer-events: auto;
    box-shadow: 0 -12px 40px -12px rgba(0,0,0,.35);
    transition-delay: 0s;
}
@media (min-width: 768px) {
    .bbm-sheet {
        left: 50%; right: auto; margin-inline: 0;
        bottom: calc(${FAB_BOTTOM_HOME + DOCK_HEIGHT + 16}px + env(safe-area-inset-bottom, 0px));
        width: min(820px, calc(100vw - 64px));
        max-height: min(78dvh, calc(100dvh - 170px));
        border-radius: 28px; border: 1px solid rgba(20,27,34,.08);
        opacity: 0; transform: translate(-50%, 14px) scale(.98);
        transition: transform .2s ease-out, opacity .2s ease-out, visibility 0s linear .2s;
    }
    .bbm-sheet[data-open="true"] {
        opacity: 1; transform: translate(-50%, 0) scale(1);
        box-shadow: 0 28px 70px -18px rgba(8,34,43,.4);
    }
}
`;

// Menu rows: a slim list row on mobile, a bordered tile on desktop.
const ROW_BASE =
    "relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150 " +
    "md:flex-col md:items-start md:gap-4 md:rounded-2xl md:border md:p-4";
const ROW_IDLE = "md:border-[rgba(20,27,34,0.09)]";
const ROW_ACTIVE = "md:border-black";
const ROW_INTERACTIVE =
    "active:opacity-60 md:hover:border-[rgba(20,27,34,0.28)] md:hover:bg-black/[0.03] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7285]/40";
const ICON_TILE = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:h-11 md:w-11 md:rounded-2xl";
const ROW_LABEL = "flex-1 text-[14px] tracking-wide md:flex-none md:text-[15px]";

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

// Only the first mounted instance renders; any extra copy renders nothing.
const mountedIds = [];
const subscribers = new Set();
const notifyAll = () => subscribers.forEach((fn) => fn());
function useIsPrimaryInstance() {
    const id = useId();
    const [primary, setPrimary] = useState(false);
    useEffect(() => {
        mountedIds.push(id);
        const sync = () => setPrimary(mountedIds[0] === id);
        subscribers.add(sync);
        notifyAll();
        return () => {
            const i = mountedIds.indexOf(id);
            if (i >= 0) mountedIds.splice(i, 1);
            subscribers.delete(sync);
            notifyAll();
        };
    }, [id]);
    return primary;
}

function MenuRow({ item, active }) {
    const Icon = item.icon;
    return (
        <button
            onClick={item.onClick}
            aria-current={active ? "page" : undefined}
            className={`${ROW_BASE} ${active ? ROW_ACTIVE : ROW_IDLE} ${ROW_INTERACTIVE}`}
        >
            {/* Mobile only: thin bar flush with the sheet's left edge (-left-5 cancels the list's px-5). */}
            {active && (
                <span
                    aria-hidden="true"
                    className="absolute -left-5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full md:hidden"
                    style={{ background: "#000" }}
                />
            )}
            <span className={ICON_TILE} style={{ background: active ? "#000" : C.tile }}>
                <Icon className="h-4 w-4 md:h-5 md:w-5" style={{ color: active ? "#fff" : C.ink }} />
            </span>
            <span
                className={`${ROW_LABEL} ${active ? "font-extrabold" : "font-semibold"}`}
                style={{ color: active ? "#000" : C.ink }}
            >
                {item.label}
            </span>
            {item.badge != null && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d2462b] px-1.5 text-[9.5px] font-bold text-white md:absolute md:right-3 md:top-3">
                    {item.badge}
                </span>
            )}
        </button>
    );
}

function Divider() {
    // Dividers only make sense in the mobile list; the desktop grid has none.
    return <div className="-mx-5 my-2 h-px md:hidden" style={{ background: C.hair }} />;
}

const countLabel = (n) => (n > 99 ? "99+" : n);

export default function BottomNavStrip({ onOpenRfq }) {
    const primary = useIsPrimaryInstance();
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const { effectiveLoggedIn, profile, signOut } = useAuth();
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
    const shopName = profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM";
    const tileGap = showSellerTabs ? 8 : 12;

    // Total of everything that used to show on the removed menu rows
    // (Manage products + Sales orders). Shown on the Grow button.
    const growBadgeTotal = (productsBadgeCount || 0) + (salesUnreadCount || 0);

    // Only ONE seller tile can be the current one (first match), so only one ring is ever drawn.
    const activeSellerKey = showSellerTabs
        ? (SELLER_TILES.find((t) => pathname === t.to || pathname.startsWith(t.to + "/"))?.key ?? null)
        : null;

    // Tiles in the dock:
    //  - seller area: Home, Enquiries, Products, Orders
    //  - elsewhere:   Grow / Save (the module you are in swaps its FAB for Home)
    const tiles = showSellerTabs
        ? [
            { ...TILES.home, slot: SLOT_PLAIN, badge: 0 },
            ...SELLER_TILES.map((t) => ({
                key: t.key, label: t.label, Icon: t.Icon, to: t.to,
                theme: { bg: t.bg, fg: t.fg }, slot: SLOT_SELLER,
                badge: sellerBadge[t.key] || 0,
            })),
        ]
        : [inGrow ? TILES.home : TILES.grow, inSave ? TILES.home : TILES.save]
            .map((t, i) => ({ ...t, slot: SLOT[i], badge: t.key === "grow" ? growBadgeTotal : 0 }));

    // Menu rows: drop the seller rows that now live in Grow, and Home while already on Home.
    const items = allItems.filter(
        (it) => !HIDDEN_MENU_IDS.includes(it.id) && !(it.id === "home" && isHome)
    );

    const [pageOpen, setPageOpen] = useState(false);
    const typing = useTypingActive();

    // Measurements used to keep the Menu button exactly where it was while the dock shrinks.
    const tilesInnerRef = useRef(null);
    const pillRef = useRef(null);
    const [tilesW, setTilesW] = useState(0);   // natural width of the tiles group
    const [pillH, setPillH] = useState(0);     // dock pill height while closed
    const [clipTiles, setClipTiles] = useState(false);

    useEffect(() => {
        const inner = tilesInnerRef.current;
        if (!inner) return undefined;
        const ro = new ResizeObserver(() => setTilesW(inner.offsetWidth));
        ro.observe(inner);
        setTilesW(inner.offsetWidth);
        return () => ro.disconnect();
    }, [primary]);

    useEffect(() => {
        if (!pageOpen && pillRef.current) setPillH(pillRef.current.offsetHeight);
    }, [pageOpen, primary, tiles.length, showSellerTabs]);

    useEffect(() => { if (pageOpen) setClipTiles(true); }, [pageOpen]);

    // Close automatically on route change so it never lingers over the next page.
    useEffect(() => { setPageOpen(false); }, [pathname]);

    // Lock background scroll, close on Escape, and flag <body> while the menu is open.
    useEffect(() => {
        if (!primary) return undefined;
        document.body.dataset.bbmMenu = pageOpen ? "open" : "closed";
        if (!pageOpen) return () => { delete document.body.dataset.bbmMenu; };
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => { if (e.key === "Escape") setPageOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = original;
            document.removeEventListener("keydown", onKey);
            delete document.body.dataset.bbmMenu;
        };
    }, [pageOpen, primary]);

    // Menu button badge = only the rows still shown in the menu (no double counting with Grow).
    const badgeTotal = items.reduce((sum, it) => sum + (it.rawBadge || 0), 0);
    const badgeDisplay = badgeTotal > 0 ? (badgeTotal > 9 ? "9+" : badgeTotal) : null;

    const menuButton = (
        <motion.button
            type="button"
            onClick={() => setPageOpen((v) => !v)}
            aria-label={badgeDisplay ? `${pageOpen ? "Close" : "Open"} menu, ${badgeTotal} unread` : `${pageOpen ? "Close" : "Open"} menu`}
            aria-expanded={pageOpen}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            className={DOCK_BTN}
            style={{ width: 52, height: 52, background: FAB_THEME.menu.bg, color: FAB_THEME.menu.fg, outline: "none", WebkitTapHighlightColor: "transparent" }}
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
            style={{ width: 52, height: 52, background: FAB_THEME.login.bg, color: FAB_THEME.login.fg, outline: "none", WebkitTapHighlightColor: "transparent" }}
        >
            <LogIn size={22} strokeWidth={2.4} />
        </motion.button>
    );

    if (!primary || typeof document === "undefined") return null;

    return createPortal(
        <>
            <style>{DOCK_AURA_CSS + MENU_OPEN_CSS + HIDE_DOCK_CSS + SHEET_CSS}</style>

            {/* ===================== DOCK ===================== */}
            <div
                className={`bbm-dock pointer-events-none fixed inset-x-0 flex justify-center transition-opacity duration-150 ${typing ? "opacity-0" : ""}`}
                style={{ zIndex: Z_DOCK, bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom, 0px))` }}
            >
                {/* Slides sideways by half the removed width, so the Menu button stays put. */}
                <motion.div
                    className={`${typing ? "pointer-events-none" : "pointer-events-auto"} relative isolate rounded-full`}
                    initial={false}
                    animate={{ x: pageOpen ? (tilesW + tileGap) / 2 : 0 }}
                    transition={DOCK_COLLAPSE}
                >
                    {/* aura: blurred halo */}
                    <span aria-hidden className={`pointer-events-none absolute -inset-[4px] -z-10 overflow-hidden rounded-full blur-[8px] transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-70"}`}>
                        <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                    </span>

                    {/* aura: comet ring */}
                    <span aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-100"}`} style={{ background: DOCK_RING }}>
                        <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                    </span>

                    {/* the dock pill (no backdrop blur) */}
                    <div
                        ref={pillRef}
                        className="relative m-[2px] flex items-center justify-center rounded-full border-[1.5px] p-[9px] transition-[background-color,box-shadow] duration-200"
                        style={{
                            background: pageOpen ? "transparent" : "rgba(255,255,255,.92)",
                            borderColor: pageOpen ? "transparent" : "#DFE7EA",
                            boxShadow: pageOpen ? "none" : "0 18px 40px -12px rgba(8,34,43,.4)",
                            minHeight: pageOpen && pillH ? pillH : undefined,
                        }}
                    >
                        {/* Tiles group: collapses to 0 width (and 0 gap) while the menu is open */}
                        <motion.div
                            className="relative"
                            initial={false}
                            animate={{
                                width: pageOpen ? 0 : "auto",
                                marginRight: pageOpen ? 0 : tileGap,
                                opacity: pageOpen ? 0 : 1,
                            }}
                            transition={DOCK_COLLAPSE}
                            onAnimationComplete={() => { if (!pageOpen) setClipTiles(false); }}
                            style={{ overflow: clipTiles ? "hidden" : "visible" }}
                        >
                            <div ref={tilesInnerRef} className="relative flex w-max items-center" style={{ gap: tileGap }}>
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {tiles.map(({ key, label, Icon, to, theme, slot, badge }) => {
                                        const current = key === activeSellerKey; // at most one tile
                                        return (
                                            <motion.button
                                                key={key}
                                                layout
                                                type="button"
                                                onClick={() => navigate(to)}
                                                aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
                                                aria-current={current ? "page" : undefined}
                                                tabIndex={pageOpen ? -1 : 0}
                                                title={label}
                                                initial={{ opacity: 0, scale: 0.6 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.6 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                                                whileTap={{ scale: 0.92 }}
                                                style={{
                                                    width: slot.size, height: slot.size, marginTop: slot.raised || slot.lift ? -4 : 0,
                                                    background: theme.bg, color: theme.fg, "--fab-bg": theme.bg,
                                                    boxShadow: current ? `0 0 0 2px #fff, 0 0 0 4px ${theme.bg}` : "none",
                                                }}
                                                className={`${DOCK_BTN} bbm-tile ${pageOpen ? "pointer-events-none" : ""}`}
                                            >
                                                {/* ping ring belongs to the raised slot, so it stays when Save swaps to Home */}
                                                {slot.raised && (
                                                    <span aria-hidden className="bbm-dock-ping pointer-events-none absolute inset-0 rounded-full border-2" style={{ borderColor: theme.bg }} />
                                                )}
                                                <span className={`flex ${key === "grow" ? "bbm-dock-nudge" : ""}`}><Icon size={slot.icon} /></span>
                                                {badge > 0 && (
                                                    <span className="absolute -right-1 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#d2462b] px-1 text-[9px] font-bold text-white">
                                                        {countLabel(badge)}
                                                    </span>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div key={effectiveLoggedIn ? "menu" : "login"} className="contents"
                                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                                {effectiveLoggedIn ? menuButton : signInButton}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* ===================== BACKDROP (dims the whole page) ===================== */}
            <div
                aria-hidden="true"
                onClick={() => setPageOpen(false)}
                style={{ zIndex: Z_BACKDROP }}
                className={`fixed inset-0 bg-black/35 transition-opacity duration-300 md:bg-black/20 ${pageOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
            />

            {/* ===================== MENU SHEET ===================== */}
            <div
                className="bbm-sheet"
                data-open={String(pageOpen)}
                role="dialog"
                aria-label="Menu"
                aria-hidden={!pageOpen}
            >
                {/* Grab handle (mobile) + shop title */}
                <div className="shrink-0 px-5 pt-2.5 md:px-7 md:pt-7">
                    <div className="mx-auto h-1 w-10 rounded-full md:hidden" style={{ background: C.hair }} />
                    <div role="heading" aria-level={2} className="mt-3 truncate text-[20px] font-extrabold leading-tight tracking-tight md:mt-0 md:text-[24px]" style={{ color: C.ink }}>
                        {shopName}
                    </div>
                </div>

                {/* List on mobile, tile grid on desktop. min-h-0 lets it scroll at max height.
                    Bottom padding on mobile clears the floating dock. */}
                <div
                    className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-[var(--sheet-pb)] md:px-7 md:pb-7 md:pt-5"
                    style={{
                        overscrollBehavior: "contain",
                        "--sheet-pb": `calc(${fabBottom + DOCK_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`,
                    }}
                    data-lenis-prevent=""
                    onWheel={stopScrollPropagation}
                    onTouchStart={stopScrollPropagation}
                    onTouchMove={stopScrollPropagation}
                >
                    <div className="flex flex-col gap-1 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
                        {items.map((it, i) => {
                            const showDivider = i > 0 && items[i - 1].group !== it.group;
                            return (
                                <Fragment key={it.id}>
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
                                </Fragment>
                            );
                        })}

                        {effectiveLoggedIn && (
                            <>
                                {items.length > 0 && items[items.length - 1].group !== 2 && <Divider />}

                                {/* Helpline: mobile only (hidden on desktop). HelpBulb keeps its own tap behaviour */}
                                <div className={`${ROW_BASE} ${ROW_IDLE} md:hidden`}>
                                    <span className={ICON_TILE} style={{ background: C.tile }}>
                                        <HelpBulb inline />
                                    </span>
                                    <span className={`${ROW_LABEL} font-semibold`} style={{ color: C.ink }}>
                                        Helpline
                                    </span>
                                </div>

                                {/* Sign out */}
                                <button
                                    onClick={() => { setPageOpen(false); signOut(); }}
                                    className={`${ROW_BASE} ${ROW_IDLE} ${ROW_INTERACTIVE}`}
                                >
                                    <span className={ICON_TILE} style={{ background: C.tile }}>
                                        <LogOut className="h-4 w-4 md:h-5 md:w-5" style={{ color: C.ink }} />
                                    </span>
                                    <span className={`${ROW_LABEL} font-semibold`} style={{ color: C.ink }}>
                                        Sign out
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}