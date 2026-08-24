// components/GroupPaymentQRModal.jsx
// Same UX as PaymentQRModal, but for a whole cart checkout (order group)
// instead of a single order — one QR/UTR covers all seller orders in the group.
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, CheckCircle2, Clock, Upload, Smartphone, AlertCircle, X, RefreshCw } from "lucide-react";
import { C, EASE } from "./seller/listingForm/FormPrimitives.jsx";
import { motion } from "framer-motion";
import { fetchGroupPaymentInstructions, submitGroupPaymentProof } from "../utils/cartApi.js";
import {
    PAYMENT_SESSION_TTL_MS,
    loadPaymentSession,
    savePaymentSession,
    resetPaymentSession,
    updateUtrDraft,
    clearPaymentSession,
} from "../utils/paymentSession.js";

function isMobileDevice() {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}
function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GroupPaymentQRModal({ token, groupId, onClose, onDoneViewOrders }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [utr, setUtr] = useState("");
    const [screenshotFile, setScreenshotFile] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [startedAt, setStartedAt] = useState(null);
    const [msLeft, setMsLeft] = useState(PAYMENT_SESSION_TTL_MS);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        let cancelled = false;
        // paymentSession is keyed by id — passing the groupId here works
        // exactly like it does for a single orderId.
        const cached = loadPaymentSession(groupId);

        if (cached) {
            setInfo({
                groupId,
                orderNumber: cached.orderNumber, // group_number
                amount: cached.amount,
                vpa: cached.vpa,
                payeeName: cached.payeeName,
                note: cached.note,
                upiUri: cached.upiUri,
                existingProof: null,
            });
            setUtr(cached.utrDraft || "");
            setStartedAt(cached.startedAt);
            setLoading(false);
        } else {
            setLoading(true);
        }

        (async () => {
            const res = await fetchGroupPaymentInstructions(token, groupId);
            if (cancelled) return;

            if (!res?.success) {
                if (res?.status) {
                    clearPaymentSession();
                    setError(`This order is no longer awaiting payment (status: ${res.status}). Please check your Orders page.`);
                    setInfo(null);
                } else if (!cached) {
                    setError(res?.message || "Couldn't load payment details.");
                }
                setLoading(false);
                return;
            }

            setInfo(res);
            if (res.existingProof?.status === "pending") setSubmitted(true);
            if (res.existingProof?.status === "rejected" && !cached?.utrDraft) setUtr(res.existingProof.utr_number || "");

            const session = savePaymentSession({
                orderId: groupId,
                orderNumber: res.orderNumber,
                amount: res.amount,
                vpa: res.vpa,
                payeeName: res.payeeName,
                note: res.note,
                upiUri: res.upiUri,
                utrDraft: cached?.utrDraft,
            });
            setStartedAt(session.startedAt);
            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, [token, groupId]);

    useEffect(() => {
        if (!startedAt || submitted) return;
        const tick = () => {
            const remaining = PAYMENT_SESSION_TTL_MS - (Date.now() - startedAt);
            if (remaining <= 0) { setMsLeft(0); setExpired(true); } else { setMsLeft(remaining); }
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [startedAt, submitted]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        setScreenshotFile(file || null);
        setScreenshotPreview(file ? URL.createObjectURL(file) : null);
    };
    const handleUtrChange = (value) => { setUtr(value); updateUtrDraft(groupId, value); };

    const handleSubmit = async () => {
        if (!utr.trim()) { setError("Please enter the UTR / transaction reference number."); return; }
        setError(null);
        setSubmitting(true);
        const res = await submitGroupPaymentProof(token, groupId, { utr: utr.trim(), screenshotUrl: screenshotFile ? undefined : undefined });
        setSubmitting(false);
        if (!res?.success) { setError(res?.message || "Couldn't submit payment proof."); return; }
        clearPaymentSession();
        setSubmitted(true);
    };

    const handleOpenUpiApp = () => {
        if (!info?.upiUri) return;
        window.location.href = info.upiUri;
    };

    const handleRefresh = async () => {
        setExpired(false);
        setError(null);
        setLoading(true);
        const res = await fetchGroupPaymentInstructions(token, groupId);
        setLoading(false);
        if (!res?.success) {
            setError(res?.message || "Couldn't load payment details.");
            if (res?.status) clearPaymentSession();
            return;
        }
        setInfo(res);
        if (res.existingProof?.status === "pending") setSubmitted(true);
        const session = resetPaymentSession({
            orderId: groupId, orderNumber: res.orderNumber, amount: res.amount, vpa: res.vpa,
            payeeName: res.payeeName, note: res.note, upiUri: res.upiUri, utrDraft: utr,
        });
        setStartedAt(session.startedAt);
        setMsLeft(PAYMENT_SESSION_TTL_MS);
    };

    const handleClose = () => { clearPaymentSession(); onClose?.(); };
    const countdownWarn = msLeft <= 2 * 60 * 1000;

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white sm:rounded-[24px]"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>

                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: C.hairSoft }}>
                    <div>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>Complete payment</p>
                        <h2 className="text-[17px] font-extrabold tracking-wide" style={{ color: C.ink }}>{info?.orderNumber || "Order"}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {!loading && !submitted && !expired && info && (
                            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums"
                                style={countdownWarn ? { background: "#fef3c7", color: "#a16207" } : { background: C.hairSoft, color: C.muted }}>
                                <Clock className="h-3 w-3" /> {formatCountdown(msLeft)}
                            </span>
                        )}
                        {onClose && (
                            <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.04]">
                                <X className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4 px-5 py-5">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>
                    ) : error && !info ? (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="rounded-lg px-3 py-2 text-[13px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>{error}</p>
                            <button onClick={onDoneViewOrders} className="mt-1 w-full rounded-xl px-5 py-2.5 text-[13px] font-bold tracking-wide text-white"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                View my orders
                            </button>
                        </div>
                    ) : submitted ? (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#fef3c7", color: "#a16207" }}>
                                <Clock className="h-7 w-7" />
                            </span>
                            <h3 className="text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>Payment submitted — awaiting verification</h3>
                            <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: C.muted }}>
                                We've received your UTR. Once verified, the sellers will be notified and your orders will move forward.
                            </p>
                            <button onClick={onDoneViewOrders} className="mt-2 w-full rounded-xl px-5 py-2.5 text-[13px] font-bold tracking-wide text-white"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                View my orders
                            </button>
                        </div>
                    ) : expired ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>
                                <Clock className="h-7 w-7" />
                            </span>
                            <h3 className="text-[15px] font-extrabold tracking-wide" style={{ color: C.ink }}>Time's up</h3>
                            <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: C.muted }}>
                                This payment window has expired. Refresh to get a new QR code — already paid? Your UTR is still saved below.
                            </p>
                            <button onClick={handleRefresh}
                                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-bold tracking-wide text-white"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                <RefreshCw className="h-4 w-4" /> Refresh
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col items-center gap-2 rounded-2xl border p-5" style={{ borderColor: C.hair }}>
                                <QRCodeSVG value={info.upiUri} size={200} includeMargin />
                                <p className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{info.amount.toLocaleString("en-IN")}</p>
                                <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>Pay to {info.vpa}</p>
                            </div>

                            {isMobileDevice() && (
                                <button onClick={handleOpenUpiApp}
                                    className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold tracking-wide text-white"
                                    style={{ background: "linear-gradient(135deg, #006F83 0%, #047084 100%)" }}>
                                    <Smartphone className="h-4 w-4" /> Open in UPI app
                                </button>
                            )}

                            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold leading-snug" style={{ background: `${C.secondary}0f`, color: C.secondary }}>
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                Scan the QR (or use the button above on mobile), complete the payment, then enter the UTR below. This single payment covers all sellers in this order.
                                You have {formatCountdown(msLeft)} left in this window.
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>UTR / transaction reference number</label>
                                <input value={utr} onChange={(e) => handleUtrChange(e.target.value)} placeholder="e.g. 402312345678"
                                    className="w-full rounded-lg border px-3 py-2.5 text-[14px] font-semibold tracking-wide focus:outline-none focus:ring-2"
                                    style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Payment screenshot (optional)</label>
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-[12.5px] font-bold tracking-wide"
                                    style={{ borderColor: C.hair, color: C.muted }}>
                                    <Upload className="h-4 w-4" />
                                    {screenshotFile ? screenshotFile.name : "Upload screenshot"}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                                {screenshotPreview && (
                                    <img src={screenshotPreview} alt="Payment screenshot preview" className="mt-1 max-h-40 rounded-lg border object-contain" style={{ borderColor: C.hair }} />
                                )}
                            </div>

                            {error && (
                                <p className="rounded-lg px-3 py-2 text-[12.5px] font-semibold" style={{ background: "rgba(199,31,17,0.08)", color: C.danger }}>{error}</p>
                            )}

                            <button onClick={handleSubmit} disabled={submitting}
                                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold tracking-wide text-white disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                {submitting ? "Submitting…" : "I've paid —  "}
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}