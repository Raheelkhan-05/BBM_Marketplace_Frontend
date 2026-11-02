// src/components/sales/SalesAddProductSheet.jsx
// Adds the product to a thread that has none yet (a cold call). Same product picker as a new enquiry.
// The product can only be added once, and is needed before a quotation can be sent.
// onAdded(res) receives { thread, entry } so the page can update the heading and the log at once.
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { setThreadProduct } from "../../utils/salesThreadApi.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { useProductForm, ProductFields } from "./SalesProductFields.jsx";
import "./sales-threads.css";
import "../orderBook/order-book.css";
import "./sales-threads.cold.css";

export default function SalesAddProductSheet({ token, thread, onClose, onAdded }) {
    useSheetBehavior(onClose);
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const touch = useCallback(() => setFormErr(""), []);
    const form = useProductForm(token, { enabled: true, onTouch: touch });

    const submit = async () => {
        if (busy) return;
        if (!form.check()) return;
        setBusy(true); setFormErr("");
        const res = await setThreadProduct(token, thread.id, form.payload());
        setBusy(false);
        if (!res.success) return setFormErr(res.message || "Couldn't add the product. Please try again.");
        onAdded?.(res);
    };

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="Add product">
                <div className="st-sh-h">
                    <div><h2>Add product</h2><p>{thread.displayName} · add it before sending a quotation</p></div>
                    <button type="button" className="st-ib" aria-label="Close" disabled={busy} onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" data-lenis-prevent>
                    <ProductFields form={form} idPrefix="ap" />
                </div>

                <div className="st-sh-f">
                    {formErr && <p className="st-err st-ferr" role="alert">{formErr}</p>}
                    <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}Add product
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}