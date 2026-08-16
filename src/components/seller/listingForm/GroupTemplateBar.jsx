// components/seller/listingForm/GroupTemplateBar.jsx
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Star, Plus, Check, Loader2, X } from "lucide-react";
import { C, EASE } from "./FormPrimitives.jsx";
import useSellerListingTemplates from "../../../hooks/useSellerListingTemplates.js";

export default function GroupTemplateBar({ groupType, currentData, onApply }) {
    const { templates, loading, saving, saveAsTemplate, setDefault, remove } = useSellerListingTemplates(groupType);
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const [saveName, setSaveName] = useState("");
    const [showSave, setShowSave] = useState(false);
    const btnRef = useRef(null);

    const openPanel = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setRect({ top: r.bottom + 6, right: window.innerWidth - r.right });
        setOpen(true);
    };

    const handleSave = async () => {
        if (!saveName.trim()) return;
        const res = await saveAsTemplate(saveName.trim(), currentData, templates.length === 0);
        if (res?.success) { setSaveName(""); setShowSave(false); }
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openPanel(); }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.03]"
                style={{ borderColor: C.hair, color: C.secondary }}
            >
                <Layers className="h-3.5 w-3.5" /> Groups {templates.length > 0 && `(${templates.length})`}
            </button>

            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {open && rect && (
                        <>
                            <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.16, ease: EASE }}
                                className="fixed z-[96] w-72 overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_-15px_rgba(11,17,22,0.35)]"
                                style={{ top: rect.top, right: rect.right, borderColor: C.hair }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="max-h-64 overflow-y-auto p-2">
                                    {loading ? (
                                        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" style={{ color: C.muted }} /></div>
                                    ) : templates.length === 0 ? (
                                        <p className="px-2 py-4 text-center text-[11.5px] font-medium" style={{ color: C.muted }}>
                                            No saved groups yet — fill this section, then save it for next time.
                                        </p>
                                    ) : (
                                        templates.map((t) => (
                                            <div key={t.id} className="flex items-center gap-1.5 rounded-xl px-2 py-2 hover:bg-black/[0.03]">
                                                <button
                                                    type="button"
                                                    onClick={() => { onApply(t.data); setOpen(false); }}
                                                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                                >
                                                    <span className="truncate text-[12.5px] font-bold" style={{ color: C.ink }}>{t.name}</span>
                                                </button>
                                                <button type="button" onClick={() => setDefault(t.id)} title={t.is_default ? "Default" : "Set as default"}>
                                                    <Star className="h-3.5 w-3.5" style={t.is_default ? { color: "#b45309", fill: "#b45309" } : { color: C.hairSoft }} />
                                                </button>
                                                <button type="button" onClick={() => remove(t.id)} title="Delete group">
                                                    <X className="h-3.5 w-3.5" style={{ color: C.muted }} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="border-t p-2" style={{ borderColor: C.hairSoft }}>
                                    {showSave ? (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                autoFocus
                                                value={saveName}
                                                onChange={(e) => setSaveName(e.target.value)}
                                                placeholder="e.g. Standard Delivery"
                                                className="min-w-0 flex-1 rounded-lg border-2 px-2.5 py-1.5 text-[12px] font-semibold focus:outline-none"
                                                style={{ borderColor: C.hairSoft, color: C.ink }}
                                            />
                                            <button type="button" onClick={handleSave} disabled={saving} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: C.secondary }}>
                                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowSave(true)}
                                            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold"
                                            style={{ background: C.hairSoft, color: C.secondary }}
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Save current as group
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}