// src/components/orderBook/OrderBookShipSheet.jsx
// "Mark as shipped" for an Order Book order (company team). Same look and rules as GrowShipSheet:
// LR number + LR document + bill are required. Rendered through <Sheet>, so it sits above the Grow header.
import { useState } from "react";
import Ic from "../growSeller/Ic.jsx";
import { Sheet } from "../growSeller/ui.jsx";
import { useDrop } from "../grow/growUi.js";
import "../growSeller/grow-ship.css";

const ACCEPT = [
    "image/*", "application/pdf", "text/plain", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx",
].join(",");
const MAX_BYTES = 10 * 1024 * 1024;
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function FileCard({ icon, label, hint, file, onChange, disabled }) {
    const drop = useDrop((files) => files[0] && onChange(files[0]), { disabled });
    return (
        <label className={`sx-drop${drop.active ? " on" : ""}${file ? " has" : ""}${disabled ? " off" : ""}`} {...drop.bind}>
            <span className="sx-di"><Ic n={file ? "check" : icon} /></span>
            <span className="sx-dt">
                <b>{label} <span className="sx-req">*</span></b>
                <small>{drop.active ? "Drop to add" : file ? `${file.name} · ${size(file.size)}` : hint}</small>
            </span>
            <span className="sx-da">
                <span>{file ? "Replace" : "Add"}</span>
                {file && <button type="button" className="del" disabled={disabled} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}>Remove</button>}
            </span>
            <input type="file" accept={ACCEPT} hidden disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ""; }} />
        </label>
    );
}

export default function OrderBookShipSheet({ open, order, onClose, onConfirm }) {
    const [lrNumber, setLrNumber] = useState("");
    const [lrNotes, setLrNotes] = useState("");
    const [lrFile, setLrFile] = useState(null);
    const [billFile, setBillFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    if (!open) return null;

    const canSubmit = !!lrNumber.trim() && !!lrFile && !!billFile;
    const pick = (setter) => (f) => {
        if (f && f.size > MAX_BYTES) { setError(`${f.name} is larger than 10 MB.`); return; }
        setError(null); setter(f);
    };

    const submit = async () => {
        if (!canSubmit) { setError("Please fill in the LR number and attach both files."); return; }
        setBusy(true); setError(null);
        const fd = new FormData();
        fd.append("lrNumber", lrNumber.trim());
        fd.append("lrNotes", lrNotes.trim());
        fd.append("lr_proof", lrFile);
        fd.append("bill", billFile);
        let res = null;
        try { res = await onConfirm(fd); } catch { res = null; }
        setBusy(false);
        if (!res?.success) setError(res?.message || "Couldn't mark this order as shipped.");
    };

    return (
        <Sheet title="Mark as shipped" sub={`${order?.orderNo} · ${order?.customerName}`} onClose={busy ? undefined : onClose}>
            <div className="sx-warn" role="note">
                <Ic n="alert" />
                <span>Upload the LR details and the bill before shipping. The salesperson will see them on the order.</span>
            </div>

            <div className="f">
                <label htmlFor="obs-lr">LR / tracking number <span className="sx-req">*</span></label>
                <div className="inp"><input id="obs-lr" value={lrNumber} placeholder="e.g. LR-48213" autoComplete="off" maxLength={60} onChange={(e) => setLrNumber(e.target.value)} /></div>
            </div>

            <div className="f stack">
                <span className="lb" style={{ marginBottom: 0 }}>Documents</span>
                <FileCard icon="file" label="LR document" hint="Photo, PDF, Word, Excel or text of the LR / consignment note" file={lrFile} onChange={pick(setLrFile)} disabled={busy} />
                <FileCard icon="receipt" label="Bill for this order" hint="Photo, PDF, Word, Excel or text of the invoice / bill" file={billFile} onChange={pick(setBillFile)} disabled={busy} />
            </div>

            <div className="f">
                <label htmlFor="obs-nt">Notes (optional)</label>
                <textarea id="obs-nt" className="ta" rows={2} maxLength={500} value={lrNotes} placeholder="Transporter, expected delivery date, etc." onChange={(e) => setLrNotes(e.target.value)} />
            </div>

            {error && <p className="sx-err" role="alert">{error}</p>}

            <div className="sx-foot">
                <button type="button" className="bt go blk" disabled={!canSubmit || busy} onClick={submit}>
                    {busy ? <><Ic n="spin" />Confirming…</> : "Confirm shipment"}
                </button>
            </div>
        </Sheet>
    );
}