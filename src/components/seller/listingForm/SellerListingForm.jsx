import { useEffect, useMemo, useState } from "react";
import {
    Package, IndianRupee, Boxes, Truck, FileText,
    Loader2, CheckCircle2, AlertTriangle, Lock, ImagePlus, Copy, ChevronDown,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadSellerFile } from "../../../utils/api.js";
import {
    fetchCommissionInfo, fetchDefaultListingTemplates,
    fetchApprovedCategories, fetchApprovedSubcategories, fetchApprovedGenericProducts,
    createSellerCategoryEntry, createSellerSubcategoryEntry, createSellerGenericProductEntry,
} from "../../../utils/sellerListingApi.js";
import {
    C, TextField, TextAreaField, SelectField, ToggleField, ChipToggleGroup, RepeatableRows,
    SectionCard, Pill, Progress,
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

// Auto-saved-default groups — unchanged contract with the backend.
const GROUP_FIELDS = {
    packaging: ["packSize", "unit", "unitsPerMasterPack", "masterPackSize", "packagingType"],
    delivery: ["sellerLocation", "dispatchLocation", "deliveryTimeline", "freightTerms"],
    tax_legal: ["hsnCode", "gstRegistrationStatus", "taxInvoiceAvailable"],
    commercial_terms: ["paymentTerms", "returnPolicy", "warranty"],
    quality: ["qualityCertificates", "tdsMsdsCoa", "otherCertifications"],
};

// Two real sections only: the handful of fields that truly need a
// decision ("essentials", always visible, never collapsed), and
// everything else, which already has a sane default and only needs
// attention if the seller wants to change it ("more").
const SECTIONS = {
    product: { id: "section-product" },
    essentials: { id: "section-essentials" },
    more: { id: "section-more" },
};

// Every field that can actually be *missing* lives in one of these two
// buckets — used to auto-expand "more" and scroll to the right spot.
const FIELD_SECTION = {
    genericProductId: "product", productName: "product", brandName: "product",
    manufacturer: "product", modelNo: "product", images: "product",
    basePrice: "essentials", moq: "essentials", packSize: "essentials", unit: "essentials",
    ratePerPack: "essentials", stockQuantity: "essentials", stockType: "essentials",
    productionLeadTimeDays: "essentials", sellerLocation: "essentials", dispatchLocation: "essentials",
    hsnCode: "essentials",
    gstPercent: "more", priceValidityTill: "more", dispatchTimeDays: "more",
    deliveryTimeline: "more", gstRegistrationStatus: "more", paymentTerms: "more", returnPolicy: "more",
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

function SpecRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex justify-between gap-3 border-b py-1.5 text-[12.5px]" style={{ borderColor: C.hairSoft }}>
            <span className="font-semibold" style={{ color: C.muted }}>{label}</span>
            <span className="font-bold text-right" style={{ color: C.ink }}>{value}</span>
        </div>
    );
}

