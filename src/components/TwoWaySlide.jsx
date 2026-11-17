// components/TwoWaySlide.jsx — drag LEFT = left action, drag RIGHT = right action.
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const KNOB = 40;
const PAD = 4;

export default function TwoWaySlide({
    leftLabel, rightLabel, onLeft, onRight,
    disabled = false, busy = false, leftColor = "#0E7C86", rightColor = "#D8420F",
}) {
    const trackRef = useRef(null);
    const x = useMotionValue(0);
    const [maxX, setMaxX] = useState(0);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return undefined;
        const measure = () => setMaxX(Math.max(0, (el.offsetWidth - KNOB - PAD * 2) / 2));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const m = Math.max(maxX, 1);
    const knobBg = useTransform(x, [-m, 0, m], [leftColor, "#0B2533", rightColor]);
    const leftOpacity = useTransform(x, [-m, 0], [0, 1]);
    const rightOpacity = useTransform(x, [0, m], [1, 0]);
    const locked = disabled || busy;

    return (
        <div
            ref={trackRef}
            data-swipe-buy=""
            className="relative h-12 w-full select-none overflow-hidden rounded-full"
            style={{ background: "#EDF3F4", opacity: disabled ? 0.5 : 1 }}
            onClick={(e) => e.stopPropagation()}
        >
            <motion.span
                className="pointer-events-none absolute left-4 top-0 flex h-full items-center gap-1 text-[20px] font-extrabold tracking-wide"
                style={{ color: leftColor, opacity: leftOpacity }}
            >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.8} /> {leftLabel}
            </motion.span>
            <motion.span
                className="pointer-events-none absolute right-4 top-0 flex h-full items-center gap-1 text-[20px] font-extrabold tracking-wide"
                style={{ color: rightColor, opacity: rightOpacity }}
            >
                {rightLabel} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.8} />
            </motion.span>

            <motion.div
                drag={locked ? false : "x"}
                dragConstraints={{ left: -maxX, right: maxX }}
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={() => {
                    const v = x.get();
                    if (maxX > 0 && v <= -maxX * 0.85) onLeft?.();
                    else if (maxX > 0 && v >= maxX * 0.85) onRight?.();
                    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
                }}
                className="absolute flex items-center justify-center rounded-full text-white"
                style={{
                    x, top: PAD, left: "50%", marginLeft: -KNOB / 2, width: KNOB, height: KNOB,
                    background: knobBg, boxShadow: "0 4px 10px -4px rgba(11,37,51,0.6)",
                    cursor: locked ? "not-allowed" : "grab", touchAction: "pan-y",
                }}
            >
                {busy
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <span className="flex items-center"><ChevronLeft className="-mr-1.5 h-4 w-4" strokeWidth={2.8} /><ChevronRight className="h-4 w-4" strokeWidth={2.8} /></span>}
            </motion.div>
        </div>
    );
}