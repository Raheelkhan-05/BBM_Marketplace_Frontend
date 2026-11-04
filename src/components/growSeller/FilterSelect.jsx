// Custom dropdown used by the product filters (replaces the native <select>).
//   Tablet / desktop: a floating menu under the button (flips above when there's no room).
//   Phone:            a bottom sheet, easier to use with a thumb.
// Opens and closes with the same smooth transition everywhere. Fully keyboard accessible:
//   Arrow keys move, Home / End jump, Enter picks, Escape closes, Tab leaves.
// Long lists (more than 8 options) get a search box.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Ic from "./Ic.jsx";
import { Portal } from "./ui.jsx";

const CLOSE_MS = 180;

// Keeps the panel mounted while it animates out.
function usePresence(open) {
    const [mounted, setMounted] = useState(open);
    const [state, setState] = useState(open ? "open" : "closed");
    useEffect(() => {
        if (open) {
            setMounted(true);
            let r2 = 0;
            const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setState("open")); }); // paint "closed" first so the transition runs
            return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
        }
        setState("closed");
        const t = setTimeout(() => setMounted(false), CLOSE_MS);
        return () => clearTimeout(t);
    }, [open]);
    return { mounted, state };
}

export default function FilterSelect({ label, allLabel, value, options, onChange, disabled = false }) {
    const uid = useId();
    const btnRef = useRef(null);
    const listRef = useRef(null);
    const searchRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [phone, setPhone] = useState(false);
    const [pos, setPos] = useState(null);
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const { mounted, state } = usePresence(open);

    const searchable = options.length > 8;
    const rows = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (term) return options.filter((o) => o.label.toLowerCase().includes(term));
        return [{ value: "", label: allLabel, count: null }, ...options];
    }, [options, q, allLabel]);
    const current = options.find((o) => o.value === value);

    function openMenu() {
        if (disabled) return;
        setPhone(window.matchMedia("(max-width: 639px)").matches);
        setQ("");
        setActive(value ? Math.max(0, options.findIndex((o) => o.value === value) + 1) : 0);
        setOpen(true);
    }
    function close(refocus = true) {
        setOpen(false);
        if (refocus) btnRef.current?.focus({ preventScroll: true });
    }
    function pick(v) { onChange(v); close(); }

    // Position under (or above) the button; follows resize and scrolling.
    useLayoutEffect(() => {
        if (!open || phone) return undefined;
        let raf = 0;
        const calc = () => {
            raf = 0;
            const el = btnRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const width = Math.min(Math.max(r.width, 240), vw - 24);
            const left = Math.round(Math.max(12, Math.min(r.left, vw - width - 12)));
            const below = vh - r.bottom - 12, above = r.top - 12;
            const up = below < 240 && above > below;
            const next = {
                left, width: Math.round(width), up,
                maxHeight: Math.round(Math.max(160, Math.min(360, up ? above : below))),
                top: up ? null : Math.round(r.bottom + 6),
                bottom: up ? Math.round(vh - r.top + 6) : null,
            };
            // same numbers as before -> no re-render (scrolling inside the list fires this a lot)
            setPos((p) => (p && p.left === next.left && p.width === next.width && p.up === next.up && p.maxHeight === next.maxHeight && p.top === next.top && p.bottom === next.bottom ? p : next));
        };
        const place = () => { if (!raf) raf = requestAnimationFrame(calc); };
        calc();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, { capture: true, passive: true });
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, { capture: true }); };
    }, [open, phone]);

    // Move focus into the menu once it is open.
    useEffect(() => {
        if (!open || state !== "open") return;
        (searchable && !phone ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
    }, [open, state, searchable, phone]);

    useEffect(() => { setActive(0); }, [q]);
    useEffect(() => {
        if (open) document.getElementById(`${uid}-o${active}`)?.scrollIntoView({ block: "nearest" });
    }, [active, open, rows, uid]);

    function onKey(e) {
        const n = rows.length;
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(n - 1, a + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if ((e.key === "Home" || e.key === "End") && e.target !== searchRef.current) { e.preventDefault(); setActive(e.key === "Home" ? 0 : n - 1); }
        else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) pick(rows[active].value); }
        else if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Tab") close(false);
    }

    const showPanel = mounted && (phone || pos);
    const up = !phone && !!pos?.up;
    const activeId = rows[active] ? `${uid}-o${active}` : undefined;

    return (
        <>
            <button ref={btnRef} type="button" className={`ddt${value ? " on" : ""}`} disabled={disabled}
                aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-l`}
                aria-label={`${label}: ${current ? current.label : allLabel}`}
                onClick={() => (open ? close() : openMenu())}
                onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) openMenu(); } }}>
                <span className="ddv">{current ? current.label : allLabel}</span>
                <Ic n="chev" />
            </button>

            {showPanel && (
                <Portal>
                    <div className="ddb" data-state={state} onClick={() => close()} aria-hidden="true" />
                    <div className="ddp" data-state={state} data-up={up ? "true" : "false"} onKeyDown={onKey}
                        style={phone ? undefined : { left: pos.left, width: pos.width, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto", maxHeight: pos.maxHeight, transformOrigin: up ? "bottom" : "top" }}>
                        <div className="ddh">
                            <i className="ddg" />
                            <div className="ddr">
                                <b>{label}</b>
                                <button type="button" className="ib sm" aria-label="Close" onClick={() => close()}><Ic n="x" /></button>
                            </div>
                        </div>

                        {searchable && (
                            <label className="dds">
                                <Ic n="search" />
                                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}`}
                                    aria-label={`Search ${label.toLowerCase()}`} aria-controls={`${uid}-l`} aria-activedescendant={activeId} autoComplete="off" />
                            </label>
                        )}

                        <ul ref={listRef} id={`${uid}-l`} className="ddl" role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={activeId}>
                            {rows.map((r, i) => (
                                <li key={r.value || "__all"} id={`${uid}-o${i}`} role="option" className="ddo"
                                    aria-selected={r.value === value} data-active={i === active}
                                    onMouseMove={() => { if (active !== i) setActive(i); }} onClick={() => pick(r.value)}>
                                    <Ic n="check" className="ddk" />
                                    <span className="ddl1">{r.label}</span>
                                    {r.count != null && <em>{r.count}</em>}
                                </li>
                            ))}
                            {!rows.length && <li className="ddn" role="presentation">No match</li>}
                        </ul>
                    </div>
                </Portal>
            )}
        </>
    );
}