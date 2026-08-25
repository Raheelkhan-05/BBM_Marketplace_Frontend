// pages/SellerWalletPage.jsx
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Wallet, Loader2, AlertTriangle, CheckCircle2, Settings2, IndianRupee, Clock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchWalletStatus, fetchWalletTransactions, submitWalletPayment, fetchWalletPayments } from "../utils/walletApi.js";
import { C, EASE } from "../components/catalog/tokens";

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

function Card({ title, children, right }) {
    return (
        <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: C.hair }}>
            <div className="flex items-center justify-between">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "#4A535B" }}>{title}</p>
                {right}
            </div>
            <div className="mt-3">{children}</div>
        </div>
    );
}

const TXN_LABEL = {
    commission_accrued: { label: "Commission accrued", color: "#c71f11" },
    commission_reversed: { label: "Commission reversed", color: "#059669" },
    payment_made: { label: "Payment made", color: "#059669" },
    manual_adjustment: { label: "Adjustment", color: C.muted },
};

export default function SellerWalletPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [txns, setTxns] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingSettings, setEditingSettings] = useState(false);
    const [billingMode, setBillingMode] = useState("threshold");
    const [thresholdAmount, setThresholdAmount] = useState("1000");
    const [savingSettings, setSavingSettings] = useState(false);

    const [payAmount, setPayAmount] = useState("");
    const [payUtr, setPayUtr] = useState("");
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);



    const load = useCallback(async () => {
        const [w, t, p] = await Promise.all([fetchWalletStatus(token), fetchWalletTransactions(token), fetchWalletPayments(token)]);
        if (w?.success) {
            setWallet(w.wallet);
            setBillingMode(w.wallet.billing_mode);
            setThresholdAmount(String(w.wallet.threshold_amount || 1000));
        }
        if (t?.success) setTxns(t.transactions);
        if (p?.success) setPayments(p.payments);
        setLoading(false);
    }, [token]);

    useEffect(() => {
        if (!token) return; // don't fire wallet calls before auth is ready
        load();
    }, [load, token]);

    const handleSubmitPayment = async () => {
        setError(null);
        if (!(Number(payAmount) > 0)) return setError("Enter a valid amount.");
        setSubmittingPayment(true);
        const res = await submitWalletPayment(token, { amount: Number(payAmount), utr: payUtr.trim() || undefined });
        setSubmittingPayment(false);
        if (!res?.success) return setError(res?.message || "Couldn't submit payment.");
        setPayAmount(""); setPayUtr("");
        setNotice("Payment submitted for verification.");
        load();
    };

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>;

    const isBlocked = wallet?.is_blocked;

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-2.5 pb-16 pt-3 sm:px-4">
            <div className="mt-3 flex items-center gap-3">
                <button onClick={() => navigate('/home')} className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: C.hair, color: C.ink }}><ArrowLeft className="h-4 w-4" /></button>
                <h1 className="flex items-center gap-2 font-extrabold tracking-wide" style={{ color: C.ink, fontSize: "clamp(20px,1.8vw,26px)" }}>
                    <Wallet className="h-5 w-5" style={{ color: C.secondary }} /> Wallet
                </h1>
            </div>

            {isBlocked && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-start gap-2.5 rounded-2xl border p-3.5" style={{ borderColor: "#c71f1140", background: "#c71f1108" }}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#c71f11" }} />
                    <div>
                        <p className="text-[13px] font-extrabold tracking-wide" style={{ color: "#c71f11" }}>New orders are paused</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                            {wallet.blocked_reason === "monthly_unpaid"
                                ? "You have an unpaid balance from a previous month. Clear it below to start receiving orders again."
                                : "Your accumulated platform commission has reached your set threshold. Pay it down below to start receiving orders again."}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* ---- Balance summary ---- */}
            <div className="mt-4 rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #047084 0%, #0B7285 100%)" }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] opacity-90">Balance due to platform</p>
                <p className="mt-1 flex items-center text-[34px] font-extrabold tabular-nums"><IndianRupee className="h-6 w-6" />{inr(wallet.balance_due)}</p>
                <div className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold opacity-90 tracking-wider">
                    {wallet.billing_mode === "threshold" ? (
                        <><ShieldCheck className="h-3.5 w-3.5" /> Threshold mode · pay when you reach ₹{inr(wallet.threshold_amount)}</>
                    ) : (
                        <><Clock className="h-3.5 w-3.5" /> Monthly mode · settle by the 1st of next month</>
                    )}
                </div>
            </div>

            {/* ---- Pay down balance ---- */}
            {wallet.balance_due > 0 && (
                <Card title="Pay platform commission">
                    <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Amount</label>
                                <input type="text" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/[^\d.]/g, ""))}
                                    placeholder={`Up to ₹${inr(wallet.balance_due)}`}
                                    className="mt-1 w-full rounded-lg border px-3 py-2 text-[13.5px] font-bold tabular-nums" style={{ borderColor: C.hair }} />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>UTR / reference (optional)</label>
                                <input type="text" value={payUtr} onChange={(e) => setPayUtr(e.target.value)}
                                    className="mt-1 w-full rounded-lg border px-3 py-2 text-[13.5px] font-semibold" style={{ borderColor: C.hair }} />
                            </div>
                        </div>
                        <p className="text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>Test mode — payment is simulated. Submitting here marks it pending until verified.</p>
                        <button onClick={handleSubmitPayment} disabled={submittingPayment}
                            className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                            {submittingPayment ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit payment"}
                        </button>
                    </div>
                </Card>
            )}

            {/* ---- Billing mode settings ---- */}
            {/* <Card title="Billing settings">
                <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                    <div>
                        <p className="text-[13px] font-semibold tracking-wide" style={{ color: C.ink }}>
                            {wallet.billing_mode === "threshold"
                                ? `Threshold mode — you'll be paused once dues reach ₹${inr(wallet.threshold_amount)}`
                                : "Monthly mode — dues settle at the start of each month"}
                        </p>
                        <p className="mt-1 text-[11.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                            Set by the platform team. Reach out to support if you'd like this changed.
                        </p>
                    </div>
                </div>
            </Card> */}

            {notice && <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold" style={{ background: `${C.secondary}10`, color: C.secondary }}>{notice}</p>}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</p>}

            {/* ---- Payment history ---- */}
            {payments.length > 0 && (
                <Card title="Payment history">
                    <div className="flex flex-col gap-2.5">
                        {payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-bold tabular-nums" style={{ color: C.ink }}>₹{inr(p.amount)}</p>
                                    <p className="text-[11px] font-semibold" style={{ color: C.muted }}>{p.billing_period} · {new Date(p.created_at).toLocaleDateString("en-IN")}</p>
                                </div>
                                <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                                    style={p.status === "verified" ? { background: "#05966912", color: "#059669" } : p.status === "rejected" ? { background: "#c71f1112", color: "#c71f11" } : { background: "#f59e0b12", color: "#a16207" }}>
                                    {p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ---- Ledger ---- */}
            <Card title="Transaction ledger">
                {txns.length === 0 ? (
                    <p className="text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>No transactions yet.</p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {txns.map((t) => {
                            const meta = TXN_LABEL[t.type] || { label: t.type, color: C.muted };
                            return (
                                <div key={t.id} className="flex items-center justify-between border-b pb-2.5 last:border-b-0 last:pb-0" style={{ borderColor: C.hairSoft }}>
                                    <div className="min-w-0">
                                        <p className="text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>{meta.label}</p>
                                        <p className="truncate text-[11px] font-medium" style={{ color: C.muted }}>{t.note}</p>
                                        <p className="text-[10.5px] font-semibold" style={{ color: C.muted }}>{new Date(t.created_at).toLocaleString("en-IN")}</p>
                                    </div>
                                    <p className="shrink-0 text-[13px] font-extrabold tabular-nums" style={{ color: t.amount > 0 ? "#c71f11" : "#059669" }}>
                                        {t.amount > 0 ? "+" : ""}₹{inr(t.amount)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}