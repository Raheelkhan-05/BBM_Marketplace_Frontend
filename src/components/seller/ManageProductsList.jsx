// components/seller/ManageProductsList.jsx
import { useEffect, useState } from "react";
import { Loader2, Pencil, X, Check, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchMySellerSubmissions, updateSellerProductSubmission, uploadSellerFile } from "../../utils/api.js";

const STATUS_STYLES = {
    approved: { label: "Live", color: "#047084", bg: "#04708414" },
    pending_review: { label: "Pending review", color: "#b45309", bg: "#fef3c7" },
    rejected: { label: "Rejected", color: "#c71f11", bg: "#fee2e2" },
};

export default function ManageProductsList() {
    const { token } = useAuth();
    const [items, setItems] = useState(null);
    const [editingId, setEditingId] = useState(null);

    const load = async () => {
        const res = await fetchMySellerSubmissions(token);
        if (res?.success) setItems(res.items);
    };
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!items) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#047084]" /></div>;
    if (!items.length) return <p className="py-10 text-center text-[13px] font-medium text-slate-400">You haven't listed any products yet.</p>;

    return (
        <div className="flex flex-col gap-3">
            {items.map((it) => (
                <ProductRow
                    key={it.id}
                    item={it}
                    editing={editingId === it.id}
                    onEdit={() => setEditingId(it.id)}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => { setEditingId(null); load(); }}
                    token={token}
                />
            ))}
        </div>
    );
}

function ProductRow({ item, editing, onEdit, onCancel, onSaved, token }) {
    const gp = item.brand?.generic_product;
    const sub = gp?.subcategory;
    const cat = sub?.category;
    const status = STATUS_STYLES[item.review_status] || STATUS_STYLES.pending_review;

    const [price, setPrice] = useState(item.price);
    const [moq, setMoq] = useState(item.moq);
    const [unit, setUnit] = useState(item.unit);
    const [leadTime, setLeadTime] = useState(item.lead_time);
    const [image, setImage] = useState(item.image);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState(null);

    const handleImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const res = await uploadSellerFile(token, file, "products");
        if (res?.success) setImage(res.url);
        setUploading(false);
    };

    const save = async () => {
        setErr(null); setSaving(true);
        const res = await updateSellerProductSubmission(token, item.id, {
            price, moq, unit, leadTime, image,
        });
        setSaving(false);
        if (!res?.success) return setErr(res?.message || "Couldn't save changes.");
        onSaved();
    };

    return (
        <div className="rounded-xl border border-slate-100 bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <img src={image || item.brand?.image} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-100 object-cover" />
                    <div>
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                            {cat?.name} {sub?.name && `› ${sub.name}`} {gp?.name && `› ${gp.name}`}
                        </p>
                        <p className="text-[13.5px] font-extrabold text-slate-900">{item.brand?.name}</p>
                        {item.brand?.brand_name && <p className="text-[11.5px] font-semibold text-slate-500">{item.brand.brand_name}</p>}
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: status.bg, color: status.color }}>
                            {item.review_status === "pending_review" && <Clock className="h-2.5 w-2.5" />}
                            {item.review_status === "rejected" && <AlertCircle className="h-2.5 w-2.5" />}
                            {status.label}
                        </span>
                        {item.review_status === "rejected" && item.rejection_reason && (
                            <p className="mt-1 text-[11px] font-medium text-[#c71f11]">{item.rejection_reason}</p>
                        )}
                    </div>
                </div>
                {!editing && (
                    <button onClick={onEdit} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                )}
            </div>

            {!editing ? (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-slate-500">
                    <span>₹{item.price} / {item.unit}</span>
                    <span>MOQ: {item.moq} {item.unit}</span>
                    <span>Lead time: {item.lead_time}</span>
                </div>
            ) : (
                <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-medium text-slate-400">Editing sends this listing back for admin review.</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        <LabeledInput label="Price" value={price} onChange={setPrice} type="number" />
                        <LabeledInput label="MOQ" value={moq} onChange={setMoq} type="number" />
                        <LabeledInput label="Unit" value={unit} onChange={setUnit} />
                        <LabeledInput label="Lead time" value={leadTime} onChange={setLeadTime} />
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={image || item.brand?.image} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                        <label className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600">
                            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace image"}
                            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                        </label>
                    </div>
                    {err && <p className="text-[11.5px] font-semibold text-[#c71f11]">{err}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={onCancel} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-500"><X className="h-3.5 w-3.5" /> Cancel</button>
                        <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: "linear-gradient(135deg,#0a95ab,#047084)" }}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Save</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function LabeledInput({ label, value, onChange, type = "text" }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
                className="rounded-lg border-2 border-slate-200 px-2.5 py-1.5 text-[13px] font-semibold text-slate-800 focus:border-[#047084] focus:outline-none" />
        </label>
    );
}