// components/seller/listingForm/FormPrimitives.jsx — RESTYLED to match
// the Home / SellerManageListingsPage visual language: same C tokens,
// compact uppercase-caption labels (like QuickField), rounded-xl inputs,
// rounded-2xl cards, hairline borders, tabular-nums, framer-motion entrance.
import { useState, useRef, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Trash2, Info, Check, X } from "lucide-react";

export const C = {
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)",
    hairSoft: "rgba(11,17,22,0.05)",
    danger: "#c71f11",
};

export const EASE = [0.16, 1, 0.3, 1];

// Compact uppercase caption label — same idiom as QuickField in
// SellerManageListingsPage, so every field in the app reads the same way.
export function Label({ children, hint }) {
    const [showHint, setShowHint] = useState(false);
    const wrapperRef = useRef(null);
    const tooltipId = useId();

    useEffect(() => {
        if (!showHint) return;

        const handleOutsideClick = (e) => {
            if (!wrapperRef.current?.contains(e.target)) {
                setShowHint(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setShowHint(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showHint]);

    if (!hint) {
        return (
            <span className="flex items-center gap-1.5">
                <span
                    className="text-[12.5px] font-extrabold uppercase"
                    style={{
                        color: "#4A535B",
                        letterSpacing: "0.08em",
                    }}
                >
                    {children}
                </span>
            </span>
        );
    }

    return (
        <span
            ref={wrapperRef}
            className="relative flex w-fit items-center gap-1.5"
        >
            <span
                className="text-[12.5px] font-extrabold uppercase"
                style={{
                    color: "#4A535B",
                    letterSpacing: "0.08em",
                }}
            >
                {children}
            </span>

            <button
                type="button"
                onClick={() => setShowHint((s) => !s)}
                className="flex h-5 w-5 shrink-0 touch-manipulation items-center justify-center rounded-full transition-colors hover:bg-black/5 active:bg-black/10"
                aria-label={`More information about ${children}`}
                aria-expanded={showHint}
                aria-describedby={showHint ? tooltipId : undefined}
            >
                <Info
                    className="h-3.5 w-3.5"
                    style={{ color: C.muted }}
                    aria-hidden="true"
                />
            </button>

            <AnimatePresence>
                {showHint && (
                    <motion.div
                        id={tooltipId}
                        role="tooltip"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="
                            absolute
                            left-0
                            top-full
                            z-[100]
                            mt-2
                            w-[min(18rem,calc(100vw-2rem))]
                            rounded-lg
                            px-3
                            py-2
                            text-[13.5px]
                            tracking-wide
                            font-medium
                            leading-snug
                            text-white
                            shadow-lg
                        "
                        style={{ background: C.ink }}
                    >
                        {hint}

                        <span
                            className="absolute -top-1.5 left-3 h-3 w-3 rotate-45"
                            style={{ background: C.ink }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
}

// Shared border/ring style so every field control looks the same whether
// it's untouched, valid, or (after blur) missing.
function fieldTone(error) {
    if (error) return { borderColor: "#f2b3ab", ["--tw-ring-color"]: `${C.danger}1a`, background: "#fff8f7" };
    return { borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` };
}

export function TextField({ label, value, onChange, onBlur, placeholder, inputMode, type = "text", hint, required, disabled, error, dense, halfOnMobile, tinyOnMobile }) {
    const widthClass = tinyOnMobile ? "w-[4.5rem] sm:w-full" : halfOnMobile ? "w-1/2 sm:w-full" : "w-full";
    return (
        <div className="flex min-w-0 flex-col gap-1">
            {label && <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>}
            <div className={widthClass}>
                <input
                    type={type}
                    value={value ?? ""}
                    inputMode={inputMode}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className={`w-full rounded-lg border tracking-wide bg-white ${dense ? "px-2.5 py-1.5 text-[14.5px]" : "px-3 py-2 text-[14.5px]"} font-bold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:opacity-60`}
                    style={{ color: C.ink, ...fieldTone(error) }}
                />
            </div>
        </div>
    );
}

export function Label2({ children, hint }) {
    const [showHint, setShowHint] = useState(false);
    const wrapperRef = useRef(null);
    const tooltipId = useId();

    useEffect(() => {
        if (!showHint) return;

        const handleOutsideClick = (e) => {
            if (!wrapperRef.current?.contains(e.target)) {
                setShowHint(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setShowHint(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showHint]);

    return (
        <span
            ref={wrapperRef}
            className="relative flex h-5 w-fit items-end gap-1.5"
        >
            <span
                className="text-[10.5px] font-extrabold uppercase leading-none"
                style={{
                    color: "#4A535B",
                    letterSpacing: "0.08em",
                }}
            >
                {children}
            </span>

            {hint && (
                <button
                    type="button"
                    onClick={() => setShowHint((s) => !s)}
                    className="flex h-5 w-5 shrink-0 touch-manipulation items-center justify-center rounded-full transition-colors hover:bg-black/5 active:bg-black/10"
                    aria-label={`More information about ${children}`}
                    aria-expanded={showHint}
                    aria-describedby={showHint ? tooltipId : undefined}
                >
                    <Info
                        className="h-3.5 w-3.5"
                        style={{ color: C.muted }}
                        aria-hidden="true"
                    />
                </button>
            )}

            <AnimatePresence>
                {hint && showHint && (
                    <motion.div
                        id={tooltipId}
                        role="tooltip"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="
                            absolute
                            left-0
                            top-full
                            z-[100]
                            mt-2
                            w-[min(18rem,calc(100vw-2rem))]
                            rounded-lg
                            px-3
                            py-2
                            text-[13.5px]
                            tracking-wide
                            font-medium
                            leading-snug
                            text-white
                            shadow-lg
                        "
                        style={{ background: C.ink }}
                    >
                        {hint}
                        <span
                            className="absolute -top-1.5 left-3 h-3 w-3 rotate-45"
                            style={{ background: C.ink }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
}

export function TextField2({ label, value, onChange, onBlur, placeholder, inputMode, type = "text", hint, required, disabled, error, dense, halfOnMobile, tinyOnMobile, prefix }) {
    const widthClass = tinyOnMobile ? "w-[4.5rem] sm:w-full" : halfOnMobile ? "w-1/2 sm:w-full" : "w-full";
    return (
        <div className="flex min-w-0 flex-col items-stretch justify-end gap-1 h-full">
            {label && <Label2>{label}</Label2>}
            <div className={`relative flex items-center ${widthClass}`}>
                {prefix && (
                    <span
                        className="pointer-events-none absolute left-2.5 text-[14.5px] font-bold"
                        style={{ color: C.muted }}
                    >
                        {prefix}
                    </span>
                )}
                <input
                    type={type}
                    value={value ?? ""}
                    inputMode={inputMode}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className={`w-full rounded-lg border tracking-wide bg-white ${dense ? "py-1.5 text-[14.5px]" : "py-2 text-[14.5px]"} font-bold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:opacity-60`}
                    style={{
                        color: C.ink,
                        paddingLeft: prefix ? "20px" : (dense ? "10px" : "12px"),
                        paddingRight: dense ? "10px" : "12px",
                        ...fieldTone(error),
                    }}
                />
            </div>
        </div>
    );
}
export function TextAreaField({ label, value, onChange, onBlur, placeholder, hint, required, rows = 2, error }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
            <textarea
                value={value ?? ""}
                placeholder={placeholder}
                rows={rows}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[14.5px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 tracking-wide"
                style={{ color: C.ink, ...fieldTone(error) }}
            />
        </div>
    );
}

// Custom SelectField — replaces the native <select>. On mobile (<640px)
// it opens as a bottom sheet sliding up to 75vh, matching the app's other
// modal language (BuyNowModal etc). On desktop it's a normal floating
// dropdown panel anchored under the trigger. Same external API as before
// (label, value, onChange, onBlur, options, hint, required, placeholder,
// error, dense) so no caller needs to change.
export function SelectField({ label, value, onChange, onBlur, options, hint, required, placeholder = "Select…", error, dense, halfOnMobile }) {
    const [open, setOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        if (!open || isMobile) return;
        const handleOutside = (e) => {
            if (!wrapperRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [open, isMobile]);

    const selectedOption = options.find((o) => (o.value ?? o) === value);
    const selectedLabel = selectedOption ? (selectedOption.label ?? selectedOption) : null;

    const handleSelect = (optValue) => {
        onChange(optValue);
        setOpen(false);
        onBlur?.();
    };
    const closeAndBlur = () => { setOpen(false); onBlur?.(); };

    return (
        <div className="relative flex min-w-0 flex-col gap-1" ref={wrapperRef}>
            {label && <Label hint={hint}>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>}

            <div className={halfOnMobile ? "relative w-1/2 sm:w-full" : "relative w-full"}>
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className={`flex w-full items-center justify-between rounded-lg border bg-white tracking-wide ${dense ? "px-2.5 py-1.5 text-[14.5px]" : "px-3 py-2.5 text-[15px]"} font-bold focus:outline-none focus:ring-2`}
                    style={{ color: selectedLabel ? C.ink : "#94a3b8", ...fieldTone(error) }}
                >
                    <span className="truncate">{selectedLabel || placeholder}</span>
                    <ChevronDown className="h-4 w-4 shrink-0" style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>

                <AnimatePresence>
                    {open && isMobile && (
                        <motion.div
                            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-[1px]"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeAndBlur}
                        >
                            <motion.div
                                className="flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white"
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                transition={{ duration: 0.28, ease: EASE }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: C.hairSoft }}>
                                    <span className="text-[15.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{label || "Select"}</span>
                                    <button type="button" onClick={closeAndBlur} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: C.hairSoft }}>
                                        <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-2 py-2">
                                    {options.map((o) => {
                                        const optValue = o.value ?? o;
                                        const optLabel = o.label ?? o;
                                        const active = optValue === value;
                                        return (
                                            <button
                                                key={optValue}
                                                type="button"
                                                onClick={() => handleSelect(optValue)}
                                                className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-[14.5px] font-semibold tracking-wider"
                                                style={active ? { background: `${C.secondary}12`, color: C.secondary } : { color: C.ink }}
                                            >
                                                {optLabel}
                                                {active && <Check className="h-4 w-4" style={{ color: C.secondary }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {open && !isMobile && (
                        <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: EASE }}
                            className="absolute left-0 top-full z-[100] mt-1 max-h-64 w-full min-w-[180px] overflow-y-auto rounded-xl border bg-white py-1.5 shadow-lg"
                            style={{ borderColor: C.hair }}
                        >
                            {options.map((o) => {
                                const optValue = o.value ?? o;
                                const optLabel = o.label ?? o;
                                const active = optValue === value;
                                return (
                                    <button
                                        key={optValue}
                                        type="button"
                                        onClick={() => handleSelect(optValue)}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] font-bold tracking-wide transition-colors duration-100 hover:bg-black/[0.03]"
                                        style={active ? { color: C.secondary, background: `${C.secondary}0c` } : { color: C.ink }}
                                    >
                                        {optLabel}
                                        {active && <Check className="h-3.5 w-3.5" style={{ color: C.secondary }} />}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export function ToggleField({ label, value, onChange, hint, onLabel = "Yes", offLabel = "No" }) {
    return (
        <div className="flex flex-col gap-1">
            <Label hint={hint}>{label}</Label>
            <div className="flex gap-1 rounded-lg p-1" style={{ background: C.hairSoft, width: "fit-content" }}>
                {[{ v: true, t: onLabel }, { v: false, t: offLabel }].map(({ v, t }) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onChange(v)}
                        className="rounded-md px-3 py-0.5 text-[13.5px] tracking-wider font-bold transition-colors duration-150"
                        style={value === v ? { background: C.secondary, color: "#fff" } : { color: C.muted }}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ToggleField3({ label, value, onChange, hint, onLabel = "Yes", offLabel = "No" }) {
    return (
        <div className="flex flex-col gap-1 self-end justify-end align-end">
            <Label hint={hint}>{label}</Label>
            <div className="flex gap-1 rounded-lg p-1 self-end justify-end align-end" style={{ background: C.hairSoft, width: "fit-content" }}>
                {[{ v: true, t: onLabel }, { v: false, t: offLabel }].map(({ v, t }) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onChange(v)}
                        className="rounded-md px-3 py-0.5 text-[13.5px] tracking-wider font-bold transition-colors duration-150"
                        style={value === v ? { background: C.secondary, color: "#fff" } : { color: C.muted }}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ChipToggleGroup({ label, value, onChange, options, hint, dense }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            {label && <Label hint={hint}>{label}</Label>}
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                    const optValue = o.value ?? o;
                    const active = value === optValue;
                    return (
                        <button
                            key={optValue}
                            type="button"
                            onClick={() => onChange(optValue)}
                            className={`rounded-full border tracking-wide ${dense ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[12px]"} font-bold transition-colors duration-150`}
                            style={active
                                ? { borderColor: C.secondary, background: `${C.secondary}14`, color: C.secondary }
                                : { borderColor: C.hair, color: C.muted, background: "#fff" }}
                        >
                            {o.label ?? o}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function RepeatableRows({ label, hint, rows, columns, onChange, addLabel = "Add row" }) {
    const update = (idx, key, val) => {
        const next = rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
        onChange(next);
    };
    const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));
    const add = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))]);

    return (
        <div className="flex flex-col gap-1.5">
            <Label hint={hint}>{label}</Label>
            {rows.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                            {columns.map((c) => (
                                <input
                                    key={c.key}
                                    value={row[c.key] ?? ""}
                                    placeholder={c.placeholder}
                                    inputMode={c.inputMode}
                                    onChange={(e) => update(idx, c.key, e.target.value)}
                                    className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[14px] font-bold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 tracking-wide"
                                    style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }}
                                />
                            ))}
                            <button type="button" onClick={() => remove(idx)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" style={{ color: C.danger }} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={add}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-[13px] font-bold transition-colors duration-150 hover:bg-black/[0.02] tracking-wide"
                style={{ borderColor: C.hair, color: C.secondary }}
            >
                <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
        </div>
    );
}

export function RepeatableRows2({ label, hint, rows, columns, onChange, addLabel = "Add row" }) {
    const update = (idx, key, val) => {
        const next = rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
        onChange(next);
    };
    const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));
    const add = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))]);

    return (
        <div className="flex flex-col gap-1.5">
            <Label hint={hint}>{label}</Label>
            {rows.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                            {columns.map((c) => {
                                const suffixText = typeof c.suffix === "function" ? c.suffix(row) : c.suffix;
                                return (
                                    <div
                                        key={c.key}
                                        className="relative min-w-0"
                                        style={{ flex: c.flex ?? 1 }}
                                    >
                                        <input
                                            value={row[c.key] ?? ""}
                                            placeholder={c.placeholder}
                                            inputMode={c.inputMode}
                                            onChange={(e) => update(idx, c.key, e.target.value)}
                                            className="w-full min-w-0 rounded-lg border py-1.5 pl-2.5 text-[12px] font-bold placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 tracking-wide"
                                            style={{
                                                borderColor: C.hair,
                                                color: C.ink,
                                                paddingRight: suffixText ? `${suffixText.length * 5.5 + 12}px` : "10px",
                                                ["--tw-ring-color"]: `${C.secondary}22`,
                                            }}
                                        />
                                        {suffixText && row[c.key] !== "" && row[c.key] != null && (
                                            <span
                                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold tracking-wide"
                                                style={{ color: C.muted }}
                                            >
                                                {suffixText}
                                            </span>
                                        )}
                                    </div>
                                );

                            })}
                            <button type="button" onClick={() => remove(idx)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" style={{ color: C.danger }} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={add}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-[13px] font-bold transition-colors duration-150 hover:bg-black/[0.02] tracking-wide"
                style={{ borderColor: C.hair, color: C.secondary }}
            >
                <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
        </div>
    );
}

// SectionCard — pass `alwaysOpen` for a card that's never collapsible
// (no chevron, no click target, content always rendered).
export function SectionCard({ icon: Icon, title, subtitle, defaultOpen, headerRight, children, open, onOpenChange, id, alwaysOpen }) {
    const [internalOpen, setInternalOpen] = useState(!!defaultOpen);
    const isControlled = open !== undefined;
    const isOpen = alwaysOpen ? true : (isControlled ? open : internalOpen);
    const toggle = () => {
        if (alwaysOpen) return;
        if (isControlled) onOpenChange?.(!isOpen);
        else setInternalOpen((o) => !o);
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            id={id}
            className="overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: C.hair }}
        >
            <div className="flex w-full items-center gap-2.5 px-3.5 py-3 sm:px-4">
                <button type="button" onClick={toggle} disabled={alwaysOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${C.secondary}14`, color: C.secondary }}>
                        <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-extrabold leading-tight tracking-wide" style={{ color: C.ink }}>{title}</span>
                        {subtitle && <span className="mt-0 block truncate text-[12.5px] tracking-wide font-semibold" style={{ color: C.muted }}>{subtitle}</span>}
                    </span>
                </button>
                {headerRight}
                {!alwaysOpen && (
                    <button type="button" onClick={toggle} className="shrink-0 rounded-full p-1.5 transition-colors duration-150 hover:bg-black/[0.05]">
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ color: C.muted, transform: isOpen ? "rotate(180deg)" : "none" }} />
                    </button>
                )}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        style={{ overflow: "hidden" }}
                    >
                        <div className="flex flex-col gap-3 border-t px-3.5 py-3.5 sm:px-4" style={{ borderColor: C.hairSoft }}>{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Small status pill for section headers — "Auto-filled", "Optional", etc.
export function Pill({ children, tone = "muted" }) {
    const tones = {
        muted: { background: C.hairSoft, color: C.muted },
        good: { background: `${C.secondary}14`, color: C.secondary },
        warn: { background: "#fef3c7", color: "#a16207" },
    };
    return (
        <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={tones[tone] || tones.muted}>
            {children}
        </span>
    );
}

// Thin, animated completion bar for the sticky footer.
export function Progress({ percent }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.hairSoft }}>
            <motion.div
                className="h-full rounded-full"
                style={{ background: percent >= 100 ? C.secondary : C.primary }}
                initial={false}
                animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                transition={{ duration: 0.25, ease: EASE }}
            />
        </div>
    );
}

export function CompletedBadge() {
    return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: C.secondary }}>
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
    );
}


export function ToggleField2({ label, value, onChange, hint, onLabel = "Yes", offLabel = "No", infoBlock }) {
    return (
        <div className="flex flex-col">
            <Label hint={hint}>{label}</Label>
            {infoBlock}
            <div className="flex gap-1 rounded-lg p-1" style={{ background: C.hairSoft, width: "fit-content" }}>
                {[{ v: true, t: onLabel }, { v: false, t: offLabel }].map(({ v, t }) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onChange(v)}
                        className="rounded-md px-3 py-0.5 text-[13.5px] tracking-wider font-bold transition-colors duration-150"
                        style={value === v ? { background: C.secondary, color: "#fff" } : { color: C.muted }}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}