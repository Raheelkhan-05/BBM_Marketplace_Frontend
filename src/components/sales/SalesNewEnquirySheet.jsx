// src/components/sales/SalesNewEnquirySheet.jsx
// A salesperson starts an enquiry for a customer who may not be on the platform yet.
// Customer = GST number (company name is fetched from it) OR a company name typed by hand. One of the two is required.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, BadgeCheck } from "lucide-react";
import { createThread } from "../../utils/salesThreadApi.js";
import { RFQ_UNITS } from "../../utils/rfqUtils.js";
import { useSheetBehavior, useGstLookup } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, ov, ol } from "./salesThreadFmt.js";
import "./sales-threads.css";

const EMPTY = { gstin: "", name: "", phone: "", email: "", product: "", quantity: "", unit: "", specs: "" };

export default function SalesNewEnquirySheet({ token, onClose, onCreated }) {
    useSheetBehavior(onClose);
    const [f, setF] = useState(EMPTY);
    const [nameFromGst, setNameFromGst] = useState(false);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const gst = useGstLookup(token);

    const set = (patch) => { setF((s) => ({ ...s, ...patch })); setFormErr(""); };

    // Fetch the company name as soon as a complete, valid GST number is typed.
    useEffect(() => {
        const g = cleanGstin(f.gstin);
        if (!GSTIN_RE.test(g)) { gst.reset(); return; }
        let live = true;
        gst.run(g).then((name) => { if (live && name) { setF((s) => ({ ...s, name })); setNameFromGst(true); } });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [f.gstin]);

    const validate = () => {
        const e = {};
        const g = cleanGstin(f.gstin);
        if (g && !GSTIN_RE.test(g)) e.gstin = "Enter all 15 characters of the GST number, or clear it.";
        if (!g && !f.name.trim()) e.name = "Enter the GST number or the company name.";
        if (f.phone.trim() && !cleanPhone(f.phone)) e.phone = "Enter a valid 10-digit mobile number.";
        if (f.email.trim() && !cleanEmail(f.email)) e.email = "Enter a valid email address.";
        if (f.product.trim().length < 2) e.product = "Enter the product name.";
        if (!(Number(f.quantity) > 0)) e.quantity = "Enter the quantity.";
        if (!f.unit) e.unit = "Choose a unit.";
        return e;
    };

    const submit = async () => {
        if (busy) return;
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length) return;
        setBusy(true); setFormErr("");
        const res = await createThread(token, {
            customerGstin: cleanGstin(f.gstin), customerName: f.name.trim(),
            customerPhone: f.phone.trim(), customerEmail: f.email.trim(),
            productName: f.product.trim(), quantity: Number(f.quantity), unit: f.unit, specifications: f.specs.trim(),
        });
        setBusy(false);
        if (!res.success) return setFormErr(res.message || "Couldn't create the enquiry. Please try again.");
        onCreated?.(res.thread);
    };

    const units = (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) }));
    const gstHint = gst.status === "loading" ? "Finding the company…"
        : gst.status === "ok" ? "Company name filled from the GST number."
            : gst.status === "fail" ? "Couldn't find this GST number. Type the company name below." : "Optional. We fill in the company name from it.";

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="New enquiry">
                <div className="st-sh-h">
                    <div><h2>New enquiry</h2><p>Only you and your team admin can see it.</p></div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" data-lenis-prevent>
                    <p className="st-sec">Customer</p>
                    <div className="st-f">
                        <label htmlFor="ne-gst">GST number</label>
                        <div className="st-inw">
                            <input id="ne-gst" className="st-in" value={f.gstin} maxLength={15} autoCapitalize="characters" autoComplete="off"
                                placeholder="e.g. 24ABCDE1234F1Z5" onChange={(e) => set({ gstin: cleanGstin(e.target.value) })} />
                            {gst.status === "loading" && <Loader2 size={16} className="st-spin st-inw-i" />}
                            {gst.status === "ok" && <BadgeCheck size={18} className="st-inw-i ok" />}
                        </div>
                        <p className={`st-hint${gst.status === "fail" ? " warn" : ""}`}>{errors.gstin ? <span className="st-err">{errors.gstin}</span> : gstHint}</p>
                    </div>

                    <div className="st-f">
                        <label htmlFor="ne-name">Company name {!cleanGstin(f.gstin) && "*"}</label>
                        <input id="ne-name" className="st-in" value={f.name} placeholder="Customer's company name"
                            onChange={(e) => { set({ name: e.target.value }); setNameFromGst(false); }} />
                        {nameFromGst && <p className="st-hint">From the GST records. You can edit it.</p>}
                        {errors.name && <p className="st-err">{errors.name}</p>}
                    </div>

                    <div className="st-two">
                        <div className="st-f">
                            <label htmlFor="ne-ph">Mobile number</label>
                            <input id="ne-ph" className="st-in" inputMode="tel" autoComplete="off" placeholder="10 digits" value={f.phone}
                                onChange={(e) => set({ phone: e.target.value.replace(/[^\d+\s-]/g, "") })} />
                            {errors.phone && <p className="st-err">{errors.phone}</p>}
                        </div>
                        <div className="st-f">
                            <label htmlFor="ne-em">Email</label>
                            <input id="ne-em" className="st-in" type="email" autoComplete="off" placeholder="name@company.com" value={f.email}
                                onChange={(e) => set({ email: e.target.value })} />
                            {errors.email && <p className="st-err">{errors.email}</p>}
                        </div>
                    </div>
                    <p className="st-hint" style={{ marginTop: -4 }}>You need the GST number plus a mobile number or email to send a quotation. You can add them later.</p>

                    <p className="st-sec">What they need</p>
                    <div className="st-f">
                        <label htmlFor="ne-prod">Product name *</label>
                        <input id="ne-prod" className="st-in" value={f.product} placeholder="e.g. Stainless steel hinges 4 inch" onChange={(e) => set({ product: e.target.value })} />
                        {errors.product && <p className="st-err">{errors.product}</p>}
                    </div>
                    <div className="st-two">
                        <div className="st-f">
                            <label htmlFor="ne-qty">Quantity *</label>
                            <input id="ne-qty" className="st-in" inputMode="decimal" placeholder="e.g. 500" value={f.quantity}
                                onChange={(e) => set({ quantity: e.target.value.replace(/[^\d.]/g, "") })} />
                            {errors.quantity && <p className="st-err">{errors.quantity}</p>}
                        </div>
                        <div className="st-f">
                            <label htmlFor="ne-unit">Unit *</label>
                            <select id="ne-unit" className="st-in" value={f.unit} onChange={(e) => set({ unit: e.target.value })}>
                                <option value="">Select…</option>
                                {units.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {errors.unit && <p className="st-err">{errors.unit}</p>}
                        </div>
                    </div>
                    <div className="st-f">
                        <label htmlFor="ne-spec">Specifications</label>
                        <textarea id="ne-spec" className="st-in" rows={3} placeholder="Grade, size, brand, anything the customer mentioned" value={f.specs} onChange={(e) => set({ specs: e.target.value })} />
                    </div>
                </div>

                <div className="st-sh-f">
                    {formErr && <p className="st-err" role="alert" style={{ flex: "1 1 100%" }}>{formErr}</p>}
                    <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy || gst.status === "loading"} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}Create enquiry
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}