import { motion } from "framer-motion";
import { Box } from "lucide-react";
import { quickActions } from "../../../data/homeData";
import {
    ArrowDown, Users, ShoppingCart, Tag, FileText, Zap,
    BadgePercent, Circle, TrendingUp, Truck, CreditCard, Plus,
    ScanLine, ClipboardList, Repeat, ShieldCheck, Lock, FileCheck, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------
   DESIGN NOTES — v3, mobile becomes an icon-grid (Paytm/GPay pattern)
   ------------------------------------------------------------------
   The row-card layout is a desktop pattern — it needs width for the
   description text to earn its place. On mobile, a stacked list of
   rows is what every generic app does when it hasn't rethought the
   layout; the pattern people actually recognize as "quick actions"
   on a phone is the icon-on-top, label-below grid (Paytm, GPay,
   PhonePe): 4-across, big tappable icon, short label, no description.

   So this is now two real layouts, not one squeezed into both sizes:

     - MOBILE (<lg): a 4-column icon grid per group. Icon in a large
       rounded-square chip (group-accent tint), label below in two
       lines max, count as a small badge on the chip's corner. No
       description — the label alone has to carry it, same discipline
       Paytm/GPay use.

     - DESKTOP (lg+): the detailed row-card from the previous pass is
       kept as-is — icon + label + description in a horizontal card,
       two-column grid, vertical divider between Purchase/Sales.

   Both layouts share the same tokens and the same group-accent icon
   tinting introduced last pass (icon color comes from the group,
   not arbitrary per-item colors) so the two breakpoints still read
   as one system, not two different designs stitched together.

   Palette/tokens unchanged: ink #0B1116, muted #667077,
   primary #D2462B, secondary #006F83, hairline rgba(11,17,22,0.09).
   Props/data contract (`quickActions`, item shape, `onOpenRfq`)
   unchanged.
   ------------------------------------------------------------------ */

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
};

const ICONS = {
    "trend-down": ArrowDown, users: Users, cart: ShoppingCart,
    tag: Tag, file: FileText, bolt: Zap, badge: BadgePercent,
    circle: Circle, trend: TrendingUp, "trend-up": TrendingUp, truck: Truck, card: CreditCard,
    plus: Plus, scan: ScanLine, clipboard: ClipboardList, repeat: Repeat,
    shield: ShieldCheck, lock: Lock, invoice: FileCheck, box: Box, clock: Clock,
    "shield-check": ShieldCheck, "file-check": FileCheck, "part-scan": ScanLine,
    "gst-credit": FileCheck, "credit-line": CreditCard, samples: ShieldCheck
};

function QuickActionsJustBelowBanner({ onOpenRfq }) {
    const navigate = useNavigate();

    const purchaseActions = quickActions.filter((a) =>
        ["explore", "purchase-order", "price-list", "post-rfq"].includes(a.id)
    );
    const salesActions = quickActions.filter((a) =>
        ["add-product", "update-stock", "seller-orders", "marketing"].includes(a.id)
    );

    /* ---------- MOBILE: icon-on-top tile (Paytm/GPay pattern) ---------- */
    const renderTile = (a, accent, i) => {
        const Icon = ICONS[a.icon] || Box;
        const chipBg = a.bg ?? `${accent}14`;
        const chipFg = a.fg ?? accent;

        return (
            <motion.button
                key={a.id}
                onClick={a.id === "add-product" ? () => navigate("/seller/sell") : a.id === "req" ? onOpenRfq : undefined}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.35, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5 outline-none"
            >
                <span
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-150 active:scale-95"
                    style={{ background: chipBg, color: chipFg }}
                >
                    <Icon className="h-6 w-6" />
                    {a.count && (
                        <span
                            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums text-white ring-2 ring-white"
                            style={{ background: accent }}
                        >
                            {a.count}
                        </span>
                    )}
                </span>
                <p
                    className="w-full text-center text-[11px] tracking-[0.0em] font-bold leading-tight"
                    style={{ color: C.ink }}
                >
                    {a.label}
                </p>
            </motion.button>
        );
    };

    /* ---------- DESKTOP: detailed row card ---------- */
    const renderCard = (a, accent, i) => {
        const Icon = ICONS[a.icon] || Box;
        const chipBg = a.bg ?? `${accent}14`;
        const chipFg = a.fg ?? accent;

        return (
            <motion.button
                key={a.id}
                onClick={a.id === "add-product" ? () => navigate("/seller/sell") : a.id === "req" ? onOpenRfq : undefined}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                className="group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(11,17,22,0.03)] outline-none transition-shadow duration-200 hover:shadow-[0_10px_24px_-10px_rgba(11,17,22,0.14)] focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ borderColor: C.hair, ["--tw-ring-color"]: accent }}
            >
                <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                    style={{ background: chipBg, color: chipFg }}
                >
                    <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight tracking-[0.01em]" style={{ color: C.ink }}>
                        {a.label}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium leading-tight" style={{ color: C.muted }}>
                        {a.desc}
                    </p>
                </div>
                {a.count && (
                    <span
                        className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10.5px] font-bold tabular-nums text-white"
                        style={{ background: accent }}
                    >
                        {a.count}
                    </span>
                )}
                <span
                    className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] scale-x-0 rounded-full transition-transform duration-200 group-hover:scale-x-100"
                    style={{ background: accent, transformOrigin: "left" }}
                />
            </motion.button>
        );
    };

    const groupLabel = (title, count, accent, align = "justify-start") => (
        <div className={`flex items-center gap-2 ${align}`}>
            <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
            <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                {title}
            </h3>
        </div>
    );

    return (
        <div className="w-full rounded-[16px] border bg-white pb-6 pt-6 lg:pb-8 lg:pt-5" style={{ borderColor: C.hair }}>
            <h2
                className="text-center font-extrabold leading-tight tracking-[-0.01em]"
                style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
            >
                Daily business tools
            </h2>
            <p className="mx-auto mt-0.5 sm:mt-0.5 max-w-xs text-center text-[12.5px] font-medium leading-relaxed" style={{ color: C.muted }}>
                Everything you need to buy or sell, one tap away.
            </p>

            {/* ---------------- MOBILE: icon grid, GPay/Paytm pattern ---------------- */}
            <div className="mt-4 space-y-4 px-4 lg:hidden">
                <div>
                    {groupLabel("Purchase", purchaseActions.length, C.primary, "justify-center")}
                    <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
                        {purchaseActions.map((a, i) => renderTile(a, C.primary, i))}
                    </div>
                </div>
                <div className="h-px w-full hidden sm:block" style={{ background: C.hair }} />
                <div>
                    {groupLabel("Sales", salesActions.length, C.secondary, "justify-center")}
                    <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
                        {salesActions.map((a, i) => renderTile(a, C.secondary, i))}
                    </div>
                </div>
            </div>

            {/* ---------------- DESKTOP: detailed row cards ---------------- */}
            <div className="mt-8 hidden w-full flex-row gap-0 px-8 lg:flex">
                <div className="flex-1">
                    {groupLabel("Purchase", purchaseActions.length, C.primary)}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        {purchaseActions.map((a, i) => renderCard(a, C.primary, i))}
                    </div>
                </div>
                <div className="shrink-0 self-stretch px-8">
                    <div className="h-full w-px" style={{ background: C.hair }} />
                </div>
                <div className="flex-1">
                    {groupLabel("Sales", salesActions.length, C.secondary)}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        {salesActions.map((a, i) => renderCard(a, C.secondary, i))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuickActionsJustBelowBanner;