// src/components/team/monitor/monitorHelpers.js
// Shared constants + helpers for the full-page Sales Monitor (kept separate from SalesMonitorPanel).

export const C = {
    ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)",
    tile: "rgba(20,27,34,0.06)", rail: "rgba(20,27,34,0.14)", red: "#d2462b", green: "#12794A",
};
export const MOD_COLOR = { enquiry: "#114072", order: "#22A06B", customer: "#7A3EB1" };
export const MOD_LABEL = { enquiry: "Enquiry", order: "Order", customer: "Customer" };
export const OPEN_LABEL = { enquiry: "View enquiry", order: "View order", customer: "View customers" };

export const IDLE_MIN = 30;
const IST_MS = 19_800_000, DAY_MS = 86_400_000, WORK_START = 540, WORK_END = 1080;

export const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
export const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const istDayStart = (ms) => Math.floor((ms + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
const istMinutes = (ms) => { const d = new Date(ms + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const fmtGap = (m) => { const n = Math.max(0, Math.round(m)); return n < 60 ? `${n} min` : `${Math.floor(n / 60)}h ${n % 60 ? `${n % 60}m` : ""}`.trim(); };
export const agoText = (now, iso) => { const m = Math.floor((now - Date.parse(iso)) / 60_000); return m < 1 ? "just now" : `${fmtGap(m)} ago`; };
export const dLabel = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const count = (v, one, many) => `${v} ${v === 1 ? one : many}`;

export const PRESETS = [["all", "All"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Pick dates"]];
export const PRESET_KEYS = PRESETS.map(([k]) => k);

export function rangeFor(preset, custom) {
    const today = istDate(Date.now());
    if (preset === "all") return { from: "", to: "", all: true };
    if (preset === "yesterday") { const y = addDays(today, -1); return { from: y, to: y, all: false }; }
    if (preset === "7d") return { from: addDays(today, -6), to: today, all: false };
    if (preset === "30d") return { from: addDays(today, -29), to: today, all: false };
    if (preset === "custom") {
        let from = custom.from || today, to = custom.to || custom.from || today;
        if (from > to) [from, to] = [to, from];
        return { from, to, all: false };
    }
    return { from: today, to: today, all: false };
}

// Live status of a salesperson, always about "right now" (independent of the chosen date range).
export function statusOf(p, now) {
    const m = istMinutes(now);
    if (m < WORK_START || m > WORK_END) return { k: "off", label: "Off hours", fg: C.muted, bg: C.tile };
    const open = istDayStart(now) + WORK_START * 60_000;
    const last = p.lastAny ? Date.parse(p.lastAny) : 0;
    const gap = (now - Math.max(last, open)) / 60_000;
    if (gap > IDLE_MIN) {
        return { k: "idle", label: last >= open ? `Idle ${fmtGap(gap)}` : "No activity yet today", fg: C.red, bg: "rgba(210,70,43,.12)" };
    }
    return { k: "active", label: "Active", fg: C.green, bg: "rgba(34,160,107,.14)" };
}