// components/seller/listingForm/SellerListingForm.jsx
//
// One scrollable page, no wizard steps. Every section is a collapsible
// SectionCard; "groupable" sections (Packaging, Delivery, Tax & Legal,
// Commercial Terms, Quality) carry a GroupTemplateBar so the seller can
// load a saved group or save the current values as one — this is the
// "Amazon-style" reusable data grouping.
//
// Used in three modes:
//   - "create": full identity fields + all commercial sections
//   - "edit":   identity shown read-only (via brandDisplay), commercial
//               sections prefilled from the existing listing
//   - "claim":  "I want to sell this" — identity shown read-only via
//               brandDisplay, everything else same as create

import { useEffect, useMemo, useState } from "react";
import {
    Package, IndianRupee, Boxes, Archive, Truck, FileText, Handshake,
    ShieldCheck, Percent, ImagePlus, Loader2, CheckCircle2, AlertTriangle,
    Layers, Lock
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadSellerFile } from "../../../utils/api.js";
import { fetchCommissionInfo, fetchDefaultListingTemplates } from "../../../utils/sellerListingApi.js";
import {
    C, TextField, TextAreaField, SelectField, ToggleField, ChipToggleGroup, RepeatableRows, SectionCard,
} from "./FormPrimitives.jsx";
import GroupTemplateBar from "./GroupTemplateBar.jsx";

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];
const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];

const todayPlus = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

export const DEFAULT_LISTING_FORM = {
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

const GROUP_FIELDS = {
    packaging: ["packSize", "unit", "unitsPerMasterPack", "masterPackSize", "packagingType"],
    delivery: ["sellerLocation", "dispatchLocation", "deliveryTimeline", "freightTerms"],
    tax_legal: ["hsnCode", "gstRegistrationStatus", "taxInvoiceAvailable"],
    commercial_terms: ["paymentTerms", "returnPolicy", "warranty"],
    quality: ["qualityCertificates", "tdsMsdsCoa", "otherCertifications"],
};

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
                <span className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: `${C.secondary}14`, color: C.secondary }}>
                    <Lock className="h-3 w-3" /> Locked
                </span>
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

function computeMissing(form, { requireIdentity, requireProductDetails = true }) {
    const missing = [];
    if (requireIdentity) {
        if (!form.productName?.trim()) missing.push("Product name");
        if (!form.brandName?.trim()) missing.push("Brand name");
    }
    if (requireProductDetails) {
        if (!form.manufacturer?.trim()) missing.push("Manufacturer");
        if (!form.modelNo?.trim()) missing.push("Model / Part No. / SKU");
        if (!form.images?.length) missing.push("Product image");
    }

    if (!(Number(form.basePrice) > 0)) missing.push("Base price");
    if (form.gstPercent === "" || form.gstPercent == null) missing.push("GST %");
    if (!form.priceValidityTill) missing.push("Price validity");
    if (!(Number(form.moq) > 0)) missing.push("MOQ");
    if (!(Number(form.packSize) > 0)) missing.push("Pack size");
    if (!form.unit) missing.push("Unit of measurement");
    if (Number(form.packSize) > 1 && !(Number(form.ratePerPack) > 0)) missing.push("Rate per pack");
    if (form.stockQuantity === "" || form.stockQuantity == null) missing.push("Stock available");
    if (!form.stockType) missing.push("Ready stock / Made-to-order");
    if (form.dispatchTimeDays === "" || form.dispatchTimeDays == null) missing.push("Expected dispatch time");
    if (form.stockType === "made_to_order" && !(form.productionLeadTimeDays !== "" && form.productionLeadTimeDays != null)) missing.push("Production lead time");
    if (!form.sellerLocation?.trim()) missing.push("Seller location");
    if (!form.dispatchLocation?.trim()) missing.push("Dispatch location");
    if (!form.deliveryTimeline?.trim()) missing.push("Delivery timeline");
    if (!form.hsnCode?.trim()) missing.push("HSN Code");
    if (!form.gstRegistrationStatus) missing.push("GST registration status");
    if (!form.paymentTerms?.trim()) missing.push("Payment terms");
    if (!form.returnPolicy?.trim()) missing.push("Return / replacement policy");
    return missing;
}