// The whole point of this block: the moment the "I want to sell" flow
// opens, every fact the platform already knows about the product is
// visible up front — nothing buried behind a click.
function ReadOnlyProductSummary({ brandDisplay, form }) {
    const facts = [form.manufacturer, form.modelNo, form.gradeVariant].filter(Boolean);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: C.hairSoft }}>
                {(form.images?.[0] || brandDisplay?.image) && (
                    <img src={form.images?.[0] || brandDisplay.image} alt="" className="h-14 w-14 shrink-0 rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                )}
                <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold" style={{ color: C.ink }}>{brandDisplay?.name || form.productName}</p>
                    {(brandDisplay?.brandName || form.brandName) && <p className="text-[11.5px] font-bold" style={{ color: C.primary }}>{brandDisplay?.brandName || form.brandName}</p>}
                </div>
            </div>
            {facts.length > 0 && (
                <div className="rounded-xl border px-3.5" style={{ borderColor: C.hairSoft }}>
                    <SpecRow label="Manufacturer" value={form.manufacturer} />
                    <SpecRow label="Model / Part No. / SKU" value={form.modelNo} />
                    <SpecRow label="Grade / Variant" value={form.gradeVariant} />
                </div>
            )}
            {form.specifications?.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Specifications</span>
                    <div className="rounded-xl border px-3.5" style={{ borderColor: C.hairSoft }}>
                        {form.specifications.map((s, i) => <SpecRow key={i} label={s.key} value={s.value} />)}
                    </div>
                </div>
            )}
            {form.images?.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {form.images.map((src, i) => (
                        <img key={src + i} src={src} alt="" className="h-14 w-14 rounded-lg border object-cover" style={{ borderColor: C.hair }} />
                    ))}
                </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: C.muted }}>
                <Lock className="h-3 w-3 shrink-0" /> Product identity is already approved — you're only adding your commercial terms below.
            </p>
        </div>
    );
}

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
    const [touched, setTouched] = useState({});
    const [hasSavedDefaults, setHasSavedDefaults] = useState(false);

    const [moreOpen, setMoreOpen] = useState(false);
    const [productOpen, setProductOpen] = useState(true);

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const touch = (key) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

    useEffect(() => {
        fetchCommissionInfo().then((res) => { if (res?.success) setCommissionPercent(res.commissionPercent); });
    }, []);

    // Prefill from the seller's auto-saved defaults on a brand new listing
    // — this is what makes every listing after the first one nearly
    // one-click for delivery/tax/terms/packaging.
    useEffect(() => {
        if (mode !== "create" && mode !== "claim") return;
        if (!token) return;
        fetchDefaultListingTemplates(token).then((res) => {
            if (!res?.success) return;
            const anyDefaults = Object.keys(res.defaults || {}).length > 0;
            setHasSavedDefaults(anyDefaults);
            setForm((f) => {
                const next = { ...f };
                Object.entries(res.defaults).forEach(([groupType, tpl]) => {
                    (GROUP_FIELDS[groupType] || []).forEach((key) => {
                        if (tpl.data?.[key] !== undefined && tpl.data[key] !== "") next[key] = tpl.data[key];
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

    const payout = useMemo(() => {
        const commissionAmount = Math.round(finalPrice * (commissionPercent / 100) * 100) / 100;
        return { commissionAmount, sellerPayout: Math.round((finalPrice - commissionAmount) * 100) / 100 };
    }, [finalPrice, commissionPercent]);

    const missing = useMemo(
        () => computeMissing(form, { requireIdentity: mode === "create", requireProductDetails: !productReadOnly }),
        [form, mode, productReadOnly]
    );
    const missingKeys = useMemo(() => new Set(missing.map((m) => m.key)), [missing]);
    const isErr = (key) => touched[key] && missingKeys.has(key);

    // Total required-field count is fixed per mode; percent complete
    // drives the sticky footer's progress bar for a real "almost there"
    // feeling instead of a flat error count.
    const totalRequired = useMemo(
        () => computeMissing(DEFAULT_LISTING_FORM, { requireIdentity: mode === "create", requireProductDetails: !productReadOnly }).length
            + (mode === "create" ? 1 : 0), // rough baseline; percent is clamped below anyway
        [mode, productReadOnly]
    );
    const percentComplete = totalRequired > 0 ? Math.round(((totalRequired - missing.length) / totalRequired) * 100) : 100;

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
        if (sectionKey === "more") setMoreOpen(true);
        if (sectionKey === "product") setProductOpen(true);
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
            setTouched((t) => ({ ...t, ...Object.fromEntries(missing.map((m) => [m.key, true])) }));
            setError(`Please complete: ${missing.slice(0, 4).map((m) => m.label).join(", ")}${missing.length > 4 ? `, +${missing.length - 4} more` : ""}.`);
            jumpToError(missing[0]);
            return;
        }
        setError(null);
        onSubmit(form);
    };

    const copySellerToDispatch = () => setForm((f) => ({ ...f, dispatchLocation: f.sellerLocation }));

    const footer = (
        <div
            className={stickyFooter ? "fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 py-3 backdrop-blur sm:px-6" : "sticky -bottom-5 z-10 mt-1 border-t bg-white px-1 py-3"}
            style={{ borderColor: C.hair }}
        >
            <div className={stickyFooter ? "mx-auto flex max-w-3xl flex-col gap-2" : "flex flex-col gap-2"}>
                <Progress percent={percentComplete} />
                <div className="flex items-center justify-between gap-3">
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
        </div>
    );

    return (
        <div className={stickyFooter ? "flex flex-col gap-4 pb-28" : "flex flex-col gap-4"}>
            {error && (
                <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
            )}

            {/* ---------------- Product ---------------- */}
            <SectionCard id={SECTIONS.product.id} icon={Package} title="Product"
                subtitle={productReadOnly ? "Already approved" : "Category, identity, specs & photos"}
                open={productOpen} onOpenChange={setProductOpen}
                headerRight={productReadOnly ? <Pill tone="good">Verified</Pill> : undefined}>
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
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FieldAnchor fieldKey="productName">
                                    <TextField required label="Product name" value={form.productName} onChange={(v) => setField("productName", v)} onBlur={() => touch("productName")} error={isErr("productName")} disabled={identityReadOnly} placeholder="e.g. Premium Stainless Steel Hinges" />
                                </FieldAnchor>
                                <FieldAnchor fieldKey="brandName">
                                    <TextField required label="Brand" value={form.brandName} onChange={(v) => setField("brandName", v)} onBlur={() => touch("brandName")} error={isErr("brandName")} disabled={identityReadOnly} />
                                </FieldAnchor>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FieldAnchor fieldKey="manufacturer">
                                <TextField required label="Manufacturer" value={form.manufacturer} onChange={(v) => setField("manufacturer", v)} onBlur={() => touch("manufacturer")} error={isErr("manufacturer")} />
                            </FieldAnchor>
                            <FieldAnchor fieldKey="modelNo">
                                <TextField required label="Model / Part No. / SKU" value={form.modelNo} onChange={(v) => setField("modelNo", v)} onBlur={() => touch("modelNo")} error={isErr("modelNo")} />
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

            {/* ---------------- Essentials — everything without a default, always visible ---------------- */}
            <SectionCard id={SECTIONS.essentials.id} icon={IndianRupee} alwaysOpen
                title="List it" subtitle="Price, quantity & where it ships from">
                <div className="grid grid-cols-2 gap-3">
                    <FieldAnchor fieldKey="basePrice">
                        <TextField required dense label="Base price / unit (₹ excl. GST)" value={form.basePrice} onChange={(v) => setField("basePrice", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("basePrice")} error={isErr("basePrice")} inputMode="decimal" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="moq">
                        <TextField required dense label="MOQ" value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("moq")} error={isErr("moq")} inputMode="decimal" />
                    </FieldAnchor>
                </div>
                <ChipToggleGroup dense label="GST %" value={Number(form.gstPercent)} onChange={(v) => setField("gstPercent", Number(v))} options={GST_OPTIONS.map((g) => ({ value: g, label: `${g}%` }))} />
                <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: `${C.secondary}0c` }}>
                    <span className="text-[12px] font-bold" style={{ color: C.muted }}>Final price incl. GST</span>
                    <span className="text-[16px] font-extrabold" style={{ color: C.secondary }}>₹{finalPrice.toLocaleString("en-IN")}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FieldAnchor fieldKey="packSize">
                        <TextField required dense label="Pack size" value={form.packSize} onChange={(v) => setField("packSize", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("packSize")} error={isErr("packSize")} inputMode="decimal" hint="Units per pack, e.g. 10" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="unit">
                        <SelectField required dense label="Unit" value={form.unit} onChange={(v) => setField("unit", v)} onBlur={() => touch("unit")} error={isErr("unit")} options={UNITS} />
                    </FieldAnchor>
                </div>
                {Number(form.packSize) > 1 && (
                    <FieldAnchor fieldKey="ratePerPack">
                        <TextField required dense label="Rate per pack (₹)" value={form.ratePerPack} onChange={(v) => setField("ratePerPack", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("ratePerPack")} error={isErr("ratePerPack")} inputMode="decimal" />
                    </FieldAnchor>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <FieldAnchor fieldKey="stockQuantity">
                        <TextField required dense label="Available Stock (Quantity)" value={form.stockQuantity} onChange={(v) => setField("stockQuantity", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("stockQuantity")} error={isErr("stockQuantity")} inputMode="decimal" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="stockType">
                        <ChipToggleGroup dense label="Fulfilment" value={form.stockType} onChange={(v) => setField("stockType", v)}
                            options={[{ value: "ready_stock", label: "Ready stock" }, { value: "made_to_order", label: "Made-to-order" }]} />
                    </FieldAnchor>
                </div>
                {form.stockType === "made_to_order" && (
                    <FieldAnchor fieldKey="productionLeadTimeDays">
                        <TextField required dense label="Production lead time (days)" value={form.productionLeadTimeDays} onChange={(v) => setField("productionLeadTimeDays", v.replace(/[^\d]/g, ""))} onBlur={() => touch("productionLeadTimeDays")} error={isErr("productionLeadTimeDays")} inputMode="numeric" />
                    </FieldAnchor>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <FieldAnchor fieldKey="sellerLocation">
                        <TextField required dense label="Seller location" value={form.sellerLocation} onChange={(v) => setField("sellerLocation", v)} onBlur={() => touch("sellerLocation")} error={isErr("sellerLocation")} placeholder="City, State" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="dispatchLocation">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold" style={{ color: C.ink }}>Dispatch location <span style={{ color: C.primary }}>*</span></span>
                                {form.sellerLocation && (
                                    <button type="button" onClick={copySellerToDispatch} className="flex items-center gap-1 text-[10px] font-bold" style={{ color: C.secondary }}>
                                        <Copy className="h-2.5 w-2.5" /> Same
                                    </button>
                                )}
                            </div>
                            <TextField dense value={form.dispatchLocation} onChange={(v) => setField("dispatchLocation", v)} onBlur={() => touch("dispatchLocation")} error={isErr("dispatchLocation")} placeholder="City, State" />
                        </div>
                    </FieldAnchor>
                </div>

                <FieldAnchor fieldKey="hsnCode">
                    <TextField required dense label="HSN Code" value={form.hsnCode} onChange={(v) => setField("hsnCode", v)} onBlur={() => touch("hsnCode")} error={isErr("hsnCode")} />
                </FieldAnchor>
            </SectionCard>

            {/* ---------------- More details — pre-filled with sensible defaults ---------------- */}
            <SectionCard id={SECTIONS.more.id} icon={FileText} title="More details"
                subtitle="Delivery, tax, terms & certifications"
                open={moreOpen} onOpenChange={setMoreOpen}
                headerRight={<Pill tone={hasSavedDefaults ? "good" : "muted"}>{hasSavedDefaults ? "Auto-filled" : "Defaults applied"}</Pill>}>

                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Pricing & quantity extras</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldAnchor fieldKey="priceValidityTill">
                        <TextField dense type="date" label="Price validity" value={form.priceValidityTill} onChange={(v) => setField("priceValidityTill", v)} onBlur={() => touch("priceValidityTill")} error={isErr("priceValidityTill")} />
                    </FieldAnchor>
                    <TextField dense label="Rate per master pack (₹)" value={form.ratePerMasterPack} onChange={(v) => setField("ratePerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <ToggleField label="Sample available" value={form.sampleAvailable} onChange={(v) => setField("sampleAvailable", v)} />
                {form.sampleAvailable && (
                    <TextField dense label="Sample price (₹)" value={form.samplePrice} onChange={(v) => setField("samplePrice", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Leave blank if free" />
                )}
                <RepeatableRows
                    label="Order quantity price slabs" hint="Optional — different pricing at different order volumes"
                    rows={form.priceSlabs} onChange={(rows) => setField("priceSlabs", rows)} addLabel="Add price slab"
                    columns={[{ key: "minQty", placeholder: "Min qty", inputMode: "decimal" }, { key: "maxQty", placeholder: "Max qty (optional)", inputMode: "decimal" }, { key: "price", placeholder: "₹ price", inputMode: "decimal" }]}
                />
                <RepeatableRows
                    label="Quantity discounts" hint="Optional — e.g. 5% off above 500 units"
                    rows={form.quantityDiscounts} onChange={(rows) => setField("quantityDiscounts", rows)} addLabel="Add discount tier"
                    columns={[{ key: "minQty", placeholder: "Min qty", inputMode: "decimal" }, { key: "discountPercent", placeholder: "Discount %", inputMode: "decimal" }]}
                />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Packaging</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField dense label="Units per master pack" value={form.unitsPerMasterPack} onChange={(v) => setField("unitsPerMasterPack", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                    <TextField dense label="Master pack size" value={form.masterPackSize} onChange={(v) => setField("masterPackSize", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" />
                </div>
                <TextField dense label="Packaging type" value={form.packagingType} onChange={(v) => setField("packagingType", v)} placeholder="e.g. Carton box, Poly bag, Wooden crate" />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Delivery</p>
                <FieldAnchor fieldKey="dispatchTimeDays">
                    <TextField required dense label="Expected dispatch time (days)" value={form.dispatchTimeDays} onChange={(v) => setField("dispatchTimeDays", v.replace(/[^\d]/g, ""))} onBlur={() => touch("dispatchTimeDays")} error={isErr("dispatchTimeDays")} inputMode="numeric" />
                </FieldAnchor>
                <FieldAnchor fieldKey="deliveryTimeline">
                    <TextField required dense label="Delivery timeline" value={form.deliveryTimeline} onChange={(v) => setField("deliveryTimeline", v)} onBlur={() => touch("deliveryTimeline")} error={isErr("deliveryTimeline")} placeholder="e.g. 3-7 business days" />
                </FieldAnchor>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: C.hairSoft }}>
                    <span className="text-[12px] font-bold" style={{ color: C.ink }}>Freight</span>
                    <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ background: `${C.primary}12`, color: C.primary }}>Always extra — buyer pays</span>
                </div>
                <TextAreaField label="Freight terms" value={form.freightTerms} onChange={(v) => setField("freightTerms", v)} rows={2} />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Tax & legal</p>
                <FieldAnchor fieldKey="gstRegistrationStatus">
                    <SelectField required dense label="GST registration status" value={form.gstRegistrationStatus} onChange={(v) => setField("gstRegistrationStatus", v)} onBlur={() => touch("gstRegistrationStatus")} error={isErr("gstRegistrationStatus")}
                        options={[{ value: "regular", label: "Regular" }, { value: "composition", label: "Composition" }, { value: "unregistered", label: "Unregistered" }]} />
                </FieldAnchor>
                <ToggleField label="Tax invoice available" value={form.taxInvoiceAvailable} onChange={(v) => setField("taxInvoiceAvailable", v)} />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Commercial terms</p>
                <FieldAnchor fieldKey="paymentTerms">
                    <TextAreaField required label="Payment terms" value={form.paymentTerms} onChange={(v) => setField("paymentTerms", v)} onBlur={() => touch("paymentTerms")} error={isErr("paymentTerms")} rows={2} />
                </FieldAnchor>
                <FieldAnchor fieldKey="returnPolicy">
                    <TextAreaField required label="Return / replacement policy" value={form.returnPolicy} onChange={(v) => setField("returnPolicy", v)} onBlur={() => touch("returnPolicy")} error={isErr("returnPolicy")} rows={3}
                        hint="Buyers raise a ticket against their order if something goes wrong — this text is shown to them as your policy." />
                </FieldAnchor>
                <TextField dense label="Warranty" value={form.warranty} onChange={(v) => setField("warranty", v)} placeholder="Optional — e.g. 1 year manufacturer warranty" />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Quality & certifications (optional)</p>
                <RepeatableRows label="Certificates" rows={form.qualityCertificates} onChange={(rows) => setField("qualityCertificates", rows)} addLabel="Add certificate"
                    columns={[{ key: "name", placeholder: "Certificate name" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="TDS / MSDS / COA" rows={form.tdsMsdsCoa} onChange={(rows) => setField("tdsMsdsCoa", rows)} addLabel="Add document"
                    columns={[{ key: "type", placeholder: "Document type" }, { key: "url", placeholder: "Link to file" }]} />
                <RepeatableRows label="BIS / ISO / other certification" rows={form.otherCertifications} onChange={(rows) => setField("otherCertifications", rows)} addLabel="Add certification"
                    columns={[{ key: "name", placeholder: "Certification name" }, { key: "url", placeholder: "Link to file" }]} />

                <div className="my-1 h-px" style={{ background: C.hairSoft }} />
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl p-2.5" style={{ background: C.hairSoft }}>
                        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Commission</p>
                        <p className="mt-0.5 text-[14px] font-extrabold" style={{ color: C.ink }}>{commissionPercent}%</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: C.hairSoft }}>
                        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Your payout</p>
                        <p className="mt-0.5 text-[14px] font-extrabold" style={{ color: C.secondary }}>₹{payout.sellerPayout.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: C.hairSoft }}>
                        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Selling price</p>
                        <p className="mt-0.5 text-[14px] font-extrabold" style={{ color: C.ink }}>₹{finalPrice.toLocaleString("en-IN")}</p>
                    </div>
                </div>
            </SectionCard>

            {!moreOpen && (
                <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-1 text-[11.5px] font-bold"
                    style={{ color: C.secondary }}
                >
                    Review delivery, tax & terms defaults <ChevronDown className="h-3.5 w-3.5" />
                </button>
            )}

            {footer}
        </div>
    );
}