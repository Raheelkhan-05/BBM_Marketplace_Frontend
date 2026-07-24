//src/pages/HomePage.jsx

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue } from "framer-motion";
import {
  Search, Camera, Wallet, ChevronRight, ArrowDown, Users, ShoppingCart,
  Tag, FileText, Zap, BadgePercent, TrendingUp, TrendingDown, Circle, Truck,
  CreditCard, Plus, ScanLine, ClipboardList, Repeat, Star, Bell, ShieldCheck,
} from "lucide-react";
import HomePageSkeleton from "../components/skeletons/HomePageSkeleton.jsx";
import StartSellingBanner from "../components/home/StartSellingBanner.jsx";
import {
  promoSlides, welcomeHighlights, topOffers,
  businessHighlights, marketFeed, categories, myPriceList, mostCompared,
  recommendedSuppliers, quickActions,
} from "../../data/homeData";
import { useAuth } from "../context/AuthContext.jsx";

/* =========================================================================
   DESIGN TOKENS
   A small, restrained palette used consistently everywhere. Color is spent
   deliberately — icon chips, one accent rule, a gold "trust" ribbon — not
   spread across full-card gradient washes. This is the single source of
   truth for the visual system; every section below draws from it.
   ========================================================================= */
const COLOR = {
  ink: "#101828",        // headings
  body: "#4B5468",       // primary body text
  muted: "#8A93A6",       // secondary / caption text
  hairline: "rgba(16,24,40,0.09)",
  paper: "#FFFFFF",
  canvas: "#F7F7F5",       // page-level warm-neutral wash, used sparingly
  brandDeep: "#052E38",   // deep teal-ink (chrome / banner)
  brand: "#0B7285",       // primary brand teal (deepened, less "web-safe" than before)
  brandSoft: "rgba(11,114,133,0.07)",
  gold: "#9C6F1E",         // muted gold — reserved for trust / value signals
  goldSoft: "rgba(156,111,30,0.10)",
  goldLine: "rgba(156,111,30,0.28)",
  success: "#1E7A5F",
  danger: "#B23B3B",
};

const ICONS = {
  "trend-down": ArrowDown, users: Users, cart: ShoppingCart,
  tag: Tag, file: FileText, bolt: Zap, badge: BadgePercent,
  circle: Circle, trend: TrendingUp, "trend-up": TrendingUp, truck: Truck, card: CreditCard,
  plus: Plus, scan: ScanLine, clipboard: ClipboardList, repeat: Repeat,
};

// Kept the same keys (green / blue / orange) so existing data files still
// resolve correctly — only the values are recalibrated to muted, cohesive tones.
const TONE_MAP = {
  green: { fg: COLOR.success, bg: "rgba(30,122,95,0.08)" },
  blue: { fg: "#1E4E77", bg: "rgba(30,78,119,0.08)" },
  orange: { fg: COLOR.gold, bg: COLOR.goldSoft },
};

export default function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return <HomePageSkeleton />;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-3 sm:px-6 lg:px-8">
      <GlobalStyles />
      <SearchWalletRow />
      <PromoCarousel />
      <WelcomeBanner />
      <StartSellingBanner />
      <TopOffers />
      <BusinessAndMarketRow />
      <ShopByCategory />
      <PriceListAndComparedRow />
      <QuickActions />
    </div>
  );
}

