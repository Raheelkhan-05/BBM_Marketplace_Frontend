import { useEffect, useState } from "react";
import { Loader2, ChevronRight, Search, CheckCircle2 } from "lucide-react";
import { fetchApprovedCategories, fetchApprovedSubcategories, fetchApprovedProducts } from "../utils/api.js";

const C = { ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83", hair: "rgba(11,17,22,0.09)" };

// Three-level cascading picker (category -> subcategory -> product) scoped
// to review_status = 'approved' rows only — a seller can't publish under
// something our team hasn't reviewed yet. `onSelect` fires with the full
// picked product, including whether it already has a spec schema.
export default function ProductPathPicker({ onSelect }) {
    const [category, setCategory] = useState(null);
    const [subcategory, setSubcategory] = useState(null);

    return (
        <div className="flex flex-col gap-4">
            <PickerLevel
                label="Category"
                selected={category}
                onClear={() => { setCategory(null); setSubcategory(null); }}
                fetcher={(q) => fetchApprovedCategories(q)}
                onPick={(item) => { setCategory(item); setSubcategory(null); }}
            />
            {category && (
                <PickerLevel
                    label="Subcategory"
                    selected={subcategory}
                    onClear={() => setSubcategory(null)}
                    fetcher={(q) => fetchApprovedSubcategories(category.id, q)}
                    onPick={(item) => setSubcategory(item)}
                />
            )}
            {subcategory && (
                <PickerLevel
                    label="Product"
                    selected={null}
                    fetcher={(q) => fetchApprovedProducts(subcategory.id, q)}
                    onPick={(item) => onSelect({ category, subcategory, product: item })}
                    renderExtra={(item) =>
                        !item.hasSpecSchema && (
                            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#f59e0b1a", color: "#b45309" }}>
                                no spec template yet
                            </span>
                        )
                    }
                />
            )}
        </div>
    );
}

function PickerLevel({ label, selected, onClear, fetcher, onPick, renderExtra }) {
    const [q, setQ] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(!selected);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetcher(q);
                if (!cancelled) setItems(res?.success ? res.items || [] : []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, q ? 250 : 0);
        return () => { cancelled = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, open]);

    if (selected && !open) {
        return (
            <div className="flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5" style={{ borderColor: `${C.secondary}40`, background: `${C.secondary}08` }}>
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: C.secondary }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
                    <span className="text-[13.5px] font-bold" style={{ color: C.ink }}>{selected.name}</span>
                </div>
                <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-bold underline" style={{ color: C.muted }}>Change</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${label.toLowerCase()}…`}
                    className="w-full rounded-xl border-2 py-2.5 pl-9 pr-3 text-[14px] font-semibold focus:outline-none focus:ring-4"
                    style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}20` }}
                />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border" style={{ borderColor: C.hair }}>
                {loading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" style={{ color: C.muted }} /></div>
                ) : items.length === 0 ? (
                    <p className="px-3.5 py-4 text-center text-[12.5px] font-medium" style={{ color: C.muted }}>
                        No approved {label.toLowerCase()} found{q ? ` for "${q}"` : ""}.
                    </p>
                ) : (
                    items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => { onPick(item); setOpen(false); }}
                            className="flex w-full items-center justify-between border-b px-3.5 py-2.5 text-left last:border-b-0 hover:bg-black/[0.03]"
                            style={{ borderColor: C.hair }}
                        >
                            <span className="flex items-center text-[13.5px] font-semibold" style={{ color: C.ink }}>
                                {item.name}
                                {renderExtra?.(item)}
                            </span>
                            <ChevronRight className="h-4 w-4" style={{ color: C.muted }} />
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}