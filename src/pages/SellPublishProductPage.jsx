import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { CheckCircle2, Lock, Clock, Package, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerAccessStatus, createSellerSubmission, updateSellerProductSubmission } from "../utils/api.js";
import { fetchSubmissionDetail } from "../utils/sellerListingApi.js";
import ProductPathPicker from "../components/ProductPathPicker.jsx";
import SellerListingForm, { DEFAULT_LISTING_FORM } from "../components/seller/listingForm/SellerListingForm.jsx";

const C = { ink: "#0B1116", muted: "#667077" };

function rowToFormValues(row) {
    return {
        ...DEFAULT_LISTING_FORM,
        manufacturer: row.manufacturer || "",
        modelNo: row.model_no || "",
        gradeVariant: row.grade_variant || "",
        specifications: row.specifications || [],
        images: row.image ? [row.image] : [],
        basePrice: row.base_price ?? "",
        gstPercent: row.gst_percent ?? 18,
        ratePerPack: row.rate_per_pack ?? "",
        ratePerMasterPack: row.rate_per_master_pack ?? "",
        priceValidityTill: row.price_validity_till || DEFAULT_LISTING_FORM.priceValidityTill,
        moq: row.moq ?? "",
        sampleAvailable: row.sample_available || false,
        samplePrice: row.sample_price ?? "",
        priceSlabs: row.price_slabs || [],
        quantityDiscounts: row.quantity_discounts || [],
        packSize: row.pack_size ?? "",
        unit: row.unit || "",
        unitsPerMasterPack: row.units_per_master_pack ?? "",
        masterPackSize: row.master_pack_size ?? "",
        packagingType: row.packaging_type || "",
        stockQuantity: row.stock_quantity ?? "",
        stockType: row.stock_type || "ready_stock",
        dispatchTimeDays: row.dispatch_time_days ?? "",
        productionLeadTimeDays: row.production_lead_time_days ?? "",
        sellerLocation: row.seller_location || "",
        dispatchLocation: row.dispatch_location || "",
        deliveryTimeline: row.delivery_timeline || "",
        freightTerms: row.freight_terms || DEFAULT_LISTING_FORM.freightTerms,
        hsnCode: row.hsn_code || "",
        gstRegistrationStatus: row.gst_registration_status || "regular",
        taxInvoiceAvailable: row.tax_invoice_available ?? true,
        paymentTerms: row.payment_terms || "",
        returnPolicy: row.return_policy || "",
        warranty: row.warranty || "",
        qualityCertificates: row.quality_certificates || [],
        tdsMsdsCoa: row.tds_msds_coa || [],
        otherCertifications: row.other_certifications || [],
    };
}

