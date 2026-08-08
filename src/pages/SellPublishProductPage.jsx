import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight, ArrowLeft, Loader2, CheckCircle2,
    Package, ClipboardList, IndianRupee, ClipboardCheck, Lock, Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerAccessStatus, createSellerSubmission, uploadSellerFile } from "../utils/api.js";
import ProductPathPicker from "../components/ProductPathPicker.jsx";

const STEPS = [
    { key: "product", title: "Choose Product", icon: Package },
    { key: "details", title: "Item Details", icon: ClipboardList },
    { key: "pricing", title: "Pricing & Availability", icon: IndianRupee },
    { key: "review", title: "Review & Publish", icon: ClipboardCheck },
];

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];
const EMPTY_FORM = { productName: "", brandName: "", image: "", price: "", moq: "", unit: "", leadTime: "" };

export default function SellPublishProductPage() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(undefined);
    const [shopSlug, setShopSlug] = useState(null);
    const [gate, setGate] = useState(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [path, setPath] = useState(null); // { category, subcategory, genericProduct }
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (!token) return;
        (async () => {
            const res = await fetchSellerAccessStatus(token);
            setAccess(res?.success ? res : { canPublish: false, reason: "NOT_AUTHENTICATED" });
            if (res?.success && res.shopSlug) setShopSlug(res.shopSlug);
        })();
    }, [token]);

    const choosePath = (picked) => { setPath(picked); setError(null); setStepIndex(1); };
    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const handleImageFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        setError(null);
        try {
            const res = await uploadSellerFile(token, file, "listings");
            if (!res?.success) throw new Error("Upload failed — check the network tab for the /seller/upload response.");
            setField("image", res.url);
        } catch (err) {
            setError(err.message || "Image upload failed.");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    const goNext = () => {
        setError(null);
        const missing = requiredMissing(STEPS[stepIndex].key, form);
        if (missing.length) return setError(`Please fill: ${missing.join(", ")}`);
        setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    };
    const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

    const handlePublish = async () => {
        setError(null);
        const missing = [...requiredMissing("details", form), ...requiredMissing("pricing", form)];
        if (missing.length) return setError(`Please fill: ${[...new Set(missing)].join(", ")}`);

        if (!token) { setGate({ canPublish: false, reason: "NOT_AUTHENTICATED" }); return; }
        let currentAccess = access;
        if (!currentAccess) {
            currentAccess = await fetchSellerAccessStatus(token);
            setAccess(currentAccess?.success ? currentAccess : { canPublish: false, reason: "NOT_AUTHENTICATED" });
        }
        if (!currentAccess?.canPublish) { setGate(currentAccess); return; }

        setSubmitting(true);
        try {
            const res = await createSellerSubmission(token, {
                genericProductId: path.genericProduct.id,
                productName: form.productName,
                brandName: form.brandName,
                price: form.price,
                moq: form.moq,
                unit: form.unit,
                leadTime: form.leadTime,
                image: form.image,
            });
            if (!res?.success) {
                if (["NOT_AUTHENTICATED", "SELLER_NOT_ONBOARDED", "SELLER_NOT_APPROVED"].includes(res?.code)) {
                    setGate({ canPublish: false, reason: res.code, sellerStatus: res.sellerStatus });
                    return;
                }
                return setError(res?.message || "Couldn't submit. Please check the required fields.");
            }
            setSubmitted(res);
        } finally {
            setSubmitting(false);
        }
    };

    if (gate) return <AccessGate access={gate} navigate={navigate} />;
    if (submitted) return <SubmittedScreen shopSlug={shopSlug} />;

    const progress = ((stepIndex + 1) / STEPS.length) * 100;

    return (
        <div className="mx-auto max-w-3xl min-h-screen px-4 pb-16 pt-6 sm:px-6">
            <h1 className="text-[clamp(1.5rem,3.5vw,1.9rem)] font-bold text-slate-900">List a product</h1>
            <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
                Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex].title}
            </p>

            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#047084]/10">
                <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#0a95ab,#047084)" }}
                    animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
            </div>

            <div className="mt-6 rounded-2xl border border-[#047084]/12 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(4,55,64,0.25)] sm:p-7">
                <AnimatePresence mode="wait">
                    <motion.div key={STEPS[stepIndex].key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                        {stepIndex === 0 && <ProductPathPicker onSelect={choosePath} />}

                        {stepIndex === 1 && (
                            <div className="flex flex-col gap-4">
                                <TextField label="Product name" value={form.productName} onChange={(v) => setField("productName", v)} placeholder="e.g. Premium Stainless Steel Hinges" />
                                <TextField label="Brand name" value={form.brandName} onChange={(v) => setField("brandName", v)} />
                                <ImageField image={form.image} uploading={uploadingImage} onFile={handleImageFile} onRemove={() => setField("image", "")} />
                            </div>
                        )}

                        {stepIndex === 2 && (
                            <div className="flex flex-col gap-4">
                                <TextField label="Price (₹)" value={form.price} onChange={(v) => setField("price", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                                <TextField label="MOQ (minimum order quantity)" value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                                <div className="flex flex-col gap-1">
                                    <label className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Unit</label>
                                    <select value={form.unit} onChange={(e) => setField("unit", e.target.value)}
                                        className="w-full rounded-md border-2 border-slate-100 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#006F83]/20">
                                        <option value="" disabled>Select unit…</option>
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <TextField label="Lead time" value={form.leadTime} onChange={(v) => setField("leadTime", v)} placeholder="e.g. 7–10 days" />
                            </div>
                        )}

                        {stepIndex === 3 && <ReviewStep form={form} path={path} />}
                    </motion.div>
                </AnimatePresence>

                {error && <p className="mt-4 text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}

                {stepIndex > 0 && (
                    <div className="mt-7 flex items-center justify-between gap-3">
                        <button type="button" onClick={goBack}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        {stepIndex < STEPS.length - 1 ? (
                            <button type="button" onClick={goNext}
                                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(199,31,17,0.55)]"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                Continue <ArrowRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button type="button" onClick={handlePublish} disabled={submitting}
                                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(199,31,17,0.55)]"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit for review <CheckCircle2 className="h-4 w-4" /></>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function requiredMissing(stepKey, form) {
    if (stepKey === "details") {
        const missing = [];
        if (!form.productName.trim()) missing.push("Product name");
        if (!form.brandName.trim()) missing.push("Brand name");
        if (!form.image) missing.push("Product image");
        return missing;
    }
    if (stepKey === "pricing") {
        const missing = [];
        if (!(Number(form.price) > 0)) missing.push("Price");
        if (!(Number(form.moq) > 0)) missing.push("MOQ");
        if (!form.unit) missing.push("Unit");
        if (!form.leadTime.trim()) missing.push("Lead time");
        return missing;
    }
    return [];
}

function TextField({ label, value, onChange, placeholder, inputMode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <input value={value} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border-2 border-slate-100 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#006F83]/20" />
        </div>
    );
}

function ImageField({ image, uploading, onFile, onRemove }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Product image</label>
            {image ? (
                <div className="relative h-28 w-28">
                    <img src={image} alt="" className="h-full w-full rounded-xl border border-slate-200 object-cover" />
                    <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[11px] leading-none text-white">×</button>
                </div>
            ) : (
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                    <span className="text-[10px] font-bold">{uploading ? "Uploading…" : "Add photo"}</span>
                    <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={uploading} />
                </label>
            )}
        </div>
    );
}

function ReviewStep({ form, path }) {
    const rows = [
        ["Category", path?.category?.name],
        ["Subcategory", path?.subcategory?.name],
        ["Product type", path?.genericProduct?.name],
        ["Product name", form.productName],
        ["Brand", form.brandName],
        ["Price", form.price ? `₹${form.price}` : ""],
        ["MOQ", form.moq && form.unit ? `${form.moq} ${form.unit}` : ""],
        ["Lead time", form.leadTime],
    ];
    return (
        <div className="flex flex-col gap-5">
            <p className="text-[13.5px] font-medium text-slate-600">Review before submitting for approval.</p>
            {form.image && <img src={form.image} alt="" className="h-32 w-32 rounded-xl border border-slate-200 object-cover" />}
            <div className="rounded-xl border border-slate-100">
                {rows.filter(([, v]) => v).map(([label, value], i, arr) => (
                    <div key={label} className={`flex justify-between gap-3 px-3.5 py-2 text-[13px] ${i !== arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                        <span className="font-semibold text-slate-500">{label}</span>
                        <span className="max-w-[60%] text-right font-bold text-slate-800">{String(value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AccessGate({ access, navigate }) {
    const content = {
        NOT_AUTHENTICATED: { icon: Lock, title: "Sign in to list a product", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        SELLER_NOT_ONBOARDED: { icon: Package, title: "Set up your seller shop first", body: "Listing a product requires an approved seller shop. It only takes a few minutes to set up.", cta: "Set up my shop", action: () => navigate("/seller/onboarding") },
        SELLER_NOT_APPROVED: { icon: Clock, title: access.sellerStatus === "pending_review" ? "Your shop is under review" : "Your shop isn't approved yet", body: access.sellerStatus === "pending_review" ? "We're verifying your details. You'll be able to list products once your shop is approved." : "Please check your shop status or contact support.", cta: "Check my shop status", action: () => navigate("/seller/status") },
    }[access.reason] || { icon: Lock, title: "Can't list right now", body: "Please try again in a moment.", cta: "Go back", action: () => navigate(-1) };
    const Icon = content.icon;
    return (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}><Icon className="h-6 w-6" /></span>
            <h2 className="mt-4 text-[19px] font-extrabold text-slate-900">{content.title}</h2>
            <p className="mt-2 text-[13.5px] font-medium text-slate-500">{content.body}</p>
            <button type="button" onClick={content.action} className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>{content.cta}</button>
        </div>
    );
}

function SubmittedScreen({ shopSlug }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}><CheckCircle2 className="h-7 w-7" /></span>
            <h2 className="mt-4 text-[20px] font-extrabold text-slate-900">Submitted for review</h2>
            <p className="mt-2 text-[13.5px] font-medium text-slate-500">We'll notify you once our team approves it — or let you know what to fix if it's rejected.</p>
            {shopSlug ? (
                <Link to={`/shop/${shopSlug}`} className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">Go to my shop</Link>
            ) : (
                <Link to="/seller/dashboard" className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">Go to my listings</Link>
            )}
        </div>
    );
}