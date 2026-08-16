// components/seller/ListingFormSections.jsx
//
// Shared building blocks for the seller listing form. Two kinds of
// section:
//   <SectionCard>            — always-expanded card for item-specific data
//                               (Product, Pricing, Quantity, Quality).
//   <DefaultsGroupCard>       — starts COLLAPSED with a one-line summary
//                               pulled from the seller's saved preset (or
//                               a system default), badge "Using your
//                               saved default", and an Edit affordance.
//                               This is the Amazon-style "groups" UX:
//                               Delivery / Tax & Legal / Commercial Terms /
//                               Packaging / Availability rarely change
//                               between listings, so we don't make the
//                               seller re-type them every time.
//
// Both are intentionally dumb/presentational — all state lives in the
// page that uses them (useListingForm-style local state).

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Pencil, Check, Sparkles, Plus, X, Loader2 } from "lucide-react";
import { C } from "../catalog/tokens";

/* ---------------- primitives ---------------- */

export function SectionCard({ icon: Icon, title, subtitle, children, badge }) {
    return (
        <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: C.hair }}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    {Icon && (
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                            <Icon className="h-4 w-4" />
                        </span>
                    )}
                    <div>
                        <h3 className="text-[14.5px] font-extrabold" style={{ color: C.ink }}>{title}</h3>
                        {subtitle && <p className="mt-0.5 text-[12px] font-medium" style={{ color: C.muted }}>{subtitle}</p>}
                    </div>
                </div>
                {badge}
            </div>
            <div className="mt-4 flex flex-col gap-4">{children}</div>
        </div>
    );
}

// Collapsed summary + expandable editor, with a "using saved default"
// badge and a "save changes as my default" toggle when edited.
export function DefaultsGroupCard({
    icon: Icon, title, subtitle, summaryLines, presetName, isSystemDefault,
    open, onToggleOpen, onSaveAsDefault, savingDefault, children,
}) {
    const [rememberChoice, setRememberChoice] = useState(true);

    return (
        <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.hair }}>
            <button
                type="button"
                onClick={onToggleOpen}
                className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5"
            >
                <div className="flex items-start gap-2.5">
                    {Icon && (
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                            <Icon className="h-4 w-4" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-[14.5px] font-extrabold" style={{ color: C.ink }}>{title}</h3>
                            <span
                                className="flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wide"
                                style={{ background: isSystemDefault ? C.hairSoft : `${C.secondary}12`, color: isSystemDefault ? C.muted : C.secondary }}
                            >
                                {!isSystemDefault && <Sparkles className="h-2.5 w-2.5" />}
                                {isSystemDefault ? "Standard default" : `Your default${presetName ? ` · ${presetName}` : ""}`}
                            </span>
                        </div>
                        {subtitle && !open && <p className="mt-0.5 text-[12px] font-medium" style={{ color: C.muted }}>{subtitle}</p>}
                        {!open && summaryLines?.length > 0 && (
                            <p className="mt-1 truncate text-[12.5px] font-semibold" style={{ color: C.ink }}>
                                {summaryLines.filter(Boolean).join(" · ")}
                            </p>
                        )}
                    </div>
                </div>
                <span className="mt-1 flex shrink-0 items-center gap-1 text-[11.5px] font-bold" style={{ color: C.secondary }}>
                    {open ? <>Close <ChevronDown className="h-3.5 w-3.5 rotate-180 transition-transform" /></> : <>Edit <Pencil className="h-3 w-3" /></>}
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-4 sm:px-5 sm:pb-5" style={{ borderColor: C.hairSoft }}>
                            {children}

                            <label className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: C.muted }}>
                                <input type="checkbox" checked={rememberChoice} onChange={(e) => setRememberChoice(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                                Save these as my default for future listings
                            </label>
                            <button
                                type="button"
                                onClick={() => onSaveAsDefault?.(rememberChoice)}
                                disabled={savingDefault}
                                className="flex items-center justify-center gap-1.5 self-start rounded-lg px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
                                style={{ background: C.secondary }}
                            >
                                {savingDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Done editing this section
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function Field({ label, hint, required, children }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                {label} {required && <span style={{ color: C.primary }}>*</span>}
            </label>
            {children}
            {hint && <p className="text-[11px] font-medium" style={{ color: C.muted }}>{hint}</p>}
        </div>
    );
}

const inputClass = "w-full rounded-lg border-2 bg-white px-3 py-2.5 text-[13.5px] font-semibold focus:outline-none focus:ring-4";
const inputStyle = { borderColor: C.hairSoft, color: C.ink, "--tw-ring-color": `${C.secondary}20` };

export function TextInput(props) {
    return <input {...props} className={inputClass} style={inputStyle} />;
}
export function SelectInput({ children, ...props }) {
    return <select {...props} className={inputClass} style={inputStyle}>{children}</select>;
}
export function TextArea(props) {
    return <textarea {...props} rows={props.rows || 3} className={`${inputClass} resize-none`} style={inputStyle} />;
}

export function Toggle({ checked, onChange, label }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex items-center gap-2.5 text-left"
        >
            <span
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
                style={{ background: checked ? C.secondary : C.hair }}
            >
                <motion.span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                    animate={{ left: checked ? 22 : 2 }}
                    transition={{ duration: 0.15 }}
                />
            </span>
            {label && <span className="text-[13px] font-bold" style={{ color: C.ink }}>{label}</span>}
        </button>
    );
}

/* ---------------- Key/value spec editor ---------------- */

export function KeyValueEditor({ rows, onChange, keyPlaceholder = "e.g. Material", valuePlaceholder = "e.g. Stainless Steel 304" }) {
    const update = (i, field, val) => {
        const next = rows.slice();
        next[i] = { ...next[i], [field]: val };
        onChange(next);
    };
    const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
    const add = () => onChange([...rows, { key: "", value: "" }]);

    return (
        <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input value={row.key} onChange={(e) => update(i, "key", e.target.value)} placeholder={keyPlaceholder}
                        className="w-2/5 rounded-lg border-2 px-2.5 py-2 text-[12.5px] font-semibold" style={inputStyle} />
                    <input value={row.value} onChange={(e) => update(i, "value", e.target.value)} placeholder={valuePlaceholder}
                        className="flex-1 rounded-lg border-2 px-2.5 py-2 text-[12.5px] font-semibold" style={inputStyle} />
                    <button type="button" onClick={() => remove(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/[0.04]">
                        <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                </div>
            ))}
            <button type="button" onClick={add} className="flex w-fit items-center gap-1 text-[12px] font-bold" style={{ color: C.secondary }}>
                <Plus className="h-3.5 w-3.5" /> Add specification
            </button>
        </div>
    );
}

