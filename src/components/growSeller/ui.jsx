// Small shared UI pieces for the GROW seller area.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Ic from "./Ic.jsx";
import { useGrowSeller } from "../../context/GrowSellerContext.js";

/** Renders inside the .gsl root so the scoped CSS (and theme variables) apply. */
export function Portal({ children }) {
    const { root } = useGrowSeller();
    return root ? createPortal(children, root) : null;
}

/**
 * Bottom sheet on phones, centred modal from 768px.
 * `light` = white panel for reused (Tailwind, light) content such as the edit form.
 * Omit `title` to render only the grab handle + close button.
 */
export function Sheet({ title, sub, onClose, wide = false, light = false, bare = false, children }) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        try { window.lenis?.stop?.(); } catch { /* noop */ }
        const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            try { window.lenis?.start?.(); } catch { /* noop */ }
            window.removeEventListener("keydown", onKey);
        };
    }, []);

    return (
        <Portal>
            <div className="shade" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current?.(); }}>
                <div className={`sheet${wide ? " wide" : ""}${light ? " lt" : ""}${bare ? " bare" : ""}`} role="dialog" aria-modal="true" aria-label={title || "Details"} data-lenis-prevent="">
                    <div className="gp" />
                    {!bare && (
                        <div className="shh">
                            <div>
                                {title && <h2 className="h2">{title}</h2>}
                                {sub && <p className="sub2">{sub}</p>}
                            </div>
                            <button type="button" className="ib sm" aria-label="Close" onClick={() => closeRef.current?.()}><Ic n="x" /></button>
                        </div>
                    )}

                    {children}
                </div>
            </div>
        </Portal>
    );
}

export function Thumb({ src, name, onClick, zoom }) {
    const inner = src ? <img src={src} alt="" loading="lazy" decoding="async" /> : (name || "?").trim()[0]?.toUpperCase() || "?";
    const cls = `th${src ? "" : " ph"}${zoom && src ? " zoom" : ""}`;
    if (onClick && src) return <button type="button" className={cls} aria-label="View images" onClick={onClick}>{inner}</button>;
    return <div className={cls} aria-hidden={!src}>{inner}</div>;
}

export function ListSkeleton({ n = 3, tall = false }) {
    return (
        <div className="grid c2" aria-busy="true" aria-label="Loading">
            {Array.from({ length: n }).map((_, i) => <div key={i} className={`sk${tall ? " tall" : ""}`} />)}
        </div>
    );
}

export function Empty({ title, text, children }) {
    return <div className="emp"><b>{title}</b>{text}{children}</div>;
}

export function Spinner() { return <Ic n="spin" />; }