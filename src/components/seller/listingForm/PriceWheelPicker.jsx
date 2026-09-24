// components/seller/listingForm/PriceWheelPicker.jsx
//
// CHANGES (this pass):
// - MANUAL ENTRY: tapping the highlighted (centre) value now turns it into
//   a real text input (numeric keyboard on mobile). The seller can type an
//   exact number instead of scrolling. Behaviour:
//     * Typing is sanitised to digits + one dot + max 2 decimals.
//     * Enter  → commits the typed value AND confirms (same as tapping the
//                confirm button), so a typed price is a single-tap flow.
//     * Blur   → commits the typed value onto the wheel (wheel re-centres
//                on it) if it's valid, otherwise reverts to the wheel value.
//     * Esc    → cancels editing, wheel value untouched.
//     * The confirm button always uses the typed value while editing, and
//       refuses (with an inline message) if it's out of range.
//   Validation reuses the same filterFn the wheel already uses, so typed
//   values obey exactly the same bounds as scrolled values
//   (currency > 0, percent within [min, max]).
// - Tapping a non-centre row now scrolls that row to the centre.
// - New optional prop `confirmVerb` (default "Use") so callers whose
//   confirm action commits/saves immediately can label the button
//   accordingly ("Save ₹1,200"). Existing callers are unaffected.
// - The scroller ignores pointer events while typing so an accidental
//   swipe can't fight the keyboard.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLenis } from "../../../providers/SmoothScrollProvider.jsx";
import { X, Minus, Plus, Check } from "lucide-react";
import { C, EASE } from "./FormPrimitives.jsx";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;
const HIGHLIGHT_INSET_X = 10;
const ERROR_RED = "#c71f11";

const CURRENCY_STEPS = [
    { value: 10, label: "₹10" },
    { value: 100, label: "₹100" },
    { value: 1000, label: "₹1,000" },
    { value: 10000, label: "₹10,000" },
];
const PERCENT_STEPS = [
    { value: 0.05, label: "0.05%" },
    { value: 0.1, label: "0.1%" },
    { value: 1, label: "1%" },
    { value: 10, label: "10%" },
];
const PERCENT_DECREASE_MAX = 99;

// Keeps only digits and a single dot, with at most 2 decimal places —
// matches the 2-dp rounding the wheel itself uses for its values.
function sanitizeDecimal(raw) {
    let s = String(raw).replace(/[^\d.]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
    }
    return s.slice(0, 10);
}

// filterFn decides which generated values are valid for this wheel —
// currency: strictly positive; percent decrease: 0..99; percent increase: 0..∞.
function buildValues(anchor, step, span = 60, filterFn) {
    const values = [];
    for (let i = -span; i <= span; i++) {
        const v = Math.round((anchor + i * step) * 100) / 100;
        if (!filterFn || filterFn(v)) values.push(v);
    }
    return values;
}

