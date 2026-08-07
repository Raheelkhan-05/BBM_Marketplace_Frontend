import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight, ArrowLeft, Loader2, CheckCircle2,
    Package, ClipboardList, IndianRupee, ClipboardCheck, Lock, Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
    fetchSellerAccessStatus,
    fetchProductSchema,
    fetchListingFieldDefs,
    createSellerListing,
    uploadSellerFile,
} from "../utils/api.js";
import ProductPathPicker from "../components/ProductPathPicker.jsx";
import SpecSchemaForm from "../components/SpecSchemaForm.jsx";
import DynamicListingFields from "../components/DynamicListingFields.jsx";

/* ------------------------------------------------------------------
   DESIGN NOTES — SellPublishProductPage
   ------------------------------------------------------------------
   Pure data capture, no review/approval workflow. The seller picks a
   category > subcategory > product from the EXISTING, already-approved
   taxonomy (ProductPathPicker), then fills in:
     - whatever generic fields seller_listing_field_defs currently
       defines (edit that table in Supabase to change this form —
       nothing here needs to change), rendered by DynamicListingFields
     - the chosen product's technical spec_schema, rendered by
       SpecSchemaForm (unchanged)
   and submits. No embedding dedup, no LLM classification, no AI image
   generation, no status tracking.
   ------------------------------------------------------------------ */

const STEPS = [
    { key: "product", title: "Choose Product", icon: Package },
    { key: "details", title: "Item Details", icon: ClipboardList },
    { key: "pricing", title: "Pricing & Availability", icon: IndianRupee },
    { key: "review", title: "Review & Publish", icon: ClipboardCheck },
];

export default function SellPublishProductPage() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(null); // { canPublish, reason, sellerStatus } | null while loading
    const [stepIndex, setStepIndex] = useState(0);
    const [path, setPath] = useState(null); // { category, subcategory, product }
    const [schema, setSchema] = useState({ specSchema: [], hasSpecSchema: false });
    const [listingFields, setListingFields] = useState([]); // from seller_listing_field_defs
    const [form, setForm] = useState({ data: {}, specifications: [] });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(null);

    useEffect(() => {
        (async () => {
            const res = await fetchSellerAccessStatus(token);
            setAccess(res?.success ? res : { canPublish: false, reason: "NOT_AUTHENTICATED" });
        })();
    }, [token]);

    useEffect(() => {
        (async () => {
            const res = await fetchListingFieldDefs();
            if (res?.success) setListingFields(res.fields || []);
        })();
    }, []);

    const detailsFields = listingFields.filter((f) => f.step === "details");
    const pricingFields = listingFields.filter((f) => f.step === "pricing");

    const choosePath = async (picked) => {
        setPath(picked);
        setError(null);
        const res = await fetchProductSchema(picked.product.id);
        if (res?.success) setSchema({ specSchema: res.specSchema || [], hasSpecSchema: res.hasSpecSchema });
        setStepIndex(1);
    };

    const updateData = (data) => setForm((f) => ({ ...f, data }));
    const updateSpecifications = (specifications) => setForm((f) => ({ ...f, specifications }));

    const goNext = () => {
        setError(null);
        const missing = requiredMissing(STEPS[stepIndex].key, form, listingFields, schema);
        if (missing.length) return setError(`Please fill: ${missing.join(", ")}`);
        setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    };
    const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

    const handlePublish = async () => {
        setError(null);
        const missing = [
            ...requiredMissing("details", form, listingFields, schema),
            ...requiredMissing("pricing", form, listingFields, schema),
        ];
        if (missing.length) return setError(`Please fill: ${[...new Set(missing)].join(", ")}`);

        setSubmitting(true);
        try {
            const res = await createSellerListing(token, {
                productId: path.product.id,
                data: form.data,
                specifications: form.specifications,
            });
            if (!res?.success) return setError(res?.message || "Couldn't save. Please check the required fields.");
            setSubmitted(res);
        } finally {
            setSubmitting(false);
        }
    };

    const uploadFile = async (file) => {
        const res = await uploadSellerFile(token, file, "listings");
        if (!res?.success) {
            console.error("uploadSellerFile failed:", res);
            return null;
        }
        return res.url;
    };

    if (access === null) {
        return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#047084]" /></div>;
    }
    if (!access.canPublish) return <AccessGate access={access} navigate={navigate} />;
    if (submitted) return <PublishedScreen />;

    const progress = ((stepIndex + 1) / STEPS.length) * 100;

    return (
        <div className="mx-auto max-w-3xl min-h-screen px-4 pb-16 pt-6 sm:px-6">
            <h1 className="text-[clamp(1.5rem,3.5vw,1.9rem)] font-bold text-slate-900">Publish a product</h1>
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
                            <div className="flex flex-col gap-6">
                                <DynamicListingFields fields={detailsFields} values={form.data} onChange={updateData} uploadFile={uploadFile} />
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Technical specifications</p>
                                    <SpecSchemaForm schema={schema.specSchema} values={form.specifications} onChange={updateSpecifications} />
                                </div>
                            </div>
                        )}

                        {stepIndex === 2 && (
                            <DynamicListingFields fields={pricingFields} values={form.data} onChange={updateData} uploadFile={uploadFile} />
                        )}

                        {stepIndex === 3 && <ReviewStep form={form} path={path} listingFields={listingFields} />}
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
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publish <CheckCircle2 className="h-4 w-4" /></>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function requiredMissing(stepKey, form, listingFields, schema) {
    if (stepKey === "details" || stepKey === "pricing") {
        const missing = [];
        for (const field of listingFields.filter((f) => f.step === stepKey)) {
            if (!field.is_required) continue;
            const v = form.data[field.field_key];
            const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
            if (empty) missing.push(field.label);
        }
        if (stepKey === "details") {
            const specByKey = Object.fromEntries((form.specifications || []).map((s) => [s.key, s.value]));
            for (const field of schema.specSchema || []) {
                if (field.required && !specByKey[field.key]) missing.push(field.label || field.key);
            }
        }
        return missing;
    }
    return [];
}

