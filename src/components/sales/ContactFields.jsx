// src/components/sales/ContactFields.jsx
// Contact UI shared by the Customers page, the Add customer sheet and the Punch order sheet.
//  - ContactRowsEditor : type one or more NEW contacts (name optional; a mobile number or an email is required).
//  - ContactPicker     : for an existing customer, the saved contacts grouped under the company; tick who gets the updates
//                        and add another contact on the spot (saved on the customer).
//  - ContactManager    : the contacts of one customer on its card: add, edit, make primary, remove.
import { useState } from "react";
import { Plus, Trash2, Star, Pencil, Phone, Mail, Loader2, UserPlus } from "lucide-react";
import { cleanPhone, cleanEmail, initialOf } from "./salesThreadFmt.js";
import { addCustomerContact, updateCustomerContact, deleteCustomerContact } from "../../utils/salesApi.js";
import "./sales-contacts.css";

const newKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const blankContact = () => ({ key: newKey(), name: "", phone: "", email: "", send: true });
const isBlank = (c) => !c.name.trim() && !c.phone.trim() && !c.email.trim();
const phoneInput = (v) => v.replace(/[^\d+\s-]/g, "");

export function checkContact(c) {
    const p = c.phone.trim(), e = c.email.trim();
    if (!p && !e) return "Add a mobile number or an email.";
    if (p && !cleanPhone(p)) return "Enter a valid 10-digit mobile number.";
    if (e && !cleanEmail(e)) return "Enter a valid email address.";
    return "";
}

// Validates the rows. Blank rows are ignored. -> { list, errors: { [rowKey]: message }, blank, ok }
export function collectContacts(rows) {
    const used = rows.filter((r) => !isBlank(r));
    const errors = {}, list = [];
    for (const r of used) {
        const m = checkContact(r);
        if (m) errors[r.key] = m;
        else list.push({ name: r.name.trim(), phone: cleanPhone(r.phone), email: cleanEmail(r.email), send: r.send !== false });
    }
    const blank = used.length === 0;
    if (blank && rows[0]) errors[rows[0].key] = "Add a mobile number or an email.";
    return { list, errors, blank, ok: Object.keys(errors).length === 0 };
}

/* ------------------------------ new contacts ------------------------------ */
export function ContactRowsEditor({ rows, onChange, errors = {}, idPrefix = "cr", selectable = false, max = 10 }) {
    const patch = (key, p) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
    const remove = (key) => onChange(rows.filter((r) => r.key !== key));
    return (
        <div className="sc-rows">
            {rows.map((r, i) => (
                <div className="sc-row" key={r.key}>
                    <div className="sc-row-h">
                        <b>{rows.length > 1 ? `Contact ${i + 1}` : "Contact"}</b>
                        {rows.length > 1 && (
                            <button type="button" className="sc-ic" aria-label={`Remove contact ${i + 1}`} onClick={() => remove(r.key)}><Trash2 size={16} /></button>
                        )}
                    </div>
                    <div className="sc-f">
                        <label htmlFor={`${idPrefix}-n${i}`}>Contact person <i>(optional)</i></label>
                        <input id={`${idPrefix}-n${i}`} className="sc-in" maxLength={80} autoComplete="off" placeholder="Name of the person you deal with"
                            value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} />
                    </div>
                    <div className="sc-two">
                        <div className="sc-f">
                            <label htmlFor={`${idPrefix}-p${i}`}>Mobile number</label>
                            <input id={`${idPrefix}-p${i}`} className="sc-in" inputMode="tel" autoComplete="off" placeholder="10 digits"
                                value={r.phone} onChange={(e) => patch(r.key, { phone: phoneInput(e.target.value) })} />
                        </div>
                        <div className="sc-f">
                            <label htmlFor={`${idPrefix}-e${i}`}>Email</label>
                            <input id={`${idPrefix}-e${i}`} className="sc-in" type="email" autoComplete="off" placeholder="name@company.com"
                                value={r.email} onChange={(e) => patch(r.key, { email: e.target.value })} />
                        </div>
                    </div>
                    {errors[r.key] && <p className="sc-err" role="alert">{errors[r.key]}</p>}
                    {selectable && (
                        <label className="sc-chk">
                            <input type="checkbox" checked={r.send !== false} onChange={(e) => patch(r.key, { send: e.target.checked })} />
                            Send order updates to this contact
                        </label>
                    )}
                </div>
            ))}
            <button type="button" className="sc-add" disabled={rows.length >= max} onClick={() => onChange([...rows, blankContact()])}>
                <Plus size={16} />Add another contact
            </button>
        </div>
    );
}

