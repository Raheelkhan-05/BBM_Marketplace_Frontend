import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { showcaseProducts, features } from "../../../data/content";

// Custom exact matched SVG paths to match the icons in the screenshot
const ICONS = {
  tag: () => (
    <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.72 2.29a2.75 2.75 0 0 0-3.89 0L2.29 8.83a2.75 2.75 0 0 0 0 3.89l7.46 7.46a2.75 2.75 0 0 0 3.89 0l6.54-6.54a2.75 2.75 0 0 0 0-3.89l-7.46-7.46ZM7 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/>
    </svg>
  ),
  "check-shield": () => (
    <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12.5 2.25a.75.75 0 0 0-1 0 11.96 11.96 0 0 1-7.83 3.31.75.75 0 0 0-.67.74c0 6.13 3.73 11.38 9 13.12a.75.75 0 0 0 .5 0c5.27-1.74 9-7 9-13.12a.75.75 0 0 0-.67-.74A11.96 11.96 0 0 1 12.5 2.25Zm3.28 7.78a.75.75 0 0 0-1.06-1.06l-4.22 4.22-1.72-1.72a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.75-4.75Z" clipRule="evenodd" />
    </svg>
  ),
  box: () => (
    <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.644 1.44a.75.75 0 0 1 .712 0l7.75 4.173a.75.75 0 0 1 0 1.314l-7.75 4.173a.75.75 0 0 1-.712 0L3.894 6.927a.75.75 0 0 1 0-1.314l7.75-4.173Z" />
      <path d="M11.25 12.54 3.75 8.5v8.586a.75.75 0 0 0 .394.657l7.106 3.826V12.54Zm1.5 0v9.069l7.106-3.826a.75.75 0 0 0 .394-.657V8.5l-7.5 4.04Z" />
    </svg>
  ),
  bolt: () => (
    <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.828 2.285a.75.75 0 0 0-1.293.44l-2.5 10.5a.75.75 0 0 0 .937.894l3.184-1.062-2.184 8.653a.75.75 0 0 0 1.293.44l6.5-10.5a.75.75 0 0 0-.64-1.144l-3.69.123 2.194-7.344Z" />
    </svg>
  ),
};

export default function ShowcaseHub() {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);
  const rafRef = useRef(null);

  // Native CSS scroll-snap drives the swipe. The browser handles momentum,
  // rubber-banding, and touch tracking on the compositor thread, which
  // feels smoother and more native than a JS-driven drag/spring.
  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const slideWidth = el.clientWidth;
      if (!slideWidth) return;
      const index = Math.round(el.scrollLeft / slideWidth);
      setActive((prev) => (prev === index ? prev : index));
    });
  }, []);

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center bg-gradient-to-b from-[#f8fafc] via-[#edf2f7] to-white p-4 md:p-8 rounded-xl">

      {/* ========================================================================= */}
      {/* 1. PRODUCT SHOWCASE CANVAS                                               */}
      {/* ========================================================================= */}
      <div className="relative w-full overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(241,245,249,0.6)_0%,rgba(255,255,255,0)_70%)] pointer-events-none" />

        {/* Mobile: Swipeable Carousel — native scroll-snap, no JS drag math */}
        <div className="w-full lg:hidden relative">
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {showcaseProducts.map((p) => (
              <div
                key={p.id}
                className="w-full shrink-0 snap-center flex justify-center items-center px-4"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  className="h-48 md:h-64 w-auto object-contain select-none drop-shadow-[0_15px_25px_rgba(0,0,0,0.06)]"
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-2 pb-4">
            {showcaseProducts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === active ? "w-2 bg-blue-600" : "w-1 bg-slate-300/70"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Layout Display */}
        <div className="hidden lg:flex w-full items-center justify-center p-6">
          <div className="relative w-full max-w-3xl aspect-[16/9] flex items-center justify-center">
            {showcaseProducts[active] && (
              <motion.img
                key={active}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1.25 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                src={showcaseProducts[active].src}
                alt={showcaseProducts[active].alt}
                className="h-48 w-auto object-contain select-none drop-shadow-[0_20px_35px_rgba(0,0,0,0.07)]"
              />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FEATURE CARDS — matched to reference: white rounded card, soft shadow, */}
      {/* four columns, hairline dividers, circular tinted icon badge, bold title, */}
      {/* muted two-line description underneath.                                   */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-xl border border-slate-100 shadow-[0_18px_50px_-12px_rgba(30,41,59,0.12)] px-3 py-5 sm:px-6 sm:py-2 md:px-2 md:py-5">
        <div className="grid grid-cols-4 w-full gap-x-1">
          {features.map((f, i) => {
            const IconComponent = ICONS[f.icon];
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex flex-col items-center text-center relative px-1.5 sm:px-3 min-w-0"
              >
                {/* Hairline vertical divider between columns */}
                {i !== 0 && (
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-slate-100" />
                )}

                {/* Soft circular icon backdrop */}
                <div
                  className={`flex h-10 w-10 sm:h-[48px] sm:w-[48px] md:h-[56px] md:w-[56px] shrink-0 items-center justify-center rounded-full ${f.bg} ${f.fg}`}
                >
                  <IconComponent />
                </div>

                {/* Title — bold, dark, two lines max, tight leading */}
                <h3 className="mt-3 sm:mt-4 text-[12px] leading-[1.15] sm:text-[14px] md:text-[14px] font-bold tracking-tight text-slate-900 sm:leading-snug w-full">
                  {f.title}
                </h3>

                {/* Description — muted gray, smaller, two lines max */}
                <p className="mt-1.5 sm:mt-2 max-w-[92px] sm:max-w-[150px] md:max-w-[165px] text-[10px] leading-[1.3] sm:text-[12px] md:text-[12px] sm:leading-relaxed text-slate-400 font-medium">
                  {f.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

    </div>
  );
}