export default function SellerListingForm({
    mode = "create",          // 'create' | 'edit' | 'claim'
    initialValues,
    identityReadOnly = false, // true for 'edit' and 'claim' (name/brand fixed)
    productReadOnly = false,  // true for 'claim' — whole Product section is locked & prefilled
    brandDisplay,             // { name, brandName, image } — shown instead of editable name/brand fields
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

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const applyGroup = (data) => setForm((f) => ({ ...f, ...data }));



    useEffect(() => {
        fetchCommissionInfo().then((res) => { if (res?.success) setCommissionPercent(res.commissionPercent); });
    }, []);

    // Prefill from the seller's saved default groups — only on a brand
    // new listing (create/claim), and it only ever overwrites the exact
    // fields that belong to a groupable section, so it never clobbers
    // Product/Pricing/Quantity/Availability fields the seller is typing.
    useEffect(() => {
        if (mode !== "create" && mode !== "claim") return;
        if (!token) return;
        fetchDefaultListingTemplates(token).then((res) => {
            if (!res?.success) return;
            setForm((f) => {
                const next = { ...f };
                Object.entries(res.defaults).forEach(([groupType, tpl]) => {
                    (GROUP_FIELDS[groupType] || []).forEach((key) => {
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

    const handleSubmit = () => {
        if (missing.length) {
            setError(`Please complete: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? `, +${missing.length - 4} more` : ""}.`);
            return;
        }
        setError(null);
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
            <SectionCard icon={Package} title="Product" subtitle={productReadOnly ? "Already approved — read only" : "Identity, specs & photos"} defaultOpen>
                {productReadOnly ? (
                    <ReadOnlyProductSummary brandDisplay={brandDisplay} form={form} />
                ) : (
                    <>
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
                                <TextField required label="Product name" value={form.productName} onChange={(v) => setField("productName", v)} disabled={identityReadOnly} placeholder="e.g. Premium Stainless Steel Hinges" />
                                <TextField required label="Brand" value={form.brandName} onChange={(v) => setField("brandName", v)} disabled={identityReadOnly} />
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField required label="Manufacturer" value={form.manufacturer} onChange={(v) => setField("manufacturer", v)} />
                            <TextField required label="Model / Part No. / SKU" value={form.modelNo} onChange={(v) => setField("modelNo", v)} />
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
                    </>
                )}
            </SectionCard>

            {/* ---------------- Pricing ---------------- */}
            <SectionCard icon={IndianRupee} title="Pricing" subtitle="Base price, GST & validity" defaultOpen>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField required label="Base price / rate per unit (₹, excl. GST)" value={form.basePrice} onChange={(v) => setField("basePrice", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                    <ChipToggleGroup label="GST %" value={Number(form.gstPercent)} onChange={(v) => setField("gstPercent", Number(v))} options={GST_OPTIONS.map((g) => ({ value: g, label: `${g}%` }))} />
                </div>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: `${C.secondary}0c` }}>
                    <span className="text-[12.5px] font-bold" style={{ color: C.muted }}>Final price (incl. GST)</span>
                    <span className="text-[17px] font-extrabold" style={{ color: C.secondary }}>₹{finalPrice.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Rate per pack (₹)" value={form.ratePerPack} onChange={(v) => setField("ratePerPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" required={Number(form.packSize) > 1} hint="Required once Pack Size below is more than 1" />
                    <TextField label="Rate per master pack (₹)" value={form.ratePerMasterPack} onChange={(v) => setField("ratePerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <TextField required type="date" label="Price validity" value={form.priceValidityTill} onChange={(v) => setField("priceValidityTill", v)} hint="This rate is guaranteed to buyers until this date" />
            </SectionCard>

            {/* ---------------- Quantity ---------------- */}
            <SectionCard icon={Boxes} title="Quantity" subtitle="MOQ, samples & bulk pricing">
                <TextField required label="MOQ (minimum order quantity)" value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
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

            {/* ---------------- Packaging (groupable) ---------------- */}
            <SectionCard icon={Archive} title="Packaging" subtitle="Pack size & unit of measurement"
                headerRight={<GroupTemplateBar groupType="packaging" currentData={pick(form, GROUP_FIELDS.packaging)} onApply={applyGroup} />}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField required label="Pack size" value={form.packSize} onChange={(v) => setField("packSize", v.replace(/[^\d.]/g, ""))} inputMode="decimal" hint="Units per pack, e.g. 10" />
                    <SelectField required label="Unit of measurement" value={form.unit} onChange={(v) => setField("unit", v)} options={UNITS} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Units per master pack" value={form.unitsPerMasterPack} onChange={(v) => setField("unitsPerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                    <TextField label="Master pack size" value={form.masterPackSize} onChange={(v) => setField("masterPackSize", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <TextField label="Packaging type" value={form.packagingType} onChange={(v) => setField("packagingType", v)} placeholder="e.g. Carton box, Poly bag, Wooden crate" />
            </SectionCard>

            {/* ---------------- Availability ---------------- */}
            <SectionCard icon={Boxes} title="Availability" subtitle="Stock & dispatch readiness">
                <TextField required label="Stock available" value={form.stockQuantity} onChange={(v) => setField("stockQuantity", v.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                <ChipToggleGroup label="Fulfilment type" value={form.stockType} onChange={(v) => setField("stockType", v)}
                    options={[{ value: "ready_stock", label: "Ready stock" }, { value: "made_to_order", label: "Made-to-order" }]} />
                <TextField required label="Expected dispatch time (days)" value={form.dispatchTimeDays} onChange={(v) => setField("dispatchTimeDays", v.replace(/[^\d]/g, ""))} inputMode="numeric" />
                {form.stockType === "made_to_order" && (
                    <TextField required label="Production lead time (days)" value={form.productionLeadTimeDays} onChange={(v) => setField("productionLeadTimeDays", v.replace(/[^\d]/g, ""))} inputMode="numeric" />
                )}
            </SectionCard>

            {/* ---------------- Delivery (groupable) ---------------- */}
            <SectionCard icon={Truck} title="Delivery" subtitle="Locations, timeline & freight"
                headerRight={<GroupTemplateBar groupType="delivery" currentData={pick(form, GROUP_FIELDS.delivery)} onApply={applyGroup} />}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField required label="Seller location" value={form.sellerLocation} onChange={(v) => setField("sellerLocation", v)} placeholder="City, State" />
                    <TextField required label="Dispatch location" value={form.dispatchLocation} onChange={(v) => setField("dispatchLocation", v)} placeholder="City, State" />
                </div>
                <TextField required label="Delivery timeline" value={form.deliveryTimeline} onChange={(v) => setField("deliveryTimeline", v)} placeholder="e.g. 3-7 business days" />
                <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: C.hairSoft }}>
                    <span className="text-[12.5px] font-bold" style={{ color: C.ink }}>Freight</span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${C.primary}12`, color: C.primary }}>Always extra — buyer pays freight</span>
                </div>
                <TextAreaField label="Freight terms" value={form.freightTerms} onChange={(v) => setField("freightTerms", v)} rows={2} />
            </SectionCard>

            {/* ---------------- Tax & Legal (groupable) ---------------- */}
            <SectionCard icon={FileText} title="Tax & Legal" subtitle="HSN, GST & invoicing"
                headerRight={<GroupTemplateBar groupType="tax_legal" currentData={pick(form, GROUP_FIELDS.tax_legal)} onApply={applyGroup} />}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField required label="HSN Code" value={form.hsnCode} onChange={(v) => setField("hsnCode", v)} />
                    <SelectField required label="GST registration status" value={form.gstRegistrationStatus} onChange={(v) => setField("gstRegistrationStatus", v)}
                        options={[{ value: "regular", label: "Regular" }, { value: "composition", label: "Composition" }, { value: "unregistered", label: "Unregistered" }]} />
                </div>
                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>GST % is set once in Pricing above and applies here too — currently <b>{form.gstPercent}%</b>.</p>
                <ToggleField label="Tax invoice available" value={form.taxInvoiceAvailable} onChange={(v) => setField("taxInvoiceAvailable", v)} />
            </SectionCard>

            {/* ---------------- Commercial Terms (groupable) ---------------- */}
            <SectionCard icon={Handshake} title="Commercial Terms" subtitle="Payment, returns & warranty"
                headerRight={<GroupTemplateBar groupType="commercial_terms" currentData={pick(form, GROUP_FIELDS.commercial_terms)} onApply={applyGroup} />}>
                <TextAreaField required label="Payment terms" value={form.paymentTerms} onChange={(v) => setField("paymentTerms", v)} rows={2} />
                <TextAreaField required label="Return / replacement policy" value={form.returnPolicy} onChange={(v) => setField("returnPolicy", v)} rows={3}
                    hint="Buyers raise a ticket against their order if something goes wrong — this text is shown to them as your policy." />
                <TextField label="Warranty" value={form.warranty} onChange={(v) => setField("warranty", v)} placeholder="Optional — e.g. 1 year manufacturer warranty" />
                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Price validity is set once in Pricing above — currently valid until <b>{form.priceValidityTill}</b>.</p>
            </SectionCard>

            {/* ---------------- Quality (groupable, optional) ---------------- */}
            <SectionCard icon={ShieldCheck} title="Quality & Certifications" subtitle="Optional — builds buyer trust"
                headerRight={<GroupTemplateBar groupType="quality" currentData={pick(form, GROUP_FIELDS.quality)} onApply={applyGroup} />}>
                <RepeatableRows label="Certificates" rows={form.qualityCertificates} onChange={(rows) => setField("qualityCertificates", rows)} addLabel="Add certificate"
                    columns={[{ key: "name", placeholder: "Certificate name" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="TDS / MSDS / COA" rows={form.tdsMsdsCoa} onChange={(rows) => setField("tdsMsdsCoa", rows)} addLabel="Add document"
                    columns={[{ key: "type", placeholder: "Document type" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="BIS / ISO / other certification" rows={form.otherCertifications} onChange={(rows) => setField("otherCertifications", rows)} addLabel="Add certification"
                    columns={[{ key: "name", placeholder: "Certification name" }, { key: "url", placeholder: "Link to file" }]} />
            </SectionCard>

            {/* ---------------- Marketplace (system, read-only) ---------------- */}
            <SectionCard icon={Percent} title="Marketplace & Payout" subtitle="System calculated" defaultOpen>
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