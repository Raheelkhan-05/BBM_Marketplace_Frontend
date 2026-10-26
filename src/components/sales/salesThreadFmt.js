// src/components/sales/salesThreadFmt.js
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const cleanGstin = (v) => String(v || "").replace(/\s+/g, "").toUpperCase().slice(0, 15);

export const cleanPhone = (v) => {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : "";
};
export const cleanEmail = (v) => {
    const e = String(v || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
};

export const ALLOWED_FILES = /\.(jpe?g|png|webp|gif|heic|pdf|docx?|xlsx?|csv|txt|pptx?)$/i;
export const FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx";
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES = 10;

export const inr = (n, max = 2) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: max });
export const qty = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 4 });
export const round4 = (n) => Math.round(n * 10000) / 10000;

export const clock = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
export const dateShort = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const dateTime = (iso) => `${dateShort(iso)}, ${clock(iso)}`;

const sameDay = (a, b) => a.toDateString() === b.toDateString();
export function dayLabel(iso) {
    const d = new Date(iso), now = new Date();
    if (sameDay(d, now)) return "Today";
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return sameDay(d, y) ? "Yesterday" : dateShort(iso);
}
// List rows: time today, "Yesterday", otherwise the date.
export function listTime(iso) {
    if (!iso) return "";
    const d = new Date(iso), now = new Date();
    if (sameDay(d, now)) return clock(iso);
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return sameDay(d, y) ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const fileSize = (n) => {
    const b = Number(n) || 0;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024) return `${Math.round(b / 1024)} KB`;
    return b ? `${b} B` : "";
};
export const initialOf = (s) => (String(s || "?").replace(/^GSTIN\s+/i, "").trim()[0] || "?").toUpperCase();

// Option lists in this app may be plain strings or { value, label }.
export const ov = (o) => (o && typeof o === "object" ? o.value : o);
export const ol = (o) => (o && typeof o === "object" ? o.label ?? o.value : o);