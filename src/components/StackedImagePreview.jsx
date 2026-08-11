// src/components/StackedImagePreview.jsx
import { useRef, useState } from "react";
import { Maximize2, Package } from "lucide-react";

// Deck-of-cards style trigger for a brand item's photo gallery.
// - 1 image: plain square, same as before.
// - 2+ images: front image on top, a tilted sliver of the next image
//   peeking out behind it, a dot strip along the bottom, and hovering
//   (desktop) or dragging (touch) across the width previews each image
//   in order without opening the full lightbox. Click opens the
//   lightbox at whatever's currently being previewed.
export default function StackedImagePreview({ images, name, onOpen, size = "h-24 w-24 sm:h-28 sm:w-28" }) {
    const gallery = images && images.length > 0 ? images : [];
    const [previewIndex, setPreviewIndex] = useState(0);
    const containerRef = useRef(null);

    function updatePreviewFromClientX(clientX) {
        const el = containerRef.current;
        if (!el || gallery.length <= 1) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 0.999);
        setPreviewIndex(Math.floor(ratio * gallery.length));
    }

    if (gallery.length === 0) {
        return (
            <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm`} style={{ borderColor: "rgba(11,17,22,0.09)" }}>
                <Package className="h-8 w-8 text-slate-300" />
            </span>
        );
    }

    return (
        <div className={`relative ${size} shrink-0`}>
            {/* tilted sliver of the next image, only visible when there's more than one */}
            {gallery.length > 1 && (
                <div
                    className="absolute inset-0 origin-bottom-left overflow-hidden rounded-2xl border bg-white shadow-sm"
                    style={{ borderColor: "rgba(11,17,22,0.09)", transform: "rotate(-7deg) translate(-3px, 2px)" }}
                    aria-hidden="true"
                >
                    <img src={gallery[(previewIndex + 1) % gallery.length]} alt="" className="h-full w-full object-cover opacity-70" draggable={false} />
                </div>
            )}

            <button
                ref={containerRef}
                onClick={() => onOpen(previewIndex)}
                onMouseMove={(e) => updatePreviewFromClientX(e.clientX)}
                onMouseLeave={() => setPreviewIndex(0)}
                onTouchMove={(e) => updatePreviewFromClientX(e.touches[0].clientX)}
                className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm"
                style={{ borderColor: "rgba(11,17,22,0.09)" }}
                aria-label="View images"
            >
                <img src={gallery[previewIndex]} alt={name} className="h-full w-full object-cover" draggable={false} />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/20">
                    <Maximize2 className="h-4 w-4 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </span>

                {gallery.length > 1 && (
                    <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
                        {gallery.map((_, i) => (
                            <span
                                key={i}
                                className="h-1 w-1 rounded-full transition-all duration-150"
                                style={{ background: i === previewIndex ? "#fff" : "rgba(255,255,255,0.45)", width: i === previewIndex ? 10 : 4 }}
                            />
                        ))}
                    </div>
                )}
            </button>
        </div>
    );
}