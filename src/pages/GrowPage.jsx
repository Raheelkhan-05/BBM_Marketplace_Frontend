// src/pages/GrowPage.jsx
// Senior UI/UX pass: restrained visual system, editorial hierarchy, fewer cards,
// clearer conversion paths, and responsive layouts from mobile through desktop.

import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowRight,
    TrendingUp, Home, Boxes, FileText, Package, PackageCheck, Truck, Tag,
    Megaphone, ShieldCheck, Wallet, Image as ImageIcon,
    Users, MessageSquare, ShoppingBag, Zap, DollarSign, UserRoundPlus,
    Repeat2, LayoutDashboard, Settings2, MapPin, CheckCircle2, Eye,
    Send, ClipboardCheck, Search,
} from "lucide-react";
import { MENU_ROUTES } from "../components/menuItems.js";

/* ------------------------------------------------------------------ */
/* BRAND SYSTEM                                                        */
/* ------------------------------------------------------------------ */
const ORANGE = "#D84315";
const BLUE = "#0A5FB0";
const GREEN = "#1F7A4D";
const YELLOW = "#FED813";
const BLACK = "#000000";
const WHITE = "#FFFFFF";

const INK = BLACK;
const MUTED = "#5F6B76";
const SOFT = "#F7F9FB";
const BORDER = "#E4E8EC";
const BLUE_SOFT = "#EFF6FD";
const GREEN_SOFT = "#EEF7F2";
const ORANGE_SOFT = "#FFF3EE";
const YELLOW_SOFT = "#FFFBEA";
const GREEN_DEEP = "#123F2C";
const GREEN_BORDER = "#CDE2D6";

const EASE = [0.16, 1, 0.3, 1];

const CONTAINER = "mx-auto w-full max-w-6xl px-5 sm:px-7 lg:px-8";
const BTN_BASE =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-[14px] font-bold tracking-wide transition duration-200 active:translate-y-px";

/* ------------------------------------------------------------------ */
/* IMAGE PROMPTS                                                       */
/* ------------------------------------------------------------------ */
const STYLE =
    "Editorial commercial photography, natural daylight, authentic Indian wholesale and manufacturing setting, premium corporate composition, no text, no logos, no watermarks.";

const IMG = {
    hero1: { src: "/grow_hero_1.png", prompt: "Tall portrait of a confident Indian shop owner in his 40s checking a product catalogue on a phone inside a tidy wholesale warehouse, shelves of boxed goods behind him. " },
    hero2: { src: "/grow_hero_2.png", prompt: "Square top-down flat lay of brand boxes, small sample items, a notebook and a phone showing a product page on a clean table. " },
    hero3: { src: "/grow_hero_3.png", prompt: "Landscape close-up of a hand placing a labelled carton onto a stack in a bright storeroom, strong foreground blur. " },
    product: { src: null, prompt: "A studio-style product shelf with several brands of hardware and consumer goods, each in clean packaging, soft shadows, slight top-down angle. " },
    packaging: { src: null, prompt: "Macro shot of stacked master cartons and smaller pack boxes in graduated sizes showing clear multiples, soft green-tinted background. " },
    fulfilment: { src: null, prompt: "Wide warehouse scene: wrapped ready-to-ship pallets on the left, a workbench of items being made to order on the right. " },
    pricing: { src: null, prompt: "Hands holding a tablet showing tiered pricing slabs over a counter, stacks of product boxes of increasing height beside it, clean and abstract. " },
    marketing: { src: null, prompt: "A seller smiling while reading new enquiry notifications on a phone, products displayed on a shop counter behind, warm light. " },
    buyers: { src: null, prompt: "Two business owners shaking hands across a desk with a laptop and product samples, soft glass-office background. " },
    transport: { src: null, prompt: "A row of colourful Indian goods trucks at a loading bay at sunrise, drivers and loaders coordinating, cinematic wide angle. " },
    credit: { src: null, prompt: "A traditional shopkeeper's ledger beside a modern phone showing a payments screen, warm wooden desk, calm and trustworthy mood. " },
    cta: { src: null, prompt: "Wide Indian trading street at dawn, shutters opening, boxes being unloaded, optimistic mood, landscape composition. " },
};

