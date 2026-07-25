// src/pages/HomePage.jsx

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue } from "framer-motion";
import {
    Search, Camera, ChevronRight, ArrowDown, Users, ShoppingCart,
    Tag, FileText, Zap, BadgePercent, TrendingUp, Circle, Truck,
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
        </div>
    );
}