/* ------------------------------ one contact form ------------------------------ */
// onSave({ name, phone, email }) -> { success, message } ; the form closes itself through the parent on success.
export function ContactForm({ initial, saveLabel = "Save contact", onSave, onCancel, idPrefix = "cf" }) {
    const [d, setD] = useState({ name: initial?.name || "", phone: initial?.phone || "", email: initial?.email || "" });
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (p) => { setD((s) => ({ ...s, ...p })); setErr(""); };

    const submit = async () => {
        if (busy) return;
        const m = checkContact(d);
        if (m) return setErr(m);
        setBusy(true);
        const res = await onSave({ name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim() });
        setBusy(false);
        if (!res?.success) setErr(res?.message || "Couldn't save the contact.");
    };
    const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };

    return (
        <div className="sc-form">
            <div className="sc-f">
                <label htmlFor={`${idPrefix}-n`}>Contact person <i>(optional)</i></label>
                <input id={`${idPrefix}-n`} className="sc-in" maxLength={80} autoComplete="off" placeholder="Name of the person"
                    value={d.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onKey} />
            </div>
            <div className="sc-two">
                <div className="sc-f">
                    <label htmlFor={`${idPrefix}-p`}>Mobile number</label>
                    <input id={`${idPrefix}-p`} className="sc-in" inputMode="tel" autoComplete="off" placeholder="10 digits"
                        value={d.phone} onChange={(e) => set({ phone: phoneInput(e.target.value) })} onKeyDown={onKey} />
                </div>
                <div className="sc-f">
                    <label htmlFor={`${idPrefix}-e`}>Email</label>
                    <input id={`${idPrefix}-e`} className="sc-in" type="email" autoComplete="off" placeholder="name@company.com"
                        value={d.email} onChange={(e) => set({ email: e.target.value })} onKeyDown={onKey} />
                </div>
            </div>
            {err && <p className="sc-err" role="alert">{err}</p>}
            <div className="sc-form-a">
                <button type="button" className="sc-btn" disabled={busy} onClick={onCancel}>Cancel</button>
                <button type="button" className="sc-btn pri" disabled={busy} onClick={submit}>
                    {busy ? <Loader2 size={15} className="gk-spin st-spin" /> : null}{saveLabel}
                </button>
            </div>
        </div>
    );
}

const contactLabel = (c) => c.name || c.phone || c.email || "Contact";

