// src/pages/HomePage.jsx

import { useState, useRef, useEffect } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, AnimatePresence } from "framer-motion";
import {
  Search, Camera, ChevronRight, ArrowDown, Users, ShoppingCart,
  Tag, FileText, Zap, BadgePercent, TrendingUp, Circle, Truck, ChevronDown,
  CreditCard, Plus, ScanLine, ClipboardList, Repeat, Star, ShieldCheck,
  Lock, FileCheck, Layers, Cpu, Box, Clock, CheckCircle2, SlidersHorizontal,
  Scale, ArrowUpRight, Award, Building2, PackageCheck, Grid, Percent, Sparkles,
  ArrowRight, Activity, FileSpreadsheet, Shield
} from "lucide-react";

import HomePageSkeleton from "../components/skeletons/HomePageSkeleton.jsx";
import StartSellingBanner from "../components/home/StartSellingBanner.jsx";
import QuickRfqModal from "../components/home/QuickRfqModal.jsx";
import BulkOrderWidget from "../components/home/BulkOrderWidget.jsx";
import SupplierCompareModal from "../components/home/SupplierCompareModal.jsx";

import {
  heroStats, promoSlides, trustPoints, welcomeHighlights, topOffers,
  businessHighlights, marketFeed, categories, myPriceList, mostCompared,
  recommendedSuppliers, quickActions
} from "../../data/homeData";
import { useAuth } from "../context/AuthContext.jsx";

/* =========================================================================
   UI-UX-PRO-MAX DESIGN SYSTEM (Enterprise B2B Amazon Marketplace)
   Brand Red:     #d2462b (Terracotta Red - CTAs & Deal Badges)
   Brand Teal:    #006f83 (Deep Corporate Slate Teal - Secondary Accent & Trust)
   Brand Paper:   #fdfeff (Card Surface with 3D Inset Bevel)
   Canvas:        #f1f5f9 (Warm Sober Neutral Backdrop)
   Amazon Navy:   #131921 & Amazon Gold #febd69
   ========================================================================= */
const COLOR = {
  brandRed: "#d2462b",
  brandRedDark: "#b53820",
  brandRedSoft: "rgba(210,70,43,0.08)",

  brandTeal: "#006f83",
  brandTealDark: "#005666",
  brandTealSoft: "rgba(0,111,131,0.08)",
  brandTealLine: "rgba(0,111,131,0.22)",

  brandPaper: "#fdfeff",
  canvas: "#f1f5f9",

  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  hairline: "rgba(15,23,42,0.08)",
  hairlineStrong: "rgba(15,23,42,0.16)",

  gold: "#d97706",
  amazonGold: "#febd69",

  emerald: "#059669",
  emeraldSoft: "rgba(5,150,105,0.08)",
};

const ICONS = {
  "trend-down": ArrowDown, users: Users, cart: ShoppingCart,
  tag: Tag, file: FileText, bolt: Zap, badge: BadgePercent,
  circle: Circle, trend: TrendingUp, "trend-up": TrendingUp, truck: Truck, card: CreditCard,
  plus: Plus, scan: ScanLine, clipboard: ClipboardList, repeat: Repeat,
  shield: ShieldCheck, lock: Lock, invoice: FileCheck, box: Box, clock: Clock,
  "shield-check": ShieldCheck, "file-check": FileCheck, "part-scan": ScanLine,
  "gst-credit": FileCheck, "credit-line": CreditCard, samples: ShieldCheck
};

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_DISPLAY = "'Rubik', " + FONT_BODY;

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return <HomePageSkeleton />;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 antialiased overflow-x-hidden" style={{ fontFamily: FONT_BODY }}>
      <GlobalStyles />

      {/* Amazon Dark Header Sub-Bar */}
      <AmazonSubHeader onOpenRfq={() => setIsRfqOpen(true)} />

      <main className="mx-auto max-w-[1400px] px-2.5 sm:px-4 lg:px-6 pb-20 pt-3 space-y-6">
        {/* Search Header Bar */}

        {/* 16:9 Aspect Ratio Hero Banner */}
        <Hero16by9Banner onOpenRfq={() => setIsRfqOpen(true)} />

        <AmazonSearchHeader onOpenRfq={() => setIsRfqOpen(true)} />

        {/* Quick Action Bar JUST BELOW THE HERO BANNER (8 Items in 2x4 Grid) */}
        <QuickActionsJustBelowBanner onOpenRfq={() => setIsRfqOpen(true)} />

        <TrustStripLogos />

        {/* Industrial Category Department Explorer */}
        <TopCategoriesAccordion />

        {/* Signature 4-Point Trust & Guarantee Strip */}
        <TrustStrip />

        {/* Personalized Buyer Command Center */}
        <WelcomeBanner />

        {/* Multi-SKU Rapid Order Desk */}
        <BulkOrderWidget />

        {/* Today's B2B Wholesale Deals & Volume Pricing */}
        <TopWholesaleOffers onOpenRfq={() => setIsRfqOpen(true)} />

        {/* Business Metrics & Live Commodity Ticker */}
        <BusinessAndMarketRow />

        {/* Verified Factory Supplier Showcase */}
        <SupplierShowcase onOpenCompare={() => setIsCompareOpen(true)} />

        {/* Start Selling Banner */}
        <StartSellingBanner />
      </main>

      {/* Modals */}
      <QuickRfqModal isOpen={isRfqOpen} onClose={() => setIsRfqOpen(false)} />
      <SupplierCompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
    </div>
  );
}

