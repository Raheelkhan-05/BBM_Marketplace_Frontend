// src/pages/GrowPage.jsx
// Placeholder for /grow until the real Grow tools ship.

import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, TrendingUp, Rocket, BarChart3, Users, Home, Boxes, FileText } from "lucide-react";
import { MENU_ROUTES } from "../components/menuItems.js";
import growLogo from "../assets/grow-logo.svg";

const GREEN = "#1F7A4D";
const GREEN_DARK = "#14573A";
const GREEN_TINT = "#E8F3EC";
const GREEN_BORDER = "#BCDCC9";
const INK = "#0B1116";
const MUTED = "#667077";
const EASE = [0.16, 1, 0.3, 1];

const STEPS = [
    { Icon: Rocket, title: "Boost your products", text: "Promote your best listings so more buyers see them first." },
    { Icon: BarChart3, title: "Track your performance", text: "See views, enquiries and orders for every product in one place." },
    { Icon: Users, title: "Reach more buyers", text: "Get matched with buyers who are looking for what you sell." },
];

// Footer dock items: icon + label. Routes come from the shared menu routes.
const FOOTER_ITEMS = [
    {
        key: "home", label: "Home", Icon: Home, to: MENU_ROUTES.home,
        match: (p) => p === "/home" || p === "/home/"
    },
    {
        key: "products", label: "Products", Icon: Boxes, to: MENU_ROUTES.manageProducts,
        match: (p) => p.startsWith("/seller/products")
    },
    {
        key: "sales", label: "Sales Orders", Icon: FileText, to: MENU_ROUTES.salesOrders,
        match: (p, s) => (p === "/orders" && new URLSearchParams(s || "").get("tab") === "sales") || p.startsWith("/seller/orders")
    },
];

function FooterDock() {
    const { pathname, search } = useLocation();
    return (
        <nav
            aria-label="Quick navigation"
            className="fixed inset-x-0 z-40 flex justify-center"
            style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        >
            <div className="flex items-center gap-1 rounded-full bg-white p-1.5 shadow-[0_10px_30px_-8px_rgba(20,27,34,0.35)] ring-1 ring-black/10">
                {FOOTER_ITEMS.map(({ key, label, Icon, to, match }) => {
                    const active = match(pathname, search);
                    return (
                        <Link
                            key={key}
                            to={to}
                            aria-current={active ? "page" : undefined}
                            className="flex min-w-[68px] flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 transition-colors active:scale-95"
                            style={{ background: active ? GREEN_TINT : "transparent", color: active ? GREEN : INK }}
                        >
                            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2.1} />
                            <span className="whitespace-nowrap text-[10.5px] font-bold leading-none tracking-wide">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function GrowTitle() {
    return (
        <h1
            aria-label="Grow"
            className="flex items-center select-none font-black uppercase leading-none"
            style={{
                color: INK,
                fontSize: "clamp(56px, 20vw, 88px)", // scales with screen width
                letterSpacing: "-0.02em",
            }}
        >
            <span aria-hidden>GR</span>
            <img
                src={growO}
                alt=""
                aria-hidden
                draggable={false}
                style={{ height: "0.8em", width: "auto", margin: "0 0.02em" }}
            />
            <span aria-hidden>W</span>
        </h1>
    );
}

export default function GrowPage() {
    const reduce = useReducedMotion();

    return (
        <div className="min-h-screen bg-white text-slate-900 antialiased">
            {/* pb-28 keeps the content clear of the fixed footer dock */}
            <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-4">
                <div className="flex flex-1 flex-col max-w-xl mx-auto items-center justify-center py-10 text-center">
                    {/* GROW wordmark: the pulsing circle is the "O" */}
                    <div
                        role="img"
                        aria-label="Grow"
                        className="flex select-none items-center justify-center font-black uppercase leading-none"
                        style={{
                            color: INK,
                            fontSize: "clamp(48px, 16vw, 72px)", // everything below scales from this
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
                                        animate={{ opacity: [0, 0.35, 0], scale: [1, 1.35, 1.8] }}
                                        transition={{
                                            duration: 4,
                                            times: [0, 0.1, 1],
                                            ease: "easeOut",
                                            repeat: Infinity,
                                            delay: i * 2, // half of duration
                                        }}
                                    />
                                ))}
                            <TrendingUp
                                className="relative text-white"
                                style={{ width: "0.4em", height: "0.4em" }}
                                strokeWidth={2.2}
                            />
                        </motion.div>

                        <span aria-hidden>W</span>
                    </div>

                    <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-wide" style={{ color: INK }}>
                        Turn Your Product Into Business
                    </h1>
                    <p className="mt-2 max-w-sm text-[13.5px] font-medium leading-relaxed tracking-wide" style={{ color: MUTED }}>
                        GROW puts your products in front of the right buyers, helping you get more inquiries, win more orders and grow your business.
                    </p>

                    <div className="mt-8 grid w-full gap-2.5 text-left">
                        {STEPS.map(({ Icon, title, text }, i) => (
                            <motion.div
                                key={title}
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: EASE, delay: 0.1 + i * 0.06 }}
                                className="flex items-start gap-3 rounded-md border px-3 py-3"
                                style={{ background: GREEN_TINT, borderColor: GREEN_BORDER }}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: GREEN }}>
                                    <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                                </span>
                                <span className="min-w-0 leading-tight">
                                    <span className="block text-[13px] font-extrabold tracking-wide" style={{ color: GREEN_DARK }}>{title}</span>
                                    <span className="mt-0.5 block text-[11.5px] font-medium leading-snug tracking-wide" style={{ color: MUTED }}>{text}</span>
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            <FooterDock />
        </div>
    );
}