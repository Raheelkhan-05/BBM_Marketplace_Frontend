// components/rfq/RfqQuoteModal.jsx
// PREVIEW ONLY: nothing is saved or sent yet (next phase). Flow: details -> mobile OTP -> confirmation.
// Mobile: bottom sheet. Tablet / desktop: centred dialog.
// Props (unchanged): enquiry, onClose, onDone. Optional: theme ("light" | "dark").
// onDone(quote) fires when the person finishes on the confirmation screen (button or close).
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Send, Check } from "lucide-react";
import { EASE } from "../seller/listingForm/FormPrimitives.jsx";
import { fmtNum } from "../../utils/rfqUtils.js";
import "./growEnquiry.css";

const VALIDITY = [3, 7, 15];

const readTheme = () => {
    try { return localStorage.getItem("gth") === "dark" ? "dark" : "light"; } catch { return "light"; }
};
const rupees = (n) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const validTill = (days) => new Date(Date.now() + days * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const maskMobile = (m) => `+91 ${m.slice(0, 2)}XXXXXX${m.slice(-2)}`;

export default function RfqQuoteModal({ enquiry, onClose, onDone, theme }) {
    const unit = enquiry.unit || "unit";
    const total = (Number(enquiry.quantity) || 0) * (Number(enquiry.packSize) || 0);

    const [step, setStep] = useState("form"); // form | otp | done
    const [f, setF] = useState({ name: "", mob: "", price: "", days: "3", valid: 7 });
    const [digits, setDigits] = useState(["", "", "", "", "", ""]);
    const [err, setErr] = useState("");
    const [info, setInfo] = useState("");
    const [cd, setCd] = useState(30);
    const [otpRun, setOtpRun] = useState(0);
    const [quote, setQuote] = useState(null);

    const sheetRef = useRef(null);
    const otpRefs = useRef([]);

    const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr(""); };
    const price = parseFloat(f.price) || 0;
    const days = parseInt(f.days, 10) || 0;

    // Lock page scroll while open, close on Escape, move focus into the dialog.
    useEffect(() => {
        const sw = window.innerWidth - document.documentElement.clientWidth;
        const { style } = document.body;
        const prevO = style.overflow, prevP = style.paddingRight;
        style.overflow = "hidden";
        if (sw > 0) style.paddingRight = `${sw}px`;
        sheetRef.current?.focus({ preventScroll: true });
        return () => { style.overflow = prevO; style.paddingRight = prevP; };
    }, []);

    const closeRef = useRef();
    closeRef.current = () => (step === "done" ? onDone?.(quote) : onClose?.());
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // OTP resend countdown.
    useEffect(() => {
        if (step !== "otp") return undefined;
        setCd(30);
        const t = setInterval(() => setCd((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [step, otpRun]);

    useEffect(() => {
        if (step === "otp") otpRefs.current[0]?.focus({ preventScroll: true });
    }, [step]);

    const submitForm = () => {
        if (f.name.trim().length < 2) return setErr("Enter your business name.");
        if (!/^[6-9]\d{9}$/.test(f.mob)) return setErr("Enter a valid 10-digit mobile number.");
        if (!(price > 0)) return setErr(`Enter your price per ${unit}.`);
        if (!(days > 0)) return setErr("Enter the delivery days.");
        setErr(""); setInfo(""); setDigits(["", "", "", "", "", ""]); setStep("otp");
    };

    const verify = () => {
        if (digits.join("").length < 6) return setErr("Enter the 6-digit code.");
        setErr("");
        setQuote({ name: f.name.trim(), mobile: f.mob, price, days, validDays: f.valid, total: price * total });
        setStep("done");
    };

    const setDigit = (i, raw) => {
        const v = raw.replace(/\D/g, "").slice(-1);
        setDigits((d) => d.map((x, idx) => (idx === i ? v : x)));
        setErr("");
        if (v && otpRefs.current[i + 1]) otpRefs.current[i + 1].focus();
    };
    const onDigitKey = (i, e) => {
        if (e.key === "Backspace" && !digits[i] && otpRefs.current[i - 1]) otpRefs.current[i - 1].focus();
        if (e.key === "Enter") verify();
    };
    const onDigitPaste = (e) => {
        const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (!t) return;
        e.preventDefault();
        setDigits(Array.from({ length: 6 }, (_, j) => t[j] || ""));
        otpRefs.current[Math.min(t.length, 5)]?.focus();
    };

    const onFormKey = (e) => { if (e.key === "Enter") { e.preventDefault(); submitForm(); } };

    return (
        <div className="ged" data-theme={theme || readTheme()}>
            <motion.div className="ged-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
                <motion.div ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Send your quote" data-lenis-prevent
                    className="ged-sheet"
                    initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}>
                    <button type="button" className="ged-x" aria-label="Close" onClick={() => closeRef.current()}><X size={18} /></button>

                    {step === "form" && (
                        <div className="ged-in" key="form">
                            <h3 className="ged-t">Send your quote</h3>
                            <p className="ged-sub">
                                {enquiry.productName} · {fmtNum(total)} {unit}
                            </p>
                            <p className="ged-sub" style={{ fontSize: ".9rem" }}>No account needed to send your first quote.</p>

                            <div className="ged-f">
                                <label htmlFor="ged-qn">Business name</label>
                                <div className="ged-inp">
                                    <input id="ged-qn" autoComplete="organization" placeholder="Your company" value={f.name}
                                        onChange={(e) => set("name", e.target.value)} onKeyDown={onFormKey} />
                                </div>
                            </div>
                            <div className="ged-f">
                                <label htmlFor="ged-qm">Mobile number</label>
                                <div className="ged-inp">
                                    <span className="ged-pre">+91</span>
                                    <input id="ged-qm" inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="98765 43210" value={f.mob}
                                        onChange={(e) => set("mob", e.target.value.replace(/\D/g, "").slice(0, 10))} onKeyDown={onFormKey} />
                                </div>
                            </div>
                            <div className="ged-two">
                                <div className="ged-f">
                                    <label htmlFor="ged-qp">Price per {unit}</label>
                                    <div className="ged-inp">
                                        <span className="ged-pre">₹</span>
                                        <input id="ged-qp" inputMode="decimal" value={f.price}
                                            onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={onFormKey} />
                                    </div>
                                </div>
                                <div className="ged-f">
                                    <label htmlFor="ged-qd">Deliver in</label>
                                    <div className="ged-inp">
                                        <input id="ged-qd" inputMode="numeric" value={f.days}
                                            onChange={(e) => set("days", e.target.value.replace(/\D/g, "").slice(0, 3))} onKeyDown={onFormKey} />
                                        <span className="ged-suf">days</span>
                                    </div>
                                </div>
                            </div>
                            <div className="ged-f">
                                <label id="ged-qv-l">Quote valid for</label>
                                <div className="ged-ch" role="group" aria-labelledby="ged-qv-l">
                                    {VALIDITY.map((d) => (
                                        <button key={d} type="button" aria-pressed={f.valid === d} onClick={() => set("valid", d)}>{d} days</button>
                                    ))}
                                </div>
                            </div>

                            <div className="ged-brk">
                                {price > 0 ? (
                                    <>
                                        <div><span>{rupees(price)} × {fmtNum(total)} {unit}</span><b>{rupees(price * total)}</b></div>
                                        <div><span>Valid until</span><b>{validTill(f.valid)}</b></div>
                                        <div className="tot"><span>Your quote</span><span>{rupees(price * total)}</span></div>
                                    </>
                                ) : `Enter your price per ${unit} to see the total.`}
                            </div>

                            <p className="ged-err" role="alert">{err}</p>
                            <button type="button" className="ged-btn go blk" style={{ marginTop: 6 }} onClick={submitForm}>
                                <Send className="ged-ic" />Submit quote
                            </button>
                            <p className="ged-fi">We will confirm your mobile number with a one-time code.</p>
                        </div>
                    )}

                    {step === "otp" && (
                        <div className="ged-in" key="otp">
                            <h3 className="ged-t">Confirm it is you</h3>
                            <p className="ged-sub">Enter the 6-digit code sent to <b style={{ color: "var(--ink)" }}>{maskMobile(f.mob)}</b></p>
                            <div className="ged-otp" role="group" aria-label="6-digit code">
                                {digits.map((d, i) => (
                                    <input key={i} ref={(el) => { otpRefs.current[i] = el; }} inputMode="numeric" maxLength={1} value={d}
                                        aria-label={`Digit ${i + 1}`} autoComplete={i === 0 ? "one-time-code" : "off"}
                                        onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onDigitKey(i, e)} onPaste={onDigitPaste} />
                                ))}
                            </div>
                            <p className="ged-err" role="alert">{err}</p>
                            <button type="button" className="ged-btn go blk" style={{ marginTop: 6 }} onClick={verify}>Verify and send quote</button>
                            <p className="ged-fi">
                                <button type="button" className="ged-lnk" disabled={cd > 0}
                                    onClick={() => { setInfo("A new code is on its way."); setDigits(["", "", "", "", "", ""]); setOtpRun((r) => r + 1); }}>
                                    {cd > 0 ? `Resend in ${cd}s` : "Resend code"}
                                </button>
                                {" · "}
                                <button type="button" className="ged-lnk" onClick={() => { setErr(""); setStep("form"); }}>Edit quote</button>
                            </p>
                            {info && <p className="ged-fi" role="status">{info}</p>}
                            <p className="ged-fi">Prototype: any 6 digits will work.</p>
                        </div>
                    )}

                    {step === "done" && quote && (
                        <div className="ged-in ged-center" key="done">
                            <div className="ged-okc"><Check /></div>
                            <h3 className="ged-t">Quote sent to the buyer</h3>
                            <p className="ged-sub">Thank you, {quote.name}. The buyer will review it and get back to you.</p>
                            <div className="ged-brk" style={{ textAlign: "left" }}>
                                <div><span>Your price</span><b>{rupees(quote.price)} / {unit}</b></div>
                                <div><span>Total for {fmtNum(total)} {unit}</span><b>{rupees(quote.total)}</b></div>
                                <div><span>Delivery</span><b>~{quote.days} day{quote.days > 1 ? "s" : ""}</b></div>
                                <div><span>Valid until</span><b>{validTill(quote.validDays)}</b></div>
                            </div>
                            <button type="button" className="ged-btn go blk" onClick={() => onDone?.(quote)}>Done</button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}