/* ---------- Shared style system (single source, applied everywhere) ---------- */
function GlobalStyles() {
  return (
    <style>{`
      .pm-surface {
        background: ${COLOR.paper};
        border: 1px solid ${COLOR.hairline};
        border-radius: 14px;
        box-shadow: 0 1px 2px rgba(16,24,40,0.04);
        transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease;
      }
      .pm-surface:hover {
        box-shadow: 0 1px 2px rgba(16,24,40,0.05), 0 18px 32px -16px rgba(16,24,40,0.18);
        border-color: rgba(16,24,40,0.14);
      }
      .pm-btn-outline {
        border: 1px solid ${COLOR.brand};
        color: ${COLOR.brand};
        transition: background-color .2s ease, color .2s ease;
      }
      .pm-btn-outline:hover { background: ${COLOR.brandSoft}; }
      .pm-link {
        color: ${COLOR.brand};
        transition: opacity .2s ease;
      }
      .pm-link:hover { opacity: 0.72; }
      .pm-ribbon {
        background: linear-gradient(135deg, #C79A3F 0%, ${COLOR.gold} 100%);
        color: #201404;
      }
      @media (prefers-reduced-motion: reduce) {
        .pm-surface, .pm-btn-outline, .pm-link { transition: none; }
      }
      .category-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  );
}

function SearchWalletRow() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };
  return (
    <form onSubmit={handleSubmit} className="flex items-stretch">
      <div
        className="flex flex-1 items-center overflow-hidden rounded-lg bg-white transition-shadow duration-200 focus-within:shadow-md"
        style={{ border: `1px solid ${COLOR.hairline}`, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
      >
        <Search className="ml-3 h-4 w-4 shrink-0" style={{ color: COLOR.muted }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, brands or suppliers..."
          className="w-full min-w-0 bg-transparent px-2.5 py-3 text-[9.5px] font-medium placeholder:text-slate-400 focus:outline-none sm:px-3 sm:text-[13px]"
          style={{ color: COLOR.ink }}
        />
        <span className="mr-1 h-5 w-px shrink-0" style={{ background: COLOR.hairline }} />
        <Camera className="mx-2.5 h-4 w-4 shrink-0 sm:mx-3" style={{ color: COLOR.muted }} />
      </div>
    </form>
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
    <div className="mt-4">
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl">
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
                className="relative w-full overflow-hidden rounded-2xl select-none"
                style={{ background: `linear-gradient(135deg, ${COLOR.brandDeep} 0%, ${COLOR.brand} 55%, ${COLOR.brandDeep} 100%)` }}
              >
                <div className="mx-auto w-full max-w-[1000px]" style={{ containerType: "inline-size" }}>
                  <div className="flex items-center" style={{ height: "clamp(160px, 28cqw, 300px)" }}>
  <div
    className="promo-text-block relative z-10 flex min-w-0 flex-[3] flex-col justify-center"
    style={{ paddingLeft: "clamp(10px, 3cqw, 34px)", paddingRight: "clamp(6px, 1.5cqw, 16px)" }}
  >
    <span
      className="pm-ribbon inline-flex w-fit items-center justify-center rounded-md font-extrabold uppercase tracking-wider"
      style={{ fontSize: "clamp(8px, 0.95cqw, 11px)", lineHeight: 1, padding: "3px 7px", letterSpacing: "0.06em" }}
    >
      {slide.tag}
    </span>
    <h2
      className="break-words font-extrabold tracking-[0.2px] text-white"
      style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: "clamp(13px, 3.1cqw, 38px)",
        lineHeight: 1.15,
        marginTop: "clamp(6px, 1.1cqw, 14px)",
      }}
    >
      {slide.title}
    </h2>
    <p
      className="break-words font-medium tracking-wide leading-snug text-white/70"
      style={{ fontSize: "clamp(10.5px, 1.35cqw, 18px)", marginTop: "clamp(3px, 0.8cqw, 10px)" }}
    >
      {slide.subtitle}
    </p>
    <button
      className="flex w-fit shrink-0 items-center gap-1.5 rounded-md bg-white font-bold transition-transform hover:-translate-y-0.5"
      style={{
        color: COLOR.brandDeep,
        fontSize: "clamp(10px, 1.3cqw, 16px)",
        padding: "clamp(5px, 1.1cqw, 13px) clamp(8px, 2cqw, 26px)",
        marginTop: "clamp(8px, 2cqw, 22px)",
      }}
    >
      {slide.cta}
      <ChevronRight className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
    </button>
  </div>

  <div className="relative h-full flex-[7] overflow-hidden">
    <img
      src={slide.image}
      alt=""
      draggable={false}
      fetchPriority={i === 1 ? "high" : "low"}
      loading={i === 1 ? "eager" : "lazy"}
      className="h-full w-full object-cover object-center sm:object-right"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 88%, transparent 100%)",
      }}
    />
  </div>
</div>

<div
  className="promo-badge absolute z-10 flex flex-col items-center justify-center rounded-lg text-center"
  style={{
    background: "rgba(5,46,56,0.55)",
    backdropFilter: "blur(6px)",
    border: `1px solid ${COLOR.goldLine}`,
    top: "clamp(8px, 1.6cqw, 20px)",
    right: "clamp(8px, 1.6cqw, 20px)",
    padding: "clamp(6px, 1cqw, 10px) clamp(9px, 1.5cqw, 17px)",
  }}
>
  <p className="font-bold mt-0.5 leading-tight tracking-wider text-white/70" style={{ fontSize: "clamp(8.5px, 0.75cqw, 11px)" }}>
    SAVE UP TO
  </p>
  <p className="mt-0.5 font-extrabold leading-none tracking-wide" style={{ fontSize: "clamp(18px, 2.1cqw, 28px)", color: "#E4B84A" }}>
    {slide.badge.match(/\d+%/)?.[0]}
  </p>
  <p className="font-semibold leading-loose text-white/70" style={{ fontSize: "clamp(9px, 0.85cqw, 12px)" }}>
    on Bulk Orders
  </p>
</div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-3">
        {promoSlides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goToDot(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: dotIndex === i ? 18 : 5,
              backgroundColor: dotIndex === i ? COLOR.brand : "#D8DCE3",
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
          .promo-badge p:first-child { font-size: 7px !important; letter-spacing: 0.02em !important; }
          .promo-badge p:nth-child(2) { font-size: 14px !important; }
          .promo-badge p:last-child { font-size: 7px !important; line-height: 1.9 !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Welcome Banner ---------- */

// WelcomeBanner — pull the name from profile, first name only, sane fallback
function WelcomeBanner() {
  const { profile } = useAuth();
  const firstName = profile?.name?.trim().split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4 }}
      className="mt-5 w-full rounded-xl"
      style={{
        background: COLOR.canvas,
        border: `1px solid ${COLOR.hairline}`,
        containerType: "inline-size",
        padding: "clamp(12px, 2.2cqw, 20px)",
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-5" style={{ gap: "clamp(6px, 1.4cqw, 14px)" }}>
        <div className="col-span-2 sm:col-span-4 min-w-0">
          <h3 className="font-extrabold leading-tight tracking-tight" style={{ fontSize: "clamp(14px, 2cqw, 17px)", color: COLOR.ink }}>
            Welcome back, {firstName}
          </h3>
          <p
            className="font-medium leading-tight"
            style={{ fontSize: "clamp(11.5px, 1.15cqw, 12.5px)", marginTop: "clamp(2px, 0.4cqw, 4px)", color: COLOR.muted }}
          >
            Here's what's new in your marketplace
          </p>

          <div
            className="grid grid-cols-3 sm:grid-cols-3"
            style={{ gap: "clamp(4px, 0.9cqw, 10px)", marginTop: "clamp(8px, 1.4cqw, 14px)" }}
          >
            {welcomeHighlights.map((h) => {
              const Icon = ICONS[h.icon];
              const tone = TONE_MAP[h.tone];
              return (
                <div
                  key={h.id}
                  className="pm-surface flex flex-col sm:flex-row sm:items-center"
                  style={{ gap: "clamp(4px, 0.7cqw, 8px)", padding: "clamp(7px, 1cqw, 11px)" }}
                >
                  {/* Icon — beside title only on mobile, spans full card height on desktop */}
                  <div className="flex mt-0.5 sm:mt-0 items-center min-w-0 sm:contents" style={{ gap: "clamp(4px, 0.7cqw, 8px)" }}>
                    <span
                      className="flex shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: tone.bg,
                        color: tone.fg,
                        width: "clamp(20px, 3cqw, 32px)",
                        height: "clamp(20px, 3cqw, 32px)",
                      }}
                    >
                      <Icon style={{ width: "clamp(14px, 1.6cqw, 18px)", height: "clamp(13px, 1.6cqw, 18px)" }} />
                    </span>

                    {/* Title — full row on mobile, hidden here on desktop (moves to text stack) */}
                    <p
                      className="font-bold leading-tight sm:hidden"
                      style={{ fontSize: "clamp(11.3px, 1.5cqw, 13.5px)", color: COLOR.ink }}
                    >
                      {h.title}
                    </p>
                  </div>

                  {/* Text stack: title (desktop only here) + description + value */}
                  <div className="min-w-0">
                    <p
                      className="hidden sm:block font-bold leading-tight"
                      style={{ fontSize: "clamp(11.3px, 1.5cqw, 13.5px)", color: COLOR.ink }}
                    >
                      {h.title}
                    </p>

                    <p
                      className="font-medium leading-tight tracking-wide ps-1 sm:mt-1 sm:ps-0"
                      style={{ fontSize: "clamp(10.5px, 1cqw, 12px)", color: COLOR.muted }}
                    >
                      {h.desc}
                    </p>

                    <p
                      className="truncate font-bold leading-tight mt-1.5 mb-1 sm:mb-0 px-1 sm:px-0 tabular-nums sm:text-left sm:mt-1"
                      style={{ color: tone.fg, fontSize: "clamp(11.5px, 1.5cqw, 12px)" }}
                    >
                      {h.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: illustration + button — full row 2 on mobile, 20% col on desktop */}
        <div className="col-span-1 flex flex-row sm:flex-col items-center justify-between gap-2 sm:h-full">
          <img
            src="./illustration-marketplace.svg"
            alt=""
            loading="lazy"
            decoding="async"
            className="object-contain hidden sm:block object-top"
            style={{
              maxHeight: "clamp(56px, 8cqw, 108px)",
              width: "clamp(70px, 22cqw, 100%)",
              transform: "scale(1.2)",
              transformOrigin: "top center",
            }}
          />
          <button
            className="pm-btn-outline flex flex-1 sm:w-full items-center justify-center rounded-lg font-bold leading-tight"
            style={{
              gap: "clamp(2px, 0.4cqw, 6px)",
              fontSize: "clamp(10.5px, 1cqw, 12px)",
              padding: "clamp(7px, 0.9cqw, 11px) clamp(3px, 0.8cqw, 8px)",
              marginTop: "clamp(3px, 0.6cqw, 8px)",
            }}
          >
            <span>View My Price List</span>
            <ChevronRight style={{ width: "clamp(10px, 1.2cqw, 14px)", height: "clamp(10px, 1.2cqw, 14px)" }} className="shrink-0" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Top Offers ---------- */
function TopOffers() {
  return (
    <div className="mt-8">
      <SectionHeader title="Top Offers from Verified Suppliers" />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {topOffers.map((offer, i) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
            whileHover={{ y: -3 }}
            className="pm-surface relative flex flex-col"
            style={{ containerType: "inline-size", gap: "clamp(4px, 1.6cqw, 8px)", padding: "clamp(7px, 2.2cqw, 13px)" }}
          >
            <span
              className="absolute flex items-center gap-0.5 rounded-full font-bold"
              style={{
                top: "clamp(6px, 1.6cqw, 10px)", right: "clamp(6px, 1.6cqw, 10px)",
                fontSize: "clamp(7.5px, 2cqw, 9px)", padding: "2px 6px",
                background: COLOR.goldSoft, color: COLOR.gold, border: `1px solid ${COLOR.goldLine}`,
              }}
            >
              <ShieldCheck className="h-2.5 w-2.5" /> Verified
            </span>

            {/* Row 1: brand logo (1:1) + title/desc */}
            <div className="flex items-stretch" style={{ gap: "clamp(4px, 1.6cqw, 8px)" }}>
              <div
                className="aspect-square shrink-0 overflow-hidden rounded-lg bg-white"
                style={{ width: "clamp(36px, 11cqw, 46px)", border: `1px solid ${COLOR.hairline}` }}
              >
                <img src={offer.logo} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
              </div>
              <div className="flex min-w-0 ms-1 sm:ms-2 flex-1 flex-col justify-center pr-10 sm:pr-14">
                <p className="truncate font-bold tracking-[0.1px] leading-tight" style={{ fontSize: "clamp(13px, 4cqw, 13px)", color: COLOR.ink }}>
                  {offer.title}
                </p>
                <p className="truncate font-medium tracking-wide leading-tight" style={{ fontSize: "clamp(11px, 5cqw, 12.5px)", color: COLOR.muted }}>
                  {offer.desc}
                </p>
              </div>
            </div>

            {/* Row 2: product image (1:1) + detail/button */}
            <div className="flex items-stretch" style={{ gap: "clamp(4px, 1.6cqw, 8px)" }}>
              <div
                className="aspect-square shrink-0 overflow-hidden rounded-lg bg-white"
                style={{ width: "clamp(36px, 11cqw, 46px)", border: `1px solid ${COLOR.hairline}` }}
              >
                <img src={offer.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 ms-1 sm:ms-2 flex-col justify-center">
                {offer.detail ? (
                  <p className="font-bold leading-tight" style={{ color: COLOR.danger, fontSize: "clamp(11px, 5cqw, 11.5px)" }}>
                    {offer.detail}
                  </p>
                ) : (
                  <span style={{ fontSize: "clamp(9.5px, 2.6cqw, 11.5px)" }}>&nbsp;</span>
                )}
                <button className="pm-link mt-0.5 flex items-center gap-0.5 truncate font-bold" style={{ fontSize: "clamp(13px, 4.6cqw, 11.5px)" }}>
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

// Helper — converts a #hex color into a low-alpha rgba() wash, used only for
// small accents (icon chips, hairline rules) — never large card surfaces.
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
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <SectionHeader title="Today's Business Highlights" />
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {businessHighlights.map((h, i) => {
            const Icon = ICONS[h.icon];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
                whileHover={{ y: -3 }}
                className="pm-surface flex flex-col items-center p-2.5 sm:p-4"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10"
                  style={{ background: hexToRgba(h.fg, 0.10), color: h.fg }}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                </span>
                <span className="mt-2 text-[18px] font-extrabold leading-none tabular-nums sm:mt-3 sm:text-[26px]" style={{ color: COLOR.ink }}>
                  {h.value}
                </span>
                <p className="mt-1.5 text-[10px] text-center tracking-wide font-semibold leading-tight sm:text-[12.5px]" style={{ color: COLOR.muted }}>
                  {h.label}
                </p>
                <button className="pm-link mt-1.5 flex items-center gap-0.5 text-[11.5px] font-bold sm:text-[12.5px]">
                  View Now <ChevronRight className="h-2.5 w-2.5 hidden sm:block sm:h-3 sm:w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="pm-surface p-4">
        <div className="flex items-center justify-between" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          <h4 className="text-[15px] font-extrabold md:text-[16px]" style={{ color: COLOR.ink }}>Market Feed</h4>
          <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: COLOR.success }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR.success }} /> Live
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {marketFeed.map((item) => {
            const Icon = ICONS[item.icon];
            const color = item.direction === "up" ? COLOR.success : item.direction === "down" ? COLOR.danger : COLOR.muted;
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center" style={{ color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold tracking-[0.2px] leading-tight" style={{ color: COLOR.ink }}>{item.title}</p>
                  {item.detail && <p className="truncate text-[12.5px] tracking-wide font-medium leading-tight" style={{ color: COLOR.muted }}>{item.detail}</p>}
                </div>
                {item.change && (
                  <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums" style={{ color }}>{item.change}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-center text-center" style={{ borderTop: `1px solid ${COLOR.hairline}`, paddingTop: "12px" }}>
          <button className="pm-link flex items-center gap-1 text-[13.5px] font-bold">
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
    <div className="mt-8">
      <SectionHeader title="Shop by Category" />
      <div
        className="mt-3 flex gap-3 overflow-x-auto overflow-y-hidden pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="category-scroll flex gap-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
              whileHover={{ y: -2 }}
              className="pm-surface flex shrink-0 flex-col items-center overflow-hidden text-center"
              style={{ width: "clamp(138px, 26vw, 156px)" }}
            >
              <div className="aspect-video w-full overflow-hidden" style={{ background: COLOR.canvas }}>
                <img src={cat.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
              <div className="flex w-full flex-col items-center px-3 pb-3.5 pt-2.5">
                <p className="truncate text-[13.5px] tracking-[0.2px] font-bold leading-tight sm:text-[14.5px]" style={{ color: COLOR.ink }}>
                  {cat.name}
                </p>
                <p className="mt-1 truncate text-[12px] tracking-wide font-medium leading-tight sm:text-[12px]" style={{ color: COLOR.muted }}>
                  {cat.count}
                </p>
                <p className="truncate text-[12px] tracking-wide font-medium leading-tight sm:text-[12px]" style={{ color: COLOR.muted }}>
                  {cat.suppliers}
                </p>
                <p className="mt-1.5 text-[13.5px] font-extrabold tabular-nums sm:text-[13.5px]" style={{ color: COLOR.brand }}>
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
    <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-5">
      {/* Left: My Price List */}
      <div className="lg:col-span-2">
        <SectionHeader title="My Price List (Recent)" />
        <div className="pm-surface mt-3 divide-y" style={{ borderColor: COLOR.hairline }}>
          {myPriceList.map((p) => (
            <div key={p.id} className="flex items-center gap-3.5 px-4 py-4" style={{ borderColor: COLOR.hairline }}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg" style={{ background: COLOR.canvas, border: `1px solid ${COLOR.hairline}` }}>
                <img src={p.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] tracking-[0.2px] font-semibold leading-snug" style={{ color: COLOR.ink }}>{p.name}</p>
                <p className="truncate mt-0.5 text-[12px] tracking-wide font-medium leading-snug" style={{ color: COLOR.muted }}>
                  {p.suppliers} &middot; Lowest <span className="tabular-nums">{p.price}</span>
                </p>
                <p className="text-[13px] mt-0.5 font-medium leading-snug" style={{ color: COLOR.muted }}>{p.updated}</p>
              </div>
              <MiniTrendIcon trend={p.trend} />
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#C7CDD8" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Recommended for You (top) + Most Compared Today (below) */}
      <div className="flex flex-col gap-5 lg:col-span-3">
        <div>
          <SectionHeader title="Most Compared Today" />
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {mostCompared.map((item) => (
              <div key={item.id} className="pm-surface flex flex-col items-center p-2.5 text-center">
                <div className="h-16 w-16 overflow-hidden rounded-full" style={{ background: COLOR.canvas, border: `1px solid ${COLOR.hairline}` }}>
                  <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
                <p className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-tight" style={{ color: COLOR.ink }}>{item.name}</p>
                <p className="mt-0.5 text-[11.5px] font-medium leading-tight" style={{ color: COLOR.muted }}>{item.count}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Recommended for You" />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {recommendedSuppliers.map((s) => (
              <div key={s.id} className="pm-surface flex flex-col p-3.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold text-white ring-2 ring-white"
                    style={{ background: s.tone, boxShadow: "0 1px 3px rgba(16,24,40,0.18)" }}
                  >
                    {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {/* Name — fixed height row */}
                    <div className="flex h-[19px] items-center">
                      <p className="truncate text-[14px] tracking-[0.2px] font-bold" style={{ color: COLOR.ink }}>{s.name}</p>
                    </div>

                    {/* Rating — fixed height row */}
                    <div className="flex mt-0.5 h-[16px] items-center">
                      <span className="flex items-center gap-1 text-[12px] font-bold tabular-nums" style={{ color: COLOR.gold }}>
                        {s.rating}
                        <Star className="h-3 w-3" style={{ fill: COLOR.gold, color: COLOR.gold }} />
                      </span>
                    </div>

                    {/* Description — fixed height row, clamps to 2 lines so it's always the same height */}
                    <p className="line-clamp-2 mt-1 sm:h-[30px] text-[12px] tracking-wide font-medium leading-tight" style={{ color: COLOR.muted }}>
                      {s.desc}
                    </p>
                  </div>
                </div>

                {/* Button — full width across the whole card */}
                <button className="pm-btn-outline mt-3 w-full shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-bold">
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
  const color = trend === "up" ? COLOR.success : COLOR.danger;
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
    <div className="mt-8">
      <SectionHeader title="Quick Actions" showViewAll={false} />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {quickActions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <motion.button
              key={a.id}
              whileHover={{ y: -3 }}
              whileTap={{ y: -1 }}
              className="pm-surface relative flex items-center gap-2.5 px-3 py-3 text-left"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: hexToRgba(a.fg, 0.10), color: a.fg }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold" style={{ color: COLOR.ink }}>{a.label}</p>
                <p className="truncate text-[11.5px] font-medium" style={{ color: COLOR.muted }}>{a.desc}</p>
              </div>
              {a.count && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white tabular-nums"
                  style={{ background: COLOR.danger }}
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
        className="text-[16px] font-extrabold tracking-tight md:text-[18.5px]"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: COLOR.ink }}
      >
        {title}
      </h3>
      {showViewAll && (
        <button className="pm-link text-[12.5px] font-bold">View All</button>
      )}
    </div>
  );
}