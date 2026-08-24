import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { CheckCircle2, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerAccessStatus, createSellerSubmission, updateSellerProductSubmission } from "../utils/api.js";
import { fetchSubmissionDetail } from "../utils/sellerListingApi.js";
import ProductPathPicker from "../components/ProductPathPicker.jsx";
import SellerListingForm, { DEFAULT_LISTING_FORM } from "../components/seller/listingForm/SellerListingForm.jsx";

const C = { ink: "#0B1116", muted: "#667077" };

// Key under which an unsubmittable (not-a-seller-yet) product listing draft is cached
// locally, so the user's work isn't lost while they go complete/await seller onboarding.
export const PENDING_PRODUCT_SUBMISSION_KEY = "bbm_pending_product_submission";

export function savePendingProductSubmission(form) {
    try {
        localStorage.setItem(PENDING_PRODUCT_SUBMISSION_KEY, JSON.stringify({ form, savedAt: Date.now() }));
        return true;
    } catch {
        return false;
    }
}

export function readPendingProductSubmission() {
    try {
        const raw = localStorage.getItem(PENDING_PRODUCT_SUBMISSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.form ? parsed : null;
    } catch {
        return null;
    }
}

export function clearPendingProductSubmission() {
    try {
        localStorage.removeItem(PENDING_PRODUCT_SUBMISSION_KEY);
    } catch {
        /* noop */
    }
}

// Reasons that no longer get their own screen — the seller is bounced
// straight to /seller/listings, which already renders the right thing
// (onboarding form / pending-review message / listings) based on their
// current status. Only SELLER_NOT_ONBOARDED carries a toast message;
// SELLER_NOT_APPROVED redirects silently.
const REDIRECT_TO_LISTINGS_REASONS = new Set(["SELLER_NOT_ONBOARDED", "SELLER_NOT_APPROVED"]);

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
        // hsnCode: row.hsn_code || "",
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
    const [draftSaved, setDraftSaved] = useState(false);

    useEffect(() => {
        if (!token) {
            // Guest / logged-out: don't block on an access check that needs a token.
            // Let them see and fill the form as normal; handleSubmit already
            // catches NOT_AUTHENTICATED at submit time, saves their draft, and
            // routes them to the AccessGate to sign in.
            setAccess({ canPublish: true, guest: true });
            return;
        }
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

    // Note: auto-submitting any cached draft once the user becomes an approved seller is
    // now handled globally by <PendingSubmissionWatcher /> (mounted in App.jsx), so it fires
    // on whatever page the user happens to be on — not just this one. This page only reads
    // the draft below to prefill the form in case it's still awaiting approval.

    // Bounce straight to /seller/listings for SELLER_NOT_ONBOARDED / SELLER_NOT_APPROVED,
    // whether that came from the initial access check or from a submit attempt (`gate`).
    // Navigation happens immediately (no blocking dialog) — the toast message travels
    // as router state and is rendered by SellerManageListingsPage on arrival, so it
    // plays out smoothly on the destination page instead of a page mid-unmount.
    const activeReason = gate?.reason || (access && !access.canPublish ? access.reason : null);
    useEffect(() => {
        if (!activeReason || !REDIRECT_TO_LISTINGS_REASONS.has(activeReason)) return;
        const toast = activeReason === "SELLER_NOT_ONBOARDED"
            ? (draftSaved
                ? "Please set up your store — we've saved your product details and will submit it automatically once you're approved."
                : "Please set up your store first.")
            : null; // SELLER_NOT_APPROVED redirects silently, no toast
        navigate("/seller/listings", { replace: true, state: toast ? { toast } : undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeReason]);

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
                    // Not (yet) an approved seller — don't lose the filled-in product data.
                    // It gets picked up automatically once onboarding is submitted / approval completes.
                    if (!isEdit) {
                        setDraftSaved(savePendingProductSubmission(form));
                    }
                    setGate({ canPublish: false, reason: res.code, sellerStatus: res.sellerStatus });
                    return;
                }
                window.alert(res?.message || "Couldn't submit. Please check the required fields.");
                return;
            }
            // Successful submission — clear any stale pending draft.
            clearPendingProductSubmission();
            setSubmitted(res);
        } finally {
            setSubmitting(false);
        }
    };

    // While redirecting for these two reasons, show a loader — we're leaving
    // this page immediately, no need to flash any gate/error screen first.
    if (activeReason && REDIRECT_TO_LISTINGS_REASONS.has(activeReason)) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
            </div>
        );
    }

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

    const pendingDraft = !isEdit ? readPendingProductSubmission() : null;

    return (
        <div className="mx-auto max-w-4xl min-h-screen px-4 pt-6 sm:px-6 bg-[#FCFBF9]">
            <h1 className="text-[clamp(1.7rem,3.5vw,1.9rem)] font-bold text-slate-900">{isEdit ? "Edit listing" : "List a product"}</h1>
            <p className="mt-1.5 text-[13.5px] tracking-wide font-medium text-slate-500">
                {isEdit
                    ? "Update your commercial terms — buyers see this immediately if it's already approved."
                    : "Everything on one page. Save your Delivery, Tax & Legal, and Commercial Terms as groups once, and every future listing prefills from them."}
            </p>

            {pendingDraft && (
                <div className="mt-4 rounded-xl border border-[#7fb3bd]/40 bg-[#047084]/[0.05] px-4 py-3 text-[12.5px] font-semibold text-slate-600">
                    We found a listing you started earlier that couldn't be submitted yet — your details below have been restored from that draft.
                </div>
            )}

            {(access?.canPublish) && (isEdit ? editRecord : true) && (
                <div className="mt-6">
                    <SellerListingForm
                        mode={isEdit ? "edit" : "create"}
                        identityReadOnly={isEdit}
                        brandDisplay={brandDisplay}
                        initialValues={isEdit ? rowToFormValues(editRecord) : pendingDraft?.form}
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
        NOT_AUTHENTICATED: {
            icon: Lock,
            title: "Sign in to list a product",
            body: "You'll need to sign in to your BBM Marketplace account first.",
            cta: "Sign in",
            action: () => navigate("/login"),
        },
        NOT_FOUND: {
            icon: Lock,
            title: "Listing not found",
            body: "This listing doesn't exist or isn't yours.",
            cta: "Go to my listings",
            action: () => navigate("/seller/listings"),
        },
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
            <Link to="/seller/listings" className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-[13.5px] font-bold text-slate-700">
                {shopSlug ? "Go to my shop" : "Go to my listings"}
            </Link>
        </div>
    );
}