/* ---------- Global Design System Styles & Dimensional Layering ---------- */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800&family=Rubik:wght@500;600;700;800&display=swap');

      body {
        letter-spacing: -0.012em;
        background-color: #f1f5f9;
      }
      h1, h2, h3, h4, h5, h6 {
        letter-spacing: -0.025em;
      }

      /* 3D Elevation Layering Cards with Bevel Inset Highlight */
      .amz-card {
        background: ${COLOR.brandPaper};
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 14px;
        box-shadow: 0 4px 18px -2px rgba(15,23,42,0.06), 0 2px 6px -1px rgba(15,23,42,0.04), inset 0 1px 0 #ffffff;
        transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .amz-card:hover {
        border-color: rgba(15,23,42,0.16);
        box-shadow: 0 12px 28px -6px rgba(15,23,42,0.12), 0 4px 10px -2px rgba(15,23,42,0.05), inset 0 1px 0 #ffffff;
        transform: translateY(-2px);
      }

      /* Primary Button */
      .amz-btn-primary {
        background: linear-gradient(180deg, ${COLOR.brandRed} 0%, ${COLOR.brandRedDark} 100%);
        color: #ffffff;
        cursor: pointer;
        transition: all 180ms ease;
      }
      .amz-btn-primary:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(210,70,43,0.35), inset 0 1px 0 rgba(255,255,255,0.3);
      }
      .amz-btn-primary:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(210,70,43,0.2);
      }

      /* Teal Button */
      .amz-btn-teal {
        background: linear-gradient(180deg, ${COLOR.brandTeal} 0%, ${COLOR.brandTealDark} 100%);
        color: #ffffff;
        border: 1px solid ${COLOR.brandTealDark};
        box-shadow: 0 2px 6px rgba(0,111,131,0.25), inset 0 1px 0 rgba(255,255,255,0.2);
        cursor: pointer;
        transition: all 180ms ease;
      }
      .amz-btn-teal:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }

      .amz-btn-outline {
        border: 1px solid ${COLOR.brandTeal};
        color: ${COLOR.brandTeal};
        background: transparent;
        cursor: pointer;
        transition: all 180ms ease;
      }
      .amz-btn-outline:hover {
        background: ${COLOR.brandTealSoft};
      }

      .amz-link {
        color: ${COLOR.brandTeal};
        cursor: pointer;
        transition: color 150ms ease;
      }
      .amz-link:hover {
        color: ${COLOR.brandRed};
      }

      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );
}

