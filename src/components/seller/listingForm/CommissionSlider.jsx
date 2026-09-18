import React, { useState, useRef, useCallback } from "react";
import { IndianRupee } from "lucide-react";
import { C } from "./FormPrimitives";

const MIN = 0.25;
const MAX = 100;

function clamp(n, min, max) {
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function CommissionSlider({ value, onChange, C, isErr }) {
    // value: number | "" — the committed value from form state
    // local text lets the user type freely (e.g. "12." or "0.") without
    // getting clamped/reformatted on every keystroke
    const [text, setText] = useState(value === "" ? "" : String(value));
    const [dragging, setDragging] = useState(false);
    const syncedValueRef = useRef(value);

    // Keep the text field in sync when value changes from outside
    // (e.g. a chip toggle sets the same form field), but don't fight
    // the user while they're actively typing.
    if (syncedValueRef.current !== value && document.activeElement?.dataset?.commissionInput !== "true") {
        syncedValueRef.current = value;
        if (text !== (value === "" ? "" : String(value))) {
            setText(value === "" ? "" : String(value));
        }
    }

    const commit = useCallback(
        (raw) => {
            const n = clamp(parseFloat(raw), MIN, MAX);
            const rounded = Math.round(n * 100) / 100; // keep up to 2 decimals
            onChange(rounded);
            setText(String(rounded));
            syncedValueRef.current = rounded;
        },
        [onChange]
    );

    const handleSliderChange = (e) => {
        const n = parseFloat(e.target.value);
        onChange(n);
        setText(String(n));
        syncedValueRef.current = n;
    };

    const handleTextChange = (e) => {
        const raw = e.target.value;
        // allow empty, digits, one decimal point while typing
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
            setText(raw);
            const n = parseFloat(raw);
            if (!Number.isNaN(n) && n >= MIN && n <= MAX) {
                onChange(n);
                syncedValueRef.current = n;
            }
        }
    };

    const handleTextBlur = () => {
        if (text === "" || Number.isNaN(parseFloat(text))) {
            commit(MIN);
        } else {
            commit(text);
        }
    };

    const sliderValue = value === "" ? MIN : clamp(Number(value), MIN, MAX);
    const pct = ((sliderValue - MIN) / (MAX - MIN)) * 100;

    return (
        <div
            className="flex flex-col gap-2.5 rounded-2xl border p-3"
            style={{
                borderColor: isErr ? "rgba(199,31,17,0.35)" : C.hairSoft,
                background: `${C.secondary}06`,
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>
                        Promotion & Visibility Budget <span style={{ color: C.primary }}>*</span>
                    </span>
                    <span className="text-[10px] font-medium leading-snug tracking-wider" style={{ color: C.muted }}>
                        Platform fee deducted from your payout on every order
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5" style={{ background: `${C.muted}14` }}>
                    <input
                        data-commission-input="true"
                        type="text"
                        inputMode="decimal"
                        value={text}
                        onChange={handleTextChange}
                        onBlur={handleTextBlur}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-[52px] bg-transparent text-right text-[18px] font-extrabold leading-none tabular-nums outline-none"
                        style={{ color: C.muted }}
                    />
                    <span className="text-[18px] font-extrabold leading-none" style={{ color: C.muted }}>
                        %
                    </span>
                </div>
            </div>

            {/* Slider row: left = slider, right = live value already shown above,
                 this row is purely the drag control */}
            <div className="flex items-center gap-3 px-0.5">
                <span className="w-8 shrink-0 text-[10px] font-bold tabular-nums" style={{ color: C.muted }}>
                    {MIN}%
                </span>
                <div className="relative flex h-6 flex-1 items-center">
                    {/* track */}
                    <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: `${C.secondary}18` }} />
                    {/* filled portion */}
                    <div
                        className="absolute h-1.5 rounded-full"
                        style={{ width: `${pct}%`, background: C.secondary }}
                    />
                    <input
                        type="range"
                        min={MIN}
                        max={MAX}
                        step={0.25}
                        value={sliderValue}
                        onChange={handleSliderChange}
                        onMouseDown={() => setDragging(true)}
                        onMouseUp={() => setDragging(false)}
                        onTouchStart={() => setDragging(true)}
                        onTouchEnd={() => setDragging(false)}
                        className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent"
                        style={{
                            // WebKit thumb
                            WebkitAppearance: "none",
                        }}
                    />
                    <style>{`
                        input[type="range"]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            width: 18px;
                            height: 18px;
                            border-radius: 9999px;
                            background: ${C.secondary};
                            border: 2px solid white;
                            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
                            cursor: pointer;
                            transition: transform 120ms ease;
                            transform: scale(${dragging ? 1.15 : 1});
                        }
                        input[type="range"]::-moz-range-thumb {
                            width: 18px;
                            height: 18px;
                            border-radius: 9999px;
                            background: ${C.secondary};
                            border: 2px solid white;
                            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
                            cursor: pointer;
                        }
                        input[type="range"]::-moz-range-track {
                            background: transparent;
                        }
                    `}</style>
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums" style={{ color: C.muted }}>
                    {MAX}%
                </span>
            </div>

            {isErr && (
                <p className="text-[11px] font-bold" style={{ color: "#c71f11" }}>
                    Choose a commission % between 0.25 and 100.
                </p>
            )}
        </div>
    );
}

export default CommissionSlider;