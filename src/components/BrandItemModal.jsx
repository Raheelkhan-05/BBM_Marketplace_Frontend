import { useEffect, useState } from "react";
import { X, Loader2, Plus, ImagePlus, Save, Trash2 } from "lucide-react";
import { adminCreateCatalogEntry, adminUpdateCatalogEntry, adminUploadCatalogImage } from "../utils/api.js";

// NOTE: this brand-item form is now IDENTITY ONLY — name, brand, images,
// manufacturer, model/part no., grade/variant, specifications. Price/MOQ/
// unit/lead time used to live here, but under the current schema those
// are commercial terms that belong to a *seller's* listing
// (seller_product_submissions), not the catalog identity — every seller
// selling this same brand item can have different pricing/MOQ/lead time.
// If you're maintaining a separate seller-facing form for that, don't
// port price/moq/unit/lead_time back in here.
//
// This mirrors CreateSimpleCatalogModal.jsx's brand_item branch — if
// both files are live in your app, prefer consolidating onto one of them
// so this identity shape can't drift out of sync between the two again.

export default function BrandItemModal({ token, isOpen, onClose, parentId, onCreated, onUpdated, editEntry }) {
    const isEdit = !!editEntry;
    const [form, setForm] = useState({ name: "", brand_name: "", manufacturer: "", model_no: "", grade_variant: "" });
    const [specifications, setSpecifications] = useState([]); // [{ key, value }]

    // Multi-image, matching brand_item's real shape (images[] + image cover)
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen && editEntry) {
            setForm({
                name: editEntry.name || "",
                brand_name: editEntry.brand_name || "",
                manufacturer: editEntry.manufacturer || "",
                model_no: editEntry.model_no || "",
                grade_variant: editEntry.grade_variant || "",
            });
            setSpecifications(editEntry.specifications || []);
            setImagePreviews(editEntry?.images?.length ? editEntry.images : editEntry?.image ? [editEntry.image] : []);
            setImageFiles([]);
        } else if (isOpen) {
            setForm({ name: "", brand_name: "", manufacturer: "", model_no: "", grade_variant: "" });
            setSpecifications([]);
            setImagePreviews([]); setImageFiles([]);
        }
        setError("");
    }, [isOpen, editEntry]);

    if (!isOpen) return null;
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    function updateSpec(i, field, val) {
        setSpecifications((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
    }
    function removeSpec(i) {
        setSpecifications((rows) => rows.filter((_, idx) => idx !== i));
    }
    function addSpec() {
        setSpecifications((rows) => [...rows, { key: "", value: "" }]);
    }

    function handleFiles(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setImageFiles((f) => [...f, ...files]);
        setImagePreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
        e.target.value = "";
    }
    function removeImageAt(i) {
        const removedUrl = imagePreviews[i];
        setImagePreviews((p) => p.filter((_, idx) => idx !== i));
        if (removedUrl?.startsWith("blob:")) {
            setImageFiles((files) => {
                const blobIdx = imagePreviews.slice(0, i).filter((u) => u.startsWith("blob:")).length;
                return files.filter((_, idx) => idx !== blobIdx);
            });
        }
    }

    async function handleSubmit() {
        setError("");
        const missing = [];
        if (form.name.trim().length < 2) missing.push("Product name");
        if (!form.brand_name.trim()) missing.push("Brand name");
        if (!form.manufacturer.trim()) missing.push("Manufacturer");
        if (!form.model_no.trim()) missing.push("Model / Part No. / SKU");
        if (imagePreviews.length === 0) missing.push("Product image");
        if (missing.length) return setError(`Please provide: ${missing.join(", ")}.`);
        if (!isEdit && !parentId) return setError("Missing parent — please reopen this from inside a generic product.");

        setSaving(true);
        try {
            const finalUrls = imagePreviews.filter((p) => !p.startsWith("blob:")); // kept existing urls
            for (const file of imageFiles) {
                const up = await adminUploadCatalogImage(token, file, "brand-items");
                if (!up?.success) throw new Error(up?.message || "Image upload failed.");
                finalUrls.push(up.url);
            }

            const payload = {
                name: form.name.trim(),
                brand_name: form.brand_name.trim(),
                manufacturer: form.manufacturer.trim(),
                model_no: form.model_no.trim(),
                grade_variant: form.grade_variant.trim() || null,
                specifications: specifications.filter((s) => s?.key?.trim()),
                images: finalUrls,
                image: finalUrls[0] || null,
            };

            if (isEdit) {
                const res = await adminUpdateCatalogEntry(token, "brand_item", editEntry.id, payload);
                if (!res?.success) throw new Error(res?.message || "Couldn't save changes.");
                onUpdated?.(res.entry);
            } else {
                const res = await adminCreateCatalogEntry(token, "brand_item", { ...payload, parentId });
                if (!res?.success) throw new Error(res?.message || "Couldn't create that.");
                onCreated?.(res.entry);
            }
            onClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-[16px] font-extrabold text-slate-900">{isEdit ? "Edit brand item" : "Add brand item"}</h3>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
                </div>
                <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Product name *</label>
                        <input value={form.name} onChange={set("name")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Brand *</label>
                        <input value={form.brand_name} onChange={set("brand_name")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Manufacturer *</label>
                        <input value={form.manufacturer} onChange={set("manufacturer")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Model / Part No. / SKU *</label>
                        <input value={form.model_no} onChange={set("model_no")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Product Grade / Variant</label>
                        <input value={form.grade_variant} onChange={set("grade_variant")} placeholder="Where applicable"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Specifications / Technical Data Sheet</label>
                        <div className="flex flex-col gap-2">
                            {specifications.map((row, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input
                                        value={row.key || ""}
                                        placeholder="Attribute (e.g. Material)"
                                        onChange={(e) => updateSpec(i, "key", e.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25"
                                    />
                                    <input
                                        value={row.value || ""}
                                        placeholder="Value (e.g. SS304)"
                                        onChange={(e) => updateSpec(i, "value", e.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25"
                                    />
                                    <button type="button" onClick={() => removeSpec(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 text-[#c71f11]" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addSpec} className="flex w-fit items-center gap-1 text-[12px] font-bold text-[#047084]">
                                <Plus className="h-3.5 w-3.5" /> Add specification
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">
                            Images {imagePreviews.length > 0 && `(${imagePreviews.length})`} *
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {imagePreviews.map((src, i) => (
                                <div key={src + i} className="relative h-20 w-20">
                                    <img src={src} alt="" className="h-full w-full rounded-lg border border-slate-200 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImageAt(i)}
                                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] leading-none text-white"
                                        aria-label="Remove image"
                                    >
                                        ×
                                    </button>
                                    {i === 0 && (
                                        <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[8.5px] font-bold text-white">Cover</span>
                                    )}
                                </div>
                            ))}
                            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-slate-400">
                                <ImagePlus className="h-5 w-5" />
                                <span className="text-[9px] font-bold">Add</span>
                                <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {error && <p className="text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEdit ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {isEdit ? "Save" : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
}