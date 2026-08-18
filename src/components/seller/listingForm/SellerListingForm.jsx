// components/seller/listingForm/SellerListingForm.jsx — RESTYLED
//
// Visual pass to match the Home / SellerManageListingsPage language:
// same C tokens, compact caption labels, rounded-2xl section cards,
// responsive grids that reflow at every breakpoint instead of just
// desktop, tighter vertical rhythm, and a sticky footer that mirrors
// the "Sync" pill + progress affordance used elsewhere.
//
// Also fixes a prop-name mismatch with the caller (SellPublishProductPage):
// this component previously only accepted `identityLocked` / `lockedIdentity`
// and never read `initialValues`, so the edit route never prefilled the
// form. Now accepts `mode`, `identityReadOnly`, `brandDisplay`, and
// `initialValues` (aliases kept for back-compat).
import { useEffect, useMemo, useState } from "react";
import {
    Package, IndianRupee, Boxes, Truck, FileText,
    Loader2, CheckCircle2, AlertTriangle, ImagePlus,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadSellerFile } from "../../../utils/api.js";
import { fetchCommissionInfo, fetchDefaultListingTemplates, lookupPincode } from "../../../utils/sellerListingApi.js";
import {
    C, TextField, TextAreaField, SelectField, ToggleField, ChipToggleGroup, RepeatableRows,
    SectionCard, Progress,
} from "./FormPrimitives.jsx";
import BrandCombobox from "./BrandCombobox.jsx";
import DispatchingLocationsPicker from "./DispatchingLocationsPicker.jsx";
import PolicySelect from "./PolicySelect.jsx";

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];
const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];
const PRICE_BASIS_OPTIONS = [
    { value: "per_unit", label: "Per unit" },
    { value: "per_pack", label: "Per pack" },
    { value: "per_master_pack", label: "Per master pack" },
];

export const DEFAULT_LISTING_FORM = {
    productName: "",
    brandName: "", brandImage: null, brandNotApplicable: false,
    images: [],
    qualityCertificates: [],
    noteToAdmin: "",

    unit: "", packSize: "", masterPackSize: "",
    hsnCode: "", gstPercent: 18,

    basePrice: "", priceBasis: "per_unit", gstInclusive: false,
    freightIncluded: false,

    sampleAvailable: false, sampleQuantity: "", sampleUnitBasis: "per_unit",

    priceSlabs: [],

    stockType: "ready_stock", stockQuantity: "", productionLeadTimeDays: "",
    moq: "",
    dispatchDistrict: "", dispatchState: "",

    dispatchPincode: "",
    dispatchingLocations: null, // { country, excludedStates, citiesByState }

    returnPolicyKey: "", warrantyKey: "",
};

function computeMissing(form) {
    const missing = [];
    const add = (cond, key, label) => { if (cond) missing.push({ key, label }); };

    add(!form.productName?.trim(), "productName", "Product name");
    add(!form.brandNotApplicable && !form.brandName?.trim(), "brandName", "Brand");
    add(!form.images?.length, "images", "Product image");
    add(!form.unit, "unit", "Unit");
    add(!(Number(form.packSize) > 0), "packSize", "Pack size");
    add(!(Number(form.masterPackSize) > 0), "masterPackSize", "Master pack size");
    add(!form.hsnCode?.trim(), "hsnCode", "HSN Code");

    add(!(Number(form.moq) > 0), "moq", "MOQ");

    add(form.gstPercent === "" || form.gstPercent == null, "gstPercent", "GST %");
    add(!(Number(form.basePrice) > 0), "basePrice", "Base price");
    add(form.sampleAvailable && !(Number(form.sampleQuantity) > 0), "sampleQuantity", "Sample quantity");
    add(form.stockType === "ready_stock" && (form.stockQuantity === "" || form.stockQuantity == null), "stockQuantity", "Available stock");
    add(form.stockType === "made_to_order" && (form.productionLeadTimeDays === "" || form.productionLeadTimeDays == null), "productionLeadTimeDays", "Lead time");
    add(!form.dispatchPincode?.trim(), "dispatchPincode", "Dispatch pincode");
    add(!form.dispatchingLocations?.country, "dispatchingLocations", "Dispatching locations");
    add(!form.returnPolicyKey, "returnPolicyKey", "Return / replacement policy");
    add(!form.warrantyKey, "warrantyKey", "Warranty");

    return missing;
}

