import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, WifiOff, Share } from "lucide-react";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
};
const EASE = [0.16, 1, 0.3, 1];

const PERKS = [
    { icon: Zap, text: "Faster load, no browser chrome" },
    { icon: WifiOff, text: "Works even with a weak connection" },
];

export default function InstallAppPrompt() {
    const { show, platform, promptInstall, dismiss } = usePwaInstallPrompt();
    const [installing, setInstalling] = useState(false);

    async function handleInstall() {
        setInstalling(true);
        await promptInstall();
        setInstalling(false);
    }

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="fixed inset-x-3 bottom-3 z-[999] overflow-hidden rounded-[22px] border bg-white sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px]"
                    style={{ borderColor: C.hair, boxShadow: "0 18px 48px -14px rgba(11,17,22,0.28)" }}
                >
                    {/* top accent bar */}
                    <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #D2462B 0%, #C71F11 50%, #006F83 100%)" }} />

                    <div className="relative p-4">
                        <button
                            onClick={dismiss}
                            aria-label="Dismiss"
                            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.05]"
                        >
                            <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                        </button>

                        <div className="flex items-start gap-3 pr-6">
                            {/* brand mark */}
                            <span
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold text-white"
                                style={{ background: "linear-gradient(135deg, #D2462B 0%, #C71F11 100%)" }}
                            >
                                BBM
                            </span>

                            <div className="min-w-0 pt-0.5">
                                <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: C.secondary }}>
                                    Get the app
                                </p>
                                <h3 className="mt-0.5 text-[14.5px] font-extrabold leading-tight" style={{ color: C.ink }}>
                                    Install BBM Business
                                </h3>
                            </div>
                        </div>

                        <ul className="mt-3.5 flex flex-col gap-1.5">
                            {PERKS.map(({ icon: Icon, text }) => (
                                <li key={text} className="flex items-center gap-2 text-[12px] font-medium" style={{ color: C.muted }}>
                                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                    {text}
                                </li>
                            ))}
                        </ul>

                        {platform === "android" ? (
                            <button
                                onClick={handleInstall}
                                disabled={installing}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold text-white transition-opacity duration-150 disabled:opacity-60"
                                style={{ background: "linear-gradient(135deg, #D2462B 0%, #C71F11 100%)" }}
                            >
                                {installing ? "Installing…" : "Install now"}
                            </button>
                        ) : (
                            <div
                                className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11.5px] font-semibold"
                                style={{ background: `${C.secondary}0c`, color: C.ink }}
                            >
                                <Share className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                Tap Share, then "Add to Home Screen"
                            </div>
                        )}

                        <button
                            onClick={dismiss}
                            className="mt-2 w-full text-center text-[11px] font-semibold transition-colors duration-150 hover:opacity-70"
                            style={{ color: C.muted }}
                        >
                            Not now
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}