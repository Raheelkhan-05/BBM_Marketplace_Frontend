// src/lib/SmoothScroll.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";

/* ------------------------------------------------------------------
   DESIGN NOTES — smooth scroll, site-wide
   ------------------------------------------------------------------
   Lenis intercepts wheel/touch input and drives scroll with its own
   eased raf loop, instead of the browser's native instant scroll.
   That's what makes a page feel "considered" rather than just
   "styled" — the same reason Linear/Vercel-adjacent sites feel
   physically different to scroll through.

   Three things this provider does beyond a bare Lenis instance:

     1. Respects `prefers-reduced-motion`. If the user has that set,
        Lenis initializes with near-instant easing (effectively
        native scroll) rather than forcing smoothing on someone who
        explicitly asked for less motion. This isn't optional — it's
        the same principle the rest of the design system already
        follows (StartSellingBanner's shimmer already checks this).

     2. Exposes `stop()`/`start()` via context. Any component can
        freeze background scroll while an overlay is open (an RFQ
        modal, a compare drawer) instead of scrolling underneath it —
        a small detail that a lot of "smooth scroll" implementations
        skip, and it shows.

     3. Drives the raf loop itself, so nothing else needs to remember
        to call `lenis.raf(time)` — mount this once, near the app
        root, and every page underneath gets smooth scroll for free.

   RECOMMENDED PLACEMENT: wrap this around your whole app (in App.jsx
   or main.jsx), not just HomePage — smooth scroll that only works on
   one route feels broken the moment someone navigates away. It's
   used inside HomePage below to match what you shared, but a single
   provider at the root is the right long-term home for it.
   ------------------------------------------------------------------ */

const LenisContext = createContext(null);

export function useLenisContext() {
    const ctx = useContext(LenisContext);
    if (!ctx) {
        // Soft-fail rather than throw — lets components call this even if
        // the provider hasn't mounted yet (e.g. during fast refresh).
        return { lenis: null, stop: () => { }, start: () => { }, scrollTo: () => { } };
    }
    return ctx;
}

export function SmoothScrollProvider({ children, options = {} }) {
    const lenisRef = useRef(null);
    const [, forceReady] = useState(0);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const lenis = new Lenis({
            duration: prefersReducedMotion ? 0.01 : 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential ease-out — matches the [0.16,1,0.3,1] feel used across the page's own motion
            smoothWheel: !prefersReducedMotion,
            wheelMultiplier: 1,
            touchMultiplier: 1.15,
            infinite: false,
        });

        lenisRef.current = lenis;
        forceReady((n) => n + 1); // trigger a render so context consumers get a live instance

        let rafId;
        function raf(time) {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    const value = {
        lenis: lenisRef.current,
        stop: () => lenisRef.current?.stop(),
        start: () => lenisRef.current?.start(),
        scrollTo: (target, opts) => lenisRef.current?.scrollTo(target, opts),
    };

    return <LenisContext.Provider value={value}>{children}</LenisContext.Provider>;
}