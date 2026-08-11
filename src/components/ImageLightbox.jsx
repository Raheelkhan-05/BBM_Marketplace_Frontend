// src/components/ImageLightbox.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLightboxVisibility } from "./Layout.jsx";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Accepts either:
//   <ImageLightbox src="url" alt="..." onClose={...} />                (single image, old behavior)
//   <ImageLightbox images={["url1","url2"]} alt="..." onClose={...} /> (gallery)
export default function ImageLightbox({ src, images, alt, initialIndex = 0, onClose }) {
    const { setLightboxOpen } = useLightboxVisibility();
    const overlayRef = useRef(null);

    const gallery = images && images.length > 0 ? images : src ? [src] : [];
    const [index, setIndex] = useState(Math.min(initialIndex, Math.max(gallery.length - 1, 0)));
    const currentSrc = gallery[index];

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });

    const pointers = useRef(new Map());
    const gestureStart = useRef(null); // 2-finger pinch state
    const panStart = useRef(null);     // 1-finger / mouse drag state
    const swipeStart = useRef(null);   // 1-finger horizontal swipe-to-navigate (only when scale === 1)

    const resetZoom = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

    const closeAndReset = useCallback(() => {
        resetZoom();
        onClose();
    }, [onClose]);

    const goTo = useCallback((next) => {
        if (gallery.length <= 1) return;
        resetZoom();
        setIndex((i) => (next + gallery.length) % gallery.length);
    }, [gallery.length]);

    const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
    const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

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
        const onKey = (e) => {
            if (e.key === "Escape") closeAndReset();
            else if (e.key === "ArrowLeft") goPrev();
            else if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [closeAndReset, goPrev, goNext]);

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

    // Mobile: real two-finger pinch + one-finger pan once zoomed,
    // or one-finger horizontal swipe to move between images when not zoomed.
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const handlePointerDown = (e) => {
        if (e.target.closest("button")) return;
        overlayRef.current?.setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gestureStart.current = { dist: dist(a, b), scale, midpoint: midpoint(a, b) };
            panStart.current = null;
            swipeStart.current = null;
        } else if (pointers.current.size === 1 && scale > 1) {
            panStart.current = { x: e.clientX, y: e.clientY, origin: translate };
        } else if (pointers.current.size === 1 && scale === 1 && gallery.length > 1) {
            swipeStart.current = { x: e.clientX, y: e.clientY };
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
        // swipeStart: no live transform, just measured on pointer up (keeps it simple/stable)
    };

    const handlePointerUp = (e) => {
        if (e.target.closest("button")) { pointers.current.delete(e.pointerId); return; }
        if (swipeStart.current && pointers.current.size === 1) {
            const dx = e.clientX - swipeStart.current.x;
            const dy = e.clientY - swipeStart.current.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0) goNext(); else goPrev();
            }
        }
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) gestureStart.current = null;
        if (pointers.current.size === 0) { panStart.current = null; swipeStart.current = null; }
    };

    if (gallery.length === 0) return null;

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
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
            style={{ touchAction: "none", overscrollBehavior: "contain" }}
        >
            <button
                onClick={closeAndReset}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6 sm:top-6"
                aria-label="Close"
            >
                <X className="h-5 w-5" />
            </button>

            {gallery.length > 1 && (
                <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white backdrop-blur-md sm:top-6">
                    {index + 1} / {gallery.length}
                </span>
            )}

            {gallery.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:left-4"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-4"
                        aria-label="Next image"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </>
            )}

            <AnimatePresence mode="wait" initial={false}>
                <motion.img
                    key={index}
                    src={currentSrc}
                    alt={alt}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                    onDoubleClick={handleDoubleClick}
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                    className="max-h-[80vh] max-w-[92vw] select-none rounded-xl object-contain shadow-2xl"
                    style={{
                        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                        transition: dragState.current || pointers.current.size > 0 ? "none" : "transform 0.15s ease-out",
                        cursor: scale > 1 ? "grab" : gallery.length > 1 ? "default" : "zoom-in",
                        touchAction: "none",
                    }}
                />
            </AnimatePresence>

            {gallery.length > 1 && (
                <div
                    className="mt-4 flex max-w-[92vw] gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {gallery.map((thumb, i) => (
                        <button
                            key={thumb + i}
                            onClick={() => goTo(i)}
                            className="h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition"
                            style={{ ringColor: i === index ? "#fff" : "transparent", opacity: i === index ? 1 : 0.5 }}
                        >
                            <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </motion.div>
    );
}