import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Hero16By9Banner from "../components/home/Hero16by9Banner.jsx";
import {
    Search,
    ChevronRight,
    ChevronLeft,
    ArrowUpRight,
    ShieldCheck,
    Sparkles,
    FileText,
    Boxes,
    MessageSquare,
    LifeBuoy,
    Compass,
    BadgeCheck,
    Star,
    MapPin,
    TrendingUp,
    Layers,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    PhoneCall,
    ChevronDown,
    X,
    SlidersHorizontal,
    PackageCheck,
    Handshake,
    Gauge,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/*  TOKENS                                                                 */
/* ---------------------------------------------------------------------- */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const T = {
    bg: "#FDFEFF",
    ink: "#0C1B1D",
    inkSoft: "#4A5C5E",
    primary: "#D2462B",
    primaryDeep: "#AB3821",
    secondary: "#006F83",
    secondaryDeep: "#004E5C",
    surface: "#F4F7F6",
    surfaceAlt: "#EFF3F1",
    line: "rgba(12,27,29,0.10)",
    lineSoft: "rgba(12,27,29,0.06)",
    gold: "#B8862E",
};

/* ---------------------------------------------------------------------- */
/*  DUMMY DATA                                                             */
/* ---------------------------------------------------------------------- */

const heroSlides = [
    {
        id: "s1",
        eyebrow: "Sourcing Week",
        title: "Precision bearings, straight from certified manufacturers",
        subtitle: "ISO-certified suppliers · Bulk pricing unlocked at 500+ units",
        cta: "Post your requirement",
        stat: { value: "18%", label: "avg. savings vs. retail" },
        image:
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1200&auto=format&fit=crop",
        tone: "teal",
    },
    {
        id: "s2",
        eyebrow: "New on the ledger",
        title: "Industrial safety equipment, verified before it ships",
        subtitle: "Every supplier GST-checked · Factory audits on request",
        cta: "Browse safety gear",
        stat: { value: "3,400+", label: "verified suppliers" },
        image:
            "https://images.unsplash.com/photo-1618477388954-7852f32655ec?q=80&w=1200&auto=format&fit=crop",
        tone: "rust",
    },
    {
        id: "s3",
        eyebrow: "High-demand this month",
        title: "CNC machine tools with escrow-backed payment terms",
        subtitle: "Compare live quotes from 40+ machine shops nationwide",
        cta: "Compare quotes",
        stat: { value: "48 hrs", label: "median quote turnaround" },
        image:
            "https://images.unsplash.com/photo-1565087095554-e02cd0cd85e1?q=80&w=1200&auto=format&fit=crop",
        tone: "teal",
    },
];

const trendingSearches = [
    "Ball bearings 6205",
    "Safety helmets ISI",
    "Hydraulic hose fittings",
    "CNC lathe machine",
    "PPE kits bulk",
    "Conveyor belts",
];

const searchCategories = [
    "All Categories",
    "Bearings & Transmission",
    "Safety & PPE",
    "Machine Tools",
    "Fasteners",
    "Electricals",
];

const quickActions = [
    { icon: FileText, label: "Post a requirement", note: "Get quotes in 24h" },
    { icon: Compass, label: "Find suppliers", note: "3,400+ verified" },
    { icon: Boxes, label: "Bulk order desk", note: "MOQ 500+" },
    { icon: Truck, label: "Track shipment", note: "Live status" },
    { icon: SlidersHorizontal, label: "Compare quotes", note: "Side by side" },
    { icon: ShieldCheck, label: "Verified sellers", note: "GST checked" },
    { icon: Layers, label: "Category directory", note: "120+ categories" },
    { icon: LifeBuoy, label: "Buying assistance", note: "Talk to an expert" },
];

const catalogTabs = ["Recommended", "Bearings", "Safety Gear", "Machine Tools", "Fasteners"];

const products = [
    {
        id: "p1",
        name: "Deep Groove Ball Bearing 6205-2RS",
        supplier: "Hindustan Bearing Co.",
        location: "Faridabad, HR",
        price: "₹42 – ₹58",
        unit: "/ piece",
        moq: "MOQ 500 pcs",
        rating: 4.8,
        verified: true,
        featured: true,
        image:
            "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?q=80&w=1000&auto=format&fit=crop",
    },
    {
        id: "p2",
        name: "ISI-Marked Safety Helmet, Ratchet Fit",
        supplier: "Suraksha Safety Industries",
        location: "Pune, MH",
        price: "₹185 – ₹240",
        unit: "/ piece",
        moq: "MOQ 200 pcs",
        rating: 4.6,
        verified: true,
        image:
            "https://images.unsplash.com/photo-1591189863430-ab87e120f312?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "p3",
        name: "Hydraulic Hose Fitting, JIC 37°",
        supplier: "Precision Hydraulics Pvt. Ltd.",
        location: "Rajkot, GJ",
        price: "₹65 – ₹90",
        unit: "/ piece",
        moq: "MOQ 1000 pcs",
        rating: 4.7,
        verified: true,
        image:
            "https://images.unsplash.com/photo-1581092335878-4a94ce80d3b7?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "p4",
        name: "3-Axis CNC Vertical Machining Center",
        supplier: "Bharat Machine Tools",
        location: "Coimbatore, TN",
        price: "₹18.5L – ₹24L",
        unit: "/ unit",
        moq: "MOQ 1 unit",
        rating: 4.9,
        verified: true,
        image:
            "https://images.unsplash.com/photo-1565087095554-e02cd0cd85e1?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "p5",
        name: "Heavy-Duty PVC Conveyor Belt",
        supplier: "Konnect Conveyors",
        location: "Ahmedabad, GJ",
        price: "₹310 / mtr",
        unit: "",
        moq: "MOQ 50 mtr",
        rating: 4.5,
        verified: false,
        image:
            "https://images.unsplash.com/photo-1581092918484-8313ca08b52b?q=80&w=800&auto=format&fit=crop",
    },
];

const ledgerSuppliers = [
    { name: "Hindustan Bearing Co.", since: "1998", verified: true },
    { name: "Bharat Machine Tools", since: "2004", verified: true },
    { name: "Suraksha Safety Industries", since: "2011", verified: true },
    { name: "Precision Hydraulics Pvt. Ltd.", since: "2007", verified: true },
    { name: "Konnect Conveyors", since: "2015", verified: true },
    { name: "Steelcraft Fasteners", since: "1992", verified: true },
    { name: "Vidyut Electricals", since: "2009", verified: true },
    { name: "Aarav Industrial Supplies", since: "2013", verified: true },
];

const whyChooseUs = [
    {
        icon: BadgeCheck,
        title: "GST-verified, factory-audited",
        body:
            "Every supplier on the ledger clears a documentation check before their first listing goes live.",
    },
    {
        icon: Handshake,
        title: "Escrow-backed payments",
        body:
            "Funds release only after you confirm delivery, so working capital stays protected on every order.",
    },
    {
        icon: Gauge,
        title: "Quotes in under 48 hours",
        body:
            "Post a requirement once and receive comparable, itemised quotes from matched suppliers.",
    },
    {
        icon: PackageCheck,
        title: "Dispute resolution desk",
        body:
            "A dedicated team mediates quality or delivery disputes within 5 working days.",
    },
];

const stats = [
    { value: "3,400+", label: "Verified suppliers" },
    { value: "120+", label: "Product categories" },
    { value: "₹840Cr", label: "Transacted this year" },
    { value: "48 hrs", label: "Median quote time" },
];

/* ---------------------------------------------------------------------- */
/*  UTIL COMPONENTS                                                        */
/* ---------------------------------------------------------------------- */

function Eyebrow({ children, color = T.secondary }) {
    return (
        <span
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color }}
        >
            <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ backgroundColor: color }}
            />
            {children}
        </span>
    );
}