/* ---------- Amazon-Style Sub-Header Department Links ---------- */
function AmazonSubHeader({ onOpenRfq }) {
  const departments = [
    "Industrial Supplies", "Bearings & Motion Controls", "Oils & Lubricants",
    "Electrical & Switchgears", "Hydraulics & Valves", "Fasteners & Hardware",
    "Safety PPE", "Bulk Purchase Desk", "Net 30 Credit"
  ];

  return (
    <div className="bg-[#131921] text-white text-xs font-semibold px-3 py-2 overflow-x-auto hide-scrollbar flex items-center justify-between gap-4 border-b border-slate-800 shadow-md">
      <div className="flex items-center gap-4 shrink-0">
        <span className="flex items-center gap-1 font-extrabold text-[#febd69] cursor-pointer hover:underline">
          <Grid className="h-3.5 w-3.5" /> All Departments
        </span>
        {departments.map((dept, i) => (
          <span key={i} className="hover:text-sky-300 transition-colors cursor-pointer whitespace-nowrap">
            {dept}
          </span>
        ))}
      </div>
      <button
        onClick={onOpenRfq}
        className="hidden md:flex items-center gap-1 bg-[#d2462b] hover:bg-[#b53820] text-white px-3 py-1 rounded-md text-[11px] font-extrabold shrink-0 transition-all shadow-sm"
      >
        <FileText className="h-3 w-3" /> Post Fast RFQ
      </button>
    </div>
  );
}


function AmazonSearchHeader() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    navigate(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-full p-[2px] bg-gradient-to-r from-[#0B8A93] via-[#3B82F6] to-[#FF6A00] shadow-lg"
    >
      <div className="flex h-[60px] lg:h-[62px] xl:h-[64px] items-center rounded-full bg-white px-3 pl-5 lg:px-5 lg:pl-7">

        {/* Logo */}
        <div className="flex shrink-0 items-center pr-3 lg:pr-4">
          <img src="./Logo.png" alt="Logo" className="h-6 w-6 lg:h-8 lg:w-8 object-contain" />
        </div>

        <div className="mr-3 lg:mr-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

        {/* Search */}
        <div className="flex min-w-0 flex-1 items-center">
          <Search size={16} className="mr-2 lg:mr-3 shrink-0 text-slate-400 lg:!w-4 lg:!h-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any product, brand, category..."
            className="w-full min-w-0 bg-transparent text-[10px] lg:text-base text-slate-700 placeholder:text-slate-400 outline-none"
          />
        </div>

        <div className="mx-3 lg:mx-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

        {/* Image */}
        <button
          type="button"
          className="flex shrink-0 flex-col items-center justify-center gap-1 px-0 lg:px-2"
        >
          <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#E7F7F7]">
            <Camera size={15} className="text-[#00838F] lg:!w-[15px] lg:!h-[15px]" />
          </div>
          <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#00838F]">
            Image
          </span>
        </button>

        {/* PDF */}
        <button
          type="button"
          className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 pr-0 lg:px-2 lg:pr-1"
        >
          <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#F1EEFF]">
            <FileText size={15} className="text-[#6655D8] lg:!w-[15px] lg:!h-[15px]" />
          </div>
          <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#6655D8]">
            PDF
          </span>
        </button>

        {/* Search Button */}
        <button
          type="submit"
          className="ml-2 lg:ml-3 flex h-9 w-9 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-full bg-[#F15A24] text-white transition hover:scale-105"
        >
          <Search size={14} className="lg:!w-[16px] lg:!h-[16px]" />
        </button>

      </div>
    </form>
  );
}

