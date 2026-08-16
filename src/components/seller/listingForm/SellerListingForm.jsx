import { useEffect, useMemo, useRef, useState } from "react";
import {
    Package, IndianRupee, Boxes, Archive, Truck, FileText, Handshake,
    ShieldCheck, Percent, ImagePlus, Loader2, CheckCircle2, AlertTriangle, Lock,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadSellerFile } from "../../../utils/api.js";
import {
    fetchCommissionInfo, fetchDefaultListingTemplates,
    fetchApprovedCategories, fetchApprovedSubcategories, fetchApprovedGenericProducts,
    createSellerCategoryEntry, createSellerSubcategoryEntry, createSellerGenericProductEntry,
} from "../../../utils/sellerListingApi.js";
import {
    C, TextField, TextAreaField, SelectField, ToggleField, ChipToggleGroup, RepeatableRows, SectionCard,
} from "./FormPrimitives.jsx";
import HierarchyCombobox from "./HierarchyCombobox.jsx";

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];
const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];

const todayPlus = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

export const DEFAULT_LISTING_FORM = {
    // hierarchy — new
    categoryEntry: null, subcategoryEntry: null, genericProductEntry: null, genericProductId: "",

    productName: "", brandName: "",
    manufacturer: "", modelNo: "", gradeVariant: "",
    specifications: [],
    images: [],

    basePrice: "", gstPercent: 18, ratePerPack: "", ratePerMasterPack: "", priceValidityTill: todayPlus(30),

    moq: "", sampleAvailable: false, samplePrice: "",
    priceSlabs: [], quantityDiscounts: [],

    packSize: "", unit: "", unitsPerMasterPack: "", masterPackSize: "", packagingType: "",

    stockQuantity: "", stockType: "ready_stock", dispatchTimeDays: "3", productionLeadTimeDays: "",

    sellerLocation: "", dispatchLocation: "", deliveryTimeline: "3-7 business days",
    freightTerms: "Freight charges are extra, borne by the buyer unless otherwise agreed.",

    hsnCode: "", gstRegistrationStatus: "regular", taxInvoiceAvailable: true,

    paymentTerms: "100% advance payment before dispatch",
    returnPolicy: "7-day replacement for manufacturing defects only. Raise a return ticket from your order within 48 hours of delivery.",
    warranty: "",

    qualityCertificates: [], tdsMsdsCoa: [], otherCertifications: [],
};

// Every groupable section maps to a "section id" for scroll/expand, in
// addition to its own field list — sectionId lines up with the id given
// to each <SectionCard> below.
const SECTIONS = {
    product: { id: "section-product" },
    pricing: { id: "section-pricing" },
    quantity: { id: "section-quantity" },
    packaging: { id: "section-packaging", groupFields: ["packSize", "unit", "unitsPerMasterPack", "masterPackSize", "packagingType"] },
    availability: { id: "section-availability" },
    delivery: { id: "section-delivery", groupFields: ["sellerLocation", "dispatchLocation", "deliveryTimeline", "freightTerms"] },
    tax_legal: { id: "section-tax_legal", groupFields: ["hsnCode", "gstRegistrationStatus", "taxInvoiceAvailable"] },
    commercial_terms: { id: "section-commercial_terms", groupFields: ["paymentTerms", "returnPolicy", "warranty"] },
    quality: { id: "section-quality", groupFields: ["qualityCertificates", "tdsMsdsCoa", "otherCertifications"] },
    marketplace: { id: "section-marketplace" },
};

// Which section each field key lives in — used to auto-expand the right
// SectionCard before scrolling to an error.
const FIELD_SECTION = {
    genericProductId: "product", productName: "product", brandName: "product",
    manufacturer: "product", modelNo: "product", images: "product",
    basePrice: "pricing", gstPercent: "pricing", priceValidityTill: "pricing", ratePerPack: "pricing",
    moq: "quantity",
    packSize: "packaging", unit: "packaging",
    stockQuantity: "availability", stockType: "availability", dispatchTimeDays: "availability", productionLeadTimeDays: "availability",
    sellerLocation: "delivery", dispatchLocation: "delivery", deliveryTimeline: "delivery",
    hsnCode: "tax_legal", gstRegistrationStatus: "tax_legal",
    paymentTerms: "commercial_terms", returnPolicy: "commercial_terms",
};

