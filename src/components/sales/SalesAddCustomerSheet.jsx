import { useEffect, useRef, useState } from "react";
import { X, Loader2, Check } from "lucide-react";
import { lookupSalesCustomer, addSalesCustomer } from "../../utils/salesApi.js";
import { ContactRowsEditor, blankContact, collectContacts } from "./ContactFields.jsx";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IDLE = { state: "idle", data: null, error: "" };

export default function SalesAddCustomerSheet({ token, onClose, onAdded }) {
    const [gstin, setGstin] = useState("");
    const [look, setLook] = useState(IDLE);       // idle | checking | ok | error
    const [rows, setRows] = useState(() => [blankContact()]);
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const saving = useRef(false);
    const seq = useRef(0);

    useEffect(() => {
        const k = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [onClose]);

    const shapeOk = GSTIN_RE.test(gstin);

    // Check the GST number automatically once it is complete.
    useEffect(() => {
        const my = ++seq.current;
        if (!shapeOk) { setLook(IDLE); return; }
        setLook({ state: "checking", data: null, error: "" });
        (async () => {
            let r;
            try { r = await lookupSalesCustomer(token, gstin); } catch { r = { success: false, message: "Couldn't check this GST number." }; }
            if (my !== seq.current) return;
            if (!r.success) return setLook({ state: "error", data: null, error: r.message || "Couldn't check this GST number." });
            if (r.state === "invalid" || r.state === "self") return setLook({ state: "error", data: null, error: r.message || "This GST number can't be used." });
            if (r.existing) return setLook({ state: "error", data: null, error: r.existingMine ? "You've already added this customer." : "This business is already in your company's customer list." });
            setLook({ state: "ok", data: r, error: "" });
        })();
    }, [gstin, shapeOk, token]);

    // Rows that have something typed show their problem at once; the "add a contact" hint waits until the person tried to save.
    const col = collectContacts(rows);
    const errs = { ...col.errors };
    if (col.blank && !touched && rows[0]) delete errs[rows[0].key];
    const ready = look.state === "ok" && col.ok;

    const save = async () => {
        setTouched(true);
        if (!ready || saving.current) return;
        saving.current = true; setBusy(true); setError("");
        let r;
        try {
            r = await addSalesCustomer(token, { gstin, contacts: col.list.map(({ name, phone, email }) => ({ name, phone, email })) });
        } catch { r = { success: false, message: "Couldn't add this customer." }; }
        saving.current = false; setBusy(false);
        if (!r.success) return setError(r.message || "Couldn't add this customer.");
        onAdded(r.message);
    };

    const f = look.data;
    return (
        <div className="gk gk-shade" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="gk-sheet" role="dialog" aria-modal="true" aria-label="Add customer" style={{ maxHeight: "92dvh" }}>
                <div className="gk-sheet-h">
                    <h2>Add customer</h2>
                    <button type="button" className="gk-icbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>
                <div className="gk-sheet-b">
                    <form className="gs-form" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
                        <div className="gk-field">
                            <label htmlFor="sc-gst">GST number</label>
                            <input id="sc-gst" className="gk-inp" style={{ textTransform: "uppercase" }} maxLength={15} autoFocus
                                autoCapitalize="characters" spellCheck={false} placeholder="22AAAAA0000A1Z5" value={gstin}
                                onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s/g, "")); setError(""); }} />
                            {gstin.length === 15 && !shapeOk && <span className="gs-err">That doesn't look like a GST number.</span>}
                            {look.state === "checking" && <span className="gs-hint" role="status"><Loader2 size={14} className="gk-spin" style={{ verticalAlign: "-2px" }} /> Checking GST number…</span>}
                            {look.state === "error" && <span className="gs-err" role="alert">{look.error}</span>}
                        </div>

                        {look.state === "ok" && f && (
                            <div className="gs-found">
                                <b><Check size={15} style={{ verticalAlign: "-2px" }} /> {f.name}</b>
                                <small>{[f.state === "registered" ? "On BBM" : "Not on BBM yet"].join(" · ")}</small>
                                {f.addressLine && <small>{f.addressLine}</small>}
                            </div>
                        )}

                        <ContactRowsEditor rows={rows} errors={errs} idPrefix="ac"
                            onChange={(next) => { setRows(next); setError(""); }} />
                        <span className="gs-hint">Add at least one contact with a mobile number or an email. The contact person's name is optional, and you can add more contacts any time from the customer card.</span>

                        {error && <p className="gs-err" role="alert">{error}</p>}
                        <button type="submit" className="gk-btn go blk" disabled={!ready || busy}>
                            {busy ? <><Loader2 size={18} className="gk-spin" />Adding…</> : "Add customer"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}