function useWheelColumn(initialValue, initialStep, filterFn) {
    const [step, setStep] = useState(initialStep);
    const [values, setValues] = useState(() => buildValues(initialValue, initialStep, 60, filterFn));
    const [selected, setSelected] = useState(initialValue);
    const containerRef = useRef(null);
    const rafRef = useRef(null);
    const isProgrammaticScroll = useRef(false);
    const pendingScrollRef = useRef(null);

    useEffect(() => {
        if (pendingScrollRef.current == null) return;
        const target = pendingScrollRef.current;
        const idx = values.findIndex((v) => v === target);
        if (idx >= 0 && containerRef.current) {
            isProgrammaticScroll.current = true;
            containerRef.current.scrollTop = idx * ITEM_HEIGHT;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
            });
        }
        pendingScrollRef.current = null;
    }, [values]);

    const jumpTo = useCallback((targetValue, targetStep) => {
        const useStep = targetStep ?? step;
        const anchor = Math.round(targetValue * 100) / 100;
        setStep(useStep);
        setValues(buildValues(anchor, useStep, 60, filterFn));
        setSelected(anchor);
        pendingScrollRef.current = anchor;
    }, [step, filterFn]);

    const handleScroll = useCallback(() => {
        if (isProgrammaticScroll.current) return;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const el = containerRef.current;
            if (!el) return;
            const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
            const clamped = Math.max(0, Math.min(values.length - 1, idx));
            const val = values[clamped];
            if (val !== undefined && val !== selected) setSelected(val);
        });
    }, [values, selected]);

    // Only ever extends the list with values the filterFn accepts — so once
    // a bound (e.g. 99% on decrease, or 0 on either side) is hit, there's
    // nothing left to prepend/append and the wheel naturally stops growing
    // instead of letting the scroll hijack past a valid range.
    const handleScrollEnd = useCallback(() => {
        if (isProgrammaticScroll.current) return;
        const el = containerRef.current;
        if (!el) return;
        const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(values.length - 1, idx));
        const val = values[clamped];

        if (clamped < 5) {
            setValues((v) => {
                const first = v[0];
                const extra = Array.from({ length: 20 }, (_, i) => Math.round((first - (20 - i) * step) * 100) / 100)
                    .filter((x) => !filterFn || filterFn(x));
                if (!extra.length) return v;
                const addedHeight = extra.length * ITEM_HEIGHT;
                isProgrammaticScroll.current = true;
                requestAnimationFrame(() => {
                    if (containerRef.current) containerRef.current.scrollTop += addedHeight;
                    requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
                });
                return [...extra, ...v];
            });
        } else if (clamped > values.length - 6) {
            setValues((v) => {
                const last = v[v.length - 1];
                const extra = Array.from({ length: 20 }, (_, i) => Math.round((last + (i + 1) * step) * 100) / 100)
                    .filter((x) => !filterFn || filterFn(x));
                if (!extra.length) return v;
                return [...v, ...extra];
            });
        }

        if (val !== undefined) setSelected(val);
    }, [values, step, filterFn]);

    return { values, selected, step, containerRef, handleScroll, handleScrollEnd, jumpTo };
}

function WheelColumn({
    wheel, formatValue,
    editing, draft, hasError, prefix, suffix,
    onDraftChange, onStartEdit, onInputBlur, onEnter, onCancelEdit,
}) {
    const { values, selected, containerRef, handleScroll, handleScrollEnd } = wheel;
    const scrollEndTimer = useRef(null);
    const didMountScroll = useRef(false);
    const inputRef = useRef(null);

    const onScroll = () => {
        handleScroll();
        clearTimeout(scrollEndTimer.current);
        scrollEndTimer.current = setTimeout(() => handleScrollEnd(), 120);
    };

    useEffect(() => {
        if (didMountScroll.current) return;
        didMountScroll.current = true;
        const idx = values.findIndex((v) => v === selected);
        if (containerRef.current && idx >= 0) containerRef.current.scrollTop = idx * ITEM_HEIGHT;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Focus + select-all the moment editing starts, so typing replaces the
    // current value instead of appending to it.
    useEffect(() => {
        if (!editing) return;
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.select();
    }, [editing]);

    const scrollToIndex = (idx) => {
        containerRef.current?.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
    };

    return (
        <div className="relative min-w-0 flex-1" style={{ height: WHEEL_HEIGHT }}>
            <div
                className="pointer-events-none absolute inset-x-1.5 z-10 rounded-lg"
                style={{ top: PADDING, height: ITEM_HEIGHT, background: `${C.secondary}0f`, border: `1.5px solid ${C.secondary}35` }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: PADDING, background: "linear-gradient(to bottom, white, rgba(255,255,255,0))" }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10" style={{ height: PADDING, background: "linear-gradient(to top, white, rgba(255,255,255,0))" }} />

            {/* Manual-entry overlay — sits exactly on the centre highlight. */}
            {editing && (
                <div
                    className="absolute inset-x-1.5 z-20 flex items-center justify-center gap-1 rounded-lg bg-white px-2"
                    style={{ top: PADDING, height: ITEM_HEIGHT, border: `1.5px solid ${hasError ? ERROR_RED : C.secondary}` }}
                >
                    {prefix && <span className="text-[17px] font-extrabold" style={{ color: C.muted }}>{prefix}</span>}
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        autoComplete="off"
                        value={draft}
                        onChange={(e) => onDraftChange(sanitizeDecimal(e.target.value))}
                        onBlur={onInputBlur}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); onEnter(); }
                            else if (e.key === "Escape") { e.preventDefault(); onCancelEdit(); }
                        }}
                        aria-label="Type a value"
                        className="min-w-0 flex-1 bg-transparent text-center font-extrabold tabular-nums tracking-wide focus:outline-none"
                        style={{ fontSize: 21, color: C.ink }}
                    />
                    {suffix && <span className="text-[17px] font-extrabold" style={{ color: C.muted }}>{suffix}</span>}
                </div>
            )}

            <div
                ref={containerRef}
                onScroll={onScroll}
                data-lenis-prevent=""
                className="hide-scrollbar h-full overflow-y-auto"
                style={{
                    scrollSnapType: "y mandatory",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    pointerEvents: editing ? "none" : undefined,
                }}
            >
                <div style={{ height: PADDING }} />
                {values.map((v, i) => {
                    const isActive = v === selected;
                    return (
                        <div
                            key={v}
                            onClick={() => (isActive ? onStartEdit() : scrollToIndex(i))}
                            style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center", cursor: isActive ? "text" : "pointer" }}
                            className="flex items-center justify-center px-2"
                        >
                            <span
                                className="tabular-nums tracking-wide whitespace-nowrap transition-all duration-150"
                                style={{ fontSize: isActive ? 21 : 15, fontWeight: isActive ? 800 : 600, color: isActive ? C.ink : C.muted, opacity: isActive ? 1 : 0.55 }}
                            >
                                {formatValue(v)}
                            </span>
                        </div>
                    );
                })}
                <div style={{ height: PADDING }} />
            </div>
        </div>
    );
}