function computeMissing(form, { requireIdentity, requireProductDetails = true }) {
    const missing = [];
    const add = (cond, key, label) => { if (cond) missing.push({ key, label }); };

    add(requireIdentity && !form.genericProductId, "genericProductId", "Category / subcategory / product type");
    if (requireIdentity) {
        add(!form.productName?.trim(), "productName", "Product name");
        add(!form.brandName?.trim(), "brandName", "Brand name");
    }
    if (requireProductDetails) {
        add(!form.manufacturer?.trim(), "manufacturer", "Manufacturer");
        add(!form.modelNo?.trim(), "modelNo", "Model / Part No. / SKU");
        add(!form.images?.length, "images", "Product image");
    }

    add(!(Number(form.basePrice) > 0), "basePrice", "Base price");
    add(form.gstPercent === "" || form.gstPercent == null, "gstPercent", "GST %");
    add(!form.priceValidityTill, "priceValidityTill", "Price validity");
    add(!(Number(form.moq) > 0), "moq", "MOQ");
    add(!(Number(form.packSize) > 0), "packSize", "Pack size");
    add(!form.unit, "unit", "Unit of measurement");
    add(Number(form.packSize) > 1 && !(Number(form.ratePerPack) > 0), "ratePerPack", "Rate per pack");
    add(form.stockQuantity === "" || form.stockQuantity == null, "stockQuantity", "Stock available");
    add(!form.stockType, "stockType", "Ready stock / Made-to-order");
    add(form.dispatchTimeDays === "" || form.dispatchTimeDays == null, "dispatchTimeDays", "Expected dispatch time");
    add(form.stockType === "made_to_order" && !(form.productionLeadTimeDays !== "" && form.productionLeadTimeDays != null), "productionLeadTimeDays", "Production lead time");
    add(!form.sellerLocation?.trim(), "sellerLocation", "Seller location");
    add(!form.dispatchLocation?.trim(), "dispatchLocation", "Dispatch location");
    add(!form.deliveryTimeline?.trim(), "deliveryTimeline", "Delivery timeline");
    add(!form.hsnCode?.trim(), "hsnCode", "HSN Code");
    add(!form.gstRegistrationStatus, "gstRegistrationStatus", "GST registration status");
    add(!form.paymentTerms?.trim(), "paymentTerms", "Payment terms");
    add(!form.returnPolicy?.trim(), "returnPolicy", "Return / replacement policy");

    return missing;
}

function pick(obj, keys) { return Object.fromEntries(keys.map((k) => [k, obj[k]])); }

function SpecRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex justify-between gap-3 border-b py-1.5 text-[12.5px]" style={{ borderColor: C.hairSoft }}>
            <span className="font-semibold" style={{ color: C.muted }}>{label}</span>
            <span className="font-bold text-right" style={{ color: C.ink }}>{value}</span>
        </div>
    );
}