/* ---------------- quantity price-slab editor ---------------- */

export function QtySlabEditor({ slabs, onChange, unit }) {
    const update = (i, field, val) => {
        const next = slabs.slice();
        next[i] = { ...next[i], [field]: val };
        onChange(next);
    };
    const remove = (i) => onChange(slabs.filter((_, idx) => idx !== i));
    const add = () => onChange([...slabs, { min_qty: "", max_qty: "", price: "" }]);

    return (
        <div className="flex flex-col gap-2">
            {slabs.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                    <input value={s.min_qty} onChange={(e) => update(i, "min_qty", e.target.value)} placeholder={`Min ${unit || "qty"}`}
                        inputMode="decimal" className="rounded-lg border-2 px-2.5 py-2 text-[12.5px] font-semibold" style={inputStyle} />
                    <input value={s.max_qty} onChange={(e) => update(i, "max_qty", e.target.value)} placeholder={`Max ${unit || "qty"}`}
                        inputMode="decimal" className="rounded-lg border-2 px-2.5 py-2 text-[12.5px] font-semibold" style={inputStyle} />
                    <input value={s.price} onChange={(e) => update(i, "price", e.target.value)} placeholder="₹ / unit"
                        inputMode="decimal" className="rounded-lg border-2 px-2.5 py-2 text-[12.5px] font-semibold" style={inputStyle} />
                    <button type="button" onClick={() => remove(i)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04]">
                        <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                </div>
            ))}
            <button type="button" onClick={add} className="flex w-fit items-center gap-1 text-[12px] font-bold" style={{ color: C.secondary }}>
                <Plus className="h-3.5 w-3.5" /> Add quantity slab
            </button>
        </div>
    );
}