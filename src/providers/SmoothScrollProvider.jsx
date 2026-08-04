// src/providers/SmoothScrollProvider.jsx
import { createContext, useContext, useEffect, useState } from "react";
import Lenis from "lenis";

const LenisContext = createContext(null);

export function SmoothScrollProvider({ children }) {
    const [lenis, setLenis] = useState(null);

    useEffect(() => {
        const prefersReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        if (prefersReduced) return; // respect a11y setting, skip smoothing entirely

        const instance = new Lenis({
            duration: 1.15,
            easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.4,
            syncTouch: false, // native touch scroll already feels good on mobile
        });

        setLenis(instance);

        let rafId;
        function raf(time) {
            instance.raf(time);
            rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            instance.destroy();
            setLenis(null);
        };
    }, []);

    return (
        <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
    );
}

export function useLenis() {
    return useContext(LenisContext);
}