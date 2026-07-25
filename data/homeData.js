// src/data/homeData.js

export const userName = "Procurement Director";

export const heroStats = [
  { label: "In-Stock SKUs", value: "1.2M+", icon: "box" },
  { label: "Verified ISO Factories", value: "4,500+", icon: "shield-check" },
  { label: "Average RFQ Turnaround", value: "24 Mins", icon: "clock" },
  { label: "GST Credit Guaranteed", value: "100%", icon: "file-check" },
];

export const promoSlides = [
  {
    id: "bearings",
    tag: "LIVE FACTORY QUOTES",
    title: "Industrial Bearings & Motion Controls",
    subtitle: "Direct factory pricing from SKF, NTN, FAG & Timken with ISO 9001 test reports.",
    cta: "Request Volume RFQ",
    image: "./c2.avif",
    badge: "SAVE UP TO 24%",
    moq: "Min. 50 Pcs",
    leadTime: "24-48 Hours",
  },
  {
    id: "oils",
    tag: "BULK TANKER & BARREL",
    title: "Heavy Duty Lubricants & Base Oils",
    subtitle: "High-grade 15W40, Hydraulic ISO 68 & Cutting fluids with batch COA certificates.",
    cta: "Get Bulk Pricing",
    image: "./c1.avif",
    badge: "SAVE UP TO 18%",
    moq: "Min. 200 Ltr Drum",
    leadTime: "Immediate Dispatch",
  },
  {
    id: "electrical",
    tag: "OEM DIRECT DISTRIBUTOR",
    title: "Industrial Electrical & Switchgears",
    subtitle: "Circuit breakers, VFD drives & contactors from Siemens, Schneider & ABB.",
    cta: "Download Price List",
    image: "./3.avif",
    badge: "SAVE UP TO 20%",
    moq: "Min. 5 Units",
    leadTime: "Same Day Shipping",
  },
];

export const trustPoints = [
  { id: "verified", icon: "shield", title: "100% Audited Suppliers", desc: "ISO, BIS & OEM Verified Factories" },
  { id: "secure", icon: "lock", title: "Escrow Payment Protection", desc: "Funds released upon delivery inspection" },
  { id: "dispatch", icon: "truck", title: "Pan-India Express Freight", desc: "Ships from 45+ regional fulfillment hubs" },
  { id: "gst", icon: "invoice", title: "GST & Credit Terms", desc: "Instant tax invoice & Net 30/60 pay lines" },
];

export const welcomeHighlights = [
  { id: "price-drop", icon: "trend-down", title: "Deep Groove Bearing 6205-ZZ", desc: "Contract price dropped by", value: "₹18.50 / Pc", tone: "green" },
  { id: "suppliers", icon: "users", title: "4 Verified Factory Bids", desc: "Pending review for RFQ #8849", value: "View Bids", tone: "blue" },
  { id: "reorder", icon: "cart", title: "Monthly Inventory Re-Order", desc: "Hydraulic Oil ISO 46 (210L Drum)", value: "Reorder Now", tone: "orange" },
];

