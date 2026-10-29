// src/components/growSeller/GrowShipSheet.jsx
// "Mark as shipped" in the GROW UI. Same props and same FormData keys as components/orders/ShipOrderModal.
// The LR number, the LR document and the bill are all OPTIONAL: the seller can add them if they want, but they never
// block the shipment. Only what is filled in is sent.
// Rendered through <Sheet> (shell Portal) so it always sits above the header and dock.
import { useState } from "react";
import Ic from "./Ic.jsx";
import { Sheet } from "./ui.jsx";
import { useDrop } from "../grow/growUi.js";
import { routeOptionSummary, routeTransportModeLabel } from "../../../shared/routeTransportFields.js";
import "./grow-ship.css";

// Explicit MIME types AND extensions: some mobile pickers only offer Photos/Camera when given a lone "image/*".
const ACCEPT = [
    "image/*", "application/pdf", "text/plain", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx",
].join(",");

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function FileCard({ icon, label, hint, file, onChange, disabled }) {
    const drop = useDrop((files) => files[0] && onChange(files[0]), { disabled });
    return (
        <label className={`sx-drop${drop.active ? " on" : ""}${file ? " has" : ""}${disabled ? " off" : ""}`} {...drop.bind}>
            <span className="sx-di"><Ic n={file ? "check" : icon} /></span>
            <span className="sx-dt">
                <b>{label} <small>(optional)</small></b>
                <small>{drop.active ? "Drop to add" : file ? `${file.name} · ${size(file.size)}` : hint}</small>
            </span>
            <span className="sx-da">
                <span>{file ? "Replace" : "Add"}</span>
                {file && (
                    <button type="button" className="del" disabled={disabled}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}>Remove</button>
                )}
            </span>
            <input type="file" accept={ACCEPT} hidden disabled={disabled}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ""; }} />
        </label>
    );
}

export default function GrowShipSheet({ open, order, onClose, onConfirm }) {
    const [lrNumber, setLrNumber] = useState("");
    const [lrNotes, setLrNotes] = useState("");
    const [lrFile, setLrFile] = useState(null);
    const [billFile, setBillFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    if (!open) return null;

    const transport = order?.transport_mode
        ? routeOptionSummary(order.transport_mode, order.transport_fields || {})
        : "No Preference Set";

    const submit = async () => {
        setBusy(true);
        setError(null);
        // Only what the seller filled in is sent; the server accepts a shipment with none of it.
        const fd = new FormData();
        if (lrNumber.trim()) fd.append("lrNumber", lrNumber.trim());
        if (lrNotes.trim()) fd.append("lrNotes", lrNotes.trim());
        if (lrFile) fd.append("lr_proof", lrFile);
        if (billFile) fd.append("bill", billFile);
        let res = null;
        try { res = await onConfirm(fd); } catch { res = null; }
        setBusy(false);
        if (!res?.success) setError(res?.message || "Couldn't mark this order as shipped.");
    };

    return (
        <Sheet title="Mark as shipped" sub={order?.order_number} onClose={busy ? undefined : onClose}>
            <div className="sx-warn" role="note">
                <Ic n="alert" />
                <span>Adding the LR details and the bill is optional, but it is recommended. They help the buyer track the delivery and make it easier to sort out any issue with the order.</span>
            </div>

            <div className="sx-tr">
                <Ic n="truck" />
                <div>
                    <small>Agreed transport</small>
                    <b>{transport}{order?.transport_mode ? ` · ${routeTransportModeLabel(order.transport_mode)}` : ""}</b>
                </div>
            </div>

            <div className="f">
                <label htmlFor="sx-lr">LR / tracking number (optional)</label>
                <div className="inp">
                    <input id="sx-lr" value={lrNumber} placeholder="e.g. LR-48213" autoComplete="off" maxLength={60}
                        onChange={(e) => setLrNumber(e.target.value)} />
                </div>
            </div>

            <div className="f stack">
                <span className="lb" style={{ marginBottom: 0 }}>Documents (optional)</span>
                <FileCard icon="file" label="LR document" hint="Photo, PDF, Word, Excel or text of the LR / consignment note"
                    file={lrFile} onChange={setLrFile} disabled={busy} />
                <FileCard icon="receipt" label="Bill for this order" hint="Photo, PDF, Word, Excel or text of the invoice / bill"
                    file={billFile} onChange={setBillFile} disabled={busy} />
            </div>

            <div className="f">
                <label htmlFor="sx-nt">Notes for the buyer (optional)</label>
                <textarea id="sx-nt" className="ta" rows={2} value={lrNotes} placeholder="Pickup point, expected transit time, etc."
                    onChange={(e) => setLrNotes(e.target.value)} />
            </div>

            {error && <p className="sx-err" role="alert">{error}</p>}

            <div className="sx-foot">
                <button type="button" className="bt go blk" disabled={busy} onClick={submit}>
                    {busy ? <><Ic n="spin" />Confirming…</> : "Confirm shipment"}
                </button>
            </div>
        </Sheet>
    );
}