/* ---------- World-Class 16:9 Aspect Ratio Hero Banner (Zero Text Clipping) ---------- */
function Hero16by9Banner({ onOpenRfq }) {
  const total = promoSlides.length;
  const slides = [promoSlides[total - 1], ...promoSlides, promoSlides[0]];

  const indexRef = useRef(1);
  const [dotIndex, setDotIndex] = useState(0);
  const containerRef = useRef(null);
  const [slideWidth, setSlideWidth] = useState(0);
  const x = useMotionValue(0);
  const controlsRef = useRef(null);

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
    controlsRef.current?.stop();
    controlsRef.current = animate(x, -newIndex * slideWidth, {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
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
      },
    });
  };

  const stepNext = () => goToIndex(indexRef.current + 1);

  useEffect(() => {
    if (!slideWidth) return;
    const interval = setInterval(stepNext, 5000);
    return () => clearInterval(interval);
  }, [slideWidth]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 shadow-xl bg-[#090D16]">
      {/* Container with STRICT 16:9 Aspect Ratio on Mobile, capped height on Desktop */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[16/9] lg:aspect-[21/9] xl:aspect-[3/1] max-h-[520px] overflow-hidden select-none"
      >
        <motion.div
          className="flex h-full"
          style={{ x, width: slideWidth ? slideWidth * slides.length : "100%" }}
        >
          {slides.map((slide, i) => (
            <div
              key={`${slide.id}-${i}`}
              className="relative h-full shrink-0 overflow-hidden"
              style={{ width: slideWidth || "100%" }}
            >
              {/* Multi-Layer Ambient Background & Lighting Effects */}
              <div
                className="relative h-full w-full overflow-hidden flex items-center justify-between"
                style={{
                  background: `radial-gradient(circle at 75% 35%, rgba(210,70,43,0.25) 0%, transparent 60%), linear-gradient(135deg, #070c14 0%, ${COLOR.brandTealDark} 55%, #08111a 100%)`,
                }}
              >
                {/* Visual Image Artwork */}
                <div className="absolute right-0 top-0 bottom-0 w-[55%] sm:w-[50%] lg:w-[45%] xl:w-[42%] overflow-hidden pointer-events-none">
                  <img
                    src={slide.image}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover object-center transform scale-105 transition-transform duration-700"
                    style={{
                      maskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)",
                      WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)",
                    }}
                  />
                </div>

                {/* Content Overlay — Non-clipping Layout with Fluid Typography */}
                <div className="relative z-10 flex flex-col justify-center h-full max-w-[50%] sm:max-w-[55%] lg:max-w-[58%] xl:max-w-[52%] p-3 sm:p-6 lg:p-10 xl:p-14 text-white">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-[#d2462b] text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[9px] sm:text-xs lg:text-sm font-extrabold uppercase tracking-wider shadow-md">
                      <Sparkles className="h-3 w-3 lg:h-4 lg:w-4" /> {slide.tag}
                    </span>
                    {slide.moq && (
                      <span className="hidden xs:inline-block bg-white/15 backdrop-blur-md border border-white/20 text-slate-200 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[9px] sm:text-xs lg:text-sm font-semibold">
                        {slide.moq}
                      </span>
                    )}
                  </div>

                  <h2
                    className="font-extrabold text-white leading-tight tracking-tight mt-1.5 sm:mt-2.5 lg:mt-4 line-clamp-2 drop-shadow-md"
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: "clamp(12px, 2.7vw, 56px)",
                    }}
                  >
                    {slide.title}
                  </h2>

                  <p
                    className="font-medium text-slate-200 leading-snug mt-1 sm:mt-2 lg:mt-3 line-clamp-2"
                    style={{ fontSize: "clamp(9.5px, 1.35vw, 20px)" }}
                  >
                    {slide.subtitle}
                  </p>

                  <div className="mt-2 sm:mt-4 lg:mt-6">
                    <button
                      onClick={onOpenRfq}
                      className="amz-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1 sm:px-5 sm:py-2 lg:px-7 lg:py-3 text-[10px] sm:text-xs lg:text-base font-extrabold shadow-lg"
                    >
                      {slide.cta} <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    </button>
                  </div>
                </div>

                {/* Glassmorphic Savings Badge */}
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 lg:top-6 lg:right-6 z-20 flex flex-col items-center justify-center rounded-xl bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 lg:px-4 lg:py-2.5 border border-amber-500/40 text-center shadow-2xl">
                  <span className="text-[8px] sm:text-[10px] lg:text-xs font-extrabold text-amber-400 uppercase tracking-wider">DIRECT SAVINGS</span>
                  <span className="text-xs sm:text-xl lg:text-3xl font-extrabold text-white leading-none mt-0.5 lg:mt-1">{slide.badge.match(/\d+%/)?.[0]} OFF</span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Carousel Navigation Dots */}
        {/* <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex items-center justify-center gap-1.5">
          {promoSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToIndex(i + 1)}
              className="pointer-events-auto h-1.5 rounded-full transition-all duration-300"
              style={{
                width: dotIndex === i ? 20 : 6,
                backgroundColor: dotIndex === i ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div> */}
      </div>
    </div>
  );
}