export const topOffers = [
  {
    id: "skf-6200",
    brand: "SKF Bearings",
    logo: "./skf.svg",
    sku: "SKF-6205-2RSH",
    title: "SKF Deep Groove Ball Bearing 6205",
    desc: "Rubber sealed, high speed C3 clearance for industrial motors",
    image: "./2.avif",
    rating: "4.9",
    reviews: "3,420",
    moq: "50 Pcs",
    originalPrice: "₹165",
    price: "₹128",
    discountPercent: 22,
    tierPricing: [
      { qty: "50-199 Pcs", price: "₹138" },
      { qty: "200-499 Pcs", price: "₹132" },
      { qty: "500+ Pcs", price: "₹128" },
    ],
    badges: ["ISO 9001 Certified", "Ready to Ship"],
  },
  {
    id: "shell-rimula",
    brand: "Shell Oils",
    logo: "./shell.svg",
    sku: "SHL-RIM-15W40-210L",
    title: "Shell Rimula R4 X 15W-40 Heavy Duty Diesel Oil",
    desc: "API CI-4 / SL engine oil, 210 Litre sealed steel drum",
    image: "./1.avif",
    rating: "4.8",
    reviews: "2,180",
    moq: "1 Drum (210L)",
    originalPrice: "₹215/L",
    price: "₹178/L",
    discountPercent: 17,
    tierPricing: [
      { qty: "1-4 Drums", price: "₹188/L" },
      { qty: "5-19 Drums", price: "₹182/L" },
      { qty: "20+ Drums", price: "₹178/L" },
    ],
    badges: ["OEM Approved", "Batch COA Included"],
  },
  {
    id: "vci-paper",
    brand: "VCI Packaging",
    logo: "./vci.svg",
    sku: "VCI-ROL-120GSM",
    title: "VCI Anti-Rust Corrosion Inhibitor Roll",
    desc: "120 GSM heavy duty poly-coated Kraft paper roll (1m x 100m)",
    image: "./3.avif",
    rating: "4.7",
    reviews: "890",
    moq: "5 Rolls",
    originalPrice: "₹1,450",
    price: "₹1,180",
    discountPercent: 18,
    tierPricing: [
      { qty: "5-19 Rolls", price: "₹1,280" },
      { qty: "20-49 Rolls", price: "₹1,220" },
      { qty: "50+ Rolls", price: "₹1,180" },
    ],
    badges: ["RoHS Compliant", "Export Grade"],
  },
  {
    id: "ntn-taper",
    brand: "NTN Japan",
    logo: "./ntn.svg",
    sku: "NTN-32211-J2/Q",
    title: "NTN Tapered Roller Bearing 32211",
    desc: "Precision tapered roller bearing for heavy vehicle axles & gearboxes",
    image: "./2.avif",
    rating: "4.9",
    reviews: "1,450",
    moq: "20 Pcs",
    originalPrice: "₹380",
    price: "₹315",
    discountPercent: 17,
    tierPricing: [
      { qty: "20-99 Pcs", price: "₹340" },
      { qty: "100-249 Pcs", price: "₹325" },
      { qty: "250+ Pcs", price: "₹315" },
    ],
    badges: ["Japan Precision", "GST Ready"],
  },
];

export const businessHighlights = [
  { id: "cheaper", icon: "tag", value: "348", label: "Industrial Items Price Dropped Today", fg: "#059669", bg: "rgba(5,150,105,0.10)" },
  { id: "quotes", icon: "file", value: "3,850+", label: "Verified Factory Bids Active", fg: "#006f83", bg: "rgba(0,111,131,0.10)" },
  { id: "delivery", icon: "bolt", value: "240+", label: "Hubs Offering Same-Day Freight", fg: "#0F172A", bg: "rgba(15,23,42,0.10)" },
  { id: "discounts", icon: "badge", value: "590+", label: "Volume Discounts Unlocked", fg: "#d2462b", bg: "rgba(210,70,43,0.10)" },
];

export const marketFeed = [
  { id: "f1", icon: "circle", title: "Bearing Steel SAE 52100", detail: "Global price index down -1.8%", change: "-₹4.20/kg", direction: "down" },
  { id: "f2", icon: "trend", title: "Industrial Base Oil SN 150", detail: "6 new refinery direct quotes added", change: "Live", direction: "neutral" },
  { id: "f3", icon: "trend-up", title: "Copper Winding Wire (Class H)", detail: "Raw material spot price increased", change: "+₹12.50/kg", direction: "up" },
  { id: "f4", icon: "truck", title: "Zero Freight Promo", detail: "Navi Mumbai Hub for orders > ₹50,000", change: "Active", direction: "neutral" },
  { id: "f5", icon: "card", title: "Net 60 Days Credit Line", detail: "Approved by National Bearing Corp", change: "Approved", direction: "neutral" },
];

