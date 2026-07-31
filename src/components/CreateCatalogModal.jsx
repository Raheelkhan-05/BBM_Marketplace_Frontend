import { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import CascadingHierarchyPicker from "./CascadingHierarchyPicker.jsx";
import { adminCreateCatalogEntry } from "../utils/api.js";

const LEVEL_TABS = [
    { key: "category", label: "Category" },
    { key: "subcategory", label: "Subcategory" },
    { key: "product", label: "Product" },
    { key: "brand", label: "Brand" },
];
const FIELD_CONFIG = {
    category: ["name", "slug", "image", "tagline", "hero_image", "overview"],
    subcategory: ["name", "slug", "image", "tagline", "hero_image", "overview"],
    product: ["name", "slug", "image", "generic_name", "description", "variants", "attributes"],
    brand: ["brand_name", "name", "slug", "image", "description", "variants", "attributes"],
};

const PARENT_RUNG = { subcategory: "category", product: "subcategory", brand: "product" };
const REQUIRED_FIELDS = { brand: ["brand_name"] };
const MULTILINE = new Set(["overview", "description", "tagline"]);
const JSON_FIELDS = new Set(["variants", "attributes"]);

const JSON_DEFAULT = { variants: "[]", attributes: "{}" };

function fieldLabel(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CreateCatalogModal({ token, isOpen, onClose, onCreated, defaultLevel = "category" }) {
    const [level, setLevel] = useState(defaultLevel);
    const [form, setForm] = useState(() => {
        const seeded = {};
        for (const key of FIELD_CONFIG[defaultLevel]) if (JSON_FIELDS.has(key)) seeded[key] = JSON_DEFAULT[key];
        return seeded;
    });
    const [chain, setChain] = useState({ category: null, subcategory: null, product: null });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    function switchLevel(next) {
        setLevel(next);
        const seeded = {};
        for (const key of FIELD_CONFIG[next]) if (JSON_FIELDS.has(key)) seeded[key] = JSON_DEFAULT[key];
        setForm(seeded);
        setChain({ category: null, subcategory: null, product: null });
        setError("");
    }

    function handleClose() {
        switchLevel(defaultLevel);
        onClose();
    }

    async function handleSubmit() {
        setError("");
        const name = (form.name || "").trim();
        if (name.length < 2) return setError("Name must be at least 2 characters.");
        if (level === "brand" && !(form.brand_name || "").trim()) return setError("Brand name is required.");
        const rung = PARENT_RUNG[level];
        if (rung && !chain[rung]?.id) return setError(`Select a ${rung} before creating.`);

        const payload = { ...form, name };
        for (const key of FIELD_CONFIG[level]) {
            if (!JSON_FIELDS.has(key)) continue;
            try {
                payload[key] = JSON.parse(form[key] || JSON_DEFAULT[key]);
            } catch {
                return setError(`"${fieldLabel(key)}" is not valid JSON.`);
            }
        }
        if (rung) payload.parentId = chain[rung].id;

        setSaving(true);
        const res = await adminCreateCatalogEntry(token, level, payload);
        setSaving(false);
        if (res?.success) {
            onCreated?.(level, res.entry);
            handleClose();
        } else {
            setError(res?.message || "Couldn't create that.");
        }
    }

    const fields = FIELD_CONFIG[level];

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={handleClose}>
            <div onClick={(e) => e.stopPropagation()}
                className="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-[16px] font-extrabold text-slate-900">Add to catalog</h3>
                    <button onClick={handleClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {LEVEL_TABS.map((t) => (
                            <button key={t.key} onClick={() => switchLevel(t.key)}
                                className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                                style={{ background: level === t.key ? "#047084" : "#f1f5f9", color: level === t.key ? "white" : "#64748b" }}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {PARENT_RUNG[level] && (
                        <div className="mt-4">
                            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Hierarchy</p>
                            <CascadingHierarchyPicker
                                token={token}
                                entityLevel={level}
                                ancestors={chain}
                                onChange={setChain}
                            />
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-3">
                        {fields.map((key) => (
                            <div key={key}>
                                <label className="mb-1 block text-[12px] font-bold text-slate-500">
                                    {fieldLabel(key)}{key === "name" || REQUIRED_FIELDS[level]?.includes(key) ? " *" : ""}
                                </label>
                                {JSON_FIELDS.has(key) ? (
                                    <textarea rows={3} value={form[key] ?? JSON_DEFAULT[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-[#047084]/30" />
                                ) : MULTILINE.has(key) ? (
                                    <textarea rows={2} value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#047084]/30" />
                                ) : (
                                    <input value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                        placeholder={key === "slug" ? "auto-generated from name if left blank" : ""}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#047084]/30" />
                                )}
                            </div>
                        ))}
                    </div>

                    {error && <p className="mt-3 text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    <button onClick={handleClose} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Create {level}
                    </button>
                </div>
            </div>
        </div>
    );
}