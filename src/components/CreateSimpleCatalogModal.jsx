import { useState } from "react";
import { X, Loader2, Plus, ImagePlus } from "lucide-react";
import { adminCreateCatalogEntry, adminUploadCatalogImage } from "../utils/api.js";

const LEVEL_META = {
    category: { title: "Add category", folder: "categories" },
    subcategory: { title: "Add subcategory", folder: "subcategories" },
    generic_product: { title: "Add generic product", folder: "generic-products" },
};

// Admin-only creation for the three simplified catalog rungs — name +
// image only. Uploads to Supabase storage via
// POST /api/admin/catalog/upload, then creates the row with that URL.
export default function CreateSimpleCatalogModal({ token, isOpen, onClose, level, parentId, onCreated }) {
    const [name, setName] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen || !level) return null;
    const meta = LEVEL_META[level];

    function reset() { setName(""); setImageFile(null); setImagePreview(null); setError(""); }
    function handleClose() { reset(); onClose(); }

    function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }

    async function handleSubmit() {
        setError("");
        const trimmed = name.trim();
        if (trimmed.length < 2) return setError("Name must be at least 2 characters.");
        if (level !== "category" && !parentId) return setError("Missing parent — please reopen this from inside the list.");

        setSaving(true);
        try {
            let imageUrl = null;
            if (imageFile) {
                const up = await adminUploadCatalogImage(token, imageFile, meta.folder);
                if (!up?.success) throw new Error(up?.message || "Image upload failed.");
                imageUrl = up.url;
            }
            const payload = { name: trimmed, image: imageUrl };
            if (level !== "category") payload.parentId = parentId;

            const res = await adminCreateCatalogEntry(token, level, payload);
            if (!res?.success) throw new Error(res?.message || "Couldn't create that.");
            onCreated?.(level, res.entry);
            handleClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={handleClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full flex-col rounded-t-2xl bg-white sm:max-w-sm sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-[16px] font-extrabold text-slate-900">{meta.title}</h3>
                    <button onClick={handleClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
                </div>
                <div className="flex flex-col gap-4 px-5 py-4">
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Name *</label>
                        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#047084]/25" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[12px] font-bold text-slate-500">Image</label>
                        <label className="flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            {imagePreview ? <img src={imagePreview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
                            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                        </label>
                    </div>
                    {error && <p className="text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    <button onClick={handleClose} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}