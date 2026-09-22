// components/BottomNavStrip.jsx
//
// Mobile-only. Same nav items as Header's desktop row.
//
// CHANGED: no more horizontal scroll strip. Items that fit the width of
// the screen are shown inline as before; anything that doesn't fit is
// tucked behind a trailing chevron button. Tapping it slides up a sheet
// (from the bottom, capped at half the viewport height) listing every
// remaining item vertically, Excel-frozen-columns style. HelpBulb stays
// pinned as the last visible slot — it moves into the sheet along with
// the rest of the nav once space runs out, rather than always floating
// free.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronUp, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { NAV_ITEMS } from "./navItems.js";
import { useCart } from "../context/CartContext.jsx";
import { useChatContext } from "../context/ChatContext.jsx";
import { useListings } from "../context/ListingsContext.jsx";
import HelpBulb from "./HelpBulb.jsx";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)" };

// Width reserved for the trailing "more" chevron button (only subtracted
// from the available row width once we know overflow exists at all).
const MORE_BUTTON_WIDTH = 52;
// Smallest gap we're willing to let justify-between compress down to
// between two neighboring pills before we consider that pill "not fitting".
const MIN_GAP = 10;

function NavPill({ item, active, dense }) {
    const Icon = item.icon;
    return (
        <button
            onClick={item.onClick}
            className={
                dense
                    ? "relative flex w-full items-center gap-3 rounded-2xl px-4 py-2 text-[15px] font-bold transition-colors duration-150"
                    : "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors duration-150 tracking-wide"
            }
            style={{
                color: active ? "#fff" : C.ink,
                background: active ? "#000000" : "rgba(20,27,34,0.045)",
            }}
        >
            <Icon className={dense ? "h-4 w-4" : "h-3.5 w-3.5"} style={{ color: active ? "#fff" : C.muted }} />
            {item.label}
            {item.badge != null && (
                <span
                    className={
                        dense
                            ? "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#d2462b] px-1.5 text-[10px] font-bold text-white"
                            : "absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#d2462b] px-1 text-[9px] font-bold text-white ring-2 ring-white"
                    }
                >
                    {item.badge}
                </span>
            )}
        </button>
    );
}

export default function BottomNavStrip({ onOpenRfq }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { isLoggedIn, profile } = useAuth();
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

    const containerRef = useRef(null);
    const measureRefs = useRef([]);
    const [visibleCount, setVisibleCount] = useState(items.length);
    const [sheetOpen, setSheetOpen] = useState(false);

    // Measure each item's natural width against the available row width and
    // find how many fit before the trailing chevron would be needed. Runs
    // on mount, on resize, and whenever the item set changes (login state,
    // badge counts appearing/disappearing, etc).
    useLayoutEffect(() => {
        function recalc() {
            const container = containerRef.current;
            if (!container) return;
            const fullWidth = container.clientWidth;
            const widths = measureRefs.current.map((el) => (el ? el.offsetWidth : 0));

            // With N pills plus the trailing button, justify-between leaves
            // N gaps; make sure each can stay at least MIN_GAP wide.
            const fitsAll =
                widths.reduce((a, b) => a + b, 0) + MIN_GAP * widths.length <= fullWidth;

            if (fitsAll) {
                setVisibleCount(items.length);
                return;
            }

            const budget = fullWidth - MORE_BUTTON_WIDTH;
            let used = 0;
            let count = 0;
            for (const w of widths) {
                const next = used + w + MIN_GAP;
                if (next > budget) break;
                used = next;
                count += 1;
            }
            setVisibleCount(Math.max(count, 1));
        }

        recalc();
        const ro = new ResizeObserver(recalc);
        if (containerRef.current) ro.observe(containerRef.current);
        window.addEventListener("resize", recalc);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", recalc);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length, items.map((it) => it.label + (it.badge ?? "")).join("|")]);

    // Close the sheet automatically on route change so it never lingers
    // over the next page.
    useEffect(() => {
        setSheetOpen(false);
    }, [pathname]);

    const hasOverflow = visibleCount < items.length;
    const visibleItems = items.slice(0, visibleCount);
    const overflowItems = items.slice(visibleCount);

    return (
        <>
            <nav
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
                style={{ borderColor: C.hair, paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div ref={containerRef} className="flex items-center justify-between px-4 py-2.5 pb-4 -mt-2 pt-4">
                    {visibleItems.map((it) => (
                        <NavPill key={it.id} item={it} active={it.match(pathname)} />
                    ))}

                    {hasOverflow ? (
                        <button
                            onClick={() => setSheetOpen(true)}
                            aria-label="Show more navigation options"
                            aria-expanded={sheetOpen}
                            className="flex shrink-0 items-center justify-center rounded-full p-2.5"
                            style={{ background: "rgba(20,27,34,0.045)", color: C.ink }}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </button>
                    ) : (
                        <div className="shrink-0">
                            <HelpBulb inline />
                        </div>
                    )}
                </div>
            </nav>

            {/* Hidden measurement row: same pills, same markup, rendered off
                -screen so we can read natural widths before deciding what's
                visible. Keeps the visible row free of layout-shift flicker. */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-[-1] flex items-center gap-2.5 px-4 py-2.5 opacity-0"
                style={{ visibility: "hidden" }}
            >
                {items.map((it, i) => (
                    <div key={it.id} ref={(el) => (measureRefs.current[i] = el)}>
                        <NavPill item={it} active={false} />
                    </div>
                ))}
            </div>

            {/* Overflow sheet: slides up from the bottom, capped at half the
                viewport height, everything listed vertically so it's easy
                to scan and tap without the horizontal-scroll ambiguity. */}
            {hasOverflow && (
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
                        className="absolute inset-x-0 bottom-0 flex max-h-[50vh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-250 ease-out"
                        style={{
                            transform: sheetOpen ? "translateY(0)" : "translateY(100%)",
                            paddingBottom: "env(safe-area-inset-bottom)",
                        }}
                    >
                        <div className="flex items-center justify-between px-5 pt-4 pb-3">
                            <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                                More options
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
                            {overflowItems.map((it) => (
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
                                    dense
                                />
                            ))}
                            <div className="mt-2 border-t pt-3" style={{ borderColor: C.hair }}>
                                <HelpBulb inline onNavigate={() => setSheetOpen(false)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}