function ReadOnlyProductSummary({ brandDisplay, form }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: C.hairSoft }}>
                {brandDisplay?.image && <img src={brandDisplay.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{brandDisplay?.name}</p>
                    {brandDisplay?.brandName && <p className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{brandDisplay.brandName}</p>}
                </div>
            </div>
            <div className="rounded-xl border px-3.5" style={{ borderColor: C.hairSoft }}>
                <SpecRow label="Manufacturer" value={form.manufacturer} />
                <SpecRow label="Model / Part No. / SKU" value={form.modelNo} />
                <SpecRow label="Grade / Variant" value={form.gradeVariant} />
            </div>
            {form.specifications?.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Specifications</span>
                    <div className="rounded-xl border px-3.5" style={{ borderColor: C.hairSoft }}>
                        {form.specifications.map((s, i) => <SpecRow key={i} label={s.key} value={s.value} />)}
                    </div>
                </div>
            )}
            {form.images?.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Product images ({form.images.length})</span>
                    <div className="flex flex-wrap gap-2">
                        {form.images.map((src, i) => (
                            <div key={src + i} className="relative h-20 w-20">
                                <img src={src} alt="" className="h-full w-full rounded-xl border object-cover" style={{ borderColor: C.hair }} />
                                {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-black/60 py-0.5 text-center text-[9px] font-bold text-white">Cover</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: C.muted }}>
                <Lock className="h-3 w-3 shrink-0" /> This product's identity was already reviewed and approved — you're only adding your commercial terms below.
            </p>
        </div>
    );
}

// Small wrapper so any field can be a scroll/highlight target and take
// a red ring for ~1.6s when it's the reason the submit was blocked.
function FieldAnchor({ fieldKey, children }) {
    return <div id={`field-${fieldKey}`} className="rounded-xl transition-shadow">{children}</div>;
}

export default function SellerListingForm({
    mode = "create",
    initialValues,
    identityReadOnly = false,
    productReadOnly = false,
    brandDisplay,
    onSubmit,
    submitting,
    submitLabel = "Submit for review",
    stickyFooter = true,
}) {
    const { token } = useAuth();
    const [form, setForm] = useState({ ...DEFAULT_LISTING_FORM, ...(initialValues || {}) });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [commissionPercent, setCommissionPercent] = useState(5);
    const [error, setError] = useState(null);

    // Controlled open/closed state per section. Everything defaults open
    // except the ones that used to be collapsed — matches the old
    // defaultOpen behavior until an error forces one open.
    const [openSections, setOpenSections] = useState({
        product: true, pricing: true, quantity: false, packaging: false,
        availability: false, delivery: false, tax_legal: false,
        commercial_terms: false, quality: false, marketplace: true,
    });
    const setSectionOpen = (key, val) => setOpenSections((s) => ({ ...s, [key]: val }));

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const applyGroup = (data) => setForm((f) => ({ ...f, ...data }));

    useEffect(() => {
        fetchCommissionInfo().then((res) => { if (res?.success) setCommissionPercent(res.commissionPercent); });
    }, []);

    // Prefill from the seller's auto-saved defaults on a brand new listing.
    useEffect(() => {
        if (mode !== "create" && mode !== "claim") return;
        if (!token) return;
        fetchDefaultListingTemplates(token).then((res) => {
            if (!res?.success) return;
            setForm((f) => {
                const next = { ...f };
                Object.entries(res.defaults).forEach(([groupType, tpl]) => {
                    (SECTIONS[groupType]?.groupFields || []).forEach((key) => {
                        if (tpl.data?.[key] !== undefined) next[key] = tpl.data[key];
                    });
                });
                return next;
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, token]);

    const finalPrice = useMemo(() => {
        const base = Number(form.basePrice);
        const gst = Number(form.gstPercent);
        if (!(base > 0)) return 0;
        return Math.round(base * (1 + (gst || 0) / 100) * 100) / 100;
    }, [form.basePrice, form.gstPercent]);

    const marketplace = useMemo(() => {
        const commissionAmount = Math.round(finalPrice * (commissionPercent / 100) * 100) / 100;
        return { commissionAmount, sellerPayout: Math.round((finalPrice - commissionAmount) * 100) / 100 };
    }, [finalPrice, commissionPercent]);

    const missing = useMemo(
        () => computeMissing(form, { requireIdentity: mode === "create", requireProductDetails: !productReadOnly }),
        [form, mode, productReadOnly]
    );

    const handleImageFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingImage(true);
        setError(null);
        try {
            const urls = [];
            for (const file of files) {
                const res = await uploadSellerFile(token, file, "listings");
                if (!res?.success) throw new Error("Image upload failed.");
                urls.push(res.url);
            }
            setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
        } catch (err) {
            setError(err.message || "Image upload failed.");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };
    const removeImageAt = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

    function jumpToError(firstMissing) {
        const sectionKey = FIELD_SECTION[firstMissing.key];
        if (sectionKey) setSectionOpen(sectionKey, true);
        // Let the section actually render open before measuring/scrolling.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const target = document.getElementById(`field-${firstMissing.key}`)
                    || document.getElementById(SECTIONS[sectionKey]?.id);
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.style.boxShadow = "0 0 0 3px rgba(199,31,17,0.35)";
                setTimeout(() => { target.style.boxShadow = ""; }, 1600);
            });
        });
    }

    const handleSubmit = () => {
        if (missing.length) {
            setError(`Please complete: ${missing.slice(0, 4).map((m) => m.label).join(", ")}${missing.length > 4 ? `, +${missing.length - 4} more` : ""}.`);
            jumpToError(missing[0]);
            return;
        }
        setError(null);
        // genericProductId already lives on `form` from the hierarchy
        // picker, so callers (SellPublishProductPage) no longer need a
        // separate `path` object — the whole payload travels as one.
        onSubmit(form);
    };

    const footer = (
        <div
            className={stickyFooter ? "fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 py-3 backdrop-blur sm:px-6" : "sticky bottom-0 z-10 mt-1 border-t bg-white px-1 py-3"}
            style={{ borderColor: C.hair }}
        >
            <div className={stickyFooter ? "mx-auto flex max-w-3xl items-center justify-between gap-3" : "flex items-center justify-between gap-3"}>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                        {missing.length === 0 ? "Ready to submit" : `${missing.length} field${missing.length === 1 ? "" : "s"} left`}
                    </p>
                    <p className="truncate text-[15px] font-extrabold" style={{ color: C.ink }}>
                        ₹{finalPrice.toLocaleString("en-IN")} <span className="text-[11px] font-semibold" style={{ color: C.muted }}>incl. GST</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(199,31,17,0.55)] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{submitLabel} <CheckCircle2 className="h-4 w-4" /></>}
                </button>
            </div>
        </div>
    );

    return (
        <div className={stickyFooter ? "flex flex-col gap-4 pb-28" : "flex flex-col gap-4"}>
            {error && (
                <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: "#c71f11" }}>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
            )}

            {/* ---------------- Product ---------------- */}
            <SectionCard id={SECTIONS.product.id} icon={Package} title="Product"
                subtitle={productReadOnly ? "Already approved — read only" : "Category, identity, specs & photos"}
                open={openSections.product} onOpenChange={(v) => setSectionOpen("product", v)}>
                {productReadOnly ? (
                    <ReadOnlyProductSummary brandDisplay={brandDisplay} form={form} />
                ) : (
                    <>
                        {mode === "create" && !brandDisplay && (
                            <FieldAnchor fieldKey="genericProductId">
                                <div className="flex flex-col gap-3 rounded-xl border p-3.5" style={{ borderColor: C.hairSoft }}>
                                    <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Where does this belong?</p>
                                    <HierarchyCombobox
                                        label="Category" required value={form.categoryEntry}
                                        fetcher={(q) => fetchApprovedCategories(token, q)}
                                        onCreate={(name) => createSellerCategoryEntry(token, name)}
                                        onSelect={(entry) => setForm((f) => ({ ...f, categoryEntry: entry, subcategoryEntry: null, genericProductEntry: null, genericProductId: "" }))}
                                        placeholder="Search or create a category…"
                                    />
                                    {form.categoryEntry && (
                                        <HierarchyCombobox
                                            label="Subcategory" required value={form.subcategoryEntry}
                                            fetcher={(q) => fetchApprovedSubcategories(token, form.categoryEntry.id, q)}
                                            onCreate={(name) => createSellerSubcategoryEntry(token, name, form.categoryEntry.id)}
                                            onSelect={(entry) => setForm((f) => ({ ...f, subcategoryEntry: entry, genericProductEntry: null, genericProductId: "" }))}
                                            placeholder="Search or create a subcategory…"
                                        />
                                    )}
                                    {form.subcategoryEntry && (
                                        <HierarchyCombobox
                                            label="Product type" required value={form.genericProductEntry}
                                            fetcher={(q) => fetchApprovedGenericProducts(token, form.subcategoryEntry.id, q)}
                                            onCreate={(name) => createSellerGenericProductEntry(token, name, form.subcategoryEntry.id)}
                                            onSelect={(entry) => setForm((f) => ({ ...f, genericProductEntry: entry, genericProductId: entry.id }))}
                                            placeholder="Search or create a product type…"
                                        />
                                    )}
                                    {(form.categoryEntry?.review_status === "pending_review" || form.subcategoryEntry?.review_status === "pending_review" || form.genericProductEntry?.review_status === "pending_review") && (
                                        <p className="text-[11px] font-medium" style={{ color: C.muted }}>
                                            New entries go live for buyers once this listing is approved — you can carry on and submit right away.
                                        </p>
                                    )}
                                </div>
                            </FieldAnchor>
                        )}

                        {brandDisplay ? (
                            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: C.hairSoft }}>
                                {brandDisplay.image && <img src={brandDisplay.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                                <div>
                                    <p className="text-[13.5px] font-extrabold" style={{ color: C.ink }}>{brandDisplay.name}</p>
                                    {brandDisplay.brandName && <p className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{brandDisplay.brandName}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FieldAnchor fieldKey="productName">
                                    <TextField required label="Product name" value={form.productName} onChange={(v) => setField("productName", v)} disabled={identityReadOnly} placeholder="e.g. Premium Stainless Steel Hinges" />
                                </FieldAnchor>
                                <FieldAnchor fieldKey="brandName">
                                    <TextField required label="Brand" value={form.brandName} onChange={(v) => setField("brandName", v)} disabled={identityReadOnly} />
                                </FieldAnchor>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FieldAnchor fieldKey="manufacturer">
                                <TextField required label="Manufacturer" value={form.manufacturer} onChange={(v) => setField("manufacturer", v)} />
                            </FieldAnchor>
                            <FieldAnchor fieldKey="modelNo">
                                <TextField required label="Model / Part No. / SKU" value={form.modelNo} onChange={(v) => setField("modelNo", v)} />
                            </FieldAnchor>
                        </div>
                        <TextField label="Grade / Variant" value={form.gradeVariant} onChange={(v) => setField("gradeVariant", v)} hint="If this product comes in grades or variants (e.g. Grade A, Size M)" placeholder="Optional" />

                        <RepeatableRows
                            label="Specifications / technical data sheet"
                            hint="Key-value pairs buyers see on the product page, e.g. Material: Stainless Steel 304"
                            rows={form.specifications}
                            onChange={(rows) => setField("specifications", rows)}
                            addLabel="Add specification"
                            columns={[{ key: "key", placeholder: "Attribute (e.g. Material)" }, { key: "value", placeholder: "Value (e.g. SS304)" }]}
                        />

                        <FieldAnchor fieldKey="images">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                                    Product images {form.images.length > 0 && `(${form.images.length})`} {!identityReadOnly && <span style={{ color: C.primary }}>*</span>}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {form.images.map((src, i) => (
                                        <div key={src + i} className="relative h-20 w-20">
                                            <img src={src} alt="" className="h-full w-full rounded-xl border object-cover" style={{ borderColor: C.hair }} />
                                            <button type="button" onClick={() => removeImageAt(i)} className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[11px] leading-none text-white">×</button>
                                            {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-black/60 py-0.5 text-center text-[9px] font-bold text-white">Cover</span>}
                                        </div>
                                    ))}
                                    <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed" style={{ borderColor: C.hairSoft, color: C.muted }}>
                                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                        <span className="text-[9.5px] font-bold">{uploadingImage ? "Uploading…" : "Add"}</span>
                                        <input type="file" accept="image/*" multiple onChange={handleImageFiles} className="hidden" disabled={uploadingImage} />
                                    </label>
                                </div>
                            </div>
                        </FieldAnchor>
                    </>
                )}
            </SectionCard>

            {/* ---------------- Pricing ---------------- */}
            <SectionCard id={SECTIONS.pricing.id} icon={IndianRupee} title="Pricing" subtitle="Base price, GST & validity"
                open={openSections.pricing} onOpenChange={(v) => setSectionOpen("pricing", v)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldAnchor fieldKey="basePrice">
                        <TextField required label="Base price / rate per unit (₹, excl. GST)" value={form.basePrice} onChange={(v) => setField("basePrice", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="gstPercent">
                        <ChipToggleGroup label="GST %" value={Number(form.gstPercent)} onChange={(v) => setField("gstPercent", Number(v))} options={GST_OPTIONS.map((g) => ({ value: g, label: `${g}%` }))} />
                    </FieldAnchor>
                </div>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: `${C.secondary}0c` }}>
                    <span className="text-[12.5px] font-bold" style={{ color: C.muted }}>Final price (incl. GST)</span>
                    <span className="text-[17px] font-extrabold" style={{ color: C.secondary }}>₹{finalPrice.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldAnchor fieldKey="ratePerPack">
                        <TextField label="Rate per pack (₹)" value={form.ratePerPack} onChange={(v) => setField("ratePerPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" required={Number(form.packSize) > 1} hint="Required once Pack Size below is more than 1" />
                    </FieldAnchor>
                    <TextField label="Rate per master pack (₹)" value={form.ratePerMasterPack} onChange={(v) => setField("ratePerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <FieldAnchor fieldKey="priceValidityTill">
                    <TextField required type="date" label="Price validity" value={form.priceValidityTill} onChange={(v) => setField("priceValidityTill", v)} hint="This rate is guaranteed to buyers until this date" />
                </FieldAnchor>
            </SectionCard>

            {/* ---------------- Quantity ---------------- */}
            <SectionCard id={SECTIONS.quantity.id} icon={Boxes} title="Quantity" subtitle="MOQ, samples & bulk pricing"
                open={openSections.quantity} onOpenChange={(v) => setSectionOpen("quantity", v)}>
                <FieldAnchor fieldKey="moq">
                    <TextField required label="MOQ (minimum order quantity)" value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                </FieldAnchor>
                <ToggleField label="Sample available" value={form.sampleAvailable} onChange={(v) => setField("sampleAvailable", v)} />
                {form.sampleAvailable && (
                    <TextField label="Sample price (₹)" value={form.samplePrice} onChange={(v) => setField("samplePrice", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Leave blank if free" />
                )}
                <RepeatableRows
                    label="Order quantity price slabs" hint="Recommended — different pricing at different order volumes"
                    rows={form.priceSlabs} onChange={(rows) => setField("priceSlabs", rows)} addLabel="Add price slab"
                    columns={[{ key: "minQty", placeholder: "Min qty", inputMode: "decimal" }, { key: "maxQty", placeholder: "Max qty (optional)", inputMode: "decimal" }, { key: "price", placeholder: "₹ price", inputMode: "decimal" }]}
                />
                <RepeatableRows
                    label="Quantity discounts" hint="Recommended — e.g. 5% off above 500 units"
                    rows={form.quantityDiscounts} onChange={(rows) => setField("quantityDiscounts", rows)} addLabel="Add discount tier"
                    columns={[{ key: "minQty", placeholder: "Min qty", inputMode: "decimal" }, { key: "discountPercent", placeholder: "Discount %", inputMode: "decimal" }]}
                />
            </SectionCard>

            {/* ---------------- Packaging (auto-saved group) ---------------- */}
            <SectionCard id={SECTIONS.packaging.id} icon={Archive} title="Packaging" subtitle="Pack size & unit of measurement — saved automatically for next time"
                open={openSections.packaging} onOpenChange={(v) => setSectionOpen("packaging", v)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldAnchor fieldKey="packSize">
                        <TextField required label="Pack size" value={form.packSize} onChange={(v) => setField("packSize", v.replace(/[^\d.]/g, ""))} inputMode="decimal" hint="Units per pack, e.g. 10" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="unit">
                        <SelectField required label="Unit of measurement" value={form.unit} onChange={(v) => setField("unit", v)} options={UNITS} />
                    </FieldAnchor>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Units per master pack" value={form.unitsPerMasterPack} onChange={(v) => setField("unitsPerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                    <TextField label="Master pack size" value={form.masterPackSize} onChange={(v) => setField("masterPackSize", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <TextField label="Packaging type" value={form.packagingType} onChange={(v) => setField("packagingType", v)} placeholder="e.g. Carton box, Poly bag, Wooden crate" />
            </SectionCard>

            {/* ---------------- Availability ---------------- */}
            <SectionCard id={SECTIONS.availability.id} icon={Boxes} title="Availability" subtitle="Stock & dispatch readiness"
                open={openSections.availability} onOpenChange={(v) => setSectionOpen("availability", v)}>
                <FieldAnchor fieldKey="stockQuantity">
                    <TextField required label="Stock available" value={form.stockQuantity} onChange={(v) => setField("stockQuantity", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                </FieldAnchor>
                <FieldAnchor fieldKey="stockType">
                    <ChipToggleGroup label="Fulfilment type" value={form.stockType} onChange={(v) => setField("stockType", v)}
                        options={[{ value: "ready_stock", label: "Ready stock" }, { value: "made_to_order", label: "Made-to-order" }]} />
                </FieldAnchor>
                <FieldAnchor fieldKey="dispatchTimeDays">
                    <TextField required label="Expected dispatch time (days)" value={form.dispatchTimeDays} onChange={(v) => setField("dispatchTimeDays", v.replace(/[^\d]/g, ""))} inputMode="numeric" />
                </FieldAnchor>
                {form.stockType === "made_to_order" && (
                    <FieldAnchor fieldKey="productionLeadTimeDays">
                        <TextField required label="Production lead time (days)" value={form.productionLeadTimeDays} onChange={(v) => setField("productionLeadTimeDays", v.replace(/[^\d]/g, ""))} inputMode="numeric" />
                    </FieldAnchor>
                )}
            </SectionCard>

            {/* ---------------- Delivery (auto-saved group) ---------------- */}
            <SectionCard id={SECTIONS.delivery.id} icon={Truck} title="Delivery" subtitle="Locations, timeline & freight — saved automatically for next time"
                open={openSections.delivery} onOpenChange={(v) => setSectionOpen("delivery", v)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldAnchor fieldKey="sellerLocation">
                        <TextField required label="Seller location" value={form.sellerLocation} onChange={(v) => setField("sellerLocation", v)} placeholder="City, State" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="dispatchLocation">
                        <TextField required label="Dispatch location" value={form.dispatchLocation} onChange={(v) => setField("dispatchLocation", v)} placeholder="City, State" />
                    </FieldAnchor>
                </div>
                <FieldAnchor fieldKey="deliveryTimeline">
                    <TextField required label="Delivery timeline" value={form.deliveryTimeline} onChange={(v) => setField("deliveryTimeline", v)} placeholder="e.g. 3-7 business days" />
                </FieldAnchor>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: C.hairSoft }}>
                    <span className="text-[12.5px] font-bold" style={{ color: C.ink }}>Freight</span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${C.primary}12`, color: C.primary }}>Always extra — buyer pays freight</span>
                </div>
                <TextAreaField label="Freight terms" value={form.freightTerms} onChange={(v) => setField("freightTerms", v)} rows={2} />
            </SectionCard>

            {/* ---------------- Tax & Legal (auto-saved group) ---------------- */}
            <SectionCard id={SECTIONS.tax_legal.id} icon={FileText} title="Tax & Legal" subtitle="HSN, GST & invoicing — saved automatically for next time"
                open={openSections.tax_legal} onOpenChange={(v) => setSectionOpen("tax_legal", v)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldAnchor fieldKey="hsnCode">
                        <TextField required label="HSN Code" value={form.hsnCode} onChange={(v) => setField("hsnCode", v)} />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="gstRegistrationStatus">
                        <SelectField required label="GST registration status" value={form.gstRegistrationStatus} onChange={(v) => setField("gstRegistrationStatus", v)}
                            options={[{ value: "regular", label: "Regular" }, { value: "composition", label: "Composition" }, { value: "unregistered", label: "Unregistered" }]} />
                    </FieldAnchor>
                </div>
                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>GST % is set once in Pricing above and applies here too — currently <b>{form.gstPercent}%</b>.</p>
                <ToggleField label="Tax invoice available" value={form.taxInvoiceAvailable} onChange={(v) => setField("taxInvoiceAvailable", v)} />
            </SectionCard>

            {/* ---------------- Commercial Terms (auto-saved group) ---------------- */}
            <SectionCard id={SECTIONS.commercial_terms.id} icon={Handshake} title="Commercial Terms" subtitle="Payment, returns & warranty — saved automatically for next time"
                open={openSections.commercial_terms} onOpenChange={(v) => setSectionOpen("commercial_terms", v)}>
                <FieldAnchor fieldKey="paymentTerms">
                    <TextAreaField required label="Payment terms" value={form.paymentTerms} onChange={(v) => setField("paymentTerms", v)} rows={2} />
                </FieldAnchor>
                <FieldAnchor fieldKey="returnPolicy">
                    <TextAreaField required label="Return / replacement policy" value={form.returnPolicy} onChange={(v) => setField("returnPolicy", v)} rows={3}
                        hint="Buyers raise a ticket against their order if something goes wrong — this text is shown to them as your policy." />
                </FieldAnchor>
                <TextField label="Warranty" value={form.warranty} onChange={(v) => setField("warranty", v)} placeholder="Optional — e.g. 1 year manufacturer warranty" />
                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Price validity is set once in Pricing above — currently valid until <b>{form.priceValidityTill}</b>.</p>
            </SectionCard>

            {/* ---------------- Quality (auto-saved group, optional) ---------------- */}
            <SectionCard id={SECTIONS.quality.id} icon={ShieldCheck} title="Quality & Certifications" subtitle="Optional — builds buyer trust, saved automatically for next time"
                open={openSections.quality} onOpenChange={(v) => setSectionOpen("quality", v)}>
                <RepeatableRows label="Certificates" rows={form.qualityCertificates} onChange={(rows) => setField("qualityCertificates", rows)} addLabel="Add certificate"
                    columns={[{ key: "name", placeholder: "Certificate name" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="TDS / MSDS / COA" rows={form.tdsMsdsCoa} onChange={(rows) => setField("tdsMsdsCoa", rows)} addLabel="Add document"
                    columns={[{ key: "type", placeholder: "Document type" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="BIS / ISO / other certification" rows={form.otherCertifications} onChange={(rows) => setField("otherCertifications", rows)} addLabel="Add certification"
                    columns={[{ key: "name", placeholder: "Certification name" }, { key: "url", placeholder: "Link to file" }]} />
            </SectionCard>

            {/* ---------------- Marketplace (system, read-only) ---------------- */}
            <SectionCard id={SECTIONS.marketplace.id} icon={Percent} title="Marketplace & Payout" subtitle="System calculated"
                open={openSections.marketplace} onOpenChange={(v) => setSectionOpen("marketplace", v)}>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl p-3" style={{ background: C.hairSoft }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Commission</p>
                        <p className="mt-1 text-[15px] font-extrabold" style={{ color: C.ink }}>{commissionPercent}%</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: C.hairSoft }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Your payout</p>
                        <p className="mt-1 text-[15px] font-extrabold" style={{ color: C.secondary }}>₹{marketplace.sellerPayout.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: C.hairSoft }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Selling price</p>
                        <p className="mt-1 text-[15px] font-extrabold" style={{ color: C.ink }}>₹{finalPrice.toLocaleString("en-IN")}</p>
                    </div>
                </div>
            </SectionCard>

            {footer}
        </div>
    );
}