function SectionHeading({ eyebrow, title, sub, eyebrowColor, align = "left" }) {
    return (
        <div className={align === "center" ? "text-center" : ""}>
            <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
            <h2
                className="mt-3 text-[28px] leading-[1.15] sm:text-[34px] lg:text-[40px]"
                style={{ fontFamily: "'Fraunces', serif", color: T.ink, fontWeight: 500 }}
            >
                {title}
            </h2>
            {sub && (
                <p
                    className="mt-3 max-w-xl text-[15px] leading-relaxed"
                    style={{ color: T.inkSoft, marginInline: align === "center" ? "auto" : 0 }}
                >
                    {sub}
                </p>
            )}
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/*  1. HERO CAROUSEL                                                       */
/* ---------------------------------------------------------------------- */

// function HeroCarousel({ onOpenRfq }) {
//     const [index, setIndex] = useState(0);
//     const [dir, setDir] = useState(1);
//     const total = heroSlides.length;
//     const timerRef = useRef(null);

//     const go = (next) => {
//         setDir(next > index || (index === total - 1 && next === 0) ? 1 : -1);
//         setIndex(next);
//     };

//     useEffect(() => {
//         clearTimeout(timerRef.current);
//         timerRef.current = setTimeout(() => {
//             go((index + 1) % total);
//         }, 5500);
//         return () => clearTimeout(timerRef.current);
//     }, [index]);

//     const slide = heroSlides[index];

//     return (
//         <section
//             className="relative overflow-hidden"
//             style={{
//                 background:
//                     "radial-gradient(120% 140% at 82% 8%, rgba(210,70,43,0.22) 0%, transparent 46%), linear-gradient(150deg, #061417 0%, #0B2A30 46%, #061417 100%)",
//             }}
//         >
//             <div
//                 className="pointer-events-none absolute inset-0 opacity-[0.06]"
//                 style={{
//                     backgroundImage:
//                         "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
//                 }}
//             />

//             <div className="relative mx-auto max-w-[1320px] px-5 pt-8 sm:px-8 lg:px-10">
//                 <AnimatePresence mode="wait">
//                     <motion.div
//                         key={slide.id}
//                         initial={{ opacity: 0, x: dir * 28 }}
//                         animate={{ opacity: 1, x: 0 }}
//                         exit={{ opacity: 0, x: -dir * 28 }}
//                         transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
//                         className="grid grid-cols-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:py-20"
//                     >
//                         <div className="order-2 lg:order-1">
//                             <span
//                                 className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90"
//                                 style={{ borderColor: "rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}
//                             >
//                                 <Sparkles className="h-3 w-3" style={{ color: "#F0A98A" }} />
//                                 {slide.eyebrow}
//                             </span>

//                             <h1
//                                 className="mt-5 max-w-[13ch] text-[34px] leading-[1.08] text-white sm:text-[46px] lg:max-w-[12ch] lg:text-[54px]"
//                                 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}
//                             >
//                                 {slide.title}
//                             </h1>

//                             <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-[16px]">
//                                 {slide.subtitle}
//                             </p>

//                             <div className="mt-8 flex flex-wrap items-center gap-4">
//                                 <button
//                                     onClick={onOpenRfq}
//                                     className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_18px_40px_-14px_rgba(210,70,43,0.65)] transition-transform duration-200 hover:-translate-y-0.5"
//                                     style={{ backgroundColor: T.primary }}
//                                 >
//                                     {slide.cta}
//                                     <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
//                                 </button>

//                                 <div className="flex items-baseline gap-2 border-l pl-4" style={{ borderColor: "rgba(255,255,255,0.18)" }}>
//                                     <span
//                                         className="text-[22px] font-semibold text-white"
//                                         style={{ fontFamily: "'IBM Plex Mono', monospace" }}
//                                     >
//                                         {slide.stat.value}
//                                     </span>
//                                     <span className="text-[12px] text-white/55">{slide.stat.label}</span>
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="order-1 lg:order-2">
//                             <div className="relative mx-auto aspect-[4/3] w-full max-w-[440px] overflow-hidden rounded-[22px] border" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
//                                 <img
//                                     src={slide.image}
//                                     alt=""
//                                     className="h-full w-full object-cover"
//                                     draggable={false}
//                                 />
//                                 <div
//                                     className="absolute inset-0"
//                                     style={{ background: "linear-gradient(180deg, rgba(6,20,23,0) 55%, rgba(6,20,23,0.55) 100%)" }}
//                                 />
//                             </div>
//                         </div>
//                     </motion.div>
//                 </AnimatePresence>

//                 <div className="flex items-center justify-between border-t py-5" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
//                     <div className="flex items-center gap-2.5">
//                         {heroSlides.map((s, i) => (
//                             <button
//                                 key={s.id}
//                                 onClick={() => go(i)}
//                                 aria-label={`Go to slide ${i + 1}`}
//                                 className="h-[3px] rounded-full transition-all duration-300"
//                                 style={{
//                                     width: i === index ? 28 : 12,
//                                     backgroundColor: i === index ? T.primary : "rgba(255,255,255,0.25)",
//                                 }}
//                             />
//                         ))}
//                     </div>
//                     <div className="flex items-center gap-1.5">
//                         <button
//                             onClick={() => go((index - 1 + total) % total)}
//                             className="flex h-9 w-9 items-center justify-center rounded-full border text-white/70 transition-colors hover:text-white"
//                             style={{ borderColor: "rgba(255,255,255,0.18)" }}
//                             aria-label="Previous slide"
//                         >
//                             <ChevronLeft className="h-4 w-4" />
//                         </button>
//                         <button
//                             onClick={() => go((index + 1) % total)}
//                             className="flex h-9 w-9 items-center justify-center rounded-full border text-white/70 transition-colors hover:text-white"
//                             style={{ borderColor: "rgba(255,255,255,0.18)" }}
//                             aria-label="Next slide"
//                         >
//                             <ChevronRight className="h-4 w-4" />
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         </section>
//     );
// }

/* ---------------------------------------------------------------------- */
/*  2. SEARCH SECTION (overlaps hero)                                      */
/* ---------------------------------------------------------------------- */

function SearchSection() {
    const [category, setCategory] = useState(searchCategories[0]);
    const [catOpen, setCatOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="relative z-10 mx-auto -mt-8 max-w-[1320px] px-5 sm:-mt-9 sm:px-8 lg:-mt-10 lg:px-10">
            {/* Desktop / tablet search bar */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="hidden overflow-visible rounded-2xl border bg-white shadow-[0_24px_60px_-24px_rgba(12,27,29,0.28)] sm:block"
                style={{ borderColor: T.line }}
            >
                <div className="flex items-stretch">
                    <div className="relative">
                        <button
                            onClick={() => setCatOpen((v) => !v)}
                            className="flex h-full min-w-[188px] items-center justify-between gap-2 px-5 text-[13.5px] font-semibold"
                            style={{ color: T.ink }}
                        >
                            <span className="truncate">{category}</span>
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: T.inkSoft }} />
                        </button>
                        <div className="absolute inset-y-2.5 right-0 w-px" style={{ backgroundColor: T.line }} />
                        <AnimatePresence>
                            {catOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.16 }}
                                    className="absolute left-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border bg-white py-1.5 shadow-xl"
                                    style={{ borderColor: T.line }}
                                >
                                    {searchCategories.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setCategory(c);
                                                setCatOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-[--hover]"
                                            style={{ color: c === category ? T.secondary : T.ink, "--hover": T.surface }}
                                        >
                                            {c}
                                            {c === category && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: T.secondary }} />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex flex-1 items-center gap-3 px-5">
                        <Search className="h-[18px] w-[18px] shrink-0" style={{ color: T.inkSoft }} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products, suppliers, or HSN codes"
                            className="h-full w-full bg-transparent py-4 text-[14.5px] outline-none placeholder:text-[--ph]"
                            style={{ color: T.ink, "--ph": T.inkSoft }}
                        />
                    </div>

                    <button
                        className="m-2 flex items-center gap-2 rounded-xl px-6 text-[13.5px] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
                        style={{ backgroundColor: T.secondary }}
                    >
                        Search
                    </button>
                </div>
            </motion.div>

            {/* trending chips - desktop */}
            <div className="mt-4 hidden items-center gap-2.5 sm:flex">
                <span className="text-[12px] font-medium" style={{ color: T.inkSoft }}>
                    Trending:
                </span>
                {trendingSearches.map((t) => (
                    <button
                        key={t}
                        className="rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-[--hb]"
                        style={{ borderColor: T.line, color: T.inkSoft, "--hb": T.secondary }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Mobile compact trigger */}
            <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setMobileOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl border bg-white px-5 py-4 shadow-[0_20px_44px_-20px_rgba(12,27,29,0.3)] sm:hidden"
                style={{ borderColor: T.line }}
            >
                <Search className="h-[18px] w-[18px]" style={{ color: T.inkSoft }} />
                <span className="text-[14px]" style={{ color: T.inkSoft }}>
                    Search products, suppliers…
                </span>
            </motion.button>

            {/* Mobile full-sheet search */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 sm:hidden"
                        style={{ backgroundColor: T.bg }}
                    >
                        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: T.line }}>
                            <div className="flex flex-1 items-center gap-2.5 rounded-xl border px-4 py-3" style={{ borderColor: T.line }}>
                                <Search className="h-4 w-4" style={{ color: T.inkSoft }} />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search products, suppliers…"
                                    className="w-full bg-transparent text-[14px] outline-none"
                                    style={{ color: T.ink }}
                                />
                            </div>
                            <button onClick={() => setMobileOpen(false)} aria-label="Close search">
                                <X className="h-5 w-5" style={{ color: T.ink }} />
                            </button>
                        </div>
                        <div className="px-5 py-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.inkSoft }}>
                                Trending searches
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {trendingSearches.map((t) => (
                                    <button
                                        key={t}
                                        className="rounded-full border px-3.5 py-2 text-[13px] font-medium"
                                        style={{ borderColor: T.line, color: T.ink }}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.inkSoft }}>
                                Browse categories
                            </p>
                            <div className="mt-3 flex flex-col divide-y" style={{ borderColor: T.line }}>
                                {searchCategories.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setCategory(c);
                                            setMobileOpen(false);
                                        }}
                                        className="flex items-center justify-between py-3.5 text-left text-[14px]"
                                        style={{ color: T.ink, borderColor: T.lineSoft }}
                                    >
                                        {c}
                                        <ChevronRight className="h-4 w-4" style={{ color: T.inkSoft }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/*  3. QUICK ACTIONS                                                       */
/* ---------------------------------------------------------------------- */

function QuickActions() {
    return (
        <section className="mx-auto max-w-[1320px] px-5 pt-10 sm:px-8 sm:pt-14 lg:px-10">
            <div
                className="grid grid-cols-2 overflow-hidden rounded-2xl border sm:grid-cols-4 lg:grid-cols-8"
                style={{ borderColor: T.line }}
            >
                {quickActions.map((a, i) => (
                    <motion.button
                        key={a.label}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        className="group flex flex-col items-start gap-3 border-b border-r px-5 py-6 text-left transition-colors duration-200 hover:bg-[--hv] last:border-r-0 sm:[&:nth-child(4)]:border-r-0 lg:[&:nth-child(4)]:border-r lg:[&:nth-child(8)]:border-r-0"
                        style={{ borderColor: T.lineSoft, "--hv": T.surface }}
                    >
                        <span
                            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200"
                            style={{ backgroundColor: T.surface, color: T.secondary }}
                        >
                            <a.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </span>
                        <div>
                            <p className="text-[13.5px] font-semibold leading-snug" style={{ color: T.ink }}>
                                {a.label}
                            </p>
                            <p className="mt-0.5 text-[11.5px]" style={{ color: T.inkSoft }}>
                                {a.note}
                            </p>
                        </div>
                    </motion.button>
                ))}
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  4. PERSONALIZED GREETING                                               */
/* ---------------------------------------------------------------------- */

function GreetingBar({ userName = "Aarav" }) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const items = [
        { icon: FileText, value: "5", label: "Open RFQs" },
        { icon: MessageSquare, value: "12", label: "New quotes" },
        { icon: Star, value: "8", label: "Saved suppliers" },
        { icon: Truck, value: "2", label: "Orders in transit" },
    ];

    return (
        <section className="mx-auto max-w-[1320px] px-5 pt-10 sm:px-8 sm:pt-14 lg:px-10">
            <div
                className="flex flex-col gap-6 rounded-2xl px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8"
                style={{ backgroundColor: T.secondaryDeep }}
            >
                <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/55">
                        {greeting}
                    </p>
                    <h3
                        className="mt-1.5 text-[22px] text-white sm:text-[26px]"
                        style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}
                    >
                        {userName}, here's where things stand
                    </h3>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:flex sm:items-center sm:gap-8">
                    {items.map((it, i) => (
                        <div key={it.label} className="flex items-center gap-3">
                            {i > 0 && <div className="hidden h-9 w-px bg-white/12 sm:block" />}
                            <it.icon className="h-4 w-4 text-white/45" strokeWidth={1.75} />
                            <div>
                                <p
                                    className="text-[18px] font-semibold leading-none text-white"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                    {it.value}
                                </p>
                                <p className="mt-1 text-[11px] text-white/55">{it.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  5. PRODUCT CATALOG                                                     */
/* ---------------------------------------------------------------------- */

function ProductCard({ p, featured }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`group relative flex overflow-hidden rounded-2xl border bg-white transition-shadow duration-300 hover:shadow-[0_24px_50px_-28px_rgba(12,27,29,0.35)] ${featured ? "flex-col lg:flex-row" : "flex-col"
                }`}
            style={{ borderColor: T.line }}
        >
            <div className={`relative overflow-hidden ${featured ? "aspect-[16/10] lg:aspect-auto lg:w-[46%]" : "aspect-[4/3]"}`}>
                <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    draggable={false}
                />
                {p.verified && (
                    <span
                        className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold shadow-sm"
                        style={{ color: T.secondary }}
                    >
                        <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                )}
            </div>

            <div className={`flex flex-1 flex-col justify-between p-5 ${featured ? "lg:p-7" : ""}`}>
                <div>
                    <div className="flex items-center gap-1 text-[11.5px]" style={{ color: T.inkSoft }}>
                        <MapPin className="h-3 w-3" /> {p.location}
                    </div>
                    <h3
                        className={`mt-2 font-semibold leading-snug ${featured ? "text-[19px]" : "text-[14.5px]"}`}
                        style={{ color: T.ink }}
                    >
                        {p.name}
                    </h3>
                    <p className="mt-1.5 text-[12.5px]" style={{ color: T.inkSoft }}>
                        {p.supplier}
                    </p>

                    <div className="mt-3 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5" fill={T.gold} style={{ color: T.gold }} />
                        <span className="text-[12px] font-medium" style={{ color: T.ink }}>
                            {p.rating}
                        </span>
                    </div>
                </div>

                <div className="mt-5 flex items-end justify-between border-t pt-4" style={{ borderColor: T.lineSoft }}>
                    <div>
                        <p
                            className={`font-semibold ${featured ? "text-[22px]" : "text-[16px]"}`}
                            style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.primaryDeep }}
                        >
                            {p.price}
                            <span className="text-[12px] font-normal" style={{ color: T.inkSoft }}>
                                {p.unit}
                            </span>
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: T.inkSoft }}>
                            {p.moq}
                        </p>
                    </div>
                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-200 group-hover:border-transparent group-hover:text-white"
                        style={{ borderColor: T.line, color: T.ink, "--tw-hover-bg": T.secondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.secondary)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                        <ArrowUpRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function ProductCatalog() {
    const [tab, setTab] = useState(catalogTabs[0]);
    const featured = products.find((p) => p.featured);
    const rest = products.filter((p) => !p.featured);

    return (
        <section className="mx-auto max-w-[1320px] px-5 pt-16 sm:px-8 sm:pt-20 lg:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <SectionHeading
                    eyebrow="Catalog"
                    title="Sourced and ready to quote"
                    sub="A live cut of what's moving fastest across the marketplace right now."
                />
                <button
                    className="hidden shrink-0 items-center gap-1.5 text-[13px] font-semibold sm:flex"
                    style={{ color: T.secondary }}
                >
                    View full catalog <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-8 flex gap-1 overflow-x-auto border-b" style={{ borderColor: T.line }}>
                {catalogTabs.map((c) => (
                    <button
                        key={c}
                        onClick={() => setTab(c)}
                        className="relative whitespace-nowrap px-4 py-3 text-[13.5px] font-medium transition-colors"
                        style={{ color: c === tab ? T.ink : T.inkSoft }}
                    >
                        {c}
                        {c === tab && (
                            <motion.div
                                layoutId="catalog-tab-underline"
                                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                                style={{ backgroundColor: T.primary }}
                            />
                        )}
                    </button>
                ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {featured && <ProductCard p={featured} featured />}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-1">
                    <div className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2 lg:col-span-1">
                        {rest.slice(0, 2).map((p) => (
                            <ProductCard key={p.id} p={p} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.slice(2).map((p) => (
                    <ProductCard key={p.id} p={p} />
                ))}
                <div
                    className="flex flex-col items-start justify-center gap-4 rounded-2xl border border-dashed p-7"
                    style={{ borderColor: T.line }}
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: T.surface, color: T.secondary }}>
                        <FileText className="h-5 w-5" />
                    </span>
                    <p className="text-[14.5px] font-semibold leading-snug" style={{ color: T.ink }}>
                        Can't find the exact spec?
                    </p>
                    <p className="text-[12.5px]" style={{ color: T.inkSoft }}>
                        Post a requirement and matched suppliers quote directly to you.
                    </p>
                    <button className="text-[13px] font-semibold" style={{ color: T.primary }}>
                        Post requirement →
                    </button>
                </div>
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  6. COMPANY TRUST STRIP — signature "verified ledger" marquee           */
/* ---------------------------------------------------------------------- */

function TrustLedgerStrip() {
    const row = [...ledgerSuppliers, ...ledgerSuppliers];
    return (
        <section className="mt-16 sm:mt-20">
            <div className="border-y" style={{ borderColor: T.line, backgroundColor: T.surface }}>
                <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-5 py-3.5 sm:px-8 lg:px-10">
                    <span
                        className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] sm:flex"
                        style={{ color: T.inkSoft }}
                    >
                        <ShieldCheck className="h-3.5 w-3.5" style={{ color: T.secondary }} />
                        Verified ledger
                    </span>
                    <div className="relative flex-1 overflow-hidden">
                        <div className="ledger-marquee flex w-max items-center gap-10">
                            {row.map((s, i) => (
                                <div key={i} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: T.secondary }} />
                                    <span className="text-[13px] font-semibold" style={{ color: T.ink }}>
                                        {s.name}
                                    </span>
                                    <span
                                        className="text-[11px]"
                                        style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}
                                    >
                                        est. {s.since}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
        .ledger-marquee {
          animation: ledger-scroll 34s linear infinite;
        }
        @keyframes ledger-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ledger-marquee { animation: none; }
        }
      `}</style>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  7. WHY CHOOSE US                                                       */
/* ---------------------------------------------------------------------- */

function WhyChooseUs() {
    return (
        <section className="mx-auto max-w-[1320px] px-5 pt-16 sm:px-8 sm:pt-20 lg:px-10">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
                <div>
                    <Eyebrow color={T.primary}>Why buyers stay</Eyebrow>
                    <h2
                        className="mt-3 max-w-sm text-[28px] leading-[1.18] sm:text-[34px]"
                        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500, color: T.ink }}
                    >
                        Procurement built for people who answer to a plant manager, not a shopping cart.
                    </h2>
                    <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed" style={{ color: T.inkSoft }}>
                        Every guarantee below exists because a buyer asked for it first — verification,
                        escrow, and turnaround times are the product, not the marketing.
                    </p>
                    <div className="mt-8 flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: T.line }}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: T.surface, color: T.secondary }}>
                            <PhoneCall className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-[13px] font-semibold" style={{ color: T.ink }}>
                                Talk to a sourcing advisor
                            </p>
                            <p className="text-[12px]" style={{ color: T.inkSoft }}>
                                Mon–Sat, 9am–8pm IST
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col divide-y" style={{ borderColor: T.lineSoft }}>
                    {whyChooseUs.map((item, i) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-60px" }}
                            transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-start gap-5 py-6 first:pt-0"
                            style={{ borderColor: T.lineSoft }}
                        >
                            <span
                                className="mt-0.5 text-[13px]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.inkSoft }}
                            >
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                                style={{ backgroundColor: T.surface, color: T.primaryDeep }}
                            >
                                <item.icon className="h-5 w-5" strokeWidth={1.75} />
                            </span>
                            <div>
                                <h3 className="text-[15.5px] font-semibold" style={{ color: T.ink }}>
                                    {item.title}
                                </h3>
                                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>
                                    {item.body}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  8. STATS BAND + CTA                                                    */
/* ---------------------------------------------------------------------- */

function StatsAndCta({ onOpenRfq }) {
    return (
        <section className="mx-auto max-w-[1320px] px-5 pt-16 sm:px-8 sm:pt-20 lg:px-10">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4" style={{ borderColor: T.line, backgroundColor: T.line }}>
                {stats.map((s) => (
                    <div key={s.label} className="bg-white px-6 py-8 text-center">
                        <p
                            className="text-[26px] font-semibold sm:text-[30px]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.secondaryDeep }}
                        >
                            {s.value}
                        </p>
                        <p className="mt-1.5 text-[12px]" style={{ color: T.inkSoft }}>
                            {s.label}
                        </p>
                    </div>
                ))}
            </div>

            <div
                className="relative mt-6 overflow-hidden rounded-2xl px-7 py-12 text-center sm:px-10 sm:py-16"
                style={{
                    background: `radial-gradient(120% 160% at 50% 0%, rgba(210,70,43,0.18) 0%, transparent 55%), ${T.secondaryDeep}`,
                }}
            >
                <TrendingUp className="mx-auto h-6 w-6" style={{ color: "#F0A98A" }} />
                <h2
                    className="mx-auto mt-4 max-w-lg text-[26px] leading-tight text-white sm:text-[32px]"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}
                >
                    One requirement, and the right suppliers come to you
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[14px] text-white/65">
                    Post it once — matched, verified suppliers quote within 48 hours.
                </p>
                <button
                    onClick={onOpenRfq}
                    className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_18px_40px_-14px_rgba(210,70,43,0.6)] transition-transform duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: T.primary }}
                >
                    Post your requirement <ArrowUpRight className="h-4 w-4" />
                </button>
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------------- */
/*  ROOT                                                                   */
/* ---------------------------------------------------------------------- */

export default function IndustrialMarketplaceHome() {
    const handleOpenRfq = () => { };

    return (
        <div style={{ backgroundColor: T.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <style>{FONTS}</style>

            <Hero16By9Banner onOpenRfq={handleOpenRfq} />
            <SearchSection />
            <QuickActions />
            <GreetingBar />
            <ProductCatalog />
            <TrustLedgerStrip />
            <WhyChooseUs />
            <StatsAndCta onOpenRfq={handleOpenRfq} />

            <div className="h-16 sm:h-20" />
        </div>
    );
}