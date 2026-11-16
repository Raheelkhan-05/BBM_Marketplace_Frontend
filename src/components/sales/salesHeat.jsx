import { Flame, Sun, Snowflake, Skull } from "lucide-react";

export const HEATS = [
    { key: "hot", label: "Hot", Icon: Flame },
    { key: "warm", label: "Warm", Icon: Sun },
    { key: "cold", label: "Cold", Icon: Snowflake },
    { key: "dead", label: "Dead", Icon: Skull },
];
export const HEAT_BY = Object.fromEntries(HEATS.map((h) => [h.key, h]));
export const EMPTY_HEAT = { hot: 0, warm: 0, cold: 0, dead: 0, none: 0 };
export const matchHeat = (h, f) => !f || (f === "none" ? !h : h === f);

export function HeatBadge({ heat }) {
    const h = HEAT_BY[heat];
    if (!h) return null;
    return <span className={`sh-badge ${h.key}`}><h.Icon size={12} aria-hidden="true" />{h.label}</span>;
}