function NudgeButton({ icon: Icon, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 active:scale-90"
            style={{ borderColor: C.hair, color: C.secondary }}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

// unit: "currency" | "percent"
// For percent mode, direction ("decrease" | "increase") is supplied by the
// caller (e.g. a Decrease/Increase toggle) — this wheel only ever scrolls a
// plain, unsigned magnitude that matches that direction:
//   - decrease: 0% to 99%
//   - increase: 0% and up, no ceiling
//
// `onConfirm(value)` receives the final number (scrolled OR typed).
// `confirmVerb` labels the confirm button ("Use" by default).
export default function PriceWheelPicker({
    open, onClose, onConfirm,
    initialValue, referenceValue, loadingReference,
    unit = "currency",
    unitLabel = "Pack",
    referenceLabel = "Default price",
    direction = "decrease",
    confirmVerb = "Use",
    min,
    max,
}) {
    const isPercent = unit === "percent";
    const isIncrease = isPercent && direction === "increase";
    const stepOptions = isPercent ? PERCENT_STEPS : CURRENCY_STEPS;
    const defaultStep = isPercent ? 1 : 10;

    const percentMin = min != null ? min : 0;
    const percentMax = max != null ? max : (isIncrease ? Infinity : PERCENT_DECREASE_MAX);

    const filterFn = isPercent
        ? (v) => v >= percentMin && v <= percentMax
        : (v) => v > 0;

    const rawSeed = initialValue != null && initialValue !== "" ? Number(initialValue) : 0;
    const seed = isPercent ? Math.min(Math.max(rawSeed, percentMin), percentMax) : rawSeed;

    const wheel = useWheelColumn(seed, defaultStep, filterFn);

    // ---- manual entry state ----
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState("");

    const rangeMessage = isPercent
        ? (Number.isFinite(percentMax)
            ? `Enter a value between ${percentMin}% and ${percentMax}%.`
            : `Enter a value of ${percentMin}% or more.`)
        : "Enter a price greater than ₹0.";

    // Returns the typed number if it's valid for this wheel, else null.
    const parseDraft = () => {
        if (draft.trim() === "" || draft === ".") return null;
        const n = Number(draft);
        if (!Number.isFinite(n)) return null;
        const v = Math.round(n * 100) / 100;
        return filterFn(v) ? v : null;
    };

    const startEdit = () => {
        setDraft(String(wheel.selected));
        setDraftError("");
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setDraftError("");
    };

    // Applies a valid typed value to the wheel (wheel re-centres on it) and
    // leaves edit mode. Returns the value, or null if the draft is invalid.
    const commitDraft = () => {
        const v = parseDraft();
        if (v == null) return null;
        wheel.jumpTo(v, wheel.step);
        setEditing(false);
        setDraftError("");
        return v;
    };

    const handleDraftChange = (next) => {
        setDraft(next);
        if (draftError) setDraftError("");
    };

    // Blur: keep a valid value, silently revert an invalid one.
    const handleInputBlur = () => {
        if (!editing) return;
        if (parseDraft() == null) cancelEdit();
        else commitDraft();
    };

    const handleConfirm = () => {
        if (editing) {
            const v = commitDraft();
            if (v == null) { setDraftError(rangeMessage); return; }
            onConfirm(v);
            return;
        }
        onConfirm(wheel.selected);
    };

    // Locks page/background scroll while this sheet is open. WheelColumn's
    // own container keeps scrolling normally because the check below only
    // blocks events whose target is OUTSIDE this modal's DOM subtree —
    // everything inside modalRef (the wheel columns, step chips, buttons,
    // the manual-entry input) is left completely alone.
    const modalRef = useRef(null);
    const lenis = useLenis();

    useEffect(() => {
        if (!open) return;

        const isInsideModal = (e) => !!modalRef.current && modalRef.current.contains(e.target);

        const blockScroll = (e) => {
            if (!isInsideModal(e)) e.preventDefault();
        };

        const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
        const blockKeyScroll = (e) => {
            if (!SCROLL_KEYS.includes(e.key)) return;
            if (isInsideModal(e)) return;
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
            e.preventDefault();
        };

        // Stop Lenis directly — the window-level preventDefault listeners
        // below only fight the browser's native scroll; Lenis runs its own
        // independent wheel/touch handling. If some OUTER modal already
        // called lenis.stop() before this opened, calling it again is a
        // harmless no-op — but we only call lenis.start() on cleanup if WE
        // were the one that stopped it.
        const weStoppedLenis = !!lenis && typeof lenis.stop === "function";
        if (weStoppedLenis) lenis.stop();

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        window.addEventListener("wheel", blockScroll, { passive: false, capture: true });
        window.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
        window.addEventListener("keydown", blockKeyScroll, { passive: false, capture: true });

        return () => {
            document.body.style.overflow = prevOverflow;
            if (weStoppedLenis && typeof lenis.start === "function") lenis.start();

            window.removeEventListener("wheel", blockScroll, { capture: true });
            window.removeEventListener("touchmove", blockScroll, { capture: true });
            window.removeEventListener("keydown", blockKeyScroll, { capture: true });
        };
    }, [open, lenis]);

    const nudge = (dir) => {
        const el = wheel.containerRef.current;
        if (!el) return;
        el.scrollBy({ top: dir * ITEM_HEIGHT, behavior: "smooth" });
    };

    const jumpToReference = () => {
        if (editing) cancelEdit();
        if (isPercent) {
            wheel.jumpTo(referenceValue != null ? referenceValue : percentMin, wheel.step);
        } else {
            wheel.jumpTo(referenceValue, wheel.step);
        }
    };

    const formatValue = (v) => (isPercent ? `${v}%` : `₹${v.toLocaleString("en-IN")}`);

    if (!open) return null;

    // A bounded percent wheel (min/max both given) is an absolute-value
    // picker (e.g. "pick a commission rate"), not a relative discount/markup
    // — so it gets its own plain copy instead of the "increase/decrease
    // relative to a reference price" language used elsewhere.
    const isBoundedAbsolute = isPercent && min != null && max != null;

    // What the confirm button will submit right now.
    const previewValue = editing ? (parseDraft() ?? wheel.selected) : wheel.selected;

    return (
        <motion.div
            className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                ref={modalRef}
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-t-[24px] bg-white p-5 sm:rounded-[20px]"
            >
                <div className="flex items-center justify-between">
                    <p className="text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>
                        {isBoundedAbsolute ? `Set ${unitLabel.toLowerCase()} %` : isPercent ? `Set % ${isIncrease ? "increase" : "decrease"}` : `Set price per ${unitLabel}`}
                    </p>
                    <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/[0.05]">
                        <X className="h-4 w-4" style={{ color: C.muted }} />
                    </button>
                </div>

                {isBoundedAbsolute ? (
                    <p className="mt-1.5 text-[11.5px] font-semibold leading-snug tracking-wide" style={{ color: C.muted }}>
                        Scroll to choose your rate, from {percentMin}% to {percentMax}%.
                    </p>
                ) : isPercent && (
                    <p className="mt-1.5 text-[11.5px] font-semibold leading-snug tracking-wide" style={{ color: C.muted }}>
                        {isIncrease
                            ? <>Scroll to choose how much to <span style={{ color: C.warn }}>increase</span> this buyer's price, relative to {referenceLabel.toLowerCase()}.</>
                            : <>Scroll to choose how much to <span style={{ color: C.ok }}>decrease</span> this buyer's price (up to {PERCENT_DECREASE_MAX}%), relative to {referenceLabel.toLowerCase()}.</>}
                    </p>
                )}

                {!isPercent && referenceValue > 0 && (
                    <button type="button" onClick={jumpToReference} className="mt-2.5 flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors duration-150 active:scale-[0.99]" style={{ background: `${C.secondary}0a`, border: `1px dashed ${C.secondary}35` }}>
                        <span className="text-[11.5px] font-bold tracking-wide" style={{ color: C.secondary }}>
                            {loadingReference ? "Checking…" : `${referenceLabel}: ₹${referenceValue.toLocaleString("en-IN")}`}
                        </span>
                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: C.secondary }}>Jump here</span>
                    </button>
                )}
                {isBoundedAbsolute && referenceValue != null && (
                    <button type="button" onClick={jumpToReference} className="mt-2.5 flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors duration-150 active:scale-[0.99]" style={{ background: `${C.secondary}0a`, border: `1px dashed ${C.secondary}35` }}>
                        <span className="text-[11.5px] font-bold tracking-wide" style={{ color: C.secondary }}>
                            {referenceLabel}: {referenceValue}%
                        </span>
                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: C.secondary }}>Jump here</span>
                    </button>
                )}
                {isPercent && !isBoundedAbsolute && (
                    <button type="button" onClick={jumpToReference} className="mt-2.5 flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors duration-150 active:scale-[0.99]" style={{ background: `${C.secondary}0a`, border: `1px dashed ${C.secondary}35` }}>
                        <span className="text-[11.5px] font-bold tracking-wide" style={{ color: C.secondary }}>
                            {referenceLabel}: 0% change (₹{referenceValue?.toLocaleString("en-IN")})
                        </span>
                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: C.secondary }}>Jump here</span>
                    </button>
                )}


                <div className="mt-3 flex items-center justify-center gap-1.5">
                    {stepOptions.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            onClick={() => { if (editing) cancelEdit(); wheel.jumpTo(wheel.selected, s.value); }}
                            className="rounded-full border px-3 py-1 text-[11.5px] font-bold tracking-wide transition-colors duration-150"
                            style={wheel.step === s.value
                                ? { borderColor: C.secondary, background: `${C.secondary}14`, color: C.secondary }
                                : { borderColor: C.hair, color: C.muted }}
                        >
                            Step {s.label}
                        </button>
                    ))}
                </div>

                <div className="mt-3 flex w-full items-center justify-center gap-3">
                    <NudgeButton icon={Minus} onClick={() => nudge(-1)} />
                    <WheelColumn
                        wheel={wheel}
                        formatValue={formatValue}
                        editing={editing}
                        draft={draft}
                        hasError={!!draftError}
                        prefix={isPercent ? null : "₹"}
                        suffix={isPercent ? "%" : null}
                        onDraftChange={handleDraftChange}
                        onStartEdit={startEdit}
                        onInputBlur={handleInputBlur}
                        onEnter={handleConfirm}
                        onCancelEdit={cancelEdit}
                    />
                    <NudgeButton icon={Plus} onClick={() => nudge(1)} />
                </div>

                <p
                    className="mt-2 text-center text-[11px] font-semibold leading-snug tracking-wide"
                    style={{ color: draftError ? ERROR_RED : C.muted }}
                >
                    {draftError || (editing ? "Type a value, then tap the button below." : "Tap the highlighted value to type it in.")}
                </p>

                <button
                    type="button"
                    // Prevents the input's blur from firing (and re-rendering)
                    // between pointer-down and click, so the click handler
                    // always sees the typed draft.
                    onMouseDown={(e) => { if (editing) e.preventDefault(); }}
                    onClick={handleConfirm}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold tracking-wide text-white"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
                >
                    <Check className="h-4 w-4" /> {confirmVerb} {formatValue(previewValue)}
                </button>
            </motion.div>
        </motion.div>
    );
}