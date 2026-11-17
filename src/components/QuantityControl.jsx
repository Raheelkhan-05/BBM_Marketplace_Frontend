// components/QuantityControl.jsx
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const INK = "#0B2533", TEAL = "#0E7C86";

/**
 * value / min / max are all in the SAME unit the buyer is ordering in (packs or master packs).
 * max = null means "no stock cap". onChange fires only with a valid, in-range whole number.
 */
export default function QuantityControl({ value, min = 1, max = null, onChange, disabled = false, size = "md", ariaLabel = "Quantity" }) {
    const [text, setText] = useState(String(value));
    const [note, setNote] = useState(null);
    const focused = useRef(false);

    useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
    useEffect(() => {
        if (!note) return undefined;
        const t = setTimeout(() => setNote(null), 2600);
        return () => clearTimeout(t);
    }, [note]);

    const hasMax = max != null && Number.isFinite(Number(max));
    const v = Number(value);
    const h = size === "sm" ? "h-10" : "h-11";
    const btn = size === "sm" ? "h-8 w-8" : "h-9 w-9";

    const commit = (raw) => {
        const n = parseInt(String(raw).replace(/\D/g, ""), 10);
        if (!Number.isFinite(n)) { setText(String(value)); return; }
        let next = n;
        if (n < min) { next = min; setNote(`Minimum order is ${min}`); }
        else if (hasMax && n > max) { next = max; setNote(`Only ${max} available`); }
        setText(String(next));
        if (next !== v) onChange(next);
    };

    const step = (d) => {
        const next = v + d;
        if (next < min) { setNote(`Minimum order is ${min}`); return; }
        if (hasMax && next > max) { setNote(`Only ${max} available`); return; }
        onChange(next);
    };

    return (
        <div className="flex flex-col items-start gap-1">
            <div className={`flex ${h} items-center rounded-full border-[1.5px] p-[2px]`} style={{ borderColor: "#CFE3E5", background: "#F3FAFA", opacity: disabled ? 0.6 : 1 }}>
                <button type="button" aria-label="Decrease quantity" disabled={disabled || v <= min} onClick={() => step(-1)}
                    className={`flex ${btn} shrink-0 items-center justify-center rounded-full transition-transform active:scale-95`}
                    style={v <= min ? { color: "#9DB0B8", cursor: "not-allowed" } : { background: "#fff", color: INK, boxShadow: "0 2px 8px rgba(11,37,51,0.15)" }}>
                    <Minus className="h-4 w-4" strokeWidth={2.6} />
                </button>
                <input
                    type="text" inputMode="numeric" aria-label={ariaLabel} disabled={disabled} value={text}
                    onFocus={(e) => { focused.current = true; e.target.select(); }}
                    onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    onBlur={() => { focused.current = false; commit(text); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                    className={`${h} w-14 min-w-0 bg-transparent text-center text-[16px] font-extrabold tabular-nums focus:outline-none`}
                    style={{ color: INK }}
                />
                <button type="button" aria-label="Increase quantity" disabled={disabled || (hasMax && v >= max)} onClick={() => step(1)}
                    className={`flex ${btn} shrink-0 items-center justify-center rounded-full transition-transform active:scale-95`}
                    style={hasMax && v >= max ? { background: "#9DB0B8", color: "#fff", cursor: "not-allowed" } : { background: TEAL, color: "#fff", boxShadow: "0 4px 10px rgba(14,124,134,0.35)" }}>
                    <Plus className="h-4 w-4" strokeWidth={2.6} />
                </button>
            </div>
            {note && <p role="status" className="px-1 text-[11.5px] font-bold" style={{ color: "#B3261E" }}>{note}</p>}
        </div>
    );
}