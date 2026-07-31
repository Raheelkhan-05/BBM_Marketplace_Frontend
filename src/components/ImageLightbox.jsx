// src/components/ImageLightbox.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useLightboxVisibility } from "./Layout.jsx";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function ImageLightbox({ src, alt, onClose }) {
    const { setLightboxOpen } = useLightboxVisibility();
    const overlayRef = useRef(null);

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });

    const pointers = useRef(new Map());
    const gestureStart = useRef(null); // 2-finger pinch state
    const panStart = useRef(null);     // 1-finger / mouse drag state

    const closeAndReset = useCallback(() => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
        onClose();
    }, [onClose]);

    // Hide the bottom bar, lock page scroll, and block native pinch-zoom
    // on the page — all scoped to this component's lifetime, and always
    // undone on unmount so there's no way to get stuck zoomed or scrolled.
    useEffect(() => {
        setLightboxOpen(true);

        const scrollY = window.scrollY;
        const prevBody = {
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
        };
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";

        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const prevViewportContent = viewportMeta?.getAttribute("content") ?? null;
        if (viewportMeta) {
            viewportMeta.setAttribute(
                "content",
                "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
            );
        }

        return () => {
            setLightboxOpen(false);
            document.body.style.position = prevBody.position;
            document.body.style.top = prevBody.top;
            document.body.style.width = prevBody.width;
            document.body.style.overflow = prevBody.overflow;
            window.scrollTo(0, scrollY);
            if (viewportMeta) {
                if (prevViewportContent != null) viewportMeta.setAttribute("content", prevViewportContent);
                else viewportMeta.removeAttribute("content");
            }
        };
    }, [setLightboxOpen]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && closeAndReset();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [closeAndReset]);

    const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

    // Desktop: scroll wheel / trackpad zooms the image only
    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = clampScale(scale - e.deltaY * 0.01);
        setScale(next);
        if (next === 1) setTranslate({ x: 0, y: 0 });
    };

    const dragState = useRef(null);
    const handleMouseDown = (e) => {
        if (scale <= 1) return;
        dragState.current = { startX: e.clientX, startY: e.clientY, origin: translate };
    };
    const handleMouseMove = (e) => {
        if (!dragState.current) return;
        setTranslate({
            x: dragState.current.origin.x + (e.clientX - dragState.current.startX),
            y: dragState.current.origin.y + (e.clientY - dragState.current.startY),
        });
    };
    const stopDrag = () => { dragState.current = null; };

    const handleDoubleClick = () => {
        setScale((s) => (s > 1 ? 1 : 2.5));
        setTranslate({ x: 0, y: 0 });
    };

    // Mobile: real two-finger pinch + one-finger pan once zoomed
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const handlePointerDown = (e) => {
        overlayRef.current?.setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gestureStart.current = { dist: dist(a, b), scale, midpoint: midpoint(a, b) };
            panStart.current = null;
        } else if (pointers.current.size === 1 && scale > 1) {
            panStart.current = { x: e.clientX, y: e.clientY, origin: translate };
        }
    };

    const handlePointerMove = (e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.current.size === 2 && gestureStart.current) {
            e.preventDefault();
            const [a, b] = [...pointers.current.values()];
            const next = clampScale(gestureStart.current.scale * (dist(a, b) / gestureStart.current.dist));
            setScale(next);
            if (next === 1) setTranslate({ x: 0, y: 0 });
        } else if (pointers.current.size === 1 && panStart.current) {
            e.preventDefault();
            setTranslate({
                x: panStart.current.origin.x + (e.clientX - panStart.current.x),
                y: panStart.current.origin.y + (e.clientY - panStart.current.y),
            });
        }
    };

    const handlePointerUp = (e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) gestureStart.current = null;
        if (pointers.current.size === 0) panStart.current = null;
    };

    return (
        <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === overlayRef.current) closeAndReset(); }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            style={{ touchAction: "none", overscrollBehavior: "contain" }}
        >
            <button
                onClick={closeAndReset}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6 sm:top-6"
                aria-label="Close"
            >
                <X className="h-5 w-5" />
            </button>

            <img
                src={src}
                alt={alt}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onDoubleClick={handleDoubleClick}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                className="max-h-[88vh] max-w-[92vw] select-none rounded-xl object-contain shadow-2xl"
                style={{
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                    transition: dragState.current || pointers.current.size > 0 ? "none" : "transform 0.15s ease-out",
                    cursor: scale > 1 ? "grab" : "zoom-in",
                    touchAction: "none",
                }}
            />
        </motion.div>
    );
}