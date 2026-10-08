// src/components/save/SavePostWizard.jsx
// The 4-step "add to my price list" wizard, wired to the existing RFQ backend:
// createRfq / updateRfq, validateRfqForm + toPayload (same validation and payload as RfqFormModal), uploadSellerFile, lookupPincode.
//
// Scroll handling: the app uses Lenis (smooth scroll). Lenis listens on window and hijacks wheel/touch events,
// which made the wizard body unscrollable/janky. While the wizard is open we (1) stop Lenis if it is reachable,
// (2) mark the overlay with data-lenis-prevent so Lenis ignores events that start inside it, and
// (3) stop wheel/touch events from bubbling to window as a final safety net.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, ImagePlus, Loader2 } from "lucide-react";
import DispatchingLocationsPicker from "../seller/listingForm/DispatchingLocationsPicker.jsx";
import { useBuyerAddress } from "../../context/BuyerAddressContext.jsx";
import { createRfq, updateRfq } from "../../utils/rfqApi.js";
import { uploadSellerFile } from "../../utils/api.js";
import { lookupPincode } from "../../utils/sellerListingApi.js";
import {
    EMPTY_RFQ_FORM, validateRfqForm, toPayload, fromDto,
    RFQ_UNITS, PAYMENT_OPTIONS, FREQ_OPTIONS, fmtNum,
} from "../../utils/rfqUtils.js";

const STEPS = [
    { t: "What do you need?", s: "Start with the product. Add pictures and specs if you have them.", keys: ["productName"] },
    { t: "How much, and on what terms?", s: "Quantity and packing help suppliers price accurately.", keys: ["quantity", "unit", "packSize", "paymentTerms", "creditDays", "recurringFrequency", "recurringQuantity"] },
    { t: "Where should it go?", s: "Pre-filled from your saved address. You can change it for this item.", keys: ["deliveryPincode", "deliveryCity", "deliveryState", "supplierLocations"] },
    { t: "Review and submit", s: "One last look. You can edit any section.", keys: [] },
];

// Options may be plain strings or { value, label }; accept both.
const ov = (o) => (o && typeof o === "object" ? o.value : o);
const ol = (o) => (o && typeof o === "object" ? o.label ?? o.value : o);
const labelOf = (opts, v) => { const f = (opts || []).find((o) => ov(o) === v); return f ? ol(f) : v || ""; };
const stepOf = (key) => { const i = STEPS.findIndex((s) => s.keys.includes(key)); return i < 0 ? 0 : i; };

// Lenis instance is usually exposed on window by the provider; try the common names.
const getLenis = () => (typeof window !== "undefined" ? window.lenis || window.__lenis || null : null);
const stopEvent = (e) => e.stopPropagation();

function Field({ k, label, hint, error, children }) {
    return (
        <div className="sh-f" data-k={k}>
            <label>{label}</label>
            {children}
            {hint && !error && <p className="sh-cap">{hint}</p>}
            {error && <p className="sh-err">{error}</p>}
        </div>
    );
}
const Inp = ({ pre, suf, ...r }) => (
    <div className="sh-inp">{pre && <span className="pre">{pre}</span>}<input {...r} />{suf && <span className="suf">{suf}</span>}</div>
);
const Chips = ({ value, onChange, options }) => (
    <div className="sh-ch">
        {options.map((o) => (
            <button key={String(ov(o))} type="button" aria-pressed={value === ov(o)} onClick={() => onChange(ov(o))}>{ol(o)}</button>
        ))}
    </div>
);