function FieldAnchor({ fieldKey, children }) {
    return <div id={`field-${fieldKey}`} className="min-w-0 rounded-xl transition-shadow">{children}</div>;
}

export default function SellerListingForm({
    onSubmit, submitting, submitLabel = "Submit for review",
    mode = "create", identityReadOnly, brandDisplay, initialValues,
    identityLocked, lockedIdentity,
    stickyBottomClassName = "-bottom-1 md:bottom-0", // default (page/edit route)
}) {
    const locked = identityReadOnly ?? identityLocked ?? mode === "edit";
    const identity = brandDisplay ?? lockedIdentity;

    const { token } = useAuth();
    const [form, setForm] = useState(() => ({
        ...DEFAULT_LISTING_FORM,
        ...(initialValues || {}),
        ...(locked ? {
            productName: initialValues?.productName ?? identity?.name ?? identity?.productName ?? "",
            brandName: initialValues?.brandName ?? identity?.brandName ?? "",
            images: initialValues?.images?.length ? initialValues.images : (identity?.image ? [identity.image] : []),
        } : {}),
    }));
    const [uploadingImage, setUploadingImage] = useState(false);
    const [commissionPercent, setCommissionPercent] = useState(5);
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState({});

    const [pincodeStatus, setPincodeStatus] = useState(null); // 'checking' | 'ok' | 'error' | null

    const confirmPincode = async () => {
        if (!/^\d{6}$/.test(form.dispatchPincode)) return;
        setPincodeStatus("checking");
        const res = await lookupPincode(form.dispatchPincode);
        if (res?.success) {
            setForm((f) => ({ ...f, dispatchDistrict: res.district, dispatchState: res.state }));
            setPincodeStatus("ok");
        } else {
            setPincodeStatus("error");
        }
    };

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const touch = (key) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

    useEffect(() => { fetchCommissionInfo().then((res) => { if (res?.success) setCommissionPercent(res.commissionPercent); }); }, []);

    // Prefill dispatch defaults (pincode + locations + freight toggle)
    // from the seller's saved "delivery" group — only on create; an edit
    // should show what's actually saved on the listing, not overwrite it.
    useEffect(() => {
        if (!token || mode === "edit") return;
        fetchDefaultListingTemplates(token).then((res) => {
            if (!res?.success) return;
            const tpl = res.defaults?.delivery?.data;
            if (!tpl) return;
            setForm((f) => ({
                ...f,
                dispatchPincode: tpl.dispatchPincode ?? f.dispatchPincode,
                dispatchingLocations: tpl.dispatchingLocations ?? f.dispatchingLocations,
                freightIncluded: tpl.freightIncluded ?? f.freightIncluded,
            }));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, mode]);

    // Live price preview — mirrors normalizeEnteredPrice on the backend.
    // Final price = base price + GST amount + commission amount, all
    // stacked on top of the base price (not commission carved back out
    // of a GST-inclusive figure, as before) — matches the fee model
    // buyers ultimately see broken down at checkout.
    const pricePreview = useMemo(() => {
        const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
        const price = Number(form.basePrice) || 0;
        const gst = Number(form.gstPercent) || 0;
        const pack = Number(form.packSize) > 0 ? Number(form.packSize) : 1;
        const master = Number(form.masterPackSize) > 0 ? Number(form.masterPackSize) : 1;
        const exGst = form.gstInclusive ? price / (1 + gst / 100) : price;
        let perUnitExGst = exGst;
        if (form.priceBasis === "per_pack") perUnitExGst = exGst / pack;
        if (form.priceBasis === "per_master_pack") perUnitExGst = exGst / (pack * master);

        const basePricePerUnit = round2(perUnitExGst);
        const gstAmount = round2(basePricePerUnit * (gst / 100));
        const commissionAmount = round2(basePricePerUnit * (commissionPercent / 100));
        const finalPricePerUnit = round2(basePricePerUnit + gstAmount + commissionAmount);

        return {
            basePricePerUnit,
            gstPercent: gst, gstAmount,
            commissionPercent, commissionAmount,
            finalPricePerUnit,
        };
    }, [form.basePrice, form.gstPercent, form.packSize, form.masterPackSize, form.gstInclusive, form.priceBasis, commissionPercent]);

    const discountedPreview = (slab) => {
        if (!slab?.discountPercent) return null;
        return Math.round((pricePreview.basePricePerUnit * (1 - Number(slab.discountPercent) / 100) + Number.EPSILON) * 100) / 100;
    };

    const missing = useMemo(() => computeMissing(form), [form]);
    const missingKeys = useMemo(() => new Set(missing.map((m) => m.key)), [missing]);
    const isErr = (key) => touched[key] && missingKeys.has(key);
    const totalRequired = useMemo(() => computeMissing(DEFAULT_LISTING_FORM).length, []);
    const percentComplete = totalRequired > 0 ? Math.round(((totalRequired - missing.length) / totalRequired) * 100) : 100;

    const handleImageFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingImage(true); setError(null);
        try {
            const urls = [];
            for (const file of files) {
                const res = await uploadSellerFile(token, file, "listings");
                if (!res?.success) throw new Error("Image upload failed.");
                urls.push(res.url);
            }
            setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
        } catch (err) { setError(err.message); } finally { setUploadingImage(false); e.target.value = ""; }
    };
    const removeImageAt = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

    function jumpToError(firstMissing) {
        requestAnimationFrame(() => {
            const target = document.getElementById(`field-${firstMissing.key}`);
            if (!target) return;
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.style.boxShadow = "0 0 0 3px rgba(199,31,17,0.35)";
            setTimeout(() => { target.style.boxShadow = ""; }, 1600);
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

        // Flatten dispatchingLocations into the jsonb array shape the
        // backend/migration expects.
        const dl = form.dispatchingLocations;
        let dispatchingLocations = [];
        if (dl?.country) {
            if (dl.mode === "include") {
                dispatchingLocations = [
                    { type: "country", name: dl.country.name, code: dl.country.code, includeOnly: true },
                    ...(dl.includedStates || []).map((state) => {
                        const cities = dl.includedCitiesByState?.[state];
                        return cities !== undefined ? { type: "state", name: state, includedCities: cities } : { type: "state", name: state };
                    }),
                ];
            } else {
                dispatchingLocations = [
                    { type: "country", name: dl.country.name, code: dl.country.code, excludedStates: dl.excludedStates || [] },
                    ...Object.entries(dl.citiesByState || {}).filter(([, cities]) => cities?.length).map(([state, cities]) => ({ type: "state", name: state, excludedCities: cities })),
                ];
            }
        }
        onSubmit({ ...form, dispatchingLocations });
    };

    return (
        <div className="flex flex-col gap-3 pb-24 sm:gap-3.5" style={{ fontFamily: FONT_BODY }}>
            {error && (
                <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12px] font-semibold leading-snug" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
            )}

            {/* ---------------- Product ---------------- */}
            <SectionCard icon={Package} title="Product" subtitle={locked ? "Already approved · locked" : "Name, brand, images & documents"} alwaysOpen>
                {locked ? (
                    <div className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: C.hairSoft }}>
                        {form.images?.[0] && <img src={form.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg border object-cover" style={{ borderColor: C.hair }} />}
                        <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{form.productName}</p>
                            {form.brandName && <p className="truncate text-[11px] font-bold" style={{ color: C.primary }}>{form.brandName}</p>}
                        </div>
                    </div>
                ) : (
                    <>
                        <FieldAnchor fieldKey="productName">
                            <TextField required label="Product name" value={form.productName} onChange={(v) => setField("productName", v)} onBlur={() => touch("productName")} error={isErr("productName")} placeholder="e.g. Premium Stainless Steel Hinges" />
                        </FieldAnchor>

                        <FieldAnchor fieldKey="brandName">
                            <BrandCombobox
                                value={form.brandName} notApplicable={form.brandNotApplicable} image={form.brandImage}
                                onChange={({ brandName, brandImage, brandNotApplicable }) => setForm((f) => ({ ...f, brandName, brandImage, brandNotApplicable }))}
                            />
                        </FieldAnchor>

                        <FieldAnchor fieldKey="images">
                            <div className="flex flex-col gap-1.5">
                                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
                                    Product images {form.images.length > 0 && `(${form.images.length})`} <span style={{ color: C.primary }}>*</span>
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {form.images.map((src, i) => (
                                        <div key={src + i} className="relative h-16 w-16 sm:h-[72px] sm:w-[72px]">
                                            <img src={src} alt="" className="h-full w-full rounded-xl border object-cover" style={{ borderColor: C.hair }} />
                                            <button type="button" onClick={() => removeImageAt(i)} className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] leading-none text-white">×</button>
                                            {i === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-black/60 py-0.5 text-center text-[8px] font-bold text-white">Cover</span>}
                                        </div>
                                    ))}
                                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed sm:h-[72px] sm:w-[72px]" style={{ borderColor: C.hair, color: C.muted }}>
                                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                        <span className="text-[9px] font-bold">{uploadingImage ? "Uploading…" : "Add"}</span>
                                        <input type="file" accept="image/*" multiple onChange={handleImageFiles} className="hidden" disabled={uploadingImage} />
                                    </label>
                                </div>
                            </div>
                        </FieldAnchor>

                        <RepeatableRows
                            label="Quality & certifications" hint="Link any current certificates you have for this item"
                            rows={form.qualityCertificates} onChange={(rows) => setField("qualityCertificates", rows)} addLabel="Add certificate"
                            columns={[{ key: "name", placeholder: "Certificate name" }, { key: "url", placeholder: "Link to file" }]}
                        />

                        <TextAreaField label="Note to admin" value={form.noteToAdmin} onChange={(v) => setField("noteToAdmin", v)} rows={2}
                            hint="Anything that'll help us approve this faster — e.g. context on the product, sourcing, or images." placeholder="Optional" />
                    </>
                )}
            </SectionCard>

            {/* ---------------- Packaging & Tax ---------------- */}
            <SectionCard icon={Boxes} title="Packaging & tax" alwaysOpen>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <FieldAnchor fieldKey="unit">
                        <SelectField required dense label="Unit" value={form.unit} onChange={(v) => setField("unit", v)} onBlur={() => touch("unit")} error={isErr("unit")} options={UNITS} />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="packSize">
                        <TextField required dense label="Pack size" hint="Individual units per pack" value={form.packSize} onChange={(v) => setField("packSize", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("packSize")} error={isErr("packSize")} inputMode="decimal" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="masterPackSize">
                        <TextField required dense label="Master pack size" hint="Packs per master pack" value={form.masterPackSize} onChange={(v) => setField("masterPackSize", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("masterPackSize")} error={isErr("masterPackSize")} inputMode="decimal" />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="moq">
                        <TextField required dense label="MOQ" hint="Minimum order quantity, in units" value={form.moq}
                            onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("moq")} error={isErr("moq")} inputMode="decimal" />
                    </FieldAnchor>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <FieldAnchor fieldKey="hsnCode">
                        <TextField required dense label="HSN Code" value={form.hsnCode} onChange={(v) => setField("hsnCode", v)} onBlur={() => touch("hsnCode")} error={isErr("hsnCode")} />
                    </FieldAnchor>
                    <ChipToggleGroup dense label="GST %" value={Number(form.gstPercent)} onChange={(v) => setField("gstPercent", Number(v))} options={GST_OPTIONS.map((g) => ({ value: g, label: `${g}%` }))} />
                </div>
            </SectionCard>

            {/* ---------------- Pricing ---------------- */}
            <SectionCard icon={IndianRupee} title="Pricing" alwaysOpen>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <FieldAnchor fieldKey="basePrice">
                        <TextField required dense label="Base price (₹)" value={form.basePrice} onChange={(v) => setField("basePrice", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("basePrice")} error={isErr("basePrice")} inputMode="decimal" />
                    </FieldAnchor>
                    <ChipToggleGroup dense label="This price is" value={form.priceBasis} onChange={(v) => setField("priceBasis", v)} options={PRICE_BASIS_OPTIONS} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <ToggleField label="Price includes GST?" value={form.gstInclusive} onChange={(v) => setField("gstInclusive", v)} />
                    <ToggleField label="Freight included?" value={form.freightIncluded} onChange={(v) => setField("freightIncluded", v)} />
                </div>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: `${C.secondary}0c` }}>
                    <span className="text-[11px] font-bold" style={{ color: C.muted }}>Base price / unit (excl. GST)</span>
                    <span className="text-[14.5px] font-extrabold tabular-nums" style={{ color: C.secondary }}>₹{pricePreview.basePricePerUnit.toLocaleString("en-IN")}</span>
                </div>

                <ToggleField label="Sample available?" value={form.sampleAvailable} onChange={(v) => setField("sampleAvailable", v)} />
                {form.sampleAvailable && (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <FieldAnchor fieldKey="sampleQuantity">
                            <TextField required dense label="Sample quantity" value={form.sampleQuantity} onChange={(v) => setField("sampleQuantity", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("sampleQuantity")} error={isErr("sampleQuantity")} inputMode="decimal" />
                        </FieldAnchor>
                        <ChipToggleGroup dense label="Basis" value={form.sampleUnitBasis} onChange={(v) => setField("sampleUnitBasis", v)} options={PRICE_BASIS_OPTIONS} />
                    </div>
                )}

                <RepeatableRows
                    label="Discount slabs" hint="Extra % off above a quantity threshold"
                    rows={form.priceSlabs} onChange={(rows) => setField("priceSlabs", rows)} addLabel="Add slab"
                    columns={[{ key: "minQty", placeholder: `Min qty (${form.unit || "units"})`, inputMode: "decimal" }, { key: "discountPercent", placeholder: "Discount %", inputMode: "decimal" }]}
                />
                {form.priceSlabs.some((s) => s.discountPercent) && (
                    <div className="flex flex-col gap-1 rounded-xl border px-3 py-2" style={{ borderColor: C.hairSoft }}>
                        {form.priceSlabs.filter((s) => s.minQty && s.discountPercent).map((s, i) => (
                            <p key={i} className="text-[10.5px] font-semibold tabular-nums" style={{ color: C.muted }}>
                                Above {s.minQty} {form.unit}: ₹{discountedPreview(s)} / {form.unit}
                            </p>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* ---------------- Fulfilment ---------------- */}
            <SectionCard icon={Truck} title="Fulfilment & delivery" alwaysOpen>
                <ChipToggleGroup label="Fulfilment" value={form.stockType} onChange={(v) => setField("stockType", v)}
                    options={[{ value: "ready_stock", label: "Ready stock" }, { value: "made_to_order", label: "Made-to-order" }]} />
                {form.stockType === "ready_stock" ? (
                    <FieldAnchor fieldKey="stockQuantity">
                        <TextField required dense label={`Available stock (${form.unit || "units"})`} value={form.stockQuantity} onChange={(v) => setField("stockQuantity", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("stockQuantity")} error={isErr("stockQuantity")} inputMode="decimal" />
                    </FieldAnchor>
                ) : (
                    <FieldAnchor fieldKey="productionLeadTimeDays">
                        <TextField required dense label="Lead time (days)" value={form.productionLeadTimeDays} onChange={(v) => setField("productionLeadTimeDays", v.replace(/[^\d]/g, ""))} onBlur={() => touch("productionLeadTimeDays")} error={isErr("productionLeadTimeDays")} inputMode="numeric" />
                    </FieldAnchor>
                )}

                <FieldAnchor fieldKey="dispatchPincode">
                    <div className="flex flex-col gap-1">
                        <TextField required dense label="Dispatch pincode" value={form.dispatchPincode}
                            onChange={(v) => { setField("dispatchPincode", v.replace(/[^\d]/g, "")); setPincodeStatus(null); }}
                            onBlur={() => { touch("dispatchPincode"); confirmPincode(); }}
                            error={isErr("dispatchPincode")} inputMode="numeric" />
                        {pincodeStatus === "checking" && <p className="text-[10.5px] font-medium" style={{ color: C.muted }}>Checking…</p>}
                        {pincodeStatus === "ok" && <p className="text-[10.5px] font-bold" style={{ color: C.secondary }}>Dispatching from {form.dispatchDistrict}, {form.dispatchState}</p>}
                        {pincodeStatus === "error" && <p className="text-[10.5px] font-medium" style={{ color: C.primary }}>Couldn't verify this pincode — you can still continue.</p>}
                    </div>
                </FieldAnchor>

                <FieldAnchor fieldKey="dispatchingLocations">
                    <DispatchingLocationsPicker value={form.dispatchingLocations} onChange={(v) => setField("dispatchingLocations", v)} />
                </FieldAnchor>
            </SectionCard>

            {/* ---------------- Terms ---------------- */}
            <SectionCard icon={FileText} title="Terms" alwaysOpen>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <FieldAnchor fieldKey="returnPolicyKey">
                        <PolicySelect kind="return_policy" label="Return / replacement policy" required value={form.returnPolicyKey} onChange={(v) => setField("returnPolicyKey", v)} error={isErr("returnPolicyKey")} />
                    </FieldAnchor>
                    <FieldAnchor fieldKey="warrantyKey">
                        <PolicySelect kind="warranty" label="Warranty" required value={form.warrantyKey} onChange={(v) => setField("warrantyKey", v)} error={isErr("warrantyKey")} />
                    </FieldAnchor>
                </div>
            </SectionCard>

            {/* ---------------- Summary ---------------- */}
            {/* Final price = base + GST + commission, all stacked on top of
                base price. GST and commission each show their % and their
                ₹ amount so it's clear exactly what's being added and why. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.hair, background: "#fff" }}>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: C.muted }}>Base price</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{pricePreview.basePricePerUnit.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.hair, background: "#fff" }}>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: C.muted }}>+ GST ({form.gstPercent}%)</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{pricePreview.gstAmount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.hair, background: "#fff" }}>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: C.muted }}>+ Commission ({commissionPercent}%)</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.primary }}>₹{pricePreview.commissionAmount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.secondary, background: `${C.secondary}0c` }}>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: C.secondary }}>Final price</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.secondary }}>₹{pricePreview.finalPricePerUnit.toLocaleString("en-IN")}</p>
                </div>
            </div>

            <div className={`sticky ${stickyBottomClassName} z-10 -mx-2.5 mt-1 border-t bg-white/95 px-2.5 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4`} style={{ borderColor: C.hair }}>
                <Progress percent={percentComplete} />
                <button type="button" onClick={handleSubmit} disabled={submitting}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-[13px] font-bold text-white transition-opacity duration-150 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{submitLabel} <CheckCircle2 className="h-4 w-4" /></>}
                </button>
            </div>
        </div>
    );
}