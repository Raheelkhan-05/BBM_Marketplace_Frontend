import { motion } from "framer-motion";
import { trustPoints } from "../../../data/homeData";
import { ArrowDown, Users, ShoppingCart, Tag, FileText, Zap, BadgePercent, Circle, TrendingUp, Truck, CreditCard, Plus, ScanLine, ClipboardList, Repeat, ShieldCheck, Lock, FileCheck, Box, Clock } from 'lucide-react';

/* ------------------------------------------------------------------
   DESIGN NOTES — closing section of the homepage
   ------------------------------------------------------------------
   This is the last thing a buyer sees before they either search or
   leave, so it shouldn't be a bare 4-cell grid — it should read as a
   deliberate closing statement, the way a good page ends on a
   considered note rather than trailing off.

     1. Given a real header: mono eyebrow + bold heading, same
        pattern as every other section (hero, quick actions,
        categories) — "Why teams trust us" — so the page closes with
        a claim, not just four icons with no framing.

     2. Every icon was the same flat teal before, which is a big part
        of why four cells in a row read as visually flat. Alternating
        primary/secondary per card (the same two-accent rhythm Quick
        Actions already established) gives the strip a beat instead
        of four identical repeats.

     3. Dividers: rather than juggling manual border classes per
        breakpoint (which breaks the moment the grid goes from 2
        columns to 4), the grid container's own background is the
        hairline color and each cell is white with a 1px gap — so
        the "dividers" are just the gaps showing through. This stays
        correct automatically at every column count, sm/lg included.

     4. `amz-card`, `slate-*` replaced with the hairline/ink/muted
        tokens and `rounded-[24px]` shell used everywhere else, and
        `font-sans`/`font-mono` (Geist) instead of unspecified
        defaults — same fix as every other section on this page.

     5. Quiet hover per cell: icon chip scales slightly, a hairline
        accent bar reveals along the top edge — small enough not to
        feel busy, but it makes the closing section feel responsive
        to the cursor rather than static, which matters more here
        since it's the last impression before the buyer acts.

     6. Stagger-in on scroll (`whileInView`), same restraint as the
        rest of the page — one clean reveal, not four independent
        animations racing each other.

   Palette: ink #0B1116, muted #667077, primary #D2462B, secondary
   #006F83, hairline rgba(11,17,22,0.09). `trustPoints`/`ICONS`
   assumed to come from the same data module as before — adjust the
   import path if it differs in your project.
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

function TrustStrip() {
    return (
        <div className="w-full">
            <div className="text-center">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.25em]" style={{ color: C.muted }}>
                    Why teams trust us
                </span>
                <h2
                    className="mx-auto mt-0.5 max-w-md text-xl font-extrabold leading-[1em] tracking-[0.02em] sm:text-2xl"
                    style={{ color: C.ink }}
                >
                    Built for how procurement actually works.
                </h2>
            </div>

            <div
                className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2 lg:grid-cols-4"
                style={{ borderColor: C.hair, background: C.hair }}
            >
                {trustPoints.map((tp, i) => {
                    const Icon = ICONS[tp.icon];
                    const accent = i % 2 === 0 ? C.primary : C.secondary;

                    return (
                        <motion.div
                            key={tp.id}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            className="group relative flex items-center gap-3.5 bg-white p-4 transition-colors duration-200 hover:bg-black/[0.015] sm:p-5 lg:gap-4 lg:p-6"
                        >
                            {/* hairline accent bar, reveals on hover */}
                            <span
                                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                                style={{ background: accent, transformOrigin: "left" }}
                            />

                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 lg:h-11 lg:w-11"
                                style={{ background: `${accent}14`, color: accent }}
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold leading-tight tracking-[0.02em] sm:text-sm" style={{ color: C.ink }}>
                                    {tp.title}
                                </p>
                                <p className="mt-0.5 truncate text-[11.5px] font-medium tracking-wide leading-tight lg:text-xs" style={{ color: C.muted }}>
                                    {tp.desc}
                                </p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

export default TrustStrip;