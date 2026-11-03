// src/components/sales/SalesNewEnquirySheet.jsx
// Start an enquiry or log a call.
//  CUSTOMER: pick one of your existing customers (search) -> or add a new one by GST number / company name + one or more contacts.
//            A contact has an optional person name and a mobile number and/or an email. Contacts are optional here, but you
//            need a GST number and at least one contact to send a quotation. They are saved on the customer with the first quotation.
//  TYPE:     "Enquiry" (the customer asked for a product / price) or "Cold call / other" (no enquiry yet).
//    Enquiry   -> tag a product from your company catalog (locked afterwards) or type its name, plus the quantity.
//    Cold call -> a free text note about what happened. The product can be added later from the thread.
// `initialCustomer` pre-selects a customer (used from the Customers page).
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, BadgeCheck, UserPlus, PhoneCall, MessageSquareText } from "lucide-react";
import { createThread } from "../../utils/salesThreadApi.js";
import { fetchSalesCustomers } from "../../utils/salesApi.js";
import { useSheetBehavior, useGstLookup } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, initialOf } from "./salesThreadFmt.js";
import { ContactRowsEditor, blankContact, collectContacts } from "./ContactFields.jsx";
import { SearchList, useDebounced, useRemoteList, useProductForm, ProductFields, LIST_PAGE } from "./SalesProductFields.jsx";
import "./sales-threads.css";
import "../orderBook/order-book.css";
import "./sales-threads.cold.css";

const NOTE_MAX = 4000;
const QUICK_NOTES = ["Didn't pick up", "Call back later", "Not interested", "Interested, will share requirement"];
const blankCustomer = { mode: "pick", picked: null, gstin: "", name: "", fromGst: false };
const justContact = ({ name, phone, email }) => ({ name, phone, email });

// "Ravi · 98xxxxxx · a@b.com" for one contact, "3 contacts" for several.
const contactsLine = (list) => {
    if (!list?.length) return "";
    return list.length > 1 ? `${list.length} contacts` : [list[0].name, list[0].phone, list[0].email].filter(Boolean).join(" · ");
};

export default function SalesNewEnquirySheet({ token, onClose, onCreated, initialCustomer = null }) {
    useSheetBehavior(onClose);
    const [c, setC] = useState(() => (initialCustomer ? { ...blankCustomer, mode: "picked", picked: initialCustomer } : blankCustomer));
    const [rows, setRows] = useState(() => [blankContact()]);   // new customer: the contacts typed
    const [kind, setKind] = useState("enquiry");     // enquiry | cold_call
    const [note, setNote] = useState("");
    const [cSearch, setCSearch] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const gst = useGstLookup(token);

    const touch = useCallback(() => setFormErr(""), []);
    const patchC = (patch) => { setC((s) => ({ ...s, ...patch })); touch(); };
    const form = useProductForm(token, { enabled: kind === "enquiry", onTouch: touch });
    const cold = kind === "cold_call";

    // ---- customers (the salesperson's own customers, same list as the Customers tab) ----
    const dCq = useDebounced(cSearch);
    const custList = useRemoteList(
        useCallback((q, offset) => fetchSalesCustomers(token, { q, filter: "all", limit: LIST_PAGE, offset }), [token]),
        dCq, c.mode === "pick", (i) => i.id,
    );

    // New customer: as soon as a full GST number is typed, the company name is fetched from it.
    useEffect(() => {
        if (c.mode !== "new") return undefined;
        const g = cleanGstin(c.gstin);
        if (!GSTIN_RE.test(g)) { gst.reset(); return undefined; }
        let live = true;
        gst.run(g).then((name) => { if (live && name) setC((s) => ({ ...s, name, fromGst: true })); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c.gstin, c.mode]);

    const pickCustomer = (cu) => { setC({ ...blankCustomer, mode: "picked", picked: cu }); setErrors((e) => ({ ...e, customer: undefined })); touch(); };
    const startNew = () => { setC({ ...blankCustomer, mode: "new" }); setRows([blankContact()]); touch(); };
    const backToSearch = () => { setC({ ...blankCustomer }); setRows([blankContact()]); gst.reset(); };
    const changeRows = (next) => { setRows(next); setErrors((e) => ({ ...e, rows: undefined })); touch(); };

    const chooseKind = (k) => { setKind(k); setErrors({}); touch(); };
    const addQuick = (t) => { setNote((n) => (n.trim() ? `${n.trim()}\n${t}` : t).slice(0, NOTE_MAX)); setErrors((e) => ({ ...e, note: undefined })); touch(); };

    const validateCustomer = () => {
        const e = {};
        if (c.mode === "pick") e.customer = "Choose a customer, or add a new one.";
        if (c.mode === "new") {
            const g = cleanGstin(c.gstin);
            if (g && !GSTIN_RE.test(g)) e.gstin = "Enter all 15 characters of the GST number, or clear it.";
            if (!g && !c.name.trim()) e.name = "Enter the GST number or the company name.";
            const col = collectContacts(rows);
            if (!col.blank && !col.ok) e.rows = col.errors;   // contacts are optional, but a typed one must be valid
        }
        return e;
    };

    const submit = async () => {
        if (busy) return;
        const ce = validateCustomer();
        const ne = {};
        let productOk = true;
        if (cold) { if (note.trim().length < 2) ne.note = "Write a short note about the call."; }
        else productOk = form.check();
        setErrors({ ...ce, ...ne });
        if (Object.keys(ce).length || Object.keys(ne).length || !productOk) return;

        const cu = c.mode === "picked"
            ? { customerGstin: c.picked.gstin || "", customerName: c.picked.name || "", contacts: (c.picked.contacts || []).map(justContact) }
            : { customerGstin: cleanGstin(c.gstin), customerName: c.name.trim(), contacts: collectContacts(rows).list.map(justContact) };

        setBusy(true); setFormErr("");
        const res = await createThread(token, cold
            ? { ...cu, kind: "cold_call", note: note.trim() }
            : { ...cu, kind: "enquiry", ...form.payload() });
        setBusy(false);
        if (!res.success) return setFormErr(res.message || (cold ? "Couldn't log this call. Please try again." : "Couldn't create the enquiry. Please try again."));
        onCreated?.(res.thread);
    };

    const gstHint = gst.status === "loading" ? "Finding the company…"
        : gst.status === "ok" ? "Company name filled from the GST number."
            : gst.status === "fail" ? "Couldn't find this GST number. Type the company name below." : "Optional. We fill in the company name from it.";

    const picked = c.picked;

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="New enquiry">
                <div className="st-sh-h">
                    <div><h2>New enquiry</h2><p>Only you and your team admin can see it.</p></div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" data-lenis-prevent>
                    {/* ------------------------------ customer ------------------------------ */}
                    <p className="st-sec">Customer</p>

                    {c.mode === "picked" && picked && (
                        <div className="st-sel">
                            <span className="st-av">{initialOf(picked.name)}</span>
                            <span className="st-prod-t">
                                <b>{picked.name}</b>
                                {picked.gstin && <small>GSTIN {picked.gstin}</small>}
                                <small>{contactsLine(picked.contacts) || "No contact saved yet. You can add one in the thread."}</small>
                            </span>
                            <button type="button" className="st-lnk" onClick={backToSearch}>Change</button>
                        </div>
                    )}

                    {c.mode === "pick" && (
                        <>
                            <SearchList label="Search your customers" placeholder="Search your customers by name, GST number or contact"
                                value={cSearch} onChange={setCSearch} list={custList} keyOf={(i) => i.id}
                                empty={custList.notReady ? "Your company isn't set up to sell yet." : dCq ? "No customer matches your search." : "You have no customers yet."}
                                renderRow={(i) => (
                                    <button type="button" className="st-prod pick" onClick={() => pickCustomer(i)}>
                                        <span className="st-av">{initialOf(i.name)}</span>
                                        <span className="st-prod-t">
                                            <b>{i.name}</b>
                                            <small>{[i.gstin ? `GSTIN ${i.gstin}` : null, i.status === "active" ? "On BBM" : null].filter(Boolean).join(" · ")}</small>
                                            {i.contacts?.length > 0 && <small>{contactsLine(i.contacts)}</small>}
                                        </span>
                                    </button>
                                )} />
                            <button type="button" className="st-btn st-full" onClick={startNew}>
                                <UserPlus size={16} />Customer not listed? Add a new one
                            </button>
                            {errors.customer && <p className="st-err" style={{ marginTop: 6 }}>{errors.customer}</p>}
                        </>
                    )}

                    {c.mode === "new" && (
                        <>
                            <div className="st-f">
                                <label htmlFor="ne-gst">GST number</label>
                                <div className="st-inw">
                                    <input id="ne-gst" className="st-in" value={c.gstin} maxLength={15} autoCapitalize="characters" autoComplete="off"
                                        placeholder="e.g. 24ABCDE1234F1Z5" onChange={(e) => patchC({ gstin: cleanGstin(e.target.value) })} />
                                    {gst.status === "loading" && <Loader2 size={16} className="st-spin st-inw-i" />}
                                    {gst.status === "ok" && <BadgeCheck size={18} className="st-inw-i ok" />}
                                </div>
                                <p className={`st-hint${gst.status === "fail" ? " warn" : ""}`}>{errors.gstin ? <span className="st-err">{errors.gstin}</span> : gstHint}</p>
                            </div>

                            <div className="st-f">
                                <label htmlFor="ne-name">Company name {!cleanGstin(c.gstin) && "*"}</label>
                                <input id="ne-name" className="st-in" value={c.name} placeholder="Customer's company name"
                                    onChange={(e) => patchC({ name: e.target.value, fromGst: false })} />
                                {c.fromGst && <p className="st-hint">From the GST records. The saved name always comes from the GST number.</p>}
                                {errors.name && <p className="st-err">{errors.name}</p>}
                            </div>

                            <p className="st-sec">Contacts (optional)</p>
                            <ContactRowsEditor rows={rows} onChange={changeRows} errors={errors.rows || {}} idPrefix="ne-c" />
                            <p className="st-hint">Add everyone you deal with: the person's name is optional, but each contact needs a mobile number or an email. You need the GST number and at least one contact to send a quotation. This customer is added to your customers, with all these contacts, when you send it.</p>
                            <button type="button" className="st-lnk" onClick={backToSearch}>Search my customers instead</button>
                        </>
                    )}

                    {/* ------------------------------ type ------------------------------ */}
                    <p className="st-sec">What is this about?</p>
                    <div className="st-kind" role="radiogroup" aria-label="Type">
                        <button type="button" role="radio" aria-checked={!cold} onClick={() => chooseKind("enquiry")}>
                            <b><MessageSquareText size={15} />Enquiry</b>
                            <small>The customer asked for a product or a price</small>
                        </button>
                        <button type="button" role="radio" aria-checked={cold} onClick={() => chooseKind("cold_call")}>
                            <b><PhoneCall size={15} />Cold call / other</b>
                            <small>No enquiry yet. Log what happened</small>
                        </button>
                    </div>

                    {cold && (
                        <>
                            <div className="st-f" style={{ marginTop: 12 }}>
                                <label htmlFor="ne-note">Call notes *</label>
                                <textarea id="ne-note" className="st-in" rows={5} maxLength={NOTE_MAX} value={note}
                                    placeholder="Write anything: who you spoke to, what they said, when to call back…"
                                    onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: undefined })); touch(); }} />
                                {errors.note && <p className="st-err">{errors.note}</p>}
                            </div>
                            <div className="st-qchips" aria-label="Quick notes">
                                {QUICK_NOTES.map((t) => <button key={t} type="button" onClick={() => addQuick(t)}>{t}</button>)}
                            </div>
                            <p className="st-hint" style={{ marginTop: 8 }}>This becomes the first message of the thread. You can add the product later from the thread, before sending a quotation.</p>
                        </>
                    )}

                    {!cold && <ProductFields form={form} idPrefix="ne" />}
                </div>

                <div className="st-sh-f">
                    {formErr && <p className="st-err st-ferr" role="alert">{formErr}</p>}
                    <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy || gst.status === "loading"} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}{cold ? "Submit" : "Create enquiry"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}