import { useEffect, useState } from "react";
import { X, Loader2, Plus, ImagePlus, Save } from "lucide-react";
import { adminCreateCatalogEntry, adminUpdateCatalogEntry, adminUploadCatalogImage } from "../utils/api.js";

const ALLOWED_UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];

export default function BrandItemModal({ token, isOpen, onClose, parentId, onCreated, onUpdated, editEntry }) {
    const isEdit = !!editEntry;
    const [form, setForm] = useState({ name: "", brand_name: "", price: "", moq: "", unit: ALLOWED_UNITS[0], lead_time: "" });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen && editEntry) {
            setForm({
                name: editEntry.name || "", brand_name: editEntry.brand_name || "",
                price: editEntry.price ?? "", moq: editEntry.moq ?? "",
                unit: editEntry.unit || ALLOWED_UNITS[0], lead_time: editEntry.lead_time || "",
            });
            setImagePreview(editEntry.image || null);
            setImageFile(null);
        } else if (isOpen) {
            setForm({ name: "", brand_name: "", price: "", moq: "", unit: ALLOWED_UNITS[0], lead_time: "" });
            setImagePreview(null); setImageFile(null);
        }
        setError("");
    }, [isOpen, editEntry]);

    if (!isOpen) return null;
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }

    async function handleSubmit() {
        setError("");
        const missing = [];
        if (form.name.trim().length < 2) missing.push("Product name");
        if (!form.brand_name.trim()) missing.push("Brand name");
        if (!(Number(form.price) > 0)) missing.push("Price");
        if (!(Number(form.moq) > 0)) missing.push("MOQ");
        if (!form.lead_time.trim()) missing.push("Lead time");
        if (!isEdit && !imageFile) missing.push("Image");
        if (missing.length) return setError(`Please provide: ${missing.join(", ")}.`);
        if (!isEdit && !parentId) return setError("Missing parent — please reopen this from inside a generic product.");

        setSaving(true);
        try {
            let imageUrl = imagePreview && !imageFile ? editEntry?.image : null;
            if (imageFile) {
                const up = await adminUploadCatalogImage(token, imageFile, "brand-items");
                if (!up?.success) throw new Error(up?.message || "Image upload failed.");
                imageUrl = up.url;
            }

            const payload = {
                name: form.name.trim(), brand_name: form.brand_name.trim(),
                price: Number(form.price), moq: Number(form.moq),
                unit: form.unit, lead_time: form.lead_time.trim(), image: imageUrl,
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
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Brand name *</label>
                        <input value={form.brand_name} onChange={set("brand_name")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Price *</label>
                            <input type="number" value={form.price} onChange={set("price")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[12px] font-bold text-slate-500">MOQ *</label>
                            <input type="number" value={form.moq} onChange={set("moq")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Unit *</label>
                        <select value={form.unit} onChange={set("unit")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25">
                            {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Lead time *</label>
                        <input value={form.lead_time} onChange={set("lead_time")} placeholder="e.g. 5-7 days" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Image {isEdit ? "" : "*"}</label>
                        <label className="flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            {imagePreview ? <img src={imagePreview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
                            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                        </label>
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