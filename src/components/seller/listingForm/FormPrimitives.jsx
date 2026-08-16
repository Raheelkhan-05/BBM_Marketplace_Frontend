// components/seller/listingForm/FormPrimitives.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Trash2, Info } from "lucide-react";

export const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
};
export const EASE = [0.16, 1, 0.3, 1];

export function Label({ children, hint }) {
    return (
        <span className="flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
            {children}
            {hint && (
                <span className="group relative">
                    <Info className="h-3 w-3 cursor-help" style={{ color: C.muted }} />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-48 -translate-x-1/2 rounded-lg bg-[#0B1116] px-2.5 py-1.5 text-[10.5px] font-medium normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        {hint}
                    </span>
                </span>
            )}
        </span>
    );
}

export function TextField({ label, value, onChange, placeholder, inputMode, type = "text", hint, required, disabled }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
            <input
                type={type}
                value={value ?? ""}
                inputMode={inputMode}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border-2 bg-white px-3.5 py-2.5 text-[14px] font-semibold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:opacity-60"
                style={{ borderColor: C.hairSoft, color: C.ink, ["--tw-ring-color"]: `${C.secondary}20` }}
            />
        </div>
    );
}

export function TextAreaField({ label, value, onChange, placeholder, hint, required, rows = 3 }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
            <textarea
                value={value ?? ""}
                placeholder={placeholder}
                rows={rows}
                onChange={(e) => onChange(e.target.value)}
                className="w-full resize-none rounded-lg border-2 bg-white px-3.5 py-2.5 text-[13.5px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4"
                style={{ borderColor: C.hairSoft, color: C.ink, ["--tw-ring-color"]: `${C.secondary}20` }}
            />
        </div>
    );
}

export function SelectField({ label, value, onChange, options, hint, required, placeholder = "Select…" }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
            <select
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border-2 bg-white px-3.5 py-2.5 text-[14px] font-semibold focus:outline-none focus:ring-4"
                style={{ borderColor: C.hairSoft, color: C.ink }}
            >
                <option value="" disabled>{placeholder}</option>
                {options.map((o) => (
                    <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
                ))}
            </select>
        </div>
    );
}

export function ToggleField({ label, value, onChange, hint, onLabel = "Yes", offLabel = "No" }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}</Label>
            <div className="flex gap-1.5 rounded-lg p-1" style={{ background: C.hairSoft, width: "fit-content" }}>
                {[{ v: true, t: onLabel }, { v: false, t: offLabel }].map(({ v, t }) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onChange(v)}
                        className="rounded-md px-3.5 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                        style={value === v ? { background: C.secondary, color: "#fff" } : { color: C.muted }}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ChipToggleGroup({ label, value, onChange, options, hint }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label hint={hint}>{label}</Label>
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                    const optValue = o.value ?? o;
                    const active = value === optValue;
                    return (
                        <button
                            key={optValue}
                            type="button"
                            onClick={() => onChange(optValue)}
                            className="rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors duration-150"
                            style={active
                                ? { borderColor: C.secondary, background: `${C.secondary}12`, color: C.secondary }
                                : { borderColor: C.hairSoft, color: C.muted }}
                        >
                            {o.label ?? o}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Repeatable rows — used for Specifications, Price Slabs, Quantity
// Discounts, and Quality certification links.
export function RepeatableRows({ label, hint, rows, columns, onChange, addLabel = "Add row" }) {
    const update = (idx, key, val) => {
        const next = rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
        onChange(next);
    };
    const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));
    const add = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))]);

    return (
        <div className="flex flex-col gap-2">
            <Label hint={hint}>{label}</Label>
            {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            {columns.map((c) => (
                                <input
                                    key={c.key}
                                    value={row[c.key] ?? ""}
                                    placeholder={c.placeholder}
                                    inputMode={c.inputMode}
                                    onChange={(e) => update(idx, c.key, e.target.value)}
                                    className="min-w-0 flex-1 rounded-lg border-2 px-3 py-2 text-[13px] font-semibold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4"
                                    style={{ borderColor: C.hairSoft, color: C.ink, ["--tw-ring-color"]: `${C.secondary}20` }}
                                />
                            ))}
                            <button type="button" onClick={() => remove(idx)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" style={{ color: "#c71f11" }} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={add}
                className="flex w-fit items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-1.5 text-[12px] font-bold"
                style={{ borderColor: C.hairSoft, color: C.secondary }}
            >
                <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
        </div>
    );
}

// Collapsible section card. The header is split into a clickable
// title area (toggles open/closed) and a separate `headerRight` slot
// so interactive content there (e.g. GroupTemplateBar's dropdown
// trigger) is never nested inside another <button>.
export function SectionCard({ icon: Icon, title, subtitle, badge, defaultOpen = false, children, headerRight }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.hair }}>
            <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
                <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                        <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span className="text-[14.5px] font-extrabold" style={{ color: C.ink }}>{title}</span>
                            {badge}
                        </span>
                        {subtitle && <span className="mt-0.5 block truncate text-[11.5px] font-medium" style={{ color: C.muted }}>{subtitle}</span>}
                    </span>
                </button>
                {headerRight}
                <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 p-1" aria-label={open ? "Collapse section" : "Expand section"}>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }} />
                </button>
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col gap-4 border-t px-4 py-4 sm:px-5" style={{ borderColor: C.hairSoft }}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}