export default function SavePostWizard({ mode = "create", initial = null, token, onClose, onSubmitted }) {
    let addr = null;
    try { addr = useBuyerAddress()?.selectedAddress || null; } catch { /* provider not mounted: no prefill */ }

    const [form, setForm] = useState(() => (initial ? fromDto(initial) : { ...EMPTY_RFQ_FORM }));
    const [step, setStep] = useState(0);
    const [attempted, setAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(null);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [imgError, setImgError] = useState(null);
    const [lookingUp, setLookingUp] = useState(false);
    const bodyRef = useRef(null);
    const fileRef = useRef(null);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    useEffect(() => { // prefill delivery from the saved address (create mode, only empty fields)
        if (mode !== "create" || !addr) return;
        setForm((f) => ({
            ...f,
            deliveryPincode: f.deliveryPincode || addr.pincode || "",
            deliveryCity: f.deliveryCity || addr.city || "",
            deliveryState: f.deliveryState || addr.state || "",
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, addr?.pincode, addr?.city, addr?.state]);

    useEffect(() => { // lock page scroll (native + Lenis) while open
        const root = document.documentElement;
        const sw = window.innerWidth - root.clientWidth;
        const { style } = document.body;
        const prevO = style.overflow, prevP = style.paddingRight;
        const prevRootO = root.style.overflow;
        style.overflow = "hidden";
        root.style.overflow = "hidden";
        if (sw > 0) style.paddingRight = `${sw}px`;
        const lenis = getLenis();
        try { lenis?.stop?.(); } catch { /* ignore */ }
        return () => {
            style.overflow = prevO;
            style.paddingRight = prevP;
            root.style.overflow = prevRootO;
            try { getLenis()?.start?.(); } catch { /* ignore */ }
        };
    }, []);

    const closeRef = useRef();
    closeRef.current = () => { if (!submitting) onClose?.(); };
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const errs = useMemo(() => validateRfqForm(form), [form]);
    const show = (k) => (attempted ? errs[k] : undefined);
    const stepErrKeys = STEPS[step].keys.filter((k) => errs[k]);

    const goto = (i) => { setStep(i); setAttempted(false); setError(null); requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 })); };

    const next = () => {
        if (stepErrKeys.length) {
            setAttempted(true);
            requestAnimationFrame(() => bodyRef.current?.querySelector(`[data-k="${stepErrKeys[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
            return;
        }
        goto(step + 1);
    };

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files || []).filter((f) => f.type?.startsWith("image/"));
        e.target.value = "";
        if (!files.length) return;
        const room = 5 - form.images.length;
        if (room <= 0) return setImgError("You can add up to 5 images.");
        setUploading(true); setImgError(null);
        try {
            const urls = [];
            for (const file of files.slice(0, room)) {
                const res = await uploadSellerFile(token, file, "listings");
                if (!res?.success) throw new Error("Image upload failed. Please try again.");
                urls.push(res.url);
            }
            setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, 5) }));
        } catch (err) { setImgError(err.message); }
        finally { setUploading(false); }
    };

    const onPincode = async (raw) => {
        const pin = raw.replace(/\D/g, "").slice(0, 6);
        set("deliveryPincode", pin);
        if (pin.length !== 6) return;
        setLookingUp(true);
        try {
            const res = await lookupPincode(pin);
            if (res?.success) setForm((f) => (f.deliveryPincode === pin ? { ...f, deliveryCity: res.district || f.deliveryCity, deliveryState: res.state || f.deliveryState } : f));
        } finally { setLookingUp(false); }
    };

    const submit = async () => {
        if (submitting) return;
        const all = validateRfqForm(form);
        const first = Object.keys(all)[0];
        if (first) { goto(stepOf(first)); setAttempted(true); setError("Please fix the highlighted fields."); return; }
        setSubmitting(true); setError(null);
        try {
            const payload = toPayload(form);
            const res = mode === "edit" ? await updateRfq(token, initial.id, payload) : await createRfq(token, payload);
            if (!res.success) { setError(res.message || "Couldn't submit. Please try again."); return; }
            setDone(res);
            onSubmitted?.(res);
        } finally { setSubmitting(false); }
    };

    const again = () => { setForm({ ...EMPTY_RFQ_FORM, deliveryPincode: form.deliveryPincode, deliveryCity: form.deliveryCity, deliveryState: form.deliveryState }); setDone(null); goto(0); };

    const qty = Number(form.quantity), pack = Number(form.packSize);
    const totalQty = qty > 0 && pack > 0 ? qty * pack : 0;
    const eq = form.acceptEquivalent;
    const unitOpts = (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) }));

    const body = (() => {
        if (done) {
            return (
                <div className="sh-in2 sh-center">
                    <div className="sh-okc"><Check size={40} strokeWidth={3} /></div>
                    <h3>{mode === "edit" ? "Changes submitted" : "Added to your price list"}</h3>
                    <p className="sh-sub">{form.productName} · {fmtNum(totalQty)} {form.unit} · {form.deliveryCity}, {form.deliveryState}</p>
                    <ul className="sh-tl">
                        <li><div><b>Our team reviews it</b><span>Every item is reviewed before it goes live to suppliers.</span></div></li>
                        <li><div><b>Goes live to suppliers</b><span>{form.supplierScope === "specific" ? "Suppliers in your chosen locations can see it." : "Suppliers across India can see it."}</span></div></li>
                        <li><div><b>Prices arrive</b><span>Compare price, MOQ, delivery time and terms side by side.</span></div></li>
                    </ul>
                </div>
            );
        }
        const s = STEPS[step];
        return (
            <div className="sh-in2" key={step}>
                <h3>{s.t}</h3>
                <p className="sh-sub">{s.s}</p>

                {step === 0 && (<>
                    {mode === "edit" && initial?.status === "rejected" && initial?.reviewNote && (
                        <p className="sh-rej" style={{ marginTop: 14 }}>Why it wasn't approved: {initial.reviewNote}</p>
                    )}
                    <Field k="productName" label="Product name *" error={show("productName")}>
                        <Inp value={form.productName} placeholder="e.g. Stainless Steel Hinges 4 inch" onChange={(e) => set("productName", e.target.value)} />
                    </Field>
                    <Field k="images" label={`Product images (optional)${form.images.length ? ` · ${form.images.length}/5` : ""}`} error={imgError}>
                        <div className="sh-pho">
                            {form.images.map((src, i) => (
                                <div className="pt" key={src + i} style={{ backgroundImage: `url(${src})` }}>
                                    <button type="button" className="x" aria-label="Remove image" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}><X size={14} /></button>
                                </div>
                            ))}
                            {form.images.length < 5 && (
                                <label className="add">
                                    {uploading ? <Loader2 size={18} className="sh-spin" /> : <ImagePlus size={18} />}<span>{uploading ? "…" : "Add"}</span>
                                    <input ref={fileRef} type="file" accept="image/*" multiple hidden disabled={uploading} onChange={handleFiles} />
                                </label>
                            )}
                        </div>
                    </Field>
                    <Field k="specifications" label="Specifications (optional)">
                        <textarea value={form.specifications} placeholder="Grade, size, material, brand preference, standards…" onChange={(e) => set("specifications", e.target.value)} />
                    </Field>
                    <button type="button" className="sh-eqc" role="checkbox" aria-checked={!!eq} onClick={() => set("acceptEquivalent", !eq)}>
                        <i>{eq ? <Check size={16} strokeWidth={3} /> : null}</i>
                        <span><b>Equivalent products are acceptable</b><span>Suppliers can price a comparable alternative. Leave unticked if you need exactly this product.</span></span>
                    </button>
                </>)}

                {step === 1 && (<>
                    <Field k="quantity" label="Quantity (in packs) *" error={show("quantity")}>
                        <Inp inputMode="decimal" placeholder="e.g. 500" value={form.quantity} onChange={(e) => set("quantity", e.target.value.replace(/[^\d.]/g, ""))} />
                    </Field>
                    <div className="sh-two">
                        <Field k="unit" label="Unit *" error={show("unit")}>
                            <div className="sh-inp">
                                <select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                                    <option value="">Select…</option>
                                    {unitOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </Field>
                        <Field k="packSize" label={form.unit ? `Pack size (${form.unit}) *` : "Pack size *"} error={show("packSize")}>
                            <Inp inputMode="decimal" placeholder="1 if loose" value={form.packSize} onChange={(e) => set("packSize", e.target.value.replace(/[^\d.]/g, ""))} />
                        </Field>
                    </div>
                    <div className="sh-brk">
                        {totalQty && form.unit
                            ? <><div><span>You need</span><b>{fmtNum(totalQty)} {form.unit}</b></div><div><span>Packs</span><b>{fmtNum(qty)} × {fmtNum(pack)} {form.unit}</b></div></>
                            : "Enter quantity, unit and pack size to see your total."}
                    </div>
                    <Field k="paymentTerms" label="Expected payment terms *" error={show("paymentTerms")}>
                        <Chips value={form.paymentTerms} onChange={(v) => set("paymentTerms", v)} options={PAYMENT_OPTIONS} />
                    </Field>
                    {form.paymentTerms === "credit" && (
                        <Field k="creditDays" label="Credit period (days, optional)" error={show("creditDays")}>
                            <Inp inputMode="numeric" placeholder="e.g. 30" value={form.creditDays} onChange={(e) => set("creditDays", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                        </Field>
                    )}
                    <Field k="consumptionType" label="Is this regular consumption?">
                        <Chips value={form.consumptionType} onChange={(v) => set("consumptionType", v)} options={[{ value: "one_time", label: "One-time" }, { value: "regular", label: "Regular" }]} />
                    </Field>
                    {form.consumptionType === "regular" && (<>
                        <Field k="recurringFrequency" label="How often? *" error={show("recurringFrequency")}>
                            <Chips value={form.recurringFrequency} onChange={(v) => set("recurringFrequency", v)} options={FREQ_OPTIONS} />
                        </Field>
                        <Field k="recurringQuantity" label={`Quantity per period${form.unit ? ` (${form.unit})` : ""} *`} error={show("recurringQuantity")}>
                            <Inp inputMode="decimal" placeholder="e.g. 200" value={form.recurringQuantity} onChange={(e) => set("recurringQuantity", e.target.value.replace(/[^\d.]/g, ""))} />
                        </Field>
                    </>)}
                </>)}

                {step === 2 && (<>
                    <Field k="deliveryPincode" label="Pincode *" error={show("deliveryPincode")}>
                        <Inp inputMode="numeric" maxLength={6} placeholder="6 digits" autoComplete="postal-code" value={form.deliveryPincode} onChange={(e) => onPincode(e.target.value)} />
                    </Field>
                    <div className="sh-two">
                        <Field k="deliveryCity" label={lookingUp ? "City…" : "City *"} error={show("deliveryCity")}>
                            <Inp value={form.deliveryCity} onChange={(e) => set("deliveryCity", e.target.value)} />
                        </Field>
                        <Field k="deliveryState" label="State *" error={show("deliveryState")}>
                            <Inp value={form.deliveryState} onChange={(e) => set("deliveryState", e.target.value)} />
                        </Field>
                    </div>
                    <Field k="deliveryAddress" label="Address / landmark (optional)">
                        <Inp placeholder="Optional" value={form.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} />
                    </Field>
                    <Field k="supplierScope" label="Looking for suppliers from">
                        <Chips value={form.supplierScope} onChange={(v) => set("supplierScope", v)} options={[{ value: "any", label: "Anywhere in India" }, { value: "specific", label: "Specific locations" }]} />
                    </Field>
                    {form.supplierScope === "specific" && (
                        <Field k="supplierLocations" label="Choose locations *" error={show("supplierLocations")}>
                            <div className="sh-lt"><DispatchingLocationsPicker value={form.supplierLocations} onChange={(v) => set("supplierLocations", v)} /></div>
                        </Field>
                    )}
                </>)}

                {step === 3 && (() => {
                    const R = (i, l, v) => <div className="sh-rv" key={i}><div><small>{l}</small><b>{v}</b></div><button type="button" className="sh-lnk" onClick={() => goto(i)}>Edit</button></div>;
                    return (<>
                        {R(0, "Product", `${form.productName}${form.images.length ? ` · ${form.images.length} photo${form.images.length > 1 ? "s" : ""}` : ""} · ${eq ? "equivalents OK" : "exact product"}`)}
                        {R(1, "Quantity", `${fmtNum(qty)} packs × ${fmtNum(pack)} ${form.unit} = ${fmtNum(totalQty)} ${form.unit} · ${labelOf(PAYMENT_OPTIONS, form.paymentTerms)}${form.paymentTerms === "credit" && form.creditDays ? ` (${form.creditDays} days)` : ""} · ${form.consumptionType === "regular" ? `Regular, ${form.recurringQuantity} ${form.unit} ${labelOf(FREQ_OPTIONS, form.recurringFrequency)}` : "One-time"}`)}
                        {R(2, "Delivery", `${form.deliveryCity}, ${form.deliveryState} – ${form.deliveryPincode} · suppliers: ${form.supplierScope === "specific" ? "chosen locations" : "anywhere in India"}`)}
                    </>);
                })()}
            </div>
        );
    })();

    return createPortal(
        <div className="sv sh-portal">
            <div
                className="sh-ov"
                data-lenis-prevent
                onWheel={stopEvent}
                onTouchMove={stopEvent}
                onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}
            >
                <div className="sh-wz" role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Edit item" : "Add to my price list"}>
                    <div className="sh-wh">
                        <h2>{mode === "edit" ? "Edit item" : "Add to my price list"}</h2>
                        <p>Our team reviews every item before it goes live to suppliers.</p>
                        <button type="button" className="sh-ib" aria-label="Close" onClick={() => closeRef.current()}><X size={18} /></button>
                    </div>
                    {!done && (<>
                        <div className="sh-wp" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i < step ? "on" : i === step ? "cur" : ""} />)}</div>
                        <p className="sh-stp">Step {step + 1} of {STEPS.length}</p>
                    </>)}
                    <div className="sh-wb" ref={bodyRef} data-lenis-prevent>{body}</div>
                    <div className="sh-wf">
                        {error && <p className="sh-err sh-ferr" role="alert">{error}</p>}
                        {done ? (<>
                            {mode !== "edit" && <button type="button" className="sh-btn" onClick={again}>Add another</button>}
                            <button type="button" className="sh-btn go" onClick={() => onClose?.()}>Back to my price list</button>
                        </>) : (<>
                            <button type="button" className="sh-btn" disabled={submitting} onClick={() => (step ? goto(step - 1) : onClose?.())}>{step ? "Back" : "Cancel"}</button>
                            <button type="button" className="sh-btn go" disabled={submitting || uploading} onClick={() => (step === 3 ? submit() : next())}>
                                {step === 3 ? (submitting ? <Loader2 size={18} className="sh-spin" /> : mode === "edit" ? "Save & resubmit" : "Submit for review") : "Continue"}
                            </button>
                        </>)}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}