// Renders one input per field in a product's spec_schema and reports back
// the filled values as [{ key, value }] — the same shape
// hs_product_brands.attributes / fillBrandSpecValues already use.
//
// ASSUMED schema shape (confirm against generateSpecSchema.service.js and
// adjust field names below if it differs):
//   [{ key, label, type: 'text'|'number'|'select'|'boolean'|'textarea',
//      unit, required, options }]
//
// Unknown/missing `type` falls back to a plain text input so nothing in
// the schema silently fails to render.

const C = { ink: "#0B1116", muted: "#667077", secondary: "#006F83", hair: "rgba(11,17,22,0.09)" };

export default function SpecSchemaForm({ schema = [], values, onChange }) {
    const valueByKey = Object.fromEntries((values || []).map((v) => [v.key, v.value]));

    const setValue = (key, value) => {
        const next = { ...valueByKey, [key]: value };
        onChange(Object.entries(next).map(([k, v]) => ({ key: k, value: v })));
    };

    if (!schema.length) {
        return (
            <p className="rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] font-medium" style={{ borderColor: C.hair, color: C.muted }}>
                This product doesn't have a specification template yet — an admin needs to define one
                before detailed specs can be captured. You can still publish; your listing will be
                flagged for the team to fill in the template.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {schema.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                        {field.label || field.key} {field.unit ? `(${field.unit})` : ""}
                        {!field.required && <span className="normal-case font-medium"> — optional</span>}
                    </label>
                    <FieldInput field={field} value={valueByKey[field.key] ?? ""} onChange={(v) => setValue(field.key, v)} />
                </div>
            ))}
        </div>
    );
}

function fieldWrap() {
    return "w-full rounded-md border-2 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4";
}

function FieldInput({ field, value, onChange }) {
    const style = { borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}20` };

    if (field.type === "select" && Array.isArray(field.options)) {
        return (
            <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldWrap()} style={style}>
                <option value="" disabled>Select…</option>
                {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        );
    }
    if (field.type === "boolean") {
        return (
            <div className="flex gap-2">
                {["Yes", "No"].map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className="rounded-lg border-2 px-3.5 py-2 text-[12.5px] font-bold"
                        style={{ borderColor: value === opt ? C.secondary : C.hair, color: value === opt ? C.secondary : C.muted, background: value === opt ? `${C.secondary}10` : "white" }}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        );
    }
    if (field.type === "textarea") {
        return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={fieldWrap()} style={style} />;
    }
    if (field.type === "number") {
        return <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} className={fieldWrap()} style={style} />;
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={fieldWrap()} style={style} />;
}