import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, Plus, Loader2, CheckCircle2, Clock } from "lucide-react";
import { C } from "./FormPrimitives.jsx";

export default function HierarchyCombobox({ label, placeholder, value, onSelect, disabled, fetcher, onCreate, required }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creatingBusy, setCreatingBusy] = useState(false);
    const [note, setNote] = useState(null);
    const boxRef = useRef(null);

    useEffect(() => {
        function onOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", onOutside);
        return () => document.removeEventListener("mousedown", onOutside);
    }, []);

    useEffect(() => {
        if (!open || disabled) return;
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(async () => {
            const res = await fetcher(q);
            if (!cancelled) { setItems(res?.success ? res.items || [] : []); setLoading(false); }
        }, q ? 250 : 0);
        return () => { cancelled = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, open, disabled]);

    async function submitCreate() {
        if (!q.trim()) return;
        setCreatingBusy(true); setNote(null);
        const res = await onCreate(q.trim());
        setCreatingBusy(false);
        if (!res?.success) return setNote({ type: "error", text: res?.message || "Couldn't create that." });
        onSelect({ id: res.entry.id, name: res.entry.name, review_status: res.entry.review_status });
        setNote({ type: res.duplicate ? "info" : "pending", text: res.message });
        setOpen(false); setQ("");
    }

    if (value && !open) {
        return (
            <div className="flex items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-2.5" style={{ borderColor: `${C.secondary}40`, background: `${C.secondary}08` }}>
                <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                    <span className="truncate text-[13.5px] font-bold" style={{ color: C.ink }}>{value.name}</span>
                    {value.review_status === "pending_review" && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#fef3c7", color: "#a16207" }}>
                            <Clock className="h-2.5 w-2.5" /> Pending review
                        </span>
                    )}
                </div>
                {!disabled && <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-[11.5px] font-bold underline" style={{ color: C.muted }}>Change</button>}
            </div>
        );
    }

    return (
        <div ref={boxRef} className="relative flex flex-col gap-1.5">
            {label && <label className="text-[12px] font-bold" style={{ color: C.muted }}>{label} {required && <span style={{ color: C.primary }}>*</span>}</label>}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                    value={q} disabled={disabled}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                    placeholder={placeholder}
                    className="w-full rounded-xl border-2 py-2.5 pl-9 pr-9 text-[13.5px] font-semibold focus:outline-none focus:ring-4 disabled:opacity-50"
                    style={{ borderColor: C.hair, color: C.ink }}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
            </div>
            {open && !disabled && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: C.hair }}>
                    {loading ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" style={{ color: C.muted }} /></div>
                    ) : (
                        <>
                            {items.map((item) => (
                                <button key={item.id} type="button" onClick={() => { onSelect(item); setOpen(false); setQ(""); }}
                                    className="flex w-full items-center justify-between border-b px-3.5 py-2.5 text-left last:border-b-0 hover:bg-black/[0.03]" style={{ borderColor: C.hairSoft }}>
                                    <span className="text-[13px] font-semibold" style={{ color: C.ink }}>{item.name}</span>
                                    {item.review_status === "pending_review" && <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "#fef3c7", color: "#a16207" }}>Pending</span>}
                                </button>
                            ))}
                            {items.length === 0 && <p className="px-3.5 py-3 text-center text-[12px] font-medium" style={{ color: C.muted }}>{q ? `No matches for "${q}".` : "Start typing to search…"}</p>}
                            {q.trim() && (
                                <button type="button" onClick={submitCreate} disabled={creatingBusy}
                                    className="flex w-full items-center gap-1.5 border-t px-3.5 py-2.5 text-left text-[12.5px] font-bold disabled:opacity-60" style={{ borderColor: C.hairSoft, color: C.secondary }}>
                                    {creatingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create "{q.trim()}"
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
            {note && <p className="text-[11px] font-semibold" style={{ color: note.type === "error" ? "#c71f11" : "#a16207" }}>{note.text}</p>}
        </div>
    );
}