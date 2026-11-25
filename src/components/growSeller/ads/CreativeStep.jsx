// CreativeStep.jsx — step 2: what gets shown.
//   banner placements : upload one image per required shape (exact ratio), optional alt text, link target
//   product placements: choose which of your listings to promote
import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Store, Package, AlertTriangle } from "lucide-react";
import { uploadCreative } from "../../../utils/adsApi.js";
import { SHAPE_BY_KEY } from "../../home/bannerShapes.js";
import { money } from "./adsHelpers.js";

const MAX_BYTES = 2 * 1024 * 1024; // matches bannerImages.service.js
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function readDims(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const im = new Image();
        im.onload = () => { resolve({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(url); };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
        im.src = url;
    });
}

function UploadTile({ shape, url, busy, error, onPick }) {
    const meta = SHAPE_BY_KEY[shape] || { label: shape, ratio: 1, hint: "" };
    const inputRef = useRef(null);
    return (
        <div className="ad-up">
            <div className="ad-up-h"><b>{meta.label} image</b><span>{meta.hint}</span></div>
            <button
                type="button" className={`ad-up-box${url ? " has" : ""}`} style={{ aspectRatio: String(meta.ratio) }}
                onClick={() => inputRef.current?.click()} disabled={busy}
                aria-label={url ? `Replace ${meta.label} image` : `Upload ${meta.label} image`}
            >
                {url && <img src={url} alt="" />}
                {!url && !busy && <span><ImagePlus size={22} aria-hidden="true" /> Upload {meta.label}</span>}
                {busy && <span className="ad-up-busy"><Loader2 size={22} className="ad-spin" aria-hidden="true" /> Uploading…</span>}
                {url && !busy && <em><RefreshCw size={13} aria-hidden="true" /> Replace</em>}
            </button>
            <input ref={inputRef} type="file" accept={TYPES.join(",")} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(shape, f); }} />
            {error && <p className="ad-err" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
            <p className="ad-mute">JPG, PNG or WebP, up to 2 MB, exactly {meta.label}.{shape === "wide" ? " On desktop the sides of this banner are cropped a little, so keep the key content in the middle." : ""}</p>
        </div>
    );
}

export default function CreativeStep({ token, placement, value, onChange, products }) {
    const [busy, setBusy] = useState({});
    const [errors, setErrors] = useState({});
    const set = (patch) => onChange({ ...value, ...patch });

    const pick = async (shape, file) => {
        const meta = SHAPE_BY_KEY[shape];
        const fail = (m) => setErrors((e) => ({ ...e, [shape]: m }));
        setErrors((e) => ({ ...e, [shape]: null }));
        if (!TYPES.includes(file.type)) return fail("Use a JPG, PNG or WebP image.");
        if (file.size > MAX_BYTES) return fail("That file is over 2 MB.");
        try {
            const { w, h } = await readDims(file);
            if (meta && Math.abs(w / h - meta.ratio) / meta.ratio > 0.01) {
                return fail(`This image is ${w}×${h}. It must be exactly ${meta.label}.`);
            }
        } catch { return fail("We couldn't read that image."); }

        setBusy((b) => ({ ...b, [shape]: true }));
        const res = await uploadCreative(token, shape, file);
        setBusy((b) => ({ ...b, [shape]: false }));
        const url = res?.images?.[shape];
        if (!res?.success || !url) return fail(res?.message || "Upload failed. Please try again.");
        onChange({ ...value, images: { ...value.images, [shape]: url } });
    };

    /* ---------- product placement ---------- */
    if (placement.kind === "product") {
        return (
            <section className="ad-card">
                <h3>Which product do you want to promote?</h3>
                <ProductList products={products} selected={value.submissionId} onSelect={(id) => set({ submissionId: id })} />
            </section>
        );
    }

    /* ---------- banner placement ---------- */
    return (
        <div className="ad-creative">
            <section className="ad-card">
                <h3>Banner image{placement.aspectKeys.length > 1 ? "s" : ""}</h3>
                <div className="ad-up-grid">
                    {placement.aspectKeys.map((shape) => (
                        <UploadTile key={shape} shape={shape} url={value.images?.[shape]} busy={!!busy[shape]} error={errors[shape]} onPick={pick} />
                    ))}
                </div>
                <label className="ad-field">
                    <span>Alt text <small>(optional, for screen readers)</small></span>
                    <input type="text" maxLength={140} value={value.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Describe the banner in a few words" />
                </label>
            </section>

            <section className="ad-card">
                <h3>Where should a tap on the banner go?</h3>
                <div className="ad-radio" role="radiogroup" aria-label="Banner link">
                    <button type="button" role="radio" aria-checked={value.linkType === "shop"} className={value.linkType === "shop" ? "on" : ""} onClick={() => set({ linkType: "shop" })}>
                        <Store size={18} aria-hidden="true" /><span><b>My shop</b><small>Buyers see all your products.</small></span>
                    </button>
                    <button type="button" role="radio" aria-checked={value.linkType === "product"} className={value.linkType === "product" ? "on" : ""} onClick={() => set({ linkType: "product" })}>
                        <Package size={18} aria-hidden="true" /><span><b>One of my products</b><small>Buyers land on that product.</small></span>
                    </button>
                </div>
                {value.linkType === "product" && (
                    <ProductList products={products} selected={value.linkSubmissionId} onSelect={(id) => set({ linkSubmissionId: id })} />
                )}
            </section>
        </div>
    );
}

function ProductList({ products, selected, onSelect }) {
    if (products.loading) return <div className="ad-plist"><span className="ad-sk" /><span className="ad-sk" /></div>;
    if (products.error) return <p className="ad-err" role="alert">{products.error}</p>;
    if (!products.list.length) return <p className="ad-mute">You have no live products yet. Add and publish a product first, then come back.</p>;
    return (
        <ul className="ad-plist" role="radiogroup" aria-label="Your products">
            {products.list.map((p) => (
                <li key={p.submissionId}>
                    <button type="button" role="radio" aria-checked={selected === p.submissionId} className={selected === p.submissionId ? "on" : ""} onClick={() => onSelect(p.submissionId)}>
                        {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="ad-ph"><Package size={18} aria-hidden="true" /></span>}
                        <span><b>{p.name}</b><small>{[p.brandName, p.price ? money(p.price) : null].filter(Boolean).join(" · ")}</small></span>
                    </button>
                </li>
            ))}
        </ul>
    );
}