function Ph({ id, ratio, rounded = "rounded-none", className = "" }) {
    const { src, prompt } = IMG[id];

    return (
        <div
            className={`relative w-full overflow-hidden ${rounded} ${className}`}
            style={{
                aspectRatio: ratio || undefined,
                background: SOFT,
            }}
        >
            {src ? (
                <img
                    src={src}
                    alt={id}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 overflow-hidden bg-slate-50" title={prompt + STYLE}>
                    <div className="absolute -left-6 top-8 h-28 w-28 rounded-full" style={{ background: BLUE_SOFT }} />
                    <div className="absolute right-8 top-5 h-16 w-16 rounded-full" style={{ background: YELLOW_SOFT }} />
                    <div className="absolute bottom-0 left-1/3 h-28 w-36 rounded-t-[40px]" style={{ background: GREEN_SOFT }} />
                    <div className="absolute bottom-5 right-6 h-16 w-24 rounded-sm border" style={{ borderColor: GREEN_BORDER, background: WHITE }} />
                    <div className="absolute inset-x-5 bottom-5 flex items-end justify-between">
                        <div className="max-w-[75%]">
                            <div className="h-1.5 w-16" style={{ background: ORANGE }} />
                            <div className="mt-2 h-2 w-28 rounded-full bg-slate-200" />
                            <div className="mt-2 h-2 w-20 rounded-full bg-slate-200" />
                        </div>
                        <ImageIcon className="h-5 w-5 text-slate-400" strokeWidth={1.7} />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* DATA                                                                */
/* ------------------------------------------------------------------ */
const WHY_GROW = [
    { Icon: Users, title: "Reach More Buyers", text: "Get your products in front of new and relevant B2B buyers.", accent: BLUE },
    { Icon: MessageSquare, title: "Get More Inquiries", text: "Receive requirements matched to what you sell.", accent: ORANGE },
    { Icon: ShoppingBag, title: "Sell More Products", text: "Turn your existing product range into new business opportunities.", accent: GREEN },
    { Icon: Zap, title: "Quote Faster", text: "Respond to inquiries quickly with ready-to-use pricing and terms.", accent: BLUE },
    { Icon: DollarSign, title: "Control Your Pricing", text: "Manage base prices, quantity slabs and buyer-specific pricing with ease.", accent: ORANGE },
    { Icon: UserRoundPlus, title: "Grow Existing Customers", text: "Manage your existing buyer relationships and pricing in one place.", accent: GREEN },
    { Icon: Repeat2, title: "Reduce Sales Effort", text: "Automate product sharing, inquiries, quotations and order management.", accent: BLUE },
    { Icon: Settings2, title: "Control Your Fulfilment", text: "Set stock, MOQ, lead time, freight and return terms your way.", accent: ORANGE },
    { Icon: Search, title: "Expand Your Network", text: "Move beyond traditional referrals and your existing customer base.", accent: GREEN },
    { Icon: Repeat2, title: "Build Recurring Business", text: "Convert new buyers into long-term customers and repeat orders.", accent: BLUE },
];

const BENEFITS = [
    { Icon: Users, title: "More Buyers", text: "Reach customers beyond your existing network." },
    { Icon: MessageSquare, title: "More Inquiries", text: "Get relevant requirements for your products." },
    { Icon: ShoppingBag, title: "More Sales", text: "Turn opportunities into new orders." },
    { Icon: Zap, title: "Faster Selling", text: "Manage products, prices, quotes and orders with less effort." },
    { Icon: ShieldCheck, title: "Better Customer Management", text: "Manage different prices, credit terms and fulfilment for each buyer." },
    { Icon: TrendingUp, title: "Lower Selling Cost", text: "Grow your business without building a larger sales infrastructure." },
    { Icon: Repeat2, title: "Recurring Business", text: "Turn new buyers into long-term customers." },
    { Icon: LayoutDashboard, title: "One-Stop Management", text: "Manage your complete B2B selling process in one place." },
];

const SELLING_STEPS = [
    { no: "01", Icon: Boxes, title: "Add Your Product", text: "Add product details, images, specifications, pack size, master pack and MOQ." },
    { no: "02", Icon: PackageCheck, title: "Set Fulfilment", text: "Choose ready-to-dispatch or made-to-order, and define lead time, returns, replacements and warranty." },
    { no: "03", Icon: MapPin, title: "Choose Your Market", text: "Select the locations where you want to sell and receive orders." },
    { no: "04", Icon: Tag, title: "Set Your Price", text: "Set an optimized price by reducing unnecessary sales and marketing overheads." },
    { no: "05", Icon: Megaphone, title: "Grow Your Reach", text: "Choose marketing and promotion services to reach new buyers and increase volumes from existing customers." },
    { no: "06", Icon: Eye, title: "Control Buyer Access", text: "Choose full or limited visibility and set different prices for multiple buyers for the same product." },
];

const CARDS = [
    { img: "product", tone: "blue", span: "lg:col-span-5", Icon: Boxes, title: "Product", text: "Add existing or new brands with product images, specifications and key details, all in one place. Keep your catalogue ready to share, discover and sell." },
    { img: "packaging", tone: "neutral", span: "lg:col-span-3", Icon: Package, title: "Packaging", text: "Set your pack size, master pack and MOQ once. Get orders in the exact multiples you sell, reducing errors and making every order easier to fulfil." },
    { img: "fulfilment", tone: "green", span: "lg:col-span-4", Icon: PackageCheck, title: "Fulfilment", text: "Set your stock, choose ready-to-ship or made-to-order, define lead times and freight terms, and customize your return & replacement policy, all your way." },
    { img: "pricing", tone: "neutral", span: "lg:col-span-3", Icon: Tag, title: "Pricing", text: "Update prices in real time and create unlimited quantity-based discount slabs, so every buyer gets the right price for the quantity they order." },
    { img: "marketing", tone: "orange", span: "lg:col-span-4", Icon: Megaphone, title: "Marketing & Promotion", text: "Start with transaction fees as low as 0.25% and choose the growth services you need to reach more buyers, generate more inquiries and grow your sales." },
    { img: "buyers", tone: "neutral", span: "lg:col-span-5", Icon: ShieldCheck, title: "Buyer Access & Pricing", text: "Control who sees your products and prices. Choose full or limited visibility, set customized pricing for multiple buyers for a single product, and update your base price once to instantly update all linked buyer prices in real time." },
    { img: "transport", tone: "green", span: "lg:col-span-6", Icon: Truck, title: "Transport", text: "Use the logistics partners you already trust every day, making transportation easier while keeping your delivery process simple and costs under control." },
    { img: "credit", tone: "blue", span: "lg:col-span-6", Icon: Wallet, title: "Credit", text: "Set your own credit terms and bring your existing credit business onto one platform, making it easier to manage customers, orders and payments while growing with confidence." },
];

const TONES = {
    blue: { bg: BLUE_SOFT, accent: BLUE },
    green: { bg: GREEN_SOFT, accent: GREEN },
    orange: { bg: ORANGE_SOFT, accent: ORANGE },
    neutral: { bg: WHITE, accent: INK },
};

/* ------------------------------------------------------------------ */
/* SHARED UI                                                          */
/* ------------------------------------------------------------------ */
function SectionLabel({ children, color = BLUE }) {
    return (
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color }}>
            <span className="h-px w-6" style={{ background: color }} />
            <span>{children}</span>
        </div>
    );
}

function SectionHeading({ eyebrow, title, text, light = false, align = "left" }) {
    return (
        <div className={`${align === "center" ? "mx-auto text-center" : ""} max-w-2xl`}>
            {eyebrow && <SectionLabel color={light ? YELLOW : BLUE}>{eyebrow}</SectionLabel>}
            <h2
                className="mt-3 text-[28px] font-black leading-[1.08] tracking-wide sm:text-[38px]"
                style={{ color: light ? WHITE : INK }}
            >
                {title}
            </h2>
            {text && (
                <p
                    className="mt-3 text-[14.5px] font-medium leading-[1.25] sm:text-[15px] tracking-wide"
                    style={{ color: light ? "rgba(255,255,255,0.78)" : MUTED }}
                >
                    {text}
                </p>
            )}
        </div>
    );
}

function PrimaryCTA({ children, className = "", style: customStyle, ...props }) {
    return (
        <Link
            {...props}
            className={`${BTN_BASE} ${className}`}
            style={{ background: GREEN_DEEP, color: WHITE, outlineColor: BLUE, ...customStyle }}
        >
            {children}
        </Link>
    );
}

function SecondaryCTA({ children, href, className = "" }) {
    return (
        <a
            href={href}
            className={`${BTN_BASE} ${className}`}
            style={{ background: WHITE, color: GREEN_DEEP, boxShadow: `inset 0 0 0 1px ${GREEN_DEEP}`, outlineColor: BLUE }}
        >
            {children}
        </a>
    );
}

function FooterDock() {
    const { pathname, search } = useLocation();
    const items = [
        { key: "home", label: "Home", Icon: Home, to: MENU_ROUTES.home, match: (p) => p === "/home" || p === "/home/" },
        { key: "products", label: "Products", Icon: Boxes, to: MENU_ROUTES.manageProducts, match: (p) => p.startsWith("/seller/products") },
        {
            key: "sales", label: "Sales Orders", Icon: FileText, to: MENU_ROUTES.salesOrders,
            match: (p, s) => (p === "/orders" && new URLSearchParams(s || "").get("tab") === "sales") || p.startsWith("/seller/orders"),
        },
    ];

    return (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center gap-1 rounded-full border bg-white p-1 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)]" style={{ borderColor: BORDER }}>
                {items.map(({ key, label, Icon, to, match }) => {
                    const active = match(pathname, search);
                    return (
                        <Link
                            key={key}
                            to={to}
                            aria-current={active ? "page" : undefined}
                            className="flex min-w-[68px] flex-col items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold transition"
                            style={{ background: active ? BLUE_SOFT : WHITE, color: active ? BLUE : MUTED, outlineColor: BLUE }}
                        >
                            <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function Wordmark() {

    const reduce = useReducedMotion();

    return (
        <>
            {/* GROW wordmark: the pulsing circle is the "O" */}
            <div
                role="img"
                aria-label="Grow"
                className="flex select-none items-center justify-left font-black uppercase leading-none tracking-wide"
                style={{
                    color: INK,
                    fontSize: "clamp(48px, 16vw, 72px)",
                    letterSpacing: "-0.02em",
                }}
            >
                <span aria-hidden>GR</span>

                <motion.div
                    aria-hidden
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="relative flex items-center justify-center rounded-full"
                    style={{
                        background: GREEN,
                        width: "0.76em",
                        height: "0.76em",
                        margin: "0 0.05em",
                    }}
                >
                    {!reduce &&
                        [0, 1].map((i) => (
                            <motion.span
                                key={i}
                                aria-hidden
                                className="absolute inset-0 rounded-full"
                                style={{ background: GREEN }}
                                initial={{ opacity: 0, scale: 1 }}
                                animate={{
                                    opacity: [0, 0.35, 0],
                                    scale: [1, 1.35, 1.8],
                                }}
                                transition={{
                                    duration: 4,
                                    times: [0, 0.1, 1],
                                    ease: "easeOut",
                                    repeat: Infinity,
                                    delay: i * 2,
                                }}
                            />
                        ))}

                    <TrendingUp
                        className="relative text-white"
                        style={{
                            width: "0.4em",
                            height: "0.4em",
                        }}
                        strokeWidth={2.2}
                    />
                </motion.div>

                <span aria-hidden>W</span>
            </div>
        </>
    );
}

/* ------------------------------------------------------------------ */
/* SECTIONS                                                            */
/* ------------------------------------------------------------------ */
function Hero() {
    return (
        <header className="border-b" style={{ borderColor: BORDER, background: WHITE }}>
            <div className={`${CONTAINER} grid items-stretch gap-10 py-10 md:py-14 lg:grid-cols-12 lg:gap-14 lg:py-20`}>
                <div className="flex flex-col justify-center lg:col-span-6">
                    <Wordmark />
                    <h1 className="mt-4 max-w-xl text-[34px] font-black leading-[1.04] tracking-[-0.015em] sm:text-[48px]">
                        Turn your product into business
                    </h1>
                    <p className="mt-5 max-w-xl text-[15px] font-medium leading-7 tracking-wide" style={{ color: MUTED }}>
                        GROW puts your products in front of the right buyers, helping you get more inquiries, win more orders and grow your business.
                    </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <PrimaryCTA to={MENU_ROUTES.manageProducts}>
                            Add your products
                            <span aria-hidden>→</span>
                        </PrimaryCTA>
                        <SecondaryCTA href="#process">See how selling works</SecondaryCTA>
                    </div>
                </div>

                <div className="lg:col-span-6">
                    <div className="grid h-full grid-cols-12 gap-2 sm:gap-3">
                        <div className="col-span-7 overflow-hidden border" style={{ borderColor: BORDER }}>
                            <Ph id="hero1" className="h-full" />
                        </div>
                        <div className="col-span-5 flex min-h-[240px] flex-col gap-2 sm:gap-3">
                            <div className="flex-1 overflow-hidden border" style={{ borderColor: BORDER }}>
                                <Ph id="hero2" ratio="4 / 3" />
                            </div>
                            <div className="overflow-hidden border" style={{ borderColor: BORDER }}>
                                <Ph id="hero3" ratio="4 / 3" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

function FeeStrip() {
    return (
        <section style={{ background: BLACK, color: WHITE }}>
            <div className={`${CONTAINER} flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-6`}>
                <div className="text-[28px] font-black tracking-[-0.04em] sm:text-[32px]">0.25%</div>
                <div className="text-[12.5px] font-medium leading-5 sm:text-[14px] tracking-wide">
                    Transaction fees start as low as 0.25%, so you keep more of every order you win.
                </div>
            </div>
        </section>
    );
}

function WhyGrowSection() {
    return (
        <section className="border-b" style={{ borderColor: BORDER, background: WHITE }}>
            <div className={`${CONTAINER} py-12 md:py-20`}>
                <SectionHeading
                    title="Why GROW?"
                />

                <div className="mt-8 grid border-t sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: BORDER }}>
                    {WHY_GROW.map(({ Icon, title, text, accent }, index) => (
                        <article key={title} className="border-b py-5 sm:px-5 sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(5n)]:border-r-0" style={{ borderColor: BORDER }}>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${accent}14`, color: accent }}>
                                    <Icon className="h-3.5 w-3.5" strokeWidth={2.3} />
                                </span>
                                <div>
                                    <div className="text-[11px] font-black tracking-[0.08em]" style={{ color: MUTED }}>{String(index + 1).padStart(2, "0")}</div>
                                    <h3 className="mt-1 text-[15px] font-extrabold leading-tight tracking-wide" style={{ color: INK }}>{title}</h3>
                                    <p className="mt-1 text-[12px] font-medium leading-tight tracking-wide" style={{ color: MUTED }}>{text}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-8 flex justify-start">
                    <PrimaryCTA to={MENU_ROUTES.manageProducts}>
                        Add your products
                        <span aria-hidden>→</span>
                    </PrimaryCTA>
                </div>
            </div>
        </section>
    );
}

function BenefitsSection() {
    return (
        <section style={{ background: SOFT }}>
            <div className={`${CONTAINER} py-12 md:py-20`}>
                <div className="grid gap-5 lg:grid-cols-12 lg:gap-14">
                    <div className="lg:col-span-4">
                        <SectionHeading
                            title="Benefits of GROW"
                        />
                    </div>

                    <div className="lg:col-span-8">
                        <div className="grid border-t sm:grid-cols-2" style={{ borderColor: BORDER }}>
                            {BENEFITS.map(({ Icon, title, text }, index) => (
                                <article key={title} className="border-b py-5 sm:px-5 sm:[&:nth-child(odd)]:border-r" style={{ borderColor: BORDER }}>
                                    <div className="flex gap-3">
                                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center" style={{ background: WHITE, color: BLUE, border: `1px solid ${BLUE}` }}>
                                            <Icon className="h-4 w-4" strokeWidth={2.1} />
                                        </span>
                                        <div>
                                            <h3 className="text-[15px] font-extrabold tracking-wide" style={{ color: INK }}>{title}</h3>
                                            <p className="mt-0 text-[12.5px] font-medium leading-tight tracking-wide" style={{ color: MUTED }}>{text}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-9 flex justify-start">
                    <PrimaryCTA to={MENU_ROUTES.manageProducts}>
                        Add your products
                        <span aria-hidden>→</span>
                    </PrimaryCTA>
                </div>
            </div>
        </section>
    );
}

function SellingProcessSection() {
    return (
        <section id="process" className="scroll-mt-5 border-b" style={{ borderColor: BORDER, background: WHITE }}>
            <div className={`${CONTAINER} py-12 md:py-20`}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <SectionHeading
                        eyebrow="See How Selling Works"
                        title="Set it once. Sell with ease."
                    />
                    <div className="flex items-center gap-2 text-[13.5px] font-bold" style={{ color: GREEN }}>
                        <CheckCircle2 className="h-4 w-4" />
                        Submit. Publish. Sell.
                    </div>
                </div>

                <div className="mt-6 grid border-t sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: BORDER }}>
                    {SELLING_STEPS.map(({ no, Icon, title, text }, index) => (
                        <article key={no} className="border-b p-0 py-6 lg:px-6 lg:[&:nth-child(3n+1)]:pl-0 lg:[&:nth-child(3n)]:pr-0 sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0" style={{ borderColor: BORDER }}>
                            <div className="flex items-center justify-between">
                                <div className="text-[11px] font-black tracking-[0.14em]" style={{ color: index % 2 === 0 ? BLUE : GREEN }}>{no}</div>
                                <Icon className="h-6 w-6" style={{ color: index === 4 ? ORANGE : MUTED }} strokeWidth={1.9} />
                            </div>
                            <h3 className="mt-0 text-[16px] font-extrabold tracking-wide" style={{ color: INK }}>{title}</h3>
                            <p className="mt-1 max-w-sm text-[12.5px] font-medium leading-tight tracking-wide" style={{ color: MUTED }}>{text}</p>
                        </article>
                    ))}
                </div>

                <div
                    className="mt-10 overflow-hidden border"
                    style={{
                        borderColor: GREEN_BORDER,
                        background: "#FFFFFF",
                    }}
                >
                    {/* Top accent */}
                    <div className="h-1 w-full" style={{ background: YELLOW }} />

                    <div className="p-5 sm:p-7 lg:p-8">

                        {/* Main message */}
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                            {/* Left: headline + supporting message */}
                            <div className="max-w-2xl">
                                <div className="flex items-start gap-4">
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center"
                                        style={{
                                            background: BLACK,
                                            color: "#FFFFFF",
                                        }}
                                    >
                                        <Send className="h-5 w-5" strokeWidth={2} />
                                    </span>

                                    <div className="min-w-0">
                                        <h3
                                            className="text-[20px] font-black leading-tight tracking-wide sm:text-[24px]"
                                            style={{ color: INK }}
                                        >
                                            Submit. Publish. Sell.
                                        </h3>

                                        <p
                                            className="mt-1 max-w-xl text-[12.5px] font-medium leading-[1.125] tracking-wide sm:text-[14px]"
                                            style={{ color: MUTED }}
                                        >
                                            Everything you need to sell, exactly your way.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: 3-step selling progression */}
                            <div className="w-full lg:w-auto">
                                <div className="grid grid-cols-3 border" style={{ borderColor: GREEN_BORDER }}>

                                    <div
                                        className="flex min-h-[72px] flex-col justify-center px-3 py-3 sm:px-5"
                                        style={{ background: GREEN_SOFT }}
                                    >
                                        <span
                                            className="text-[12.5px] font-black uppercase tracking-[0.14em]"
                                            style={{ color: GREEN }}
                                        >
                                            01
                                        </span>

                                        <span
                                            className="mt-0.5 text-[14px] tracking-wide font-extrabold"
                                            style={{ color: INK }}
                                        >
                                            Submit.
                                        </span>
                                    </div>

                                    <div
                                        className="flex min-h-[72px] flex-col justify-center border-l px-3 py-3 sm:px-5"
                                        style={{
                                            borderColor: GREEN_BORDER,
                                            background: "#FFFFFF",
                                        }}
                                    >
                                        <span
                                            className="text-[12.5px] font-black uppercase tracking-[0.14em]"
                                            style={{ color: BLUE }}
                                        >
                                            02
                                        </span>

                                        <span
                                            className="mt-0.5 text-[14px] tracking-wide font-extrabold"
                                            style={{ color: INK }}
                                        >
                                            Publish.
                                        </span>
                                    </div>

                                    <div
                                        className="flex min-h-[72px] flex-col justify-center border-l px-3 py-3 sm:px-5"
                                        style={{
                                            borderColor: GREEN_BORDER,
                                            background: YELLOW,
                                        }}
                                    >
                                        <span
                                            className="text-[12.5px] font-black uppercase tracking-[0.14em]"
                                            style={{ color: BLACK }}
                                        >
                                            03
                                        </span>

                                        <span
                                            className="mt-0.5 text-[14px] tracking-wide font-extrabold"
                                            style={{ color: BLACK }}
                                        >
                                            Sell.
                                        </span>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Fulfilment journey */}
                        <div
                            className="mt-7 border-t pt-6"
                            style={{ borderColor: GREEN_BORDER }}
                        >
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                                {/* Copy */}
                                <div className="max-w-xl">
                                    <p
                                        className="text-[14px] font-semibold leading-6 sm:text-[15px] tracking-wide"
                                        style={{ color: INK }}
                                    >
                                        Once an order arrives, confirm → dispatch → deliver.
                                    </p>
                                </div>

                                {/* Process */}
                                <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2 sm:justify-end">

                                    <span
                                        className="inline-flex min-w-0 shrink-0 items-center gap-1.5 border px-2.5 py-2 text-[12px] font-extrabold tracking-wide sm:gap-2 sm:px-3 sm:text-[13px]"
                                        style={{
                                            borderColor: GREEN_BORDER,
                                            color: INK,
                                            background: "#FFFFFF",
                                        }}
                                    >
                                        <span
                                            className="flex h-5 w-5 items-center justify-center"
                                            style={{
                                                background: GREEN_SOFT,
                                                color: GREEN,
                                            }}
                                        >
                                            <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                                        </span>
                                        Confirm
                                    </span>

                                    <ArrowRight
                                        className="h-4 w-4 shrink-0"
                                        style={{ color: GREEN_BORDER }}
                                        strokeWidth={1.8}
                                    />

                                    <span
                                        className="inline-flex min-w-0 shrink-0 items-center gap-1.5 border px-2.5 py-2 text-[12px] font-extrabold tracking-wide sm:gap-2 sm:px-3 sm:text-[13px]"
                                        style={{
                                            borderColor: GREEN_BORDER,
                                            color: INK,
                                            background: "#FFFFFF",
                                        }}
                                    >
                                        <span
                                            className="flex h-5 w-5 items-center justify-center"
                                            style={{
                                                background: "#EAF2FB",
                                                color: BLUE,
                                            }}
                                        >
                                            <PackageCheck className="h-3 w-3" strokeWidth={2.2} />
                                        </span>
                                        Dispatch
                                    </span>

                                    <ArrowRight
                                        className="h-4 w-4 shrink-0"
                                        style={{ color: GREEN_BORDER }}
                                        strokeWidth={1.8}
                                    />

                                    <span
                                        className="inline-flex min-w-0 shrink-0 items-center gap-1.5 border px-2.5 py-2 text-[12px] font-extrabold tracking-wide sm:gap-2 sm:px-3 sm:text-[13px]"
                                        style={{
                                            borderColor: GREEN_BORDER,
                                            color: INK,
                                            background: "#FFFFFF",
                                        }}
                                    >
                                        <span
                                            className="flex h-5 w-5 items-center justify-center"
                                            style={{
                                                background: "#FFF8D8",
                                                color: BLACK,
                                            }}
                                        >
                                            <Truck className="h-3 w-3" strokeWidth={2.2} />
                                        </span>
                                        Deliver
                                    </span>

                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}

function SellingControlsSection() {
    return (
        <section id="selling" className="scroll-mt-5" style={{ background: WHITE }}>
            <div className={`${CONTAINER} py-12 md:py-20`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <SectionHeading
                        title="Enjoy the ease of selling"
                        text="Set up how you sell once. Your catalogue, packs, stock, prices, buyers, delivery and credit stay ready for every order."
                    />
                </div>

                <div className="mt-9 grid gap-3 lg:grid-cols-12">
                    {CARDS.map(({ img, tone, span, Icon, title, text }) => {
                        const t = TONES[tone];
                        return (
                            <article key={title} className={`group grid overflow-hidden border bg-white sm:grid-cols-[150px_1fr] lg:grid-cols-1 ${span}`} style={{ borderColor: BORDER }}>
                                <div className="min-h-[145px] sm:min-h-0 lg:min-h-[175px]">
                                    <Ph id={img} />
                                </div>
                                <div className="flex flex-col justify-between p-5" style={{ background: t.bg }}>
                                    <div>
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="text-[16px] font-extrabold tracking-wide" style={{ color: INK }}>{title}</h3>
                                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.accent }} />
                                        </div>
                                        <p className="mt-1 text-[12.5px] font-medium leading-5 tracking-wide" style={{ color: MUTED }}>{text}</p>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function ClosingCTA() {
    return (
        <section className="pb-28 md:pb-32">
            <div className={CONTAINER}>
                <div className="grid overflow-hidden lg:grid-cols-12" style={{ background: GREEN_DEEP }}>
                    <div className="min-h-[210px] lg:col-span-5">
                        <Ph id="cta" />
                    </div>
                    <div className="flex flex-col justify-center p-7 sm:p-10 lg:col-span-7 lg:p-12">
                        <h2 className="mt-3 max-w-xl text-[28px] font-black leading-[1.05] tracking-wide text-white sm:text-[40px]">
                            Your catalogue is ready when you are
                        </h2>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <PrimaryCTA to={MENU_ROUTES.manageProducts} style={{ background: WHITE, color: GREEN_DEEP, outlineColor: WHITE }}>
                                Add your first product
                                <span aria-hidden>→</span>
                            </PrimaryCTA>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function GrowPage() {
    return (
        <div className="min-h-screen bg-white text-slate-900 antialiased">
            <Hero />
            <FeeStrip />
            <WhyGrowSection />
            <BenefitsSection />
            <SellingProcessSection />
            <SellingControlsSection />
            <ClosingCTA />
            <FooterDock />
        </div>
    );
}
