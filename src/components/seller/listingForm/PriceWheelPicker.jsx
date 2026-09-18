// components/seller/listingForm/PriceWheelPicker.jsx
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

function WheelColumn({ wheel, formatValue }) {
    const { values, selected, containerRef, handleScroll, handleScrollEnd } = wheel;
    const scrollEndTimer = useRef(null);
    const didMountScroll = useRef(false);

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

    return (
        <div className="relative min-w-0 flex-1" style={{ height: WHEEL_HEIGHT }}>
            <div
                className="pointer-events-none absolute inset-x-1.5 z-10 rounded-lg"
                style={{ top: PADDING, height: ITEM_HEIGHT, background: `${C.secondary}0f`, border: `1.5px solid ${C.secondary}35` }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: PADDING, background: "linear-gradient(to bottom, white, rgba(255,255,255,0))" }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10" style={{ height: PADDING, background: "linear-gradient(to top, white, rgba(255,255,255,0))" }} />

            <div
                ref={containerRef}
                onScroll={onScroll}
                data-lenis-prevent=""
                className="hide-scrollbar h-full overflow-y-auto"
                style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                <div style={{ height: PADDING }} />
                {values.map((v) => {
                    const isActive = v === selected;
                    return (
                        <div key={v} style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }} className="flex items-center justify-center px-2">
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
export default function PriceWheelPicker({
    open, onClose, onConfirm,
    initialValue, referenceValue, loadingReference,
    unit = "currency",
    unitLabel = "Pack",
    referenceLabel = "Default price",
    direction = "decrease",
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

    // Locks page/background scroll while this sheet is open. WheelColumn's
    // own container keeps scrolling normally because the check below only
    // blocks events whose target is OUTSIDE this modal's DOM subtree —
    // everything inside modalRef (the wheel columns, step chips, buttons)
    // is left completely alone.
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

        // Stop Lenis directly — this is the piece that was missing. The
        // window-level preventDefault listeners below only fight the
        // browser's native scroll; Lenis runs its own independent wheel/touch
        // handling that doesn't defer to preventDefault, so without this it
        // just keeps smooth-scrolling the page underneath regardless of what
        // the listeners below do. If some OUTER modal (EditListingModal /
        // ListingDetailModal) already called lenis.stop() before this opened,
        // calling it again is a harmless no-op — but we only call lenis.start()
        // on cleanup if WE were the one that stopped it, so we never
        // accidentally re-enable scroll while that outer modal is still open.
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
                            onClick={() => wheel.jumpTo(wheel.selected, s.value)}
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
                    <WheelColumn wheel={wheel} formatValue={formatValue} />
                    <NudgeButton icon={Plus} onClick={() => nudge(1)} />
                </div>

                <button
                    type="button"
                    onClick={() => onConfirm(wheel.selected)}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold tracking-wide text-white"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
                >
                    <Check className="h-4 w-4" /> Use {formatValue(wheel.selected)}
                </button>
            </motion.div>
        </motion.div>
    );
}