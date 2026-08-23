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
    Info,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadSellerFile } from "../../../utils/api.js";
import { fetchCommissionInfo, fetchDefaultListingTemplates, lookupPincode, findBrandItemMatch } from "../../../utils/sellerListingApi.js";
import {
    C, TextField, TextAreaField, SelectField, ToggleField, ChipToggleGroup, RepeatableRows,
    SectionCard, Progress,
    ToggleField2,
    TextField2,
} from "./FormPrimitives.jsx";
import BrandCombobox from "./BrandCombobox.jsx";
import DispatchingLocationsPicker from "./DispatchingLocationsPicker.jsx";
import PolicySelect from "./PolicySelect.jsx";

// const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Dozen", "Tons"];

const GST_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28];
const PRICE_BASIS_OPTIONS = [
    { value: "per_pack", label: "Per pack" },
    { value: "per_master_pack", label: "Per master pack" },
];

export const DEFAULT_LISTING_FORM = {
    productName: "",
    brandName: "", brandImage: null, brandNotApplicable: false,
    images: [],
    qualityCertificates: [],
    noteToAdmin: "",

    unit: "", packSize: "", hasOuterPack: false, masterPackSize: "1",
    brandItemMatch: null,
    hsnCode: "", gstPercent: 18,

    basePrice: "", priceBasis: "per_pack", gstInclusive: false,
    freightIncluded: false,

    sampleAvailable: false, sampleQuantity: "", sampleUnitBasis: "per_pack",

    priceSlabs: [],

    stockType: "ready_stock", stockQuantity: "", productionLeadTimeDays: "",
    moq: "",
    dispatchDistrict: "", dispatchState: "",

    dispatchPincode: "",
    dispatchingLocations: null,

    returnPolicyKey: "", warrantyKey: "",
};

// Dynamic MOQ label/hint — mirrors whichever basis the seller is
// currently thinking in. When there's an outer pack, MOQ is asked for in
// Master Packs (the unit sellers actually reason in for bulk orders);
// otherwise it's asked in Packs, same as before. The underlying form
// value is converted to Packs at submit time regardless — see
// handleSubmit — since that's the unit the backend always expects.
function getMoqLabel(hasOuterPack) {
    return hasOuterPack ? "MOQ in Master Packs" : "MOQ in Packs";
}
function getMoqHint(hasOuterPack) {
    return hasOuterPack
        ? "Minimum number of Master Packs a buyer must order"
        : "Minimum number of Packs a buyer must order";
}

function round2ToInt(n) {
    return Math.max(1, Math.round(Number(n) || 0));
}

// New helper functions — dynamic labels for Pack size / Master pack size
// based on the currently selected Unit. Falls back to generic wording
// when no unit is selected yet.
function getPackSizeLabel(unit) {
    return unit ? `How many ${unit} in a Pack?` : "Pack size";
}
function getPackSizeHint(unit) {
    return unit
        ? `How many ${unit} make up 1 Pack (e.g. 1 Pack = 10 ${unit})`
        : "How many Units make up 1 Pack (e.g. 1 Pack = 10 Pieces)";
}
function getMasterPackSizeLabel(unit) {
    return "How many Packs in a Master Pack"; // unit doesn't change this one, kept as its own function for symmetry/future tweaks
}
function getMasterPackSizeHint() {
    return "How many Packs make up 1 Master Pack (e.g. 1 Master Pack = 5 Packs)";
}

// Converts whatever single (price, basis) pair is currently stored into
// all three display values — per unit, per pack, per master pack — so
// the three price fields can always show a consistent, derived view of
// the same underlying number. Mirrors normalizeEnteredPrice's basis
// handling, but purely for display (GST/commission untouched here).
function computeThreeTierPrices(basis, rawPrice, packSize, masterPackSize) {
    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    const price = Number(rawPrice) || 0;
    const pack = Number(packSize) > 0 ? Number(packSize) : 1;
    const master = Number(masterPackSize) > 0 ? Number(masterPackSize) : 1;

    let perUnit, perPack, perMaster;
    if (basis === "per_unit") {
        perUnit = price;
        perPack = price * pack;
        perMaster = perPack * master;
    } else if (basis === "per_master_pack") {
        perMaster = price;
        perPack = price / master;
        perUnit = perPack / pack;
    } else {
        // per_pack (default)
        perPack = price;
        perUnit = price / pack;
        perMaster = price * master;
    }

    return { perUnit: round2(perUnit), perPack: round2(perPack), perMaster: round2(perMaster) };
}

function computeMissing(form) {
    const missing = [];
    const add = (cond, key, label) => { if (cond) missing.push({ key, label }); };

    add(!form.productName?.trim(), "productName", "Product name");
    add(!form.brandNotApplicable && !form.brandName?.trim(), "brandName", "Brand");
    add(!form.images?.length, "images", "Product image");

    if (!form.brandItemMatch) {
        add(!form.unit, "unit", "Unit");
        add(!(Number(form.packSize) > 0), "packSize", "Pack size");
        // Master pack is only required — and only needs to be >= 2 — when
        // the seller says this product has an outer pack. Otherwise it's
        // silently pinned to 1 (see the toggle handler below) so nothing
        // downstream (backend validation, order math) ever sees a missing
        // or invalid master pack size.
        add(form.hasOuterPack && !(Number(form.masterPackSize) >= 2), "masterPackSize", "Master pack size");
    }

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
    const [form, setForm] = useState(() => {
        const base = {
            ...DEFAULT_LISTING_FORM,
            ...(initialValues || {}),
            ...(locked ? {
                productName: initialValues?.productName ?? identity?.name ?? identity?.productName ?? "",
                brandName: initialValues?.brandName ?? identity?.brandName ?? "",
                images: initialValues?.images?.length ? initialValues.images : (identity?.image ? [identity.image] : []),
            } : {}),
        };

        base.hasOuterPack = Number(base.masterPackSize) > 1;
        if (!base.hasOuterPack) base.masterPackSize = "1";

        // incoming moq (from initialValues / backend) is always in Packs —
        // convert it to Master Packs for display if this listing has one, so
        // the field shows the same number of physical units the seller
        // originally intended, in whichever unit is currently displayed.
        if (base.hasOuterPack && Number(base.moq) > 0 && Number(base.masterPackSize) > 0) {
            base.moq = String(Math.round(Number(base.moq) / Number(base.masterPackSize)) || "");
        }

        if (locked) {
            const hasPackaging = base.unit && Number(base.packSize) > 0 && Number(base.masterPackSize) > 0;
            base.brandItemMatch = hasPackaging
                ? { unit: base.unit, packSize: base.packSize, masterPackSize: base.masterPackSize }
                : null;
        }

        return base;
    });

    const [uploadingImage, setUploadingImage] = useState(false);
    const [commissionPercent, setCommissionPercent] = useState(2.5);
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState({});
    const [checkingBrandMatch, setCheckingBrandMatch] = useState(false);

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

    // Whenever productName / brandName / brandNotApplicable settle, check
    // whether this exact product+brand already exists in the catalog. If
    // it does, its packaging (unit/packSize/masterPackSize) is fixed and
    // the seller no longer needs to (or can) enter their own — see the
    // "Packaging & tax" section below.
    useEffect(() => {
        if (locked) return; // edit mode already has fixed identity + packaging
        const productName = form.productName?.trim();
        const brandName = form.brandName?.trim();
        const brandNotApplicable = form.brandNotApplicable;

        if (!productName || productName.length < 2 || (!brandNotApplicable && !brandName)) {
            setForm((f) => (f.brandItemMatch ? { ...f, brandItemMatch: null } : f));
            return;
        }

        setCheckingBrandMatch(true);
        const t = setTimeout(async () => {
            const res = await findBrandItemMatch(token, { productName, brandName, brandNotApplicable });
            setCheckingBrandMatch(false);
            if (!res?.success) return;
            setForm((f) => {
                // Guard against a stale response landing after the seller
                // changed the fields again mid-flight.
                if (f.productName?.trim() !== productName || f.brandName?.trim() !== brandName || f.brandNotApplicable !== brandNotApplicable) return f;
                if (res.match) {
                    const matchHasOuterPack = Number(res.match.masterPackSize) > 1;
                    return {
                        ...f,
                        brandItemMatch: res.match,
                        unit: res.match.unit,
                        packSize: String(res.match.packSize),
                        hasOuterPack: matchHasOuterPack,
                        masterPackSize: matchHasOuterPack ? String(res.match.masterPackSize) : "1",
                    };
                }
                // No match — clear any previously-locked packaging so the
                // seller can enter their own for this brand-new product.
                return f.brandItemMatch ? { ...f, brandItemMatch: null } : f;
            });
        }, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.productName, form.brandName, form.brandNotApplicable, locked, token]);

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const touch = (key) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

    useEffect(() => { fetchCommissionInfo().then((res) => { if (res?.success) setCommissionPercent(res.commissionPercent); }); }, []);

    // Prefill defaults from the seller's last submission — now covers delivery,
    // tax/legal, and commercial-terms groups (see GROUP_FIELD_MAP on the
    // backend), not just dispatch info. Product-specific fields (name, brand,
    // images, unit/packSize/masterPackSize, price, stock, MOQ) are deliberately
    // NOT prefilled — those are always specific to the new item being listed.
    useEffect(() => {
        if (!token || mode === "edit") return;
        fetchDefaultListingTemplates(token).then((res) => {
            if (!res?.success) return;
            const d = res.defaults || {};
            const delivery = d.delivery?.data || {};
            const taxLegal = d.tax_legal?.data || {};
            const commercial = d.commercial_terms?.data || {};
            setForm((f) => ({
                ...f,
                dispatchPincode: delivery.dispatchPincode ?? f.dispatchPincode,
                dispatchingLocations: delivery.dispatchingLocations ?? f.dispatchingLocations,
                freightIncluded: delivery.freightIncluded ?? f.freightIncluded,
                // hsnCode: taxLegal.hsnCode ?? f.hsnCode,
                gstPercent: taxLegal.gstPercent ?? f.gstPercent,
                gstInclusive: taxLegal.gstInclusive ?? f.gstInclusive,
                returnPolicyKey: taxLegal.returnPolicyKey ?? f.returnPolicyKey,
                warrantyKey: taxLegal.warrantyKey ?? f.warrantyKey,
                priceBasis: commercial.priceBasis ?? f.priceBasis,
            }));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, mode]);

    // Live price preview — mirrors normalizeEnteredPrice on the backend.
    //
    // Two modes, driven by "Price includes GST?":
    // - Inclusive: the price the seller types is the ceiling — exactly what the
    //   buyer should pay. GST% and commission% are both reverse-calculated OUT
    //   of it together (as a combined % of the base), instead of commission
    //   being stacked on top afterward. So finalPricePerUnit === entered price.
    // - Exclusive: entered price is the base as-is, GST + commission are both
    //   added on top for the buyer (unchanged).
    const pricePreview = useMemo(() => {
        const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
        const price = Number(form.basePrice) || 0;
        const gst = Number(form.gstPercent) || 0;
        const pack = Number(form.packSize) > 0 ? Number(form.packSize) : 1;
        const master = Number(form.masterPackSize) > 0 ? Number(form.masterPackSize) : 1;

        let perUnitPrice = price;
        if (form.priceBasis === "per_pack") perUnitPrice = price;
        if (form.priceBasis === "per_master_pack") perUnitPrice = price / master;

        let basePricePerUnit, gstAmount, commissionAmount, finalPricePerUnit;

        if (form.gstInclusive) {
            // Reverse out GST% + commission% together, as one combined divisor,
            // so both come off the exact figure the seller typed.
            const divisor = 1 + (gst + commissionPercent) / 100;
            basePricePerUnit = round2(perUnitPrice / divisor);
            gstAmount = round2(basePricePerUnit * (gst / 100));
            commissionAmount = round2(basePricePerUnit * (commissionPercent / 100));
            finalPricePerUnit = round2(basePricePerUnit + gstAmount + commissionAmount);
        } else {
            basePricePerUnit = round2(perUnitPrice);
            gstAmount = round2(basePricePerUnit * (gst / 100));
            commissionAmount = round2(basePricePerUnit * (commissionPercent / 100));
            finalPricePerUnit = round2(basePricePerUnit + gstAmount + commissionAmount);
        }

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

    const handleOuterPackToggle = (value) => {
        setForm((f) => ({
            ...f,
            hasOuterPack: value,
            masterPackSize: value ? "" : "1",
            // MOQ's unit of measure flips between Packs and Master Packs
            // depending on this toggle — a value entered under one meaning
            // is wrong under the other, so clear it rather than silently
            // reinterpreting the same number.
            moq: "",
        }));
        if (!value) setTouched((t) => (t.masterPackSize ? { ...t, masterPackSize: false } : t));
        setTouched((t) => (t.moq ? { ...t, moq: false } : t));
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

        // MOQ is always persisted in Packs. If the seller entered it in
        // Master Packs (hasOuterPack on), convert up before it leaves this
        // component — every downstream consumer (backend validation,
        // place_order math, BuyNowModal's computeMinQuantity) assumes Packs.
        const moqInPacks = form.hasOuterPack
            ? round2ToInt(Number(form.moq) * Number(form.masterPackSize))
            : Number(form.moq);

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
        onSubmit({ ...form, moq: String(moqInPacks), dispatchingLocations });
    };

    return (
        <div className="flex flex-col gap-3 pb-24 sm:gap-3.5">
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
                            <p className="truncate text-[14.5px] font-extrabold tracking-wide" style={{ color: C.ink }}>{form.productName}</p>
                            {form.brandName && <p className="truncate text-[12px] font-bold tracking-wider" style={{ color: C.primary }}>{form.brandName}</p>}
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
                                <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>
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

            {/* ---------------- Packaging ---------------- */}
            <SectionCard icon={Boxes} title="Packaging" alwaysOpen>
                {checkingBrandMatch && (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.muted }}>
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking if this product already exists…
                    </p>
                )}

                {form.brandItemMatch ? (
                    <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: C.hairSoft }}>
                        <Boxes className="h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                        <div className="min-w-0">
                            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: C.muted }}>Fixed by this product</p>
                            <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                1 Pack = {form.packSize} {form.unit}
                                {Number(form.masterPackSize) > 1 && ` · 1 Master Pack = ${form.masterPackSize} Packs`}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <FieldAnchor fieldKey="unit">
                                <SelectField required dense halfOnMobile label="What is the Selling Unit of this Product?" hint="Smallest measure this product is sold in (e.g. Pieces, Kg, Litres)" value={form.unit} onChange={(v) => setField("unit", v)} onBlur={() => touch("unit")} error={isErr("unit")} options={UNITS} />
                            </FieldAnchor>
                            <FieldAnchor fieldKey="packSize">
                                <TextField required dense tinyOnMobile placeholder="1234" label={getPackSizeLabel(form.unit)} hint={getPackSizeHint(form.unit)} value={form.packSize} onChange={(v) => setField("packSize", v.replace(/[^\d.]/g, ""))} onBlur={() => touch("packSize")} error={isErr("packSize")} inputMode="decimal" />
                            </FieldAnchor>
                        </div>

                        <ToggleField2
                            label="Does this have an Outer Pack?"
                            value={form.hasOuterPack}
                            onChange={handleOuterPackToggle}
                            infoBlock={
                                <div className="mb-1 flex items-start gap-2 rounded-xl">
                                    <p className="text-[8.5px] font-semibold leading-snug tracking-wide" style={{ color: C.primary }}>
                                        An outer pack is a larger pack / <b style={{ color: C.primary }}>Master Pack</b> containing multiple individual Packs.
                                    </p>
                                </div>
                            }
                        />

                        {form.hasOuterPack && (
                            <>
                                <FieldAnchor fieldKey="masterPackSize">
                                    <TextField
                                        required dense tinyOnMobile
                                        placeholder="1234"
                                        label="How many Packs are there in one Outer Pack?"
                                        hint="How many Packs make up 1 Master Pack (e.g. 1 Master Pack = 5 Packs)"
                                        value={form.masterPackSize}
                                        onChange={(v) => {
                                            const digitsOnly = v.replace(/[^\d]/g, "");
                                            setField("masterPackSize", digitsOnly === "1" ? "" : digitsOnly);
                                        }}
                                        onBlur={() => touch("masterPackSize")}
                                        error={isErr("masterPackSize")}
                                        inputMode="numeric"
                                    />
                                </FieldAnchor>
                            </>
                        )}
                        {/* Derived packaging summary — recalculates live from Unit / Pack size /
                        Master pack size, shown just above MOQ so the seller can sanity-check
                        the numbers they just entered before setting a minimum order quantity. */}
                        {form.unit && Number(form.packSize) > 0 && (
                            <p className="text-[13px] font-bold tracking-wider mt-1" style={{ color: C.ink }}>
                                {form.hasOuterPack && Number(form.masterPackSize) >= 2
                                    ? `1 Master Pack = ${form.masterPackSize} Packs = ${Number(form.packSize) * Number(form.masterPackSize)} ${form.unit}`
                                    : `1 Pack = ${form.packSize} ${form.unit}`}
                            </p>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <FieldAnchor fieldKey="moq">
                        <TextField required dense tinyOnMobile placeholder="1234" label={getMoqLabel(form.hasOuterPack)} hint={getMoqHint(form.hasOuterPack)}
                            value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))}
                            onBlur={() => touch("moq")} error={isErr("moq")} inputMode="decimal" />
                    </FieldAnchor>
                </div>
            </SectionCard>

            {/* ---------------- Pricing ---------------- */}
            <SectionCard icon={IndianRupee} title="Tax & Pricing" alwaysOpen>
                <ChipToggleGroup dense label="GST %" value={Number(form.gstPercent)} onChange={(v) => setField("gstPercent", Number(v))} options={GST_OPTIONS.map((g) => ({ value: g, label: `${g}%` }))} />
                {(() => {
                    const showMaster = form.hasOuterPack && Number(form.masterPackSize) >= 2;
                    const hasPrice = form.basePrice !== "" && form.basePrice != null;
                    const { perUnit, perPack, perMaster } = hasPrice
                        ? computeThreeTierPrices(form.priceBasis, form.basePrice, form.packSize, form.masterPackSize)
                        : { perUnit: "", perPack: "", perMaster: "" };

                    // Show the raw typed value in whichever field is the active basis,
                    // and the derived value in the other two — but ONLY when a price has
                    // actually been entered. Empty basePrice means all three stay empty,
                    // never falling back to a computed "0".
                    const unitValue = !hasPrice ? "" : (form.priceBasis === "per_unit" ? form.basePrice : String(perUnit));
                    const packValue = !hasPrice ? "" : (form.priceBasis === "per_pack" ? form.basePrice : String(perPack));
                    const masterValue = !hasPrice ? "" : (form.priceBasis === "per_master_pack" ? form.basePrice : String(perMaster));

                    const sanitize = (v) => v.replace(/[^\d.]/g, "");

                    return (
                        <FieldAnchor fieldKey="basePrice">
                            <div className={`grid gap-2.5 ${showMaster ? "grid-cols-3" : "grid-cols-2"}`}>
                                <TextField2
                                    required dense
                                    label={`Per ${form.unit || "Unit"} (₹)`}
                                    hint={`Price for 1 ${form.unit || "Unit"} — the other fields recalculate automatically`}
                                    value={unitValue}
                                    onChange={(v) => setForm((f) => ({ ...f, basePrice: sanitize(v), priceBasis: "per_unit" }))}
                                    onBlur={() => touch("basePrice")}
                                    error={isErr("basePrice")}
                                    inputMode="decimal"
                                />
                                <TextField2
                                    required dense
                                    label="Per Pack (₹)"
                                    hint={`Price for 1 Pack (${form.packSize || "?"} ${form.unit || "Unit"}) — the other fields recalculate automatically`}
                                    value={packValue}
                                    onChange={(v) => setForm((f) => ({ ...f, basePrice: sanitize(v), priceBasis: "per_pack" }))}
                                    onBlur={() => touch("basePrice")}
                                    error={isErr("basePrice")}
                                    inputMode="decimal"
                                />
                                {showMaster && (
                                    <TextField2
                                        required dense
                                        label="Per Master Pack (₹)"
                                        hint={`Price for 1 Master Pack (${form.masterPackSize || "?"} Packs) — the other fields recalculate automatically`}
                                        value={masterValue}
                                        onChange={(v) => setForm((f) => ({ ...f, basePrice: sanitize(v), priceBasis: "per_master_pack" }))}
                                        onBlur={() => touch("basePrice")}
                                        error={isErr("basePrice")}
                                        inputMode="decimal"
                                    />
                                )}
                            </div>
                            <div className={`mt-1 grid gap-2.5 items-start ${showMaster ? "grid-cols-3" : "grid-cols-2"}`}>
                                <p className="text-[9.5px] font-semibold tracking-wide leading-tight" style={{ color: C.muted }}>
                                    Price per 1 {form.unit || "Unit"}
                                </p>
                                <p className="text-[9.5px] font-semibold tracking-wide leading-tight" style={{ color: C.muted }}>
                                    Price per {form.packSize || "?"} {form.unit || "Unit"}
                                </p>
                                {showMaster && (
                                    <p className="text-[9.5px] font-semibold tracking-wide leading-tight" style={{ color: C.muted }}>
                                        Price per {form.masterPackSize} packs
                                    </p>
                                )}
                            </div>
                        </FieldAnchor>
                    );
                })()}
                <div className="grid grid-cols-2 gap-2.5">
                    <ToggleField label="Price includes GST?" value={form.gstInclusive} onChange={(v) => setField("gstInclusive", v)} />
                    <ToggleField label="Freight included?" value={form.freightIncluded} onChange={(v) => setField("freightIncluded", v)} />
                </div>
                <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: `${C.secondary}0c` }}>
                    <span className="text-[11.5px] font-bold tracking-wide" style={{ color: C.muted }}>Base price / pack (excl. GST)</span>
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
                    label="Discount slabs" hint="Extra % off above a quantity threshold, in Packs"
                    rows={form.priceSlabs} onChange={(rows) => setField("priceSlabs", rows)} addLabel="Add slab"
                    columns={[{ key: "minQty", placeholder: "Min qty (Packs)", inputMode: "decimal" }, { key: "discountPercent", placeholder: "Discount %", inputMode: "decimal" }]}
                />
                {form.priceSlabs.some((s) => s.discountPercent) && (
                    <div className="flex flex-col gap-1 rounded-xl border px-3 py-2" style={{ borderColor: C.hairSoft }}>
                        {form.priceSlabs.filter((s) => s.minQty && s.discountPercent).map((s, i) => (
                            <p key={i} className="text-[10.5px] font-semibold tabular-nums" style={{ color: C.muted }}>
                                Above {s.minQty} Pack{Number(s.minQty) === 1 ? "" : "s"}: ₹{discountedPreview(s)} / {form.unit}
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
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Base price</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{pricePreview.basePricePerUnit.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.hair, background: "#fff" }}>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>+ GST ({form.gstPercent}%)</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{pricePreview.gstAmount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.hair, background: "#fff" }}>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>+ Commission ({commissionPercent}%)</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.primary }}>₹{pricePreview.commissionAmount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border p-2.5 text-center" style={{ borderColor: C.secondary, background: `${C.secondary}0c` }}>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.secondary }}>Final price</p>
                    <p className="mt-1 text-[13px] font-extrabold tabular-nums" style={{ color: C.secondary }}>₹{pricePreview.finalPricePerUnit.toLocaleString("en-IN")}</p>
                </div>
            </div>

            <div className={`sticky ${stickyBottomClassName} z-10 -mx-2.5 mt-1 border-t bg-white/95 px-2.5 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4`} style={{ borderColor: C.hair }}>
                <Progress percent={percentComplete} />
                <button type="button" onClick={handleSubmit} disabled={submitting}
                    className="mt-2.5 flex w-full items-center tracking-wider justify-center gap-1.5 rounded-xl px-5 py-3 text-[13.5px] font-bold text-white transition-opacity duration-150 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{submitLabel} <CheckCircle2 className="h-4 w-4" /></>}
                </button>
            </div>
        </div>
    );
}