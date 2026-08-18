// components/seller/listingForm/PolicySelect.jsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { fetchListingPolicyOptions } from "../../../utils/sellerListingApi.js";
import { C, Label } from "./FormPrimitives.jsx";

export default function PolicySelect({ kind, label, value, onChange, error, required }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        fetchListingPolicyOptions(kind).then((r) => { if (r?.success) setOptions(r.items); setLoading(false); });
    }, [kind]);

    useEffect(() => {
        function onOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", onOutside);
        return () => document.removeEventListener("mousedown", onOutside);
    }, []);

    const selected = options.find((o) => o.key === value);

    if (loading) {
        return (
            <div className="flex flex-col gap-1">
                <Label>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
                <div className="h-[42px] w-full animate-pulse rounded-lg" style={{ background: C.hairSoft }} />
            </div>
        );
    }

    return (
        <div ref={boxRef} className="relative flex min-w-0 flex-col gap-1">
            <Label>{label}{required && <span style={{ color: C.primary }}> *</span>}</Label>
            <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-[13px] font-bold focus:outline-none focus:ring-2"
                style={error ? { borderColor: "#f2b3ab", background: "#fff8f7" } : { borderColor: C.hair }}>
                <span className="truncate" style={{ color: selected ? C.ink : "#94a3b8" }}>{selected ? selected.label : "Select…"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {selected?.description && (
                <p className="text-[10.5px] font-medium leading-snug" style={{ color: C.muted }}>{selected.description}</p>
            )}
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: C.hair }}>
                        {options.map((o) => (
                            <button key={o.key} type="button" onClick={() => { onChange(o.key); setOpen(false); }}
                                className="flex w-full items-start gap-2.5 border-b px-3.5 py-2.5 text-left last:border-b-0 transition-colors duration-150 hover:bg-black/[0.03]" style={{ borderColor: C.hairSoft }}>
                                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={o.key === value ? { background: C.secondary } : { border: `1.5px solid ${C.hair}` }}>
                                    {o.key === value && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[12.5px] font-bold" style={{ color: C.ink }}>{o.label}</span>
                                    {o.description && <span className="mt-0.5 block text-[10.5px] font-medium leading-snug" style={{ color: C.muted }}>{o.description}</span>}
                                </span>
                            </button>
                        ))}
                        {options.length === 0 && <p className="px-3.5 py-3 text-center text-[11.5px] font-medium" style={{ color: C.muted }}>No options available.</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}