export default function SellPublishProductPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { submissionId } = useParams(); // present only on the /seller/sell/:submissionId/edit route

    const isEdit = Boolean(submissionId);

    const [access, setAccess] = useState(undefined);
    const [gate, setGate] = useState(null);
    const [path, setPath] = useState(null);
    const [editRecord, setEditRecord] = useState(undefined); // undefined = loading, null = not found
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(null);
    const [shopSlug, setShopSlug] = useState(null);

    useEffect(() => {
        if (!token) return;
        (async () => {
            const res = await fetchSellerAccessStatus(token);
            setAccess(res?.success ? res : { canPublish: false, reason: "NOT_AUTHENTICATED" });
            if (res?.success && res.shopSlug) setShopSlug(res.shopSlug);
        })();
    }, [token]);

    useEffect(() => {
        if (!isEdit || !token) return;
        fetchSubmissionDetail(token, submissionId).then((res) => {
            setEditRecord(res?.success ? res.submission : null);
        });
    }, [isEdit, token, submissionId]);

    const handleSubmit = async (form) => {
        setSubmitting(true);
        try {
            let res;
            if (isEdit) {
                res = await updateSellerProductSubmission(token, submissionId, form);
            } else {
                res = await createSellerSubmission(token, form); // form already has genericProductId
                // res = await createSellerSubmission(token, { genericProductId: path.genericProduct.id, ...form });
            }
            if (!res?.success) {
                if (["NOT_AUTHENTICATED", "SELLER_NOT_ONBOARDED", "SELLER_NOT_APPROVED"].includes(res?.code)) {
                    setGate({ canPublish: false, reason: res.code, sellerStatus: res.sellerStatus });
                    return;
                }
                window.alert(res?.message || "Couldn't submit. Please check the required fields.");
                return;
            }
            setSubmitted(res);
        } finally {
            setSubmitting(false);
        }
    };

    if (gate) return <AccessGate access={gate} navigate={navigate} />;
    if (submitted) return <SubmittedScreen shopSlug={shopSlug} isEdit={isEdit} />;

    if (access === undefined || (isEdit && editRecord === undefined)) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
            </div>
        );
    }
    if (!access?.canPublish) return <AccessGate access={access} navigate={navigate} />;
    if (isEdit && !editRecord) return <AccessGate access={{ reason: "NOT_FOUND" }} navigate={navigate} />;

    const brandDisplay = isEdit && editRecord?.brand
        ? { name: editRecord.brand.name, brandName: editRecord.brand.brand_name, image: editRecord.brand.image }
        : null;

    return (
        <div className="mx-auto max-w-3xl min-h-screen px-4 pt-6 sm:px-6">
            <h1 className="text-[clamp(1.5rem,3.5vw,1.9rem)] font-bold text-slate-900">{isEdit ? "Edit listing" : "List a product"}</h1>
            <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
                {isEdit
                    ? "Update your commercial terms — buyers see this immediately if it's already approved."
                    : "Everything on one page. Save your Delivery, Tax & Legal, and Commercial Terms as groups once, and every future listing prefills from them."}
            </p>

            {(access?.canPublish) && (isEdit ? editRecord : true) && (
                <div className="mt-6">
                    <SellerListingForm
                        mode={isEdit ? "edit" : "create"}
                        identityReadOnly={isEdit}
                        brandDisplay={brandDisplay}
                        initialValues={isEdit ? rowToFormValues(editRecord) : undefined}
                        onSubmit={handleSubmit}
                        submitting={submitting}
                        submitLabel={isEdit ? "Save changes" : "Submit for review"}
                    />
                </div>
            )}
        </div>
    );
}

function AccessGate({ access, navigate }) {
    const content = {
        NOT_AUTHENTICATED: { icon: Lock, title: "Sign in to list a product", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        SELLER_NOT_ONBOARDED: { icon: Package, title: "Set up your seller shop first", body: "Listing a product requires an approved seller shop. It only takes a few minutes to set up.", cta: "Set up my shop", action: () => navigate("/seller/onboarding") },
        SELLER_NOT_APPROVED: { icon: Clock, title: access.sellerStatus === "pending_review" ? "Your shop is under review" : "Your shop isn't approved yet", body: access.sellerStatus === "pending_review" ? "We're verifying your details. You'll be able to list products once your shop is approved." : "Please check your shop status or contact support.", cta: "Check my shop status", action: () => navigate("/seller/status") },
        NOT_FOUND: { icon: Lock, title: "Listing not found", body: "This listing doesn't exist or isn't yours.", cta: "Go to my listings", action: () => navigate("/seller/dashboard") },
    }[access.reason] || { icon: Lock, title: "Can't do this right now", body: "Please try again in a moment.", cta: "Go back", action: () => navigate(-1) };
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

function SubmittedScreen({ shopSlug, isEdit }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}><CheckCircle2 className="h-7 w-7" /></span>
            <h2 className="mt-4 text-[20px] font-extrabold text-slate-900">{isEdit ? "Changes saved" : "Submitted for review"}</h2>
            <p className="mt-2 text-[13.5px] font-medium text-slate-500">{isEdit ? "Your listing has been updated." : "We'll notify you once our team approves it — or let you know what to fix if it's rejected."}</p>
            {shopSlug ? (
                <Link to={`/shop/${shopSlug}`} className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">Go to my shop</Link>
            ) : (
                <Link to="/seller/dashboard" className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">Go to my listings</Link>
            )}
        </div>
    );
}