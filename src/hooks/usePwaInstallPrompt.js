// hooks/usePwaInstallPrompt.js
import { useEffect, useRef, useState } from "react";

const DISMISS_KEY = "pwa_install_dismissed_at";
const DISMISS_COOLDOWN_DAYS = 1; // don't nag again for 2 weeks after dismiss
const DELAY_MS = 30 * 1000; // 1 minute of active use

function isStandalone() {
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true // iOS
    );
}

function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function usePwaInstallPrompt() {
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState(null); // "android" | "ios"
    const deferredPrompt = useRef(null);
    const timerStarted = useRef(false);

    useEffect(() => {
        if (isStandalone()) return; // already installed, don't bother

        const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
        const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        if (dismissedAt && Date.now() - dismissedAt < cooldownMs) return;

        function onBeforeInstallPrompt(e) {
            e.preventDefault();
            deferredPrompt.current = e;
            setPlatform("android");
        }
        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

        // iOS never fires beforeinstallprompt — just flag it directly
        if (isIos()) setPlatform("ios");

        let timeoutId;
        function startTimerOnce() {
            if (timerStarted.current) return;
            timerStarted.current = true;
            timeoutId = setTimeout(() => setShow(true), DELAY_MS);
        }
        // start counting only once the user actually interacts,
        // so idle background tabs don't trigger it
        window.addEventListener("pointerdown", startTimerOnce, { once: true });
        window.addEventListener("keydown", startTimerOnce, { once: true });
        startTimerOnce(); // or just start on mount — see note below

        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("pointerdown", startTimerOnce);
            window.removeEventListener("keydown", startTimerOnce);
            clearTimeout(timeoutId);
        };
    }, []);

    async function promptInstall() {
        if (platform === "android" && deferredPrompt.current) {
            deferredPrompt.current.prompt();
            const { outcome } = await deferredPrompt.current.userChoice;
            deferredPrompt.current = null;
            setShow(false);
            if (outcome === "accepted") localStorage.removeItem(DISMISS_KEY);
            else localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
        // for iOS there's no programmatic prompt — the modal just shows instructions
    }

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setShow(false);
    }

    return { show: show && platform, platform, promptInstall, dismiss };
}