export const STORE_TEMPLATES = [
    { id: "letterhead", label: "Classic", hint: "Clean white card with a colour edge" },
    { id: "solid", label: "Bold", hint: "Rich gradient with shapes" },
    { id: "cover", label: "Photo", hint: "Cover photo, overlapping logo" },
    { id: "compact", label: "Compact", hint: "Slim bar, products first" },
];

export const STORE_ACCENTS = [
    { name: "Seller blue", hex: "#0F63B5" },
    { name: "Navy", hex: "#1F3A5F" },
    { name: "Brick", hex: "#B4351B" },
    { name: "Pine", hex: "#1E6B52" },
    { name: "Teal", hex: "#0F6E7A" },
    { name: "Ochre", hex: "#8A5A00" },
    { name: "Berry", hex: "#9C2C5B" },
    { name: "Graphite", hex: "#23272B" },
];

// Optional "need ideas?" helpers in the editor. NOT pre-selected; sellers type their own.
export const HIGHLIGHT_IDEAS = ["GST invoice", "Credit available", "Doorstep delivery", "Bulk pricing", "Direct seller support"];
export const SELL_IDEAS = ["Bearings", "Fasteners", "Hydraulics", "Electricals", "Tools"];

export const MAX_TAGLINE = 90;
export const MAX_ABOUT = 280;
export const MAX_HIGHLIGHTS = 4;
export const MAX_HIGHLIGHT_LEN = 32;
export const MAX_SELLS = 6;
export const MAX_SELL_LEN = 28;
export const MAX_POINTS = 4;
export const MAX_POINT_LEN = 70;

// Old themes stored highlight KEYS. Map them to text so existing stores keep working.
const LEGACY_HIGHLIGHTS = {
    gst: "GST invoice", credit: "Credit available", delivery: "Doorstep delivery",
    bulk: "Bulk pricing", support: "Direct seller support",
};

export const DEFAULT_THEME = {
    v: 2,
    template: "letterhead",
    accent: STORE_ACCENTS[0].hex,
    tagline: "",
    about: "",
    sells: [],
    highlights: [],
    points: [],
    coverUrl: "",
};

const line = (v, max) =>
    typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const para = (v, max) =>
    typeof v === "string"
        ? v.replace(/\r/g, "").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").replace(/[ \t]+/g, " ")
            .replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
        : "";

function list(raw, max, len, legacy) {
    const seen = new Set();
    const out = [];
    for (const x of Array.isArray(raw) ? raw : []) {
        const t = line((legacy && legacy[x]) || x, len);
        const k = t.toLowerCase();
        if (!t || seen.has(k)) continue;
        seen.add(k);
        out.push(t);
        if (out.length >= max) break;
    }
    return out;
}

export function sanitizeTheme(raw) {
    const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const template = STORE_TEMPLATES.some((t) => t.id === r.template) ? r.template : DEFAULT_THEME.template;
    const accent =
        STORE_ACCENTS.find((a) => a.hex.toLowerCase() === String(r.accent || "").toLowerCase())?.hex || DEFAULT_THEME.accent;
    const coverUrl = typeof r.coverUrl === "string" && /^https:\/\/\S{4,480}$/.test(r.coverUrl) ? r.coverUrl : "";
    return {
        v: 2,
        template,
        accent,
        tagline: line(r.tagline, MAX_TAGLINE),
        about: para(r.about, MAX_ABOUT),
        sells: list(r.sells, MAX_SELLS, MAX_SELL_LEN),
        highlights: list(r.highlights, MAX_HIGHLIGHTS, MAX_HIGHLIGHT_LEN, LEGACY_HIGHLIGHTS),
        points: list(r.points, MAX_POINTS, MAX_POINT_LEN),
        coverUrl,
    };
}

// Text colour that stays readable on top of `hex`.
export function readableOn(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0B1116" : "#FFFFFF";
}