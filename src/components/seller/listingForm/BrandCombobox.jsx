// components/seller/listingForm/BrandCombobox.jsx — RESTYLED (border weight,
// radius, and caption-label consistency to match the rest of the form)
import { useEffect, useRef, useState } from "react";
import { Search, ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { searchBrandNames } from "../../../utils/sellerListingApi.js";
import { uploadSellerFile } from "../../../utils/api.js";
import { C } from "./FormPrimitives.jsx";

export default function BrandCombobox({ value, notApplicable, image, onChange }) {
    const { token } = useAuth();
    const [q, setQ] = useState(value || "");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [uploading, setUploading] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        function onOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", onOutside);
        return () => document.removeEventListener("mousedown", onOutside);
    }, []);

    useEffect(() => {
        if (!open || notApplicable) return;
        const t = setTimeout(() => {
            searchBrandNames(token, q).then((res) => setItems(res?.success ? res.items : []));
        }, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [q, open, notApplicable, token]);

    const pick = (name, img) => {
        onChange({ brandName: name, brandImage: img || null, brandNotApplicable: false });
        setQ(name); setOpen(false);
    };

    const handleImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await uploadSellerFile(token, file, "brands");
            if (res?.success) onChange({ brandName: q, brandImage: res.url, brandNotApplicable: false });
        } finally {
            setUploading(false); e.target.value = "";
        }
    };

    if (notApplicable) {
        return (
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.hairSoft }}>
                <span className="text-[12.5px] font-bold" style={{ color: C.muted }}>Brand: Not Applicable</span>
                <button type="button" onClick={() => onChange({ brandName: "", brandImage: null, brandNotApplicable: false })} className="text-[11px] font-bold underline" style={{ color: C.secondary }}>Change</button>
            </div>
        );
    }

    return (
        <div ref={boxRef} className="relative flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: C.muted }}>Brand <span style={{ color: C.primary }}>*</span></span>
            <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                    <input
                        value={q}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                        placeholder="Search or type a new brand…"
                        className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-[13px] font-bold focus:outline-none focus:ring-2"
                        style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }}
                    />
                </div>
                {image ? (
                    <div className="relative h-10 w-10 shrink-0">
                        <img src={image} alt="" className="h-full w-full rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                        <button type="button" onClick={() => onChange({ brandName: q, brandImage: null, brandNotApplicable: false })} className="absolute -right-1 -top-1 rounded-full bg-black/60 p-0.5"><X className="h-2.5 w-2.5 text-white" /></button>
                    </div>
                ) : (
                    <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed" style={{ borderColor: C.hair, color: C.muted }} title="Optional brand logo">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                        <input type="file" accept="image/*" onChange={handleImage} className="hidden" disabled={uploading} />
                    </label>
                )}
            </div>
            <button type="button" onClick={() => onChange({ brandName: "", brandImage: null, brandNotApplicable: true })} className="w-fit text-[10.5px] font-bold underline" style={{ color: C.muted }}>
                This product has no brand
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-[64px] z-30 max-h-56 overflow-y-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: C.hair }}>
                    {items.map((it) => (
                        <button key={it.name} type="button" onClick={() => pick(it.name, it.image)} className="flex w-full items-center gap-2.5 border-b px-3.5 py-2.5 text-left last:border-b-0 transition-colors duration-150 hover:bg-black/[0.03]" style={{ borderColor: C.hairSoft }}>
                            {it.image ? <img src={it.image} alt="" className="h-6 w-6 rounded object-cover" /> : <span className="h-6 w-6 rounded" style={{ background: C.hairSoft }} />}
                            <span className="text-[12.5px] font-semibold" style={{ color: C.ink }}>{it.name}</span>
                        </button>
                    ))}
                    {items.length === 0 && <p className="px-3.5 py-3 text-center text-[11.5px] font-medium" style={{ color: C.muted }}>{q ? `No matches — "${q}" will be created as a new brand.` : "Start typing…"}</p>}
                </div>
            )}
        </div>
    );
}