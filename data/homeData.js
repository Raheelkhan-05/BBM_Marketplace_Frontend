//src/data/dashboardData.js

export const walletBalance = "₹1,40,000";
export const userName = "User_Name";

export const promoSlides = [
  {
    id: "bearings",
    tag: "LIVE QUOTES",
    title: "Lowest Bearing Prices Today!",
    subtitle: "Compare 150+ verified suppliers and save on bulk purchases.",
    cta: "Compare Now",
    image: "./c2.png",
    badge: "SAVE UP TO 18% on Bulk Orders",
  },
  {
    id: "oils",
    tag: "TRENDING",
    title: "Best Engine Oil Deals Today!",
    subtitle: "Compare trusted suppliers and get the best bulk prices fast.",
    cta: "Explore Deals",
    image: "./c1.png",
    badge: "SAVE UP TO 12% on Bulk Orders",
  },
];

export const welcomeHighlights = [
  { id: "price-drop", icon: "trend-down", title: "32211 Bearing", desc: "Price dropped today", value: "₹15 / Pc", tone: "green" },
  { id: "suppliers", icon: "users", title: "3 Suppliers", desc: "Updated quotations", value: "View Now", tone: "blue" },
  { id: "reorder", icon: "cart", title: "Reorder", desc: "15W40 Engine Oil", value: "Reorder Now", tone: "orange" },
];

export const topOffers = [
  { id: "skf", brand: "SKF", logo : "./skf.png", brandTone: "#047084", title: "SKF Week", desc: "Special Discounts", detail: "Up to 12% Off", image: "./2.jpeg" },
  { id: "shell", brand: "Shell", logo : "./shell.png", brandTone: "#d2462b", title: "Shell", desc: "Bulk Purchase Offer", detail: "Extra Savings on Bulk Orders", image: "./1.jpeg" },
  { id: "vci", brand: "VCI Paper", logo : "./vci.png", brandTone: "#16a34a", title: "VCI Paper", desc: "Best Price Today", detail: "₹132 / Kg", image: "./3.jpeg" },
  { id: "ntn", brand: "NTN", logo : "./ntn.png", brandTone: "#2563eb", title: "Bearings in Stock", desc: "Ready to Ship", detail: "", image: "./2.jpeg" },
];

export const businessHighlights = [
  {
    id: "cheaper",
    icon: "tag",
    value: "126",
    label: "Products Cheaper Today",
    fg: "#059669", // Emerald
    bg: "rgba(5,150,105,0.12)",
  },
  {
    id: "quotes",
    icon: "file",
    value: "2,400+",
    label: "New Quotes Added",
    fg: "#047084", // Brand Teal
    bg: "rgba(4,112,132,0.12)",
  },
  {
    id: "delivery",
    icon: "bolt",
    value: "180",
    label: "Express Delivery Offers",
    fg: "#2563EB", // Royal Blue
    bg: "rgba(37,99,235,0.12)",
  },
  {
    id: "discounts",
    icon: "badge",
    value: "420",
    label: "Bulk Discounts Available",
    fg: "#D2462B", // Brand Orange-Red
    bg: "rgba(210,70,43,0.12)",
  },
];

export const marketFeed = [
  { id: "f1", icon: "circle", title: "Bearing 6205", detail: "", change: "-₹4.00", direction: "down" },
  { id: "f2", icon: "trend", title: "15W40 Engine Oil", detail: "5 new suppliers quoted", change: "", direction: "neutral" },
  { id: "f3", icon: "trend-up", title: "VCI Paper 100 Kg", detail: "", change: "+₹2.00", direction: "up" },
  { id: "f4", icon: "truck", title: "Free freight from", detail: "Gujarat Polymers today", change: "", direction: "neutral" },
  { id: "f5", icon: "card", title: "Credit terms added by", detail: "Bearing House", change: "", direction: "neutral" },
];

export const categories = [
  { id: "bearings", name: "Bearings", count: "32,000+ Products", suppliers: "1,250+ Suppliers", from: "₹28", image: "./2.jpeg" },
  { id: "lubricants", name: "Lubricants & Oils", count: "18,000+ Products", suppliers: "950+ Suppliers", from: "₹90 / Ltr", image: "./1.jpeg" },
  { id: "industrial", name: "Industrial Supplies", count: "45,000+ Products", suppliers: "1,600+ Suppliers", from: "₹10", image: "./3.jpeg" },
  { id: "hydraulics", name: "Hydraulics", count: "12,000+ Products", suppliers: "820+ Suppliers", from: "₹150", image: "./2.jpeg" },
  { id: "fasteners", name: "Fasteners", count: "28,000+ Products", suppliers: "1,100+ Suppliers", from: "₹0.50", image: "./1.jpeg" },
  { id: "pipes", name: "Pipes & Fittings", count: "20,000+ Products", suppliers: "950+ Suppliers", from: "₹5", image: "./3.jpeg" },
  { id: "bearings2", name: "Bearings", count: "32,000+ Products", suppliers: "1,250+ Suppliers", from: "₹28", image: "./2.jpeg" },
  { id: "lubricants2", name: "Lubricants & Oils", count: "18,000+ Products", suppliers: "950+ Suppliers", from: "₹90 / Ltr", image: "./1.jpeg" },
  { id: "industrial2", name: "Industrial Supplies", count: "45,000+ Products", suppliers: "1,600+ Suppliers", from: "₹10", image: "./3.jpeg" },
  { id: "hydraulics2", name: "Hydraulics", count: "12,000+ Products", suppliers: "820+ Suppliers", from: "₹150", image: "./2.jpeg" },
  { id: "fasteners2", name: "Fasteners", count: "28,000+ Products", suppliers: "1,100+ Suppliers", from: "₹0.50", image: "./1.jpeg" },
  { id: "pipes2", name: "Pipes & Fittings", count: "20,000+ Products", suppliers: "950+ Suppliers", from: "₹5", image: "./3.jpeg" },
];

export const myPriceList = [
  { id: "p1", name: "15W40 Engine Oil", suppliers: "47 Suppliers", price: "₹182 / Ltr", updated: "Updated 2 min ago", trend: "up", image: "./1.jpeg" },
  { id: "p2", name: "Taper Roller Bearing 32211", suppliers: "18 Suppliers", price: "₹320 / Pc", updated: "Updated 10 min ago", trend: "up", image: "./2.jpeg" },
  { id: "p3", name: "VCI Paper (12\" x 15\")", suppliers: "12 Suppliers", price: "₹132 / Kg", updated: "Updated 18 min ago", trend: "down", image: "./3.jpeg" },
];

export const mostCompared = [
  { id: "c1", name: "15W40 Engine Oil", count: "620+ Comparisons", image: "./1.jpeg" },
  { id: "c2", name: "6205 Bearing", count: "510+ Comparisons", image: "./2.jpeg" },
  { id: "c3", name: "VCI Paper", count: "430+ Comparisons", image: "./3.jpeg" },
  { id: "c4", name: "PP Woven Bag", count: "380+ Comparisons", image: "./1.jpeg" },
  { id: "c5", name: "Hydraulic Pump", count: "360+ Comparisons", image: "./2.jpeg" },
];

export const recommendedSuppliers = [
  { id: "r1", name: "Bearing House", rating: "4.6", desc: "Recently quoted 32211", tone: "#047084" },
  { id: "r2", name: "Shree Lubes", rating: "4.7", desc: "Lubes you purchased last month", tone: "#d2462b" },
  { id: "r3", name: "Galaxy Petroleum", rating: "4.5", desc: "Top quotes in 15W40", tone: "#ea580c" },
];

export const quickActions = [
  { id: "req", icon: "plus", label: "Add Requirement", desc: "Post your requirement", fg: "#047084", bg: "rgba(4,112,132,0.08)" },
  { id: "scan", icon: "scan", label: "Scan Product", desc: "Get product details", fg: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  { id: "purchase", icon: "clipboard", label: "Purchase Desk", desc: "20 items in desk", fg: "#7c3aed", bg: "rgba(124,58,237,0.08)", count: 20 },
  { id: "reorder", icon: "repeat", label: "Reorder", desc: "Buy again quickly", fg: "#d2462b", bg: "rgba(210,70,43,0.08)" },
];