//src/pages/HomePage.jsx

import { useState, useRef, useEffect } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import {
  Search, Camera, Wallet, ChevronRight, ArrowDown, Users, ShoppingCart,
  Tag, FileText, Zap, BadgePercent, TrendingUp, TrendingDown, Circle, Truck,
  CreditCard, Plus, ScanLine, ClipboardList, Repeat, Star, Bell,
} from "lucide-react";
import {
  walletBalance, userName, promoSlides, welcomeHighlights, topOffers,
  businessHighlights, marketFeed, categories, myPriceList, mostCompared,
  recommendedSuppliers, quickActions,
} from "../../data/homeData";

const ICONS = {
  "trend-down": ArrowDown, users: Users, cart: ShoppingCart,
  tag: Tag, file: FileText, bolt: Zap, badge: BadgePercent,
  circle: Circle, trend: TrendingUp, "trend-up": TrendingUp, truck: Truck, card: CreditCard,
  plus: Plus, scan: ScanLine, clipboard: ClipboardList, repeat: Repeat,
};  

const TONE_MAP = {
  green: { fg: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  blue: { fg: "#2563eb", bg: "rgba(37,99,235,0.10)" },
  orange: { fg: "#d2462b", bg: "rgba(210,70,43,0.10)" },
};

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 lg:px-8">
      <SearchWalletRow />
      <PromoCarousel />
      <WelcomeBanner />
      <TopOffers />
      <BusinessAndMarketRow />
      <ShopByCategory />
      <PriceListAndComparedRow />
      <QuickActions />
    </div>
  );
}

/* ---------- Search + Wallet ---------- */
function SearchWalletRow() {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-[5] md:flex-[9] items-center overflow-hidden rounded-md border border-slate-200 bg-white">
        <Search className="ml-2.5 h-4 w-4 shrink-0 text-slate-400 sm:ml-3" />
        <input
          placeholder="Search products, brands or suppliers..."
          className="w-full min-w-0 bg-transparent px-2 py-3 text-[9.5px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none sm:px-2.5 sm:text-[12.5px]"
        />
        <Camera className="mr-2.5 h-4 w-4 shrink-0 text-slate-400 sm:mr-3" />
      </div>

      <button className="flex flex-[2] items-center gap-1.5 overflow-hidden rounded-md border border-slate-200 bg-white px-2 py-2 sm:gap-2 sm:px-4">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7"
          style={{ background: "rgba(4,112,132,0.10)", color: "#047084" }}
        >
          <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[8px] font-semibold leading-tight text-slate-400 sm:text-[9.5px]">
            Wallet Balance
          </p>
          <p className="truncate text-[11px] font-extrabold leading-tight text-slate-900 sm:text-[12.5px]">
            {walletBalance}
          </p>
        </div>
        <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
      </button>
    </div>
  );
}