/* ---------- Review step ---------- */

function ReviewStep({ form, path, listingFields }) {
    const rows = [
        ["Category", path?.category?.name],
        ["Subcategory", path?.subcategory?.name],
        ["Product", path?.product?.name],
        ...listingFields
            .filter((f) => f.field_type !== "image" && f.field_type !== "images")
            .map((f) => [f.label, form.data[f.field_key]]),
    ];
    const imageField = listingFields.find((f) => f.field_type === "images" || f.field_type === "image");
    const previewImage = imageField ? (Array.isArray(form.data[imageField.field_key]) ? form.data[imageField.field_key][0] : form.data[imageField.field_key]) : null;

    return (
        <div className="flex flex-col gap-5">
            <p className="text-[13.5px] font-medium text-slate-600">Review your listing below before publishing.</p>
            {previewImage && <img src={previewImage} alt="" className="h-32 w-32 rounded-xl border border-slate-200 object-cover" />}
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
        NOT_AUTHENTICATED: { icon: Lock, title: "Sign in to publish a product", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        SELLER_NOT_ONBOARDED: { icon: Package, title: "Set up your seller shop first", body: "Publishing a product requires an approved seller shop. It only takes a few minutes to set up.", cta: "Set up my shop", action: () => navigate("/seller/onboarding") },
        SELLER_NOT_APPROVED: { icon: Clock, title: access.sellerStatus === "pending_review" ? "Your shop is under review" : "Your shop isn't approved yet", body: access.sellerStatus === "pending_review" ? "We're verifying your details. You'll be able to publish products once your shop is approved." : "Please check your shop status or contact support.", cta: "Check my shop status", action: () => navigate("/seller/status") },
    }[access.reason] || { icon: Lock, title: "Can't publish right now", body: "Please try again in a moment.", cta: "Go back", action: () => navigate(-1) };

    const Icon = content.icon;
    return (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-[19px] font-extrabold text-slate-900">{content.title}</h2>
            <p className="mt-2 text-[13.5px] font-medium text-slate-500">{content.body}</p>
            <button type="button" onClick={content.action}
                className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                {content.cta}
            </button>
        </div>
    );
}

function PublishedScreen() {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-[20px] font-extrabold text-slate-900">Saved</h2>
            <p className="mt-2 text-[13.5px] font-medium text-slate-500">
                Your product details have been saved.
            </p>
            <Link to="/seller/dashboard" className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">
                Go to my listings
            </Link>
        </div>
    );
}