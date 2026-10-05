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
import { Menu, X, LogOut, ArrowUpRight, Home } from "lucide-react";
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

const DOCK_HEIGHT = 44 + 16 + 4; // buttons + p-2 top/bottom + 2px ring top/bottom

// TODO: set the real destinations for Grow and Save.
const GROW_TO = "/grow";
const SAVE_TO = "/save";

const FAB_CLASS =
    "relative flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]";

const DOCK_FAB_CLASS =
    "relative flex h-11 w-11 items-center justify-center rounded-full shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]";

// Flat, earthy tones. No gradients, no glow.
const FAB_THEME = {
    grow: { bg: "#1F7A4D", fg: "#FFFFFF" },    // deep green: growth
    save: { bg: "#FED813", fg: "#141B22" },   // saffron/amber: money, with a dark icon
    menu: { bg: "#F4F1EA", fg: "#141B22" },   // warm cream, stands out on the petrol dock   // teal (your existing secondary)
};

// Dock surface colours (change here to re-theme the dock).
const DOCK_BG = "#0B4F5C";      // petrol blue
const DOCK_RING = "#1F6F7D";    // the ring colour where the comet isn't passing
const DOCK_SHADOW = "rgba(11,79,92,0.5)";

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
    , .bbm-dock-ping { display: none; }
}
`;

// Grow: the arrow from the image (the FAB itself is the black circle).
function GrowIcon({ size = 56 }) {
    return (
        <svg width={size} height={size} viewBox="168 168 400 400" fill="none" aria-hidden="true">
            <path
                d="M238 466 L305 348 L378 385 L415 312 L376 291 L484 248 L497 362 L455 341 L395 446 L322 408 L277 488 Z"
                fill="currentColor"
            />
        </svg>
    );
}

// Save: the money bag from the image.
function SaveIcon({ size = 36 }) {
    return (
        <svg width={size} height={size} viewBox="150 90 440 590" fill="none" aria-hidden="true">
            {/* knot / neck */}
            <path
                d="M313 120 Q377 108 441 128 L430 175 Q470 160 465 195 Q455 225 408 255 L345 255 Q285 215 272 185 Q275 150 310 150 Z"
                fill="currentColor"
            />
            {/* body */}
            <path
                d="M330 265 Q377 245 410 262 C500 330 570 450 563 530 C560 590 520 605 380 612 C250 612 185 595 177 535 C175 450 260 330 330 265 Z"
                fill="currentColor"
            />
            {/* slits in the neck and the tie line */}
            <path d="M312 130 L332 195 M440 140 L425 180 M405 215 L385 250 M330 300 L352 266 M335 262 L405 252"
                stroke="var(--fab-bg, #000)" strokeWidth="9" strokeLinecap="round" />
            {/* dollar sign */}
            {/* rupee sign */}
            <g stroke="var(--fab-bg, #000)" strokeWidth="20" fill="none" strokeLinejoin="miter">
                {/* two horizontal bars, same length, ending flush with the bowl's outer edge */}
                <path d="M322 372 H445" />
                <path d="M322 412 H445" />
                {/* bowl: starts on the top bar, semicircle, returns left */}
                <path d="M342 372 H370 A44 44 0 0 1 370 460 H338" />
                {/* diagonal leg from the bowl's bottom-left to the bottom right */}
                <path d="M338 460 L406 560" />
            </g>

        </svg>
    );
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
    const { isLoggedIn, profile, signOut } = useAuth();
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

    // Home lives in the quick-access FAB now, so it's dropped from the list
    // to avoid showing it twice. (Desktop nav still uses the full list.)
    const items = allItems.filter((it) => it.id !== "home");

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

    const isHome = pathname === "/home" || pathname === "/home/";
    const fabBottom = isHome ? FAB_BOTTOM_HOME : FAB_BOTTOM_DEFAULT;

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
            initial={{ opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
            whileTap={{ scale: 0.92 }}
            className={FAB_CLASS}
            style={{ background: FAB_THEME.menu.bg, color: FAB_THEME.menu.fg }}
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
            initial={{ opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
            whileTap={{ scale: 0.94 }}
            className="flex h-12 items-center gap-1.5 rounded-full bg-black px-5 text-[13px] font-bold text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]"
        >
            Sign In
            <ArrowUpRight className="h-3.5 w-3.5" />
        </motion.button>
    );

    return (
        <>
            {isHome ? (
                /* HOME: 5-column grid; the buttons use the middle 3 columns, so the
                   group is centred. Hidden while the keyboard is up. */
                <div
                    className={`fixed inset-x-0 z-40 flex justify-center transition-opacity duration-150 ${typing ? "pointer-events-none opacity-0" : ""}`}
                    style={{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom, 0px))` }}
                >
                    {isLoggedIn ? (
                        <div className="relative isolate rounded-full">
                            <style>{DOCK_AURA_CSS}</style>

                            {/* coloured halo: visible on a white page, fades out while the menu is open */}
                            <span
                                aria-hidden
                                className={`pointer-events-none absolute -inset-[4px] -z-10 overflow-hidden rounded-full blur-[8px] transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-70"}`}
                            >
                                <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                            </span>

                            {/* ring: dark hairline + the travelling comet */}
                            <span
                                aria-hidden
                                className={`pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-300 ${pageOpen ? "opacity-0" : "opacity-100"}`}
                                style={{ background: DOCK_RING }}
                            >
                                <span className="bbm-dock-spin absolute left-1/2 top-1/2 aspect-square w-[200%]" style={{ background: DOCK_CONIC }} />
                            </span>

                            {/* inner surface: dark ink pill, leaves a 2px ring visible around it */}
                            <div
                                className="relative m-[2px] flex items-center justify-center gap-2.5 rounded-full p-2 transition-[background-color,box-shadow] duration-200 md:gap-3"
                                style={{
                                    background: pageOpen ? "transparent" : DOCK_BG,
                                    boxShadow: pageOpen ? "none" : `0 14px 30px -10px ${DOCK_SHADOW}`,
                                }}
                            >
                                {/* glass shine sweeping across the dark surface */}
                                {!pageOpen && (
                                    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                                        <span className="bbm-dock-shine absolute inset-0" />
                                    </span>
                                )}

                                {[
                                    { key: "grow", label: "Grow", Icon: GrowIcon, to: GROW_TO },
                                    { key: "save", label: "Save", Icon: SaveIcon, to: SAVE_TO },
                                ].map(({ key, label, Icon, to }, i) => (
                                    <motion.button
                                        key={key}
                                        type="button"
                                        onClick={() => navigate(to)}
                                        aria-label={label}
                                        title={label}
                                        initial={{ opacity: 0, y: 14, scale: 0.85 }}
                                        animate={{ opacity: pageOpen ? 0 : 1, y: 0, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 + i * 0.05 }}
                                        whileTap={{ scale: 0.92 }}
                                        whileHover={{ scale: 1.06 }}
                                        style={{ background: FAB_THEME[key].bg, color: FAB_THEME[key].fg, "--fab-bg": FAB_THEME[key].bg }}
                                        className={`${DOCK_FAB_CLASS} ${pageOpen ? "pointer-events-none" : ""}`}
                                    >
                                        {/* amber ping ring, Save only */}
                                        {key === "save" && (
                                            <span
                                                aria-hidden
                                                className="bbm-dock-ping pointer-events-none absolute inset-0 rounded-full border-2"
                                                style={{ borderColor: FAB_THEME.save.bg }}
                                            />
                                        )}
                                        {/* Grow arrow gets a small up-right nudge */}
                                        <span className={`flex ${key === "grow" ? "bbm-dock-nudge" : ""}`}>
                                            <Icon size={38} />
                                        </span>
                                    </motion.button>
                                ))}
                                <div className="contents md:hidden">{menuButton}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center">{signInButton}</div>
                    )}
                </div>
            ) : (
                /* EVERYWHERE ELSE — z-40 sits ABOVE the sheet (z-[39]).
                   Bottom-anchored, so anything added above the Menu button grows upward
                   and never shifts the Menu button itself. */
                <div
                    className="fixed right-4 z-40 flex flex-col items-center gap-3 md:hidden"
                    style={{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom, 0px))` }}
                >
                    {/* Quick-access Home — only while the menu is open */}
                    <AnimatePresence>
                        {isLoggedIn && pageOpen && (
                            <motion.button
                                key="home-fab"
                                type="button"
                                onClick={goHome}
                                aria-label="Go to Home"
                                initial={{ opacity: 0, y: 28, scale: 0.5 }}
                                animate={{
                                    opacity: 1, y: 0, scale: 1,
                                    transition: { type: "spring", stiffness: 420, damping: 26, delay: 0.06 },
                                }}
                                exit={{
                                    opacity: 0, y: 20, scale: 0.6,
                                    transition: { duration: 0.16, ease: "easeIn" },
                                }}
                                whileTap={{ scale: 0.92 }}
                                className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-black text-white shadow-[0_8px_22px_-8px_rgba(0,0,0,0.5)]"
                            >
                                <Home size={19} strokeWidth={2.4} />
                                <span className="text-[9.5px] font-bold uppercase leading-none tracking-wider">
                                    Home
                                </span>
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {isLoggedIn ? menuButton : signInButton}
                </div>
            )}

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
                    <h1 className="mt-3 truncate text-[20px] font-extrabold leading-tight tracking-tight" style={{ color: C.ink }}>
                        {profile?.shop_slug ? formatShopName(profile.shop_slug) : "BBM"}
                    </h1>
                </div>

                {/* List — min-h-0 lets it shrink and scroll when the sheet hits its max height.
                    Bottom padding clears the floating buttons. */}
                <div
                    className={`min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-[var(--sheet-pb)] ${isHome ? "md:pb-5" : ""}`}
                    style={{
                        overscrollBehavior: "contain",
                        "--sheet-pb": `calc(${fabBottom + (isHome ? DOCK_HEIGHT + 12 : FAB_STACK_HEIGHT)}px + env(safe-area-inset-bottom, 0px))`,
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