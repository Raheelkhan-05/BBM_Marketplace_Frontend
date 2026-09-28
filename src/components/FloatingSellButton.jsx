// components/FloatingSellButton.jsx
//
// Desktop (md+): the original floating "Sell" button with its hover label.
// Mobile (<md): a floating MENU button. Tapping it morphs the icon into an X,
// dims the screen, and fans the menu items upward one by one.
// Sell is the first (highlighted) item, so nothing is lost on mobile.

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Menu, X, Home, LayoutGrid } from "lucide-react";

const RIPPLE_COUNT = 3;
const RIPPLE_CYCLE_MS = 2600;
const RIPPLE_STAGGER_MS = RIPPLE_CYCLE_MS / RIPPLE_COUNT;

// TODO: replace/extend with the same items BottomNavStrip used to show.
const DEFAULT_MENU_ITEMS = [
    { key: "home", label: "Home", icon: Home, to: "/home" },
    { key: "browse", label: "Browse", icon: LayoutGrid, to: "/browse" },
];

/* ───────────────────────── Desktop (unchanged) ───────────────────────── */

function DesktopSellButton({ to, label }) {
    const navigate = useNavigate();

    return (
        <>
            <style>{`
                @keyframes fsb-pop-in {
                    from { opacity: 0; transform: translateY(14px) scale(0.85); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fsb-breathe {
                    0%, 100% { box-shadow: 0 8px 22px -6px rgba(255, 255, 255, 0.5); }
                    50%      { box-shadow: 0 10px 30px -4px rgba(255, 255, 255, 0.68); }
                }

                .fsb-wrap {
                    animation: fsb-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
                }

                .fsb-btn {
                    animation: fsb-breathe 3.4s ease-in-out infinite;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .fsb-btn:hover {
                    transform: scale(1.07) translateY(-2px);
                }
                .fsb-btn:active {
                    transform: scale(0.94);
                }

                .fsb-icon {
                    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .fsb-group:hover .fsb-icon {
                    transform: rotate(90deg);
                }

                .fsb-label {
                    max-width: 0;
                    opacity: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    transition: max-width 0.3s ease, opacity 0.25s ease, margin 0.3s ease;
                }
                .fsb-group:hover .fsb-label {
                    max-width: 90px;
                    opacity: 1;
                    margin-left: 8px;
                }

                @media (prefers-reduced-motion: reduce) {
                    .fsb-wrap { animation: none; }
                    .fsb-btn { animation: none; }
                    .fsb-icon, .fsb-label { transition: none; }
                }
            `}</style>

            <div className="fixed bottom-8 right-8 z-[38] fsb-wrap">
                <div className="relative">
                    {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            style={{ animationDelay: `${i * RIPPLE_STAGGER_MS}ms` }}
                        />
                    ))}

                    <button
                        type="button"
                        onClick={() => navigate(to)}
                        aria-label={`${label} — start listing an item`}
                        className="fsb-group fsb-btn relative flex h-16 w-auto items-center justify-center rounded-full px-5 text-white"
                        style={{ background: "#000000" }}
                    >
                        <span className="relative flex items-center">
                            <Plus size={24} strokeWidth={2.5} className="fsb-icon shrink-0" />
                            <span className="fsb-label text-[13px] font-bold tracking-wide">
                                {label}
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}

/* ───────────────────────── Mobile menu button ───────────────────────── */

function MobileMenuFab({ sellTo, sellLabel, menuItems }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);

    // Sell first + highlighted, then the rest
    const items = [
        { key: "sell", label: sellLabel, icon: Plus, to: sellTo, primary: true },
        ...menuItems,
    ];

    useEffect(() => { setOpen(false); }, [pathname]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const handleItem = (item) => {
        setOpen(false);
        if (item.onClick) item.onClick();
        else if (item.to) navigate(item.to);
    };

    return (
        <div className="md:hidden">
            {/* dim backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-backdrop"
                        className="fixed inset-0 z-[44] bg-black/35 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* sits just above the bottom search bar */}
            <div
                className="fixed right-4 z-[46] flex flex-col items-end"
                style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
            >
                <AnimatePresence>
                    {open && (
                        <div className="mb-3 flex flex-col items-end gap-2.5">
                            {items.map((item, i) => {
                                const Icon = item.icon;
                                // reverse stagger: items nearest the button appear first
                                const delay = (items.length - 1 - i) * 0.05;
                                return (
                                    <motion.button
                                        key={item.key}
                                        type="button"
                                        onClick={() => handleItem(item)}
                                        initial={{ opacity: 0, y: 16, scale: 0.85 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.9, transition: { duration: 0.12 } }}
                                        transition={{ type: "spring", stiffness: 420, damping: 26, delay }}
                                        className="flex items-center gap-2.5"
                                    >
                                        <span
                                            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold tracking-wide shadow-lg ${item.primary ? "bg-black text-white" : "bg-white text-slate-800"
                                                }`}
                                        >
                                            {item.label}
                                        </span>
                                        <span
                                            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg ${item.primary ? "bg-black text-white" : "bg-white text-slate-800"
                                                }`}
                                        >
                                            <Icon size={20} strokeWidth={2.2} />
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>

                <motion.button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={open ? "Close menu" : "Open menu"}
                    aria-expanded={open}
                    initial={{ opacity: 0, y: 14, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
                    whileTap={{ scale: 0.92 }}
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)]"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={open ? "x" : "menu"}
                            initial={{ rotate: open ? -90 : 90, opacity: 0, scale: 0.6 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: open ? 90 : -90, opacity: 0, scale: 0.6 }}
                            transition={{ duration: 0.18 }}
                            className="flex"
                        >
                            {open ? <X size={24} strokeWidth={2.5} /> : <Menu size={24} strokeWidth={2.5} />}
                        </motion.span>
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
}

/* ───────────────────────── Public component ───────────────────────── */

export default function FloatingSellButton({ to = "/seller/sell", label = "Sell" }) {
    return (
        <div className="hidden md:block">
            <DesktopSellButton to={to} label={label} />
        </div>
    );
}