/* ---------- Quick Action Bar JUST BELOW THE BANNER - Purchase (left col) / Sales (right col) ---------- */
function QuickActionsJustBelowBanner({ onOpenRfq }) {
  const purchaseActions = quickActions.filter((a) =>
    ["explore", "purchase-order", "price-list", "post-rfq"].includes(a.id)
  );
  const salesActions = quickActions.filter((a) =>
    ["add-product", "update-stock", "seller-orders", "marketing"].includes(a.id)
  );

  const renderCard = (a, accent) => {
    const Icon = ICONS[a.icon] || Box;
    return (
      <motion.button
        key={a.id}
        onClick={a.id === "req" ? onOpenRfq : undefined}
        whileHover={{ y: -2 }}
        whileTap={{ y: 0 }}
        className="amz-card relative flex items-center gap-2.5 lg:gap-3 p-3 lg:p-4 text-left cursor-pointer w-full"
      >
        <span
          className="flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: a.bg, color: a.fg }}
        >
          <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs lg:text-sm font-extrabold text-slate-900 leading-tight">{a.label}</p>
          <p className="truncate text-[10.5px] lg:text-xs font-medium text-slate-500 mt-0.5 leading-tight">{a.desc}</p>
        </div>
        {a.count && (
          <span className="absolute right-1.5 top-1.5 lg:right-2 lg:top-2 flex h-4 min-w-4 lg:h-5 lg:min-w-5 items-center justify-center rounded-full bg-[#d2462b] px-1 text-[9.5px] lg:text-[10.5px] font-extrabold text-white tabular-nums">
            {a.count}
          </span>
        )}
      </motion.button>
    );
  };

  const renderGroup = (title, items, accent) => (
    <div className="flex-1 space-y-2.5 lg:space-y-3">
      <h3
        className="text-[13px] lg:text-base font-extrabold tracking-tight text-center"
        style={{ fontFamily: FONT_DISPLAY, color: accent }}
      >
        {title}
      </h3>
      {/* single column on mobile, 2 columns on desktop for a tighter, wider layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3">
        {items.map((a) => renderCard(a, accent))}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-1 pb-5 lg:pb-8 bg-white rounded-xl">
      <h3
        className="text-md pt-2 lg:pt-4 sm:text-base lg:text-xl font-bold text-slate-900 text-center"
        style={{ fontFamily: FONT_DISPLAY }}
      >
        Daily Business Tools
      </h3>

      <div className="w-full flex flex-row gap-3 lg:gap-8 lg:px-4">
        {renderGroup("Purchase", purchaseActions, "#d2462b")}
        {renderGroup("Sales", salesActions, "#059669")}
      </div>
    </div>
  );
}

/* ---------- Signature 4-Point Trust Strip ---------- */
function TrustStrip() {
  return (
    <div className="w-full">
      <div className="amz-card grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
        {trustPoints.map((tp) => {
          const Icon = ICONS[tp.icon];
          return (
            <div key={tp.id} className="flex items-center gap-3 p-3.5 sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006f83]/10 text-[#006f83]">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                  {tp.title}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500 leading-tight mt-0.5">
                  {tp.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Personalized Buyer Command Center ---------- */
function WelcomeBanner() {
  const { profile } = useAuth();
  const firstName = profile?.name?.trim().split(" ")[0] || "Procurement Director";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="amz-card w-full p-4 sm:p-5"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Welcome back, {firstName}
            </h3>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Active quotes, contract price updates & re-order items
          </p>
        </div>

        <button className="amz-btn-outline rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
          Saved Price Lists <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {welcomeHighlights.map((h) => {
          const Icon = ICONS[h.icon];
          return (
            <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#006f83]/10 text-[#006f83]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">{h.title}</p>
                <p className="truncate text-[11px] font-medium text-slate-500 mt-0.5">{h.desc}</p>
              </div>
              <span className="text-xs font-extrabold tabular-nums shrink-0 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                {h.value}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ---------- Top Wholesale Offers & Tiered Pricing ---------- */
function TopWholesaleOffers({ onOpenRfq }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Today's B2B Wholesale Deals & Volume Pricing"
        subtitle="Audited OEM & Factory Direct Stock with Instant Volume Discounts"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topOffers.map((offer, i) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="amz-card flex flex-col p-4"
          >
            {/* Header / Brand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1">
                  <img src={offer.logo} alt="" className="h-full w-full object-contain" />
                </div>
                <span className="text-xs font-extrabold text-slate-900">{offer.brand}</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                <ShieldCheck className="h-3 w-3 text-amber-600" /> Verified
              </span>
            </div>

            {/* Product Image */}
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 relative shadow-inner">
              <img src={offer.image} alt="" className="h-full w-full object-cover" />
              <span className="absolute top-2 left-2 bg-[#d2462b] text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                {offer.discountPercent}% OFF
              </span>
            </div>

            {/* Title & SKU */}
            <div className="mt-3 min-w-0">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                SKU: {offer.sku}
              </span>
              <p className="mt-0.5 truncate text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                {offer.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-500 leading-normal">
                {offer.desc}
              </p>
            </div>

            {/* Rating & MOQ */}
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="flex items-center gap-1 font-bold text-amber-600">
                {offer.rating} <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span className="text-slate-400 font-normal">({offer.reviews})</span>
              </span>
              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                MOQ: {offer.moq}
              </span>
            </div>

            {/* Tiered Volume Pricing */}
            <div className="mt-3 rounded-lg bg-slate-50 p-2.5 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Volume Pricing
              </span>
              {offer.tierPricing?.map((tier, idx) => (
                <div key={idx} className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">{tier.qty}:</span>
                  <span className="font-extrabold text-slate-900 tabular-nums">{tier.price}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={onOpenRfq}
              className="amz-btn-primary mt-4 w-full py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1"
            >
              Get Bulk RFQ Quote <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Business Metrics & Live Commodity Ticker ---------- */
function BusinessAndMarketRow() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <SectionHeader
          title="Today's Procurement Highlights"
          subtitle="Real-time volume statistics across active industrial hubs"
        />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {businessHighlights.map((h, i) => {
            const Icon = ICONS[h.icon];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="amz-card flex flex-col items-center p-4 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006f83]/10 text-[#006f83]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                  {h.value}
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-500 leading-tight">
                  {h.label}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Live Market Commodity Ticker */}
      <div className="amz-card p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900" style={{ fontFamily: FONT_DISPLAY }}>
              Live Spec & Commodity Ticker
            </h4>
            <p className="text-[11px] font-medium text-slate-500">Real-time B2B raw material movement</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Live
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {marketFeed.map((item) => {
            const Icon = ICONS[item.icon];
            const isUp = item.direction === "up";
            const isDown = item.direction === "down";
            return (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isUp ? "bg-rose-100 text-rose-600" : isDown ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900 leading-tight">{item.title}</p>
                  {item.detail && <p className="truncate text-[11px] font-medium text-slate-500 mt-0.5">{item.detail}</p>}
                </div>
                {item.change && (
                  <span
                    className={`shrink-0 text-xs font-extrabold tabular-nums ${isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-600"
                      }`}
                  >
                    {item.change}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <button className="amz-link text-xs font-extrabold flex items-center justify-center gap-1 w-full">
            Setup Market Price Alerts &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trust Strip: Dual-row infinite marquee of brand logos (bare, no cards) ---------- */

const trustBrands = [
  {
    name: "SKF Group (Bearings)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b8/SKF_logo.svg"
  },
  {
    name: "Shell (Lubricants)",
    logo: "https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/shell.svg"
  },
  {
    name: "3M (Industrial Pack & Safety)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/15/3M_wordmark.svg"
  },
  {
    name: "Schneider Electric",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/95/Schneider_Electric_2007.svg"
  },
  {
    name: "Bosch Rexroth (Hydraulics)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Logo_of_Bosch_Rexroth_AG.svg/1280px-Logo_of_Bosch_Rexroth_AG.svg.png"
  },
  {
    name: "Würth Group (Fasteners)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/26/WURTH.png"
  },
  {
    name: "Honeywell (Safety Gear)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Honeywell_logo.svg/1280px-Honeywell_logo.svg.png"
  },
  {
    name: "ArcelorMittal (Steel Works)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Arcelormittal-logo.svg"
  },
  {
    name: "Sandvik (MetalTech)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b8/SANDVIK.svg"
  },
  {
    name: "Siemens (Automation)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Siemens-logo.svg"
  },
  {
    name: "ABB (Power & Robotics)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/00/ABB_logo.svg"
  },
  {
    name: "Parker Hannifin (Motion & Control)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Parker_Hannifin.svg"
  },
  {
    name: "Eaton (Electrical & Fluid Power)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Eaton_Corporation_logo.svg"
  },
  {
    name: "Festool (Power Tools)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Festool.svg"
  },
  {
    name: "Danfoss (Climate & Drives)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f2/Danfoss-Logo.svg"
  },
  {
    name: "Emerson (Automation & Flow)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Logo_Emerson.svg/1280px-Logo_Emerson.svg.png"
  },
  {
    name: "Rockwell Automation",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Rockwell_Automation_logo_%282019%29.svg"
  },
  {
    name: "Atlas Copco (Compressors & Industrial)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/42/Atlas_logo.png"
  }
];

function TrustLogo({ brand, onSelect }) {
  return (
    <button
      onClick={() => onSelect(brand.name)}
      className="shrink-0 mx-4 sm:mx-5 flex items-center justify-center group"
      title={`Search ${brand.name}`}
    >
      <img
        src={brand.logo}
        alt={brand.name}
        loading="lazy"
        className="h-5 sm:h-6 w-auto object-contain opacity-100 transition-transform duration-200 group-hover:scale-110"
      />
    </button>
  );
}

function MarqueeRow({ brands, direction = "left", onSelect, bg }) {
  const loop = [...brands, ...brands];
  return (
    <div className={`relative overflow-hidden ${bg}`}>
      <div
        className={`flex w-max items-center py-2.5 ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"
          }`}
      >
        {loop.map((brand, i) => (
          <TrustLogo key={`${brand.name}-${i}`} brand={brand} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function TrustStripLogos() {
  const handleSelect = (name) => {
    window.location.href = `/search?query=${encodeURIComponent(name)}`;
  };

  return (
    <div className="border border-slate-200 overflow-hidden divide-y divide-slate-200">
      <MarqueeRow
        brands={trustBrands}
        direction="left"
        onSelect={handleSelect}
        bg="bg-white"
      />
      <MarqueeRow
        brands={[...trustBrands].reverse()}
        direction="right"
        onSelect={handleSelect}
        bg="bg-slate-50"
      />

      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-left {
          animation: marquee-left 64s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 64s linear infinite;
        }
        .animate-marquee-left:hover,
        .animate-marquee-right:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

/* ---------- Top Performing Categories (Accordion: Category -> Subcategory -> Products) ---------- */

// Dummy product data generator per subcategory (for testing only)
const dummyProducts = (subName) => [
  { id: `${subName}-1`, name: `${subName} - Standard Grade`, sellers: 24, moq: "MOQ 50 pcs" },
  { id: `${subName}-2`, name: `${subName} - Heavy Duty`, sellers: 12, moq: "MOQ 20 pcs" },
  { id: `${subName}-3`, name: `${subName} - Premium OEM`, sellers: 7, moq: "MOQ 10 pcs" },
];

const topCategories = categories.slice(0, 5);

function TopCategoriesAccordion() {
  const [openCategory, setOpenCategory] = React.useState(null);
  const [openSubcategory, setOpenSubcategory] = React.useState(null);

  const toggleCategory = (id) => {
    setOpenCategory((prev) => (prev === id ? null : id));
    setOpenSubcategory(null); // closing/switching category resets subcategory
  };

  const toggleSubcategory = (id) => {
    setOpenSubcategory((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Explore Categories"
        subtitle="Explore our best-selling industrial departments"
        viewAllTo="/browse"
      />

      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {topCategories.map((cat, idx) => {
          const isOpen = openCategory === cat.id;
          return (
            <div
              key={cat.id}
              className={idx !== 0 ? "border-t-4 border-slate-200" : ""}
            >
              {/* ---- Category Row ---- */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex flex-col text-left group"
              >
                <div className="relative w-full aspect-[3/1] overflow-hidden bg-slate-200">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-between w-full px-4 ps-2 sm:px-5 py-3 pt-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      {cat.name}
                    </h4>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
                      {cat.subcategories.length} Subcategories
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#d2462b]" : ""
                      }`}
                  />
                </div>
              </button>

              {/* ---- Subcategories (expand/collapse) ---- */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden bg-slate-50"
                  >
                    <div className="divide-y divide-slate-200/70">
                      {cat.subcategories.map((sub) => {
                        const subId = `${cat.id}-${sub}`;
                        const isSubOpen = openSubcategory === subId;
                        return (
                          <div key={subId}>
                            <button
                              onClick={() => toggleSubcategory(subId)}
                              className="w-full flex items-center justify-between pl-7 pr-4 sm:pl-9 sm:pr-5 py-3 text-left"
                            >
                              <div>
                                <span className="text-xs sm:text-sm font-bold text-slate-700">
                                  {sub}
                                </span>
                                <p className="text-[10.5px] font-semibold text-slate-400">
                                  {dummyProducts(sub).length} Products
                                </p>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${isSubOpen ? "rotate-180 text-[#d2462b]" : ""
                                  }`}
                              />
                            </button>

                            {/* ---- Products (expand/collapse) ---- */}
                            <AnimatePresence initial={false}>
                              {isSubOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: "easeInOut" }}
                                  className="overflow-hidden bg-white"
                                >
                                  <div className="pl-9 sm:pl-12 pr-4 sm:pr-5 py-2 space-y-2">
                                    {dummyProducts(sub).map((p) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 hover:border-[#d2462b]/40 transition-colors cursor-pointer"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-[11.5px] sm:text-xs font-bold text-slate-800 truncate">
                                            {p.name}
                                          </p>
                                          <p className="text-[10.5px] font-medium text-slate-500 mt-0.5">
                                            {p.moq}
                                          </p>
                                        </div>
                                        <span className="text-[11.5px] sm:text-xs font-extrabold text-[#d2462b] shrink-0 ml-2">
                                          {p.sellers} Sellers
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Industrial Category Explorer ---------- */
// function ShopByCategory() {
//   return (
//     <div className="space-y-3">
//       <SectionHeader
//         title="Explore Industrial Departments"
//         subtitle="Browse over 450,000+ verified products across key manufacturing domains"
//       />
//       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
//         {categories.map((cat, i) => (
//           <motion.div
//             key={cat.id}
//             initial={{ opacity: 0, y: 8 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
//             className="amz-card flex flex-col overflow-hidden group cursor-pointer"
//           >
//             <div className="aspect-video w-full overflow-hidden bg-slate-100 relative shadow-inner">
//               <img
//                 src={cat.image}
//                 alt=""
//                 className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
//               />
//               <span className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
//                 From {cat.from}
//               </span>
//             </div>
//             <div className="p-3.5 flex flex-col flex-1">
//               <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-[#d2462b] transition-colors">
//                 {cat.name}
//               </h4>
//               <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
//                 {cat.count} &middot; {cat.suppliers}
//               </p>

//               <div className="mt-2 flex flex-wrap gap-1">
//                 {cat.subcategories?.slice(0, 2).map((sub, idx) => (
//                   <span key={idx} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60">
//                     {sub}
//                   </span>
//                 ))}
//               </div>
//             </div>
//           </motion.div>
//         ))}
//       </div>
//     </div>
//   );
// }

/* ---------- Verified Supplier Showcase ---------- */
function SupplierShowcase({ onOpenCompare }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="ISO & OEM Verified Factory Suppliers"
          subtitle="Direct manufacturer audit status, lead times & escrow protection"
        />
        <button
          onClick={onOpenCompare}
          className="amz-btn-outline flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-extrabold self-start sm:self-auto"
        >
          <Scale className="h-4 w-4" /> Compare Suppliers
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {recommendedSuppliers.map((s) => (
          <div key={s.id} className="amz-card flex flex-col p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-md"
                style={{ background: s.tone }}
              >
                {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </span>

              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs sm:text-sm font-extrabold text-slate-900">{s.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="flex items-center gap-0.5 text-xs font-extrabold text-amber-600">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {s.rating}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">({s.reviews})</span>
                  <span className="text-[11px] font-bold text-[#006f83] bg-sky-50 px-1.5 py-0.5 rounded">
                    {s.location}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold">
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Dispatch: {s.dispatchRate}
              </span>
              <span className="text-slate-500">{s.certification}</span>
            </div>

            <button
              onClick={onOpenCompare}
              className="amz-btn-outline mt-3 w-full rounded-lg py-2 text-xs font-extrabold flex items-center justify-center gap-1"
            >
              View Factory Profile & Products <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  showViewAll = true,
  viewAllTo,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3
          className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          {title}
        </h3>

        {subtitle && (
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {showViewAll && (
        <button
          onClick={() => viewAllTo && navigate(viewAllTo)}
          className="amz-link text-xs font-bold flex items-center gap-0.5"
        >
          See All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}