/* ---------- Promo Carousel ---------- */
function PromoCarousel() {
  const total = promoSlides.length;
  const slides = [promoSlides[total - 1], ...promoSlides, promoSlides[0]];

  const indexRef = useRef(1);
  const [dotIndex, setDotIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const containerRef = useRef(null);
  const x = useMotionValue(0);
  const isAnimating = useRef(false);
  const controlsRef = useRef(null); // active animation controls, so we can always .stop() before restarting
  const autoplayRef = useRef(null);
  const resumeTimeoutRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setSlideWidth(w);
      x.set(-indexRef.current * w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const goToIndex = (newIndex) => {
    controlsRef.current?.stop(); // cancel any in-flight animation first, no competing writers to x
    isAnimating.current = true;

    controlsRef.current = animate(x, -newIndex * slideWidth, {
      duration: 0.55,
      ease: [0.4, 0, 0.2, 1],
      onComplete: () => {
        indexRef.current = newIndex;
        setDotIndex(((newIndex - 1) % total + total) % total);

        if (newIndex === slides.length - 1) {
          indexRef.current = 1;
          x.set(-1 * slideWidth);
        } else if (newIndex === 0) {
          indexRef.current = total;
          x.set(-total * slideWidth);
        }
        isAnimating.current = false;
      },
    });
  };

  const stepNext = () => goToIndex(indexRef.current + 1);
  const stepPrev = () => goToIndex(indexRef.current - 1);

  const startAutoplay = () => {
    stopAutoplay();
    autoplayRef.current = setInterval(stepNext, 3200);
  };
  const stopAutoplay = () => {
    clearInterval(autoplayRef.current);
    clearTimeout(resumeTimeoutRef.current);
  };

  useEffect(() => {
    if (!slideWidth) return;
    startAutoplay();
    return stopAutoplay;
  }, [slideWidth]);

  const handleDragStart = () => {
    stopAutoplay();
    controlsRef.current?.stop();
    isAnimating.current = false; // defensive reset — never let a stuck flag block a fresh gesture
  };

  const handleDragEnd = (_, info) => {
    const threshold = slideWidth * 0.18;
    if (info.offset.x < -threshold) stepNext();
    else if (info.offset.x > threshold) stepPrev();
    else goToIndex(indexRef.current);

    resumeTimeoutRef.current = setTimeout(startAutoplay, 1800);
  };

  const goToDot = (i) => {
    stopAutoplay();
    controlsRef.current?.stop();
    isAnimating.current = false;
    goToIndex(i + 1);
    resumeTimeoutRef.current = setTimeout(startAutoplay, 1800);
  };

  return (
    <div className="mt-3">
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl">
        <motion.div
          className="flex"
          style={{ x, width: slideWidth ? slideWidth * slides.length : "100%" }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.03}
          dragConstraints={{ left: -((slides.length - 1) * slideWidth), right: 0 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {slides.map((slide, i) => (
            <div key={`${slide.id}-${i}`} className="relative shrink-0" style={{ width: slideWidth || "100%" }}>
              <div
                className="relative w-full overflow-hidden rounded-xl select-none"
                style={{ background: "linear-gradient(135deg, #04303D 0%, #047084 50%, #04303D 100%)" }}
              >
                <div className="mx-auto w-full max-w-[1000px]" style={{ containerType: "inline-size" }}>
                  <div className="flex items-center" style={{ height: "clamp(160px, 24cqw, 230px)" }}>
                    <div
                      className="promo-text-block relative z-10 flex min-w-0 flex-[3] flex-col justify-center"
                      style={{ paddingLeft: "clamp(10px, 3cqw, 34px)", paddingRight: "clamp(6px, 1.5cqw, 16px)" }}
                    >
                      <span
                        className="inline-flex w-fit items-center justify-center rounded-xl font-extrabold tracking-wide text-slate-900"
                        style={{ background: "#fbbf24", fontSize: "clamp(6px, 0.85cqw, 8px)", lineHeight: 1, padding: "2px 6px" }}
                      >
                        {slide.tag}
                      </span>
                      <h2
                        className="break-words font-extrabold text-white"
                        style={{
                          fontFamily: "'Bricolage Grotesque', sans-serif",
                          fontSize: "clamp(13px, 2.6cqw, 30px)",
                          lineHeight: 1.15,
                          marginTop: "clamp(5px, 1cqw, 10px)",
                        }}
                      >
                        {slide.title}
                      </h2>
                      <p
                        className="break-words font-medium leading-snug text-white/75"
                        style={{ fontSize: "clamp(8.5px, 1.2cqw, 15px)", marginTop: "clamp(3px, 0.8cqw, 8px)" }}
                      >
                        {slide.subtitle}
                      </p>
                      <button
                        className="flex w-fit shrink-0 items-center gap-1 rounded-lg bg-white font-bold text-[#047084] transition-transform hover:-translate-y-0.5"
                        style={{
                          fontSize: "clamp(8.5px, 1.15cqw, 14px)",
                          padding: "clamp(5px, 1cqw, 11px) clamp(8px, 1.8cqw, 22px)",
                          marginTop: "clamp(7px, 1.6cqw, 16px)",
                        }}
                      >
                        {slide.cta}
                        <ChevronRight className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>

                    <div className="relative h-full flex-[7] overflow-hidden">
                      <img
                        src={slide.image}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover object-center sm:object-right"
                        style={{
                          maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 88%, transparent 100%)",
                          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 88%, transparent 100%)",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="promo-badge absolute z-10 flex flex-col items-center justify-center rounded-lg text-center shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
                      top: "clamp(8px, 1.6cqw, 20px)",
                      right: "clamp(8px, 1.6cqw, 20px)",
                      padding: "clamp(5px, 0.9cqw, 8px) clamp(7px, 1.3cqw, 14px)",
                    }}
                  >
                    <p className="font-bold leading-tight tracking-wider text-white/85" style={{ fontSize: "clamp(6.5px, 0.7cqw, 9px)" }}>
                      SAVE UP TO
                    </p>
                    <p className="mt-0.5 font-extrabold leading-none tracking-wide text-white" style={{ fontSize: "clamp(14px, 1.8cqw, 22px)" }}>
                      {slide.badge.match(/\d+%/)?.[0]}
                    </p>
                    <p className="font-semibold leading-loose text-white/90" style={{ fontSize: "clamp(7px, 0.8cqw, 10px)" }}>
                      on Bulk Orders
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-2.5">
        {promoSlides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goToDot(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: dotIndex === i ? 16 : 5,
              backgroundColor: dotIndex === i ? "#047084" : "#cbd5e1",
            }}
          />
        ))}
      </div>

      <style>{`
        @media (min-width: 1000px) {
          .promo-text-block { padding-left: 18px !important; }
        }
        @media (min-width: 1190px) {
          .promo-text-block { padding-left: 1px !important; }
        }
        @media (max-width: 500px) {
          .promo-badge {
            top: 6px !important;
            right: 6px !important;
            padding: 3px 6px !important;
            border-radius: 6px !important;
          }
          .promo-badge p:first-child { font-size: 5.5px !important; letter-spacing: 0.02em !important; }
          .promo-badge p:nth-child(2) { font-size: 11px !important; }
          .promo-badge p:last-child { font-size: 5.5px !important; line-height: 1.2 !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Welcome Banner ---------- */
function WelcomeBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4 }}
      className="mt-4 w-full rounded-md border"
      style={{
        background: "rgba(4,112,132,0.05)",
        borderColor: "rgba(4,112,132,0.14)",
        containerType: "inline-size",
        padding: "clamp(10px, 2cqw, 18px)",
      }}
    >
      <div className="grid grid-cols-5" style={{ gap: "clamp(6px, 1.4cqw, 14px)" }}>
        {/* Left: text + cards — 80% */}
        <div className="col-span-4 min-w-0">
          <h3
            className="font-extrabold leading-tight text-slate-900"
            style={{ fontSize: "clamp(11px, 2cqw, 16px)" }}
          >
            Welcome back, {userName} 👋
          </h3>
          <p
            className="font-medium leading-tight text-slate-500"
            style={{ fontSize: "clamp(8px, 1.15cqw, 12px)", marginTop: "clamp(2px, 0.4cqw, 4px)" }}
          >
            Here's what's new in your marketplace
          </p>

          <div
            className="grid grid-cols-3"
            style={{ gap: "clamp(4px, 0.9cqw, 10px)", marginTop: "clamp(6px, 1.2cqw, 12px)" }}
          >
            {welcomeHighlights.map((h) => {
              const Icon = ICONS[h.icon];
              const tone = TONE_MAP[h.tone];
              return (
                <div
                  key={h.id}
                  className="flex items-center rounded-md bg-white"
                  style={{
                    gap: "clamp(4px, 0.9cqw, 10px)",
                    padding: "clamp(4px, 0.8cqw, 9px) clamp(5px, 0.9cqw, 10px)",
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      width: "clamp(20px, 3.4cqw, 36px)",
                      height: "clamp(20px, 3.4cqw, 36px)",
                    }}
                  >
                    <Icon style={{ width: "clamp(11px, 1.8cqw, 18px)", height: "clamp(11px, 1.8cqw, 18px)" }} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="truncate mt-1 font-bold leading-tight text-slate-900"
                      style={{ fontSize: "clamp(7.5px, 1.5cqw, 13.5px)" }}
                    >
                      {h.title}
                    </p>
                    <p
                      className="mt-0.5 md:mt-1 font-medium leading-tight text-slate-400"
                      style={{ fontSize: "clamp(6px, 0.95cqw, 11.5px)" }}
                    >
                      {h.desc}
                    </p>
                    <p
                      className="mb-1 font-bold leading-tight"
                      style={{ color: tone.fg, fontSize: "clamp(6.5px, 1.5cqw, 12px)", marginTop: "clamp(3px, 0.7cqw, 6px)" }}
                    >
                      {h.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: illustration + button — 20%, always beside content, never stacks */}
        <div className="col-span-1 flex h-full flex-col items-center justify-between">
          <img
            src="./illustration-marketplace.svg"
            alt=""
            className="w-full object-contain object-top"
            style={{
              maxHeight: "clamp(56px, 8cqw, 108px)",
              transform: "scale(1.25)",
              transformOrigin: "top center",
            }}
          />
          <button
            className="flex w-full items-center justify-center rounded-md border font-bold leading-tight"
            style={{
              borderColor: "#047084",
              color: "#047084",
              gap: "clamp(2px, 0.4cqw, 6px)",
              fontSize: "clamp(5px, 1cqw, 12px)",
              padding: "clamp(4px, 0.9cqw, 10px) clamp(3px, 0.8cqw, 8px)",
              marginTop: "clamp(3px, 0.6cqw, 8px)",
            }}
          >
            <span>View My Price List</span>
            <ChevronRight style={{ width: "clamp(8px, 1.2cqw, 14px)", height: "clamp(8px, 1.2cqw, 14px)" }} className="shrink-0" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Top Offers ---------- */
function TopOffers() {
  return (
    <div className="mt-5">
      <SectionHeader title="Top Offers from Verified Suppliers" />
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {topOffers.map((offer, i) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="flex flex-col rounded-lg border transition-shadow duration-300"
            style={{
              containerType: "inline-size",
              gap: "clamp(4px, 1.6cqw, 8px)",
              padding: "clamp(6px, 2.2cqw, 12px)",
              background: `linear-gradient(150deg, ${hexToRgba(offer.brandTone, 0.12)} 0%, ${hexToRgba(offer.brandTone, 0.02)} 45%, #ffffff 75%)`,
              borderColor: hexToRgba(offer.brandTone, 0.18),
              boxShadow: `0 1px 2px ${hexToRgba(offer.brandTone, 0.08)}, 0 6px 14px -6px ${hexToRgba(offer.brandTone, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.6)`,
            }}
          >
            {/* Row 1: brand logo (1:1) + title/desc */}
            <div className="flex items-stretch" style={{ gap: "clamp(4px, 1.6cqw, 8px)" }}>
              <div
                className="aspect-square shrink-0 overflow-hidden rounded-md bg-white"
                style={{ width: "clamp(26px, 11cqw, 46px)", boxShadow: `0 1px 3px ${hexToRgba(offer.brandTone, 0.18)}` }}
              >
                <img src={offer.logo} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p
                  className="truncate font-bold leading-tight text-slate-900"
                  style={{ fontSize: "clamp(10.5px, 4cqw, 11.5px)" }}
                >
                  {offer.title}
                </p>
                <p
                  className="truncate font-medium leading-tight text-slate-500"
                  style={{ fontSize: "clamp(8.5px, 4cqw, 9.5px)" }}
                >
                  {offer.desc}
                </p>
              </div>
            </div>

            {/* Row 2: product image (1:1) + detail/button */}
            <div className="flex items-stretch" style={{ gap: "clamp(4px, 1.6cqw, 8px)" }}>
              <div
                className="aspect-square shrink-0 overflow-hidden rounded-md bg-white"
                style={{ width: "clamp(26px, 11cqw, 46px)", boxShadow: `0 1px 3px ${hexToRgba(offer.brandTone, 0.18)}` }}
              >
                <img src={offer.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                {offer.detail ? (
                  <p
                    className="font-bold leading-tight"
                    style={{ color: "#d2462b", fontSize: "clamp(9px, 5cqw, 10px)" }}
                  >
                    {offer.detail}
                  </p>
                ) : (
                  <span style={{ fontSize: "clamp(8px, 2.6cqw, 10px)" }}>&nbsp;</span>
                )}
                <button
                  className="mt-0.5 flex items-center gap-0.5 truncate font-bold"
                  style={{ color: "#047084", fontSize: "clamp(9.5px, 4.6cqw, 10px)" }}
                >
                  Shop Now <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Helper — converts a #hex brand color into an rgba() string for the gradient wash
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- Business Highlights + Market Feed ---------- */
function BusinessAndMarketRow() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <SectionHeader title="Today's Business Highlights" />
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {businessHighlights.map((h, i) => {
            const Icon = ICONS[h.icon];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                whileHover={{ y: -3 }}
                className="flex flex-col rounded-lg border p-2 transition-shadow duration-300 sm:p-3.5"
                style={{
                  background: `linear-gradient(210deg, ${hexToRgba(h.fg, 0.16)} 0%, ${hexToRgba(h.fg, 0.03)} 45%, #ffffff 75%)`,
                  borderColor: hexToRgba(h.fg, 0.2),
                  boxShadow: `0 1px 2px ${hexToRgba(h.fg, 0.08)}, 0 8px 16px -8px ${hexToRgba(h.fg, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.65)`,
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10"
                  style={{ background: hexToRgba(h.fg, 0.14), color: h.fg, boxShadow: `inset 0 1px 1px ${hexToRgba(h.fg, 0.15)}` }}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                </span>
                <span className="mt-1.5 text-[16px] font-extrabold leading-none sm:mt-2.5 sm:text-[26px]" style={{ color: h.fg }}>
                  {h.value}
                </span>
                <p className="mt-1.5 text-[8.5px] font-semibold leading-tight text-slate-600 sm:text-[12px]">
                  {h.label}
                </p>
                <button className="mt-1.5 flex items-center gap-0.5 text-[8px] font-bold sm:text-[11.5px]" style={{ color: h.fg }}>
                  View Now <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl border border-slate-100 bg-white p-3.5"
        style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 10px 22px -10px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.8)" }}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-[12.5px] font-extrabold text-slate-900 md:text-[14.5px]">Market Feed</h4>
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        </div>

        <div className="mt-2.5 space-y-2.5">
          {marketFeed.map((item) => {
            const Icon = ICONS[item.icon];
            const color = item.direction === "up" ? "#16a34a" : item.direction === "down" ? "#dc2626" : "#64748b";
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center" style={{ color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold leading-tight text-slate-800">{item.title}</p>
                  {item.detail && <p className="truncate text-[9.5px] font-medium leading-tight text-slate-400">{item.detail}</p>}
                </div>
                {item.change && (
                  <span className="shrink-0 text-[10.5px] font-extrabold" style={{ color }}>{item.change}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex mt-3 text-center justify-center items-center">
          <button className=" flex items-center gap-1 text-[11px] font-bold text-[#047084]">
            View Full Feed <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shop by Category ---------- */
function ShopByCategory() {
  return (
    <div className="mt-5">
      <SectionHeader title="Shop by Category" />
      <div
        className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`
          .category-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div className="category-scroll flex gap-2.5">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              className="flex shrink-0 flex-col items-center overflow-hidden rounded-xl border border-slate-100 bg-white text-center transition-shadow duration-300"
              style={{
                width: "clamp(108px, 26vw, 138px)",
                background: "linear-gradient(160deg, rgba(4,112,132,0.07) 0%, rgba(4,112,132,0.01) 40%, #ffffff 70%)",
                borderColor: "rgba(4,112,132,0.14)",
                boxShadow:
                  "0 1px 2px rgba(4,112,132,0.06), 0 8px 16px -10px rgba(4,112,132,0.22), inset 0 1px 0 rgba(255,255,255,0.7)",
              }}
            >
              <div className="aspect-video w-full overflow-hidden bg-slate-50">
                <img src={cat.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex w-full flex-col items-center px-2.5 pb-3 pt-2">
                <p className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[13px]">
                  {cat.name}
                </p>
                <p className="mt-1 truncate text-[9.5px] font-medium leading-tight text-slate-400 sm:text-[10.5px]">
                  {cat.count}
                </p>
                <p className="truncate text-[9.5px] font-medium leading-tight text-slate-400 sm:text-[10.5px]">
                  {cat.suppliers}
                </p>
                <p className="mt-1 text-[11px] font-extrabold sm:text-[12px]" style={{ color: "#047084" }}>
                  From {cat.from}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- My Price List + Recommended + Most Compared ---------- */
function PriceListAndComparedRow() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Left: My Price List */}
      <div>
        <SectionHeader title="My Price List (Recent)" />
        <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {myPriceList.map((p) => (
            <div key={p.id} className="flex items-center gap-3.5 px-3.5 py-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-100">
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold leading-snug text-slate-900">{p.name}</p>
                <p className="truncate mt-0.5 text-[11.5px] font-medium leading-snug text-slate-400">
                  {p.suppliers} &middot; Lowest {p.price}
                </p>
                <p className="text-[10.5px] mt-0.5 font-medium leading-snug text-slate-400">{p.updated}</p>
              </div>
              <MiniTrendIcon trend={p.trend} />
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Recommended for You (top) + Most Compared Today (below) */}
      <div className="flex flex-col gap-5">
        <div>
          <SectionHeader title="Most Compared Today" />
          <div className="mt-2.5 grid grid-cols-5 gap-2">
            {mostCompared.map((item) => (
              <div key={item.id} className="flex flex-col items-center rounded-lg border border-slate-100 bg-white p-2 text-center">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-50 ring-1 ring-slate-100">
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[9.5px] font-bold leading-tight text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-[8.5px] font-medium leading-tight text-slate-400">{item.count}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Recommended for You" />
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {recommendedSuppliers.map((s) => (
              <div key={s.id} className="flex flex-col rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ background: s.tone }}
                  >
                    {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {/* Name — fixed height row */}
                    <div className="flex h-[17px] items-center">
                      <p className="truncate text-[12.5px] font-bold text-slate-900">{s.name}</p>
                    </div>

                    {/* Rating — fixed height row */}
                    <div className="flex mt-0.5 h-[15px] items-center">
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                        {s.rating}
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      </span>
                    </div>

                    {/* Description — fixed height row, clamps to 2 lines so it's always the same height */}
                    <p className="line-clamp-2 mt-1 sm:h-[28px] text-[10.5px] font-medium leading-tight text-slate-400">
                      {s.desc}
                    </p>
                  </div>
                </div>

                {/* Button — now full width across the whole card */}
                <button
                  className="mt-2.5 w-full shrink-0 rounded-md border px-2.5 py-1.5 text-[10.5px] font-bold"
                  style={{ borderColor: '#047084', color: '#047084' }}
                >
                  View Products
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function MiniTrendIcon({ trend }) {
  const color = trend === "up" ? "#16a34a" : "#dc2626";
  const points = trend === "up" ? "0,10 5,6 10,7 15,2" : "0,3 5,7 10,6 15,10";
  return (
    <svg width="22" height="14" viewBox="0 0 15 12" className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Quick Actions ---------- */
function QuickActions() {
  return (
    <div className="mt-5">
      <SectionHeader title="Quick Actions" showViewAll={false} />
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quickActions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <motion.button
              key={a.id}
              whileHover={{ y: -3 }}
              whileTap={{ y: -1 }}
              className="relative flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2.5 text-left transition-shadow duration-300"
              style={{
                borderColor: hexToRgba(a.fg, 0.16),
                background: `linear-gradient(150deg, ${hexToRgba(a.fg, 0.09)} 0%, ${hexToRgba(a.fg, 0.015)} 45%, #ffffff 75%)`,
                boxShadow: `0 1px 2px ${hexToRgba(a.fg, 0.08)}, 0 8px 16px -10px ${hexToRgba(a.fg, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.7)`,
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: hexToRgba(a.fg, 0.14), color: a.fg, boxShadow: `inset 0 1px 1px ${hexToRgba(a.fg, 0.15)}` }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-slate-900">{a.label}</p>
                <p className="truncate text-[9.5px] font-medium text-slate-400">{a.desc}</p>
              </div>
              {a.count && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d2462b] px-1 text-[8.5px] font-bold text-white"
                  style={{ boxShadow: "0 1px 3px rgba(210,70,43,0.45)" }}
                >
                  {a.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Shared ---------- */
function SectionHeader({ title, showViewAll = true }) {
  return (
    <div className="flex items-center justify-between">
      <h3
        className="text-[13.5px] font-extrabold tracking-tight text-slate-900 md:text-[15.5px]"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        {title}
      </h3>
      {showViewAll && (
        <button className="text-[11px] font-bold text-[#047084]">View All</button>
      )}
    </div>
  );
}