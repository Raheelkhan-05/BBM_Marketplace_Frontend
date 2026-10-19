import { useEffect, useRef, useState } from "react";
import { X, Loader2, Search, Check } from "lucide-react";
import { lookupSalesCustomer, addSalesCustomer } from "../../utils/salesApi.js";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanPhone = (v) => { let d = String(v).replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2, 12); return d; };

export default function SalesAddCustomerSheet({ token, onClose, onAdded }) {
    const [gstin, setGstin] = useState("");
    const [found, setFound] = useState(null);   // lookup result
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState("");       // "" | "check" | "save"
    const [error, setError] = useState("");
    const saving = useRef(false);

    useEffect(() => {
        const k = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [onClose]);

    const shapeOk = GSTIN_RE.test(gstin);
    const usable = found && (found.state === "registered" || found.state === "unregistered") && !found.existing;
    const phoneBad = phone.trim() && !PHONE_RE.test(cleanPhone(phone));
    const emailBad = email.trim() && !EMAIL_RE.test(email.trim());

    const check = async () => {
        if (!shapeOk || busy) return;
        setBusy("check"); setError(""); setFound(null);
        const r = await lookupSalesCustomer(token, gstin);
        setBusy("");
        if (!r.success) return setError(r.message || "Couldn't check this GST number.");
        if (r.state === "invalid" || r.state === "self") return setError(r.message || "This GST number can't be used.");
        if (r.existing) return setError(r.existingMine ? "You've already added this customer." : "This business is already in your company's customer list.");
        setFound(r);
    };

    const save = async () => {
        if (!usable || saving.current || phoneBad || emailBad) return;
        saving.current = true; setBusy("save"); setError("");
        const r = await addSalesCustomer(token, { gstin, name: name.trim(), phone: phone.trim(), email: email.trim() });
        saving.current = false; setBusy("");
        if (!r.success) return setError(r.message || "Couldn't add this customer.");
        onAdded(r.message);
    };

    return (
        <div className="gk gk-shade" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="gk-sheet" role="dialog" aria-modal="true" aria-label="Add customer" style={{ maxHeight: "92dvh" }}>
                <div className="gk-sheet-h">
                    <h2>Add customer</h2>
                    <button type="button" className="gk-icbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>
                <div className="gk-sheet-b">
                    <div className="gs-form">
                        <div className="gk-field">
                            <label htmlFor="sc-gst">GST number</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input id="sc-gst" className="gk-inp" style={{ textTransform: "uppercase" }} maxLength={15} autoFocus
                                    autoCapitalize="characters" spellCheck={false} placeholder="22AAAAA0000A1Z5" value={gstin}
                                    onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s/g, "")); setFound(null); setError(""); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }} />
                                <button type="button" className="gk-btn" disabled={!shapeOk || !!busy} onClick={check}>
                                    {busy === "check" ? <Loader2 size={16} className="gk-spin" /> : <Search size={16} />}Check
                                </button>
                            </div>
                            {gstin.length === 15 && !shapeOk && <span className="gs-err">That doesn't look like a GST number.</span>}
                        </div>

                        {found && usable && (
                            <div className="gs-found">
                                <b><Check size={15} style={{ verticalAlign: "-2px" }} /> {found.name}</b>
                                <small>{[found.location, found.state === "registered" ? "On BBM" : "Not on BBM yet"].filter(Boolean).join(" · ")}</small>
                            </div>
                        )}

                        {usable && (<>
                            <div className="gk-field">
                                <label htmlFor="sc-name">Contact name <span className="gs-hint">(optional)</span></label>
                                <input id="sc-name" className="gk-inp" maxLength={80} autoComplete="off" placeholder="Person you deal with" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="gk-field">
                                <label htmlFor="sc-phone">Phone <span className="gs-hint">(optional)</span></label>
                                <input id="sc-phone" className="gk-inp" inputMode="tel" autoComplete="off" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                                {phoneBad && <span className="gs-err">Enter a valid 10-digit mobile number.</span>}
                            </div>
                            <div className="gk-field">
                                <label htmlFor="sc-email">Email <span className="gs-hint">(optional)</span></label>
                                <input id="sc-email" className="gk-inp" inputMode="email" autoComplete="off" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                                {emailBad && <span className="gs-err">Enter a valid email address.</span>}
                            </div>
                        </>)}

                        {error && <p className="gs-err" role="alert">{error}</p>}
                        <button type="button" className="gk-btn go blk" disabled={!usable || !!busy || phoneBad || emailBad} onClick={save}>
                            {busy === "save" ? <><Loader2 size={18} className="gk-spin" />Adding…</> : "Add customer"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}