export const categories = [
  {
    id: "bearings",
    name: "Bearings & Motion Controls",
    count: "45,000+ SKUs",
    suppliers: "1,420+ Certified OEM Suppliers",
    from: "₹18/pc",
    image: "./2.avif",
    subcategories: ["Deep Groove Ball", "Taper Roller", "Spherical Roller", "Pillow Block Units"],
  },
  {
    id: "lubricants",
    name: "Industrial Oils & Lubricants",
    count: "22,000+ SKUs",
    suppliers: "980+ Refinery Partners",
    from: "₹85/Ltr",
    image: "./1.avif",
    subcategories: ["Engine Oils 15W40", "Hydraulic ISO 46/68", "Gear Oils 80W90", "Greases NLGI 2/3"],
  },
  {
    id: "industrial",
    name: "Industrial Packaging & VCI",
    count: "18,000+ SKUs",
    suppliers: "750+ Manufacturers",
    from: "₹12/roll",
    image: "./3.avif",
    subcategories: ["VCI Anti-Rust Paper", "Stretch Wrap Film", "PP Strapping Band", "Corrugated Boxes"],
  },
  {
    id: "electrical",
    name: "Electrical & Switchgears",
    count: "65,000+ SKUs",
    suppliers: "1,850+ Distributors",
    from: "₹120/pc",
    image: "./3.avif",
    subcategories: ["MCBs & MCCBs", "VFD Drives", "Contactors & Relays", "Armoured Cables"],
  },
  {
    id: "hydraulics",
    name: "Hydraulics & Pneumatics",
    count: "34,000+ SKUs",
    suppliers: "890+ Manufacturers",
    from: "₹95/pc",
    image: "./2.avif",
    subcategories: ["Hydraulic Cylinders", "Solenoid Valves", "High Pressure Hoses", "Air Compressors"],
  },
  {
    id: "fasteners",
    name: "Fasteners & Industrial Hardware",
    count: "88,000+ SKUs",
    suppliers: "2,100+ Factories",
    from: "₹0.35/pc",
    image: "./1.avif",
    subcategories: ["Grade 8.8 Hex Bolts", "Stainless Steel Nuts", "Anchor Fasteners", "Threaded Rods"],
  },
  {
    id: "pumps",
    name: "Industrial Pumps & Valves",
    count: "29,000+ SKUs",
    suppliers: "640+ Manufacturers",
    from: "₹450/unit",
    image: "./2.avif",
    subcategories: ["Centrifugal Pumps", "Ball & Gate Valves", "Slurry Pumps", "Check Valves"],
  },
  {
    id: "safety",
    name: "Safety Equipment & PPE",
    count: "40,000+ SKUs",
    suppliers: "1,350+ Distributors",
    from: "₹45/item",
    image: "./3.avif",
    subcategories: ["Safety Shoes S3", "Helmet & Visors", "Cut Resistant Gloves", "Fall Protection Harness"],
  },
];

export const myPriceList = [
  { id: "p1", name: "Shell Rimula R4 X 15W40 (210L)", suppliers: "52 Verified Suppliers", price: "₹178 / Ltr", updated: "2 mins ago", trend: "down", image: "./1.avif" },
  { id: "p2", name: "SKF Taper Roller Bearing 32211", suppliers: "24 Verified Suppliers", price: "₹315 / Pc", updated: "8 mins ago", trend: "down", image: "./2.avif" },
  { id: "p3", name: "VCI Anti-Rust Roll 120GSM", suppliers: "16 Verified Suppliers", price: "₹1,180 / Roll", updated: "15 mins ago", trend: "down", image: "./3.avif" },
];

export const mostCompared = [
  { id: "c1", name: "15W40 Engine Oil (Shell vs Castrol vs Mobil)", count: "1,240+ Comparisons Today", image: "./1.avif" },
  { id: "c2", name: "Deep Groove Bearing 6205 (SKF vs NTN vs FAG)", count: "980+ Comparisons Today", image: "./2.avif" },
  { id: "c3", name: "VCI Paper vs Poly Coating Anti-Rust", count: "720+ Comparisons Today", image: "./3.avif" },
];

