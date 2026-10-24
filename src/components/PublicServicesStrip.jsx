// src/components/PublicServicesStrip.jsx
// Home page section that states the B2B business model (MCC 7399 requirement).
// Styled to match the Home page (PromoHero): same container width, white
// rounded-3xl card with soft radial tints, teal eyebrow, black/brand heading,
// yellow pill CTA, Nunito Sans inherited from the page.
// Mount in Layout.jsx between </main> and <PublicFooter />, logged-out visitors on /home only.
// Content comes from SERVICES in company.js (shared with /services and the prerendered HTML).
import { Link } from "react-router-dom";
import { Search, Megaphone, Globe, Truck, Tag, Store } from "lucide-react";
import { COMPANY, SERVICES } from "../config/company.js";

const C = {
    ink: "#0B1116", muted: "#667077",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)",
    brand: "#de3207", teal: "#006F83",
};

// Icon + accent colour per service (same palette as PromoHero's steps).
const LOOK = {
    "Strategic Sourcing": { Icon: Search, tone: "#006F83" },
    "Brand Marketing": { Icon: Megaphone, tone: "#1E78D6" },
    "Export & Import Management": { Icon: Globe, tone: "#22A06B" },
    "Distribution Agency Services": { Icon: Truck, tone: "#de3207" },
    "Private Label Execution": { Icon: Tag, tone: "#1E78D6" },
    "B2B Marketplace": { Icon: Store, tone: "#006F83" },
};
const FALLBACK = { Icon: Store, tone: "#006F83" };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006F83]";

export default function PublicServicesStrip() {
    return (
        <section
            aria-labelledby="bsv-title"
            className="mx-auto max-w-7xl px-2.5 pb-2 pt-0 sm:px-4 lg:px-6"
        >
            <div
                className="overflow-hidden rounded-3xl border p-4 sm:p-6 lg:p-8"
                style={{
                    borderColor: C.hair,
                    background:
                        "radial-gradient(520px 260px at 100% 0%, rgba(0,111,131,0.10), transparent 70%)," +
                        "radial-gradient(480px 240px at 0% 100%, rgba(222,50,7,0.09), transparent 70%), #fff",
                    boxShadow: "0 24px 48px -34px rgba(11,17,22,0.35)",
                }}
            >
                {/* Header: pitch on the left, actions on the right (desktop) */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
                    <div className="min-w-0">
                        <span
                            className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                            style={{ color: C.teal }}
                        >
                            What {COMPANY.brand} does
                        </span>
                        <h2
                            id="bsv-title"
                            className="mt-1.5 text-[28px] font-extrabold font-black leading-[1.08] tracking-normal sm:text-[32px] lg:text-[38px]"
                            style={{ color: C.ink }}
                        >
                            Sourcing, branding and trade support
                            <br />
                            <span style={{ color: C.brand }}>for registered businesses.</span>
                        </h2>
                        <p
                            className="mt-2.5 max-w-[38rem] text-[13.5px] font-medium leading-relaxed tracking-wide sm:text-[14.5px]"
                            style={{ color: C.muted }}
                        >
                            {COMPANY.legalName} works with manufacturers, brand owners, distributors,
                            traders and exporters. Our services are not offered to individual consumers.
                        </p>
                    </div>

                    <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-2 sm:gap-3 lg:w-auto lg:shrink-0">
                        <Link
                            to="/services"
                            className={`flex h-12 min-w-0 flex-[1.25] items-center justify-center rounded-full px-5 text-center text-[14px] font-extrabold tracking-wide text-black transition active:scale-[0.98] hover:brightness-95 sm:text-[15px] lg:flex-none ${FOCUS}`}
                            style={{ background: "#FFD60A" }}
                        >
                            <span className="truncate">View all services</span>
                        </Link>
                        <Link
                            to="/pricing"
                            className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-full border bg-white px-5 text-center text-[14px] font-extrabold tracking-wide transition hover:bg-black/[0.03] active:scale-[0.98] sm:text-[15px] lg:flex-none ${FOCUS}`}
                            style={{ borderColor: C.hair, color: C.ink }}
                        >
                            <span className="truncate">Pricing and fees</span>
                        </Link>
                    </div>
                </div>

                {/* Services: one bordered panel, hairline dividers (no loose cards) */}
                <ul
                    className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:mt-6 sm:grid-cols-2 lg:grid-cols-3"
                    style={{ borderColor: C.hair, background: C.hair }}
                >
                    {SERVICES.map((s) => {
                        const { Icon, tone } = LOOK[s.name] || FALLBACK;
                        const isMarketplace = s.name === "B2B Marketplace";
                        return (
                            <li
                                key={s.name}
                                className="flex min-w-0 items-start gap-3 p-3.5 sm:p-4"
                                style={{ background: isMarketplace ? "#F2F8F9" : "#fff" }}
                            >
                                <span
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                    style={{ background: `color-mix(in srgb, ${tone} 13%, #fff)`, color: tone }}
                                >
                                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-[13.5px] font-extrabold leading-tight tracking-wide" style={{ color: C.ink }}>
                                        {isMarketplace ? `${COMPANY.brand} ${s.name}` : s.name}
                                    </h3>
                                    <p className="mt-1 text-[12px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                                        {s.text}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}