/* ------------------------------ pick who gets the updates ------------------------------ */
// company  : { name, gstin }          contacts : [{ id, name, phone, email, isPrimary }]
// selected : Set of contact ids       onSelect(nextSet)
// onAdd(input) -> { success, message }  saves a new contact on the customer; the parent adds it to `contacts` and selects it
export function ContactPicker({ company, contacts, selected, onSelect, onAdd, idPrefix = "cp" }) {
    const [adding, setAdding] = useState(false);
    const open = adding || contacts.length === 0;
    const toggle = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onSelect(n); };
    const add = async (input) => {
        const res = await onAdd(input);
        if (res?.success) setAdding(false);
        return res;
    };
    return (
        <div className="sc-group">
            <div className="sc-group-h">
                <span className="sc-av">{initialOf(company?.name)}</span>
                <b>{company?.name}</b>
                <small>{contacts.length} contact{contacts.length === 1 ? "" : "s"}</small>
            </div>
            {contacts.length > 0 && <p className="sc-hint">Tick who should get the order updates.</p>}
            <ul className="sc-list">
                {contacts.map((c) => {
                    const on = selected.has(c.id);
                    return (
                        <li key={c.id}>
                            <label className={`sc-opt${on ? " on" : ""}`}>
                                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                                <span className="sc-opt-t">
                                    <b>{c.name || "Contact"}{c.isPrimary && <em className="sc-pri">Primary</em>}</b>
                                    {c.phone && <small>+91 {c.phone} · WhatsApp</small>}
                                    {c.email && <small>{c.email} · Email</small>}
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>
            {open
                ? <ContactForm idPrefix={idPrefix} saveLabel="Save and select" onSave={add} onCancel={() => setAdding(false)} />
                : <button type="button" className="sc-add" onClick={() => setAdding(true)}><UserPlus size={16} />Add another contact</button>}
        </div>
    );
}

/* ------------------------------ manage the contacts of a customer ------------------------------ */
// onContacts(customerId, contactsList) receives the full updated list after every change.
export function ContactManager({ token, customer, onContacts, say }) {
    const contacts = customer.contacts || [];
    const [mode, setMode] = useState(null);      // null | "add" | contactId being edited
    const [busyId, setBusyId] = useState("");

    const done = (res) => { onContacts(customer.id, res.contacts || []); setMode(null); if (res.message) say?.(res.message); };
    const add = async (input) => { const res = await addCustomerContact(token, customer.id, input); if (res.success) done(res); return res; };
    const edit = (id) => async (input) => { const res = await updateCustomerContact(token, customer.id, id, input); if (res.success) done(res); return res; };
    const makePrimary = async (c) => {
        setBusyId(c.id);
        const res = await updateCustomerContact(token, customer.id, c.id, { isPrimary: true });
        setBusyId("");
        if (res.success) done({ ...res, message: "Primary contact changed." }); else say?.(res.message || "Couldn't update the contact.");
    };
    const remove = async (c) => {
        if (!window.confirm(`Remove ${contactLabel(c)} from ${customer.name}?`)) return;
        setBusyId(c.id);
        const res = await deleteCustomerContact(token, customer.id, c.id);
        setBusyId("");
        if (res.success) done(res); else say?.(res.message || "Couldn't remove the contact.");
    };

    return (
        <div className="sc-mgr">
            <div className="sc-mgr-h"><b>Contacts</b><span>{contacts.length}</span></div>
            {contacts.length === 0 && mode !== "add" && <p className="sc-hint">No contact saved yet. Add one to send quotations and order updates.</p>}
            {contacts.length > 0 && (
                <ul className="sc-list">
                    {contacts.map((c) => (
                        <li className="sc-item" key={c.id}>
                            {mode === c.id ? (
                                <ContactForm idPrefix={`ce-${c.id.slice(0, 6)}`} initial={c} saveLabel="Save" onSave={edit(c.id)} onCancel={() => setMode(null)} />
                            ) : (<>
                                <span className="sc-av">{initialOf(contactLabel(c))}</span>
                                <span className="sc-item-t">
                                    <b>{c.name || "Contact"}{c.isPrimary && <em className="sc-pri">Primary</em>}</b>
                                    {c.phone && <a href={`tel:+91${c.phone}`}><Phone size={13} />+91 {c.phone}</a>}
                                    {c.email && <a href={`mailto:${c.email}`}><Mail size={13} />{c.email}</a>}
                                </span>
                                <span className="sc-acts">
                                    {!c.isPrimary && contacts.length > 1 && (
                                        <button type="button" className="sc-ic" aria-label={`Make ${contactLabel(c)} the primary contact`} title="Make primary" disabled={busyId === c.id} onClick={() => makePrimary(c)}><Star size={16} /></button>
                                    )}
                                    <button type="button" className="sc-ic" aria-label={`Edit ${contactLabel(c)}`} title="Edit" disabled={busyId === c.id} onClick={() => setMode(c.id)}><Pencil size={16} /></button>
                                    <button type="button" className="sc-ic" aria-label={`Remove ${contactLabel(c)}`} title="Remove" disabled={busyId === c.id} onClick={() => remove(c)}><Trash2 size={16} /></button>
                                </span>
                            </>)}
                        </li>
                    ))}
                </ul>
            )}
            {mode === "add"
                ? <ContactForm idPrefix={`ca-${customer.id.slice(0, 6)}`} onSave={add} onCancel={() => setMode(null)} />
                : <button type="button" className="sc-add" onClick={() => setMode("add")}><UserPlus size={16} />Add contact</button>}
        </div>
    );
}