export const recommendedSuppliers = [
  {
    id: "r1",
    name: "National Bearing Corporation",
    rating: "4.9",
    reviews: "1,840",
    certification: "ISO 9001:2015 Certified",
    desc: "Direct SKF & FAG Authorized Stockist. Instant Net 30 terms.",
    tone: "#006f83",
    location: "Mumbai, MH",
    dispatchRate: "99.4%",
  },
  {
    id: "r2",
    name: "Shree Petroleum & Lubricants",
    rating: "4.8",
    reviews: "1,220",
    certification: "Shell Authorized Distributor",
    desc: "Bulk tanker & drum supply. Free COA certificate on every batch.",
    tone: "#d2462b",
    location: "Ahmedabad, GJ",
    dispatchRate: "98.8%",
  },
  {
    id: "r3",
    name: "Apex Switchgears & Automation",
    rating: "4.7",
    reviews: "950",
    certification: "Siemens & Schneider Partner",
    desc: "Panel components, drives & breakers with 1-year factory warranty.",
    tone: "#059669",
    location: "Bengaluru, KA",
    dispatchRate: "99.1%",
  },
];

export const supplierComparisonMatrix = [
  {
    feature: "Verification Level",
    supplierA: "Gold OEM Factory (Audited)",
    supplierB: "Authorized Tier-1 Stockist",
    supplierC: "Regional Master Distributor",
  },
  {
    feature: "MOQ Flexibility",
    supplierA: "From 10 Pcs",
    supplierB: "From 50 Pcs",
    supplierC: "From 100 Pcs",
  },
  {
    feature: "Lead Time / Dispatch",
    supplierA: "Same Day (24 hrs)",
    supplierB: "48 Hours",
    supplierC: "3-5 Days",
  },
  {
    feature: "Credit / Payment Terms",
    supplierA: "Net 60 Days / Escrow",
    supplierB: "Net 30 Days / Escrow",
    supplierC: "100% Advance / LC",
  },
  {
    feature: "Batch Test Reports",
    supplierA: "ISO MTR + COA Included",
    supplierB: "COA On Request",
    supplierC: "Standard Invoice Only",
  },
];

// TOTAL 8 QUICK ACTION ITEMS (4 items in Row 1, 4 items in Row 2)
export const quickActions = [
  { id: "req", icon: "plus", label: "Post Quick RFQ", desc: "Get bids in 30 mins", fg: "#d2462b", bg: "rgba(210,70,43,0.08)" },
  { id: "bulk", icon: "scan", label: "Multi-SKU Order", desc: "Paste part numbers & order", fg: "#006f83", bg: "rgba(0,111,131,0.08)" },
  { id: "purchase", icon: "clipboard", label: "Procurement Desk", desc: "18 Active Orders", fg: "#0F172A", bg: "rgba(15,23,42,0.08)", count: 18 },
  { id: "reorder", icon: "repeat", label: "1-Click Re-Order", desc: "Repeat previous invoice", fg: "#059669", bg: "rgba(5,150,105,0.08)" },
  { id: "part-scan", icon: "box", label: "Scan Part Number", desc: "Barcode / Spec lookup", fg: "#d97706", bg: "rgba(217,119,6,0.08)" },
  { id: "gst-credit", icon: "invoice", label: "GST Tax Invoices", desc: "Download tax reports", fg: "#006f83", bg: "rgba(0,111,131,0.08)" },
  { id: "credit-line", icon: "card", label: "Net 30 Credit", desc: "Check credit limit", fg: "#d2462b", bg: "rgba(210,70,43,0.08)" },
  { id: "samples", icon: "shield", label: "Request Sample", desc: "Free product sample", fg: "#059669", bg: "rgba(5,150,105,0.08)" },
];