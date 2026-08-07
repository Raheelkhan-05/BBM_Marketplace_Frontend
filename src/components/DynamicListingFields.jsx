import { useState } from "react";

const C = { ink: "#0B1116", muted: "#667077", secondary: "#006F83", hair: "rgba(11,17,22,0.09)" };

// Renders whatever seller_listing_field_defs currently defines for a given
// wizard step ('details' | 'pricing') and reports values back as a flat
// object: { field_key: value }. Add/remove/require fields in Supabase —
// this component just reflects whatever GET /seller/catalog/listing-fields
// returns; nothing here needs to change when the form shape changes.
export default function DynamicListingFields({ fields, values, onChange, uploadFile }) {
    const setValue = (key, v) => onChange({ ...values, [key]: v });

    return (
        <div className="flex flex-col gap-4">
            {fields.map((field) => (
                <div key={field.field_key} className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                        {field.label} {field.unit ? `(${field.unit})` : ""}
                        {!field.is_required && <span className="normal-case font-medium"> — optional</span>}
                    </label>
                    {field.help_text && (
                        <p className="text-[11px] font-medium" style={{ color: C.muted }}>{field.help_text}</p>
                    )}
                    <FieldInput
                        field={field}
                        value={values[field.field_key]}
                        onChange={(v) => setValue(field.field_key, v)}
                        uploadFile={uploadFile}
                    />
                </div>
            ))}
        </div>
    );
}

function fieldWrap() {
    return "w-full rounded-md border-2 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4";
}

function FieldInput({ field, value, onChange, uploadFile }) {
    const style = { borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}20` };

    switch (field.field_type) {
        case "select":
            return (
                <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={fieldWrap()} style={style}>
                    <option value="" disabled>Select…</option>
                    {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        case "boolean":
            return (
                <div className="flex gap-2">
                    {["Yes", "No"].map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(opt)}
                            className="rounded-lg border-2 px-3.5 py-2 text-[12.5px] font-bold"
                            style={{
                                borderColor: value === opt ? C.secondary : C.hair,
                                color: value === opt ? C.secondary : C.muted,
                                background: value === opt ? `${C.secondary}10` : "white",
                            }}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            );
        case "textarea":
            return <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className={fieldWrap()} style={style} />;
        case "number":
            return (
                <input
                    type="text"
                    inputMode="decimal"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
                    className={fieldWrap()}
                    style={style}
                />
            );
        case "image":
        case "images":
            return <ImagesInput multiple={field.field_type === "images"} value={value} onChange={onChange} uploadFile={uploadFile} />;
        default:
            return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={fieldWrap()} style={style} />;
    }
}

function ImagesInput({ multiple, value, onChange, uploadFile }) {
    const urls = multiple ? (value || []) : (value ? [value] : []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const url = await uploadFile(file);
            if (!url) {
                setError("Upload failed — the server didn't return an image URL. Check the console/network tab for the /seller/upload response.");
                return;
            }
            onChange(multiple ? [...urls, url] : url);
        } catch (err) {
            console.error("Image upload threw:", err);
            setError(err?.message || "Upload failed unexpectedly.");
        } finally {
            setLoading(false);
            e.target.value = "";
        }
    };

    const remove = (url) => onChange(multiple ? urls.filter((u) => u !== url) : "");

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
                {urls.map((url) => (
                    <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                            type="button"
                            onClick={() => remove(url)}
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-[10px] leading-none text-white"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {(multiple || urls.length === 0) && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-slate-400">
                        <span className="text-[9px] font-bold">{loading ? "…" : "Add"}</span>
                        <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={loading} />
                    </label>
                )}
            </div>
            {error && <p className="text-[11px] font-semibold text-[#c71f11]">{error}</p>}
        </div>
    );
}