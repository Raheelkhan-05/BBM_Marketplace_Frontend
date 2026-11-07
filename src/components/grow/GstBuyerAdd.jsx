// src/components/grow/GstBuyerAdd.jsx
// Type a full GST number -> the business is looked up at once and previewed (name, place, on BBM or not).
// Works for buyers on BBM and for ones who haven't joined yet.
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupGst } from "../../utils/gstAccessApi.js";
import "./grow-gst.css";

const clean = (v) => String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
const IDLE = { status: "idle", data: null, message: "" };

export default function GstBuyerAdd({ token, submissionId = null, onAdd, disabled = false }) {
    const [value, setValue] = useState("");
    const [st, setSt] = useState(IDLE);
    const seq = useRef(0);
    const ctl = useRef(null);

    useEffect(() => () => ctl.current?.abort(), []);

    const run = useCallback(async (g) => {
        ctl.current?.abort();
        const c = new AbortController();
        ctl.current = c;
        const my = ++seq.current;
        setSt({ status: "loading", data: null, message: "" });
        try {
            const res = await lookupGst(token, g, submissionId, c.signal);
            if (my !== seq.current) return;
            if (!res?.success) setSt({ status: "error", data: null, message: res?.message || "Couldn't check this GST number." });
            else if (res.state === "invalid" || res.state === "self") setSt({ status: "blocked", data: null, message: res.message || "This GST number can't be used." });
            else setSt({ status: "ready", data: res, message: "" });
        } catch (e) {
            if (e?.name !== "AbortError" && my === seq.current) setSt({ status: "error", data: null, message: "Network problem. Please try again." });
        }
    }, [token, submissionId]);

    const change = (e) => {
        const v = clean(e.target.value);
        setValue(v);
        seq.current += 1;
        ctl.current?.abort();
        if (v.length === 15) run(v); else setSt(IDLE);
    };

    const add = () => {
        if (st.status !== "ready") return;
        onAdd?.(st.data);
        setValue(""); setSt(IDLE);
    };

    const d = st.data;
    const already = !!(d?.already?.visibility || d?.already?.price);

    return (
        <div className="gst-add">
            <div className="gax-inp gst-inp">
                <input value={value} onChange={change} disabled={disabled} placeholder="e.g. 24ABCDE1234F1Z5" maxLength={15}
                    autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="GST number" />
                <span className="suf gst-n">{value.length}/15</span>
            </div>

            {st.status === "loading" && <p className="gst-st"><span className="gst-spin" aria-hidden="true" />Checking GST number…</p>}
            {st.status === "blocked" && <p className="gax-sum err">{st.message}</p>}
            {st.status === "error" && (
                <p className="gax-sum err">
                    <span style={{ flex: 1 }}>{st.message}</span>
                    <button type="button" className="gst-link" onClick={() => run(value)}>Try again</button>
                </p>
            )}

            {st.status === "ready" && d && (
                <div className="gst-prev">
                    <span className="gst-av" aria-hidden="true">{(d.name || "?").trim()[0]?.toUpperCase()}</span>
                    <div className="gst-t">
                        <b>{d.name}</b>
                        <small>GSTIN {d.gstin}{d.location ? ` · ${d.location}` : ""}</small>
                        <span className={`gst-chip ${d.onBbm ? "ok" : "warn"}`}>{d.onBbm ? "On BBM" : "Not on BBM yet"}</span>
                        {!d.onBbm && <small>Saved against this GST number. It applies automatically when they join.</small>}
                        {already && <small>Already added to this listing.</small>}
                    </div>
                    <button type="button" className="gax-btn" onClick={add}>{already ? "Open" : "Add"}</button>
                </div>
            )}
        </div>
    );
}