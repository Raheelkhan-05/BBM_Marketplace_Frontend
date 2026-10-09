// pages/PaymentReturnPage.jsx  — route: /payment/return?ref=BBM...
//
// JioPay sends the buyer's browser to the backend (/pay/return), which redirects here. This page
// credits NOTHING: it only asks the backend (which verifies with JioPay) what happened and shows it.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { C } from "../components/catalog/tokens";
import {
    fetchPaymentStatus, startOrderPayment, startGroupPayment, redirectToGateway, takePaymentReturnPath,
} from "../utils/paymentsApi.js";

const REF_RE = /^BBM[0-9A-F]{17}$/;
const POLL_MS = 2500;
const MAX_POLL_MS = 3 * 60 * 1000;

// The cart provider may not wrap this route in every layout — never let that break the page.
function useCartSafe() {
    try { return useCart() || null; } catch { return null; }
}

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function PaymentReturnPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useAuth();
    const cart = useCartSafe();

    const ref = params.get("ref") || "";
    const validRef = REF_RE.test(ref);

    const [payment, setPayment] = useState(null);
    const [error, setError] = useState(null);
    const [timedOut, setTimedOut] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [authWaited, setAuthWaited] = useState(false);
    const startedAt = useRef(Date.now());
    const cartReloaded = useRef(false);

    // Give the session a moment to restore after the full-page return from the gateway.
    useEffect(() => {
        const t = setTimeout(() => setAuthWaited(true), 4000);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!validRef || !token) return undefined;
        let cancelled = false;
        let timer;

        const tick = async () => {
            const res = await fetchPaymentStatus(token, ref);
            if (cancelled) return;
            if (res?.success && res.payment) {
                setPayment(res.payment);
                setError(null);
                if (res.payment.final) return;
            } else {
                setError(res?.message || "Couldn't check the payment status.");
            }
            if (Date.now() - startedAt.current > MAX_POLL_MS) { setTimedOut(true); return; }
            timer = setTimeout(tick, POLL_MS);
        };
        tick();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [ref, token, validRef]);

    // A paid cart is cleared server-side; refresh the badge once.
    useEffect(() => {
        if (payment?.status === "success" && payment.purpose === "order_group" && !cartReloaded.current) {
            cartReloaded.current = true;
            cart?.reload?.();
        }
    }, [payment, cart]);

    const retry = async () => {
        if (!payment || retrying) return;
        setRetrying(true);
        setError(null);
        const res = payment.purpose === "order_group"
            ? await startGroupPayment(token, payment.groupId)
            : await startOrderPayment(token, payment.orderId);
        if (!res?.success || !redirectToGateway(res.redirectUrl)) {
            setRetrying(false);
            setError(res?.message || "Couldn't start the payment. Please try again.");
        }
    };

    const walletPath = takePaymentReturnPath() || "/grow/wallet";

    /* --------------------------------------------------------------- states */
    let view;
    if (!validRef) {
        view = { tone: "bad", icon: XCircle, title: "Invalid payment link", text: "This payment reference isn't valid.", actions: [["Go to my orders", () => navigate("/save/orders"), true]] };
    } else if (!token) {
        view = authWaited
            ? { tone: "warn", icon: AlertTriangle, title: "Please sign in", text: "Sign in to see the result of your payment.", actions: [["Sign in", () => navigate("/login", { state: { from: location.pathname + location.search } }), true]] }
            : { tone: "wait", icon: Loader2, spin: true, title: "Checking your session…", text: "" };
    } else if (!payment) {
        view = timedOut
            ? { tone: "warn", icon: Clock, title: "Still waiting", text: error || "We couldn't load the payment yet.", actions: [["Go to my orders", () => navigate("/save/orders"), true]] }
            : { tone: "wait", icon: Loader2, spin: true, title: "Confirming your payment…", text: "Please don't pay again or close this page." };
    } else if (payment.status === "success") {
        const forWallet = payment.purpose === "wallet_topup";
        view = {
            tone: "good", icon: CheckCircle2,
            title: forWallet ? "Credits added" : "Payment received",
            text: forWallet
                ? `${inr(payment.amount)} has been added to your wallet.`
                : `We received ${inr(payment.amount)}${payment.orderNumber ? ` for order ${payment.orderNumber}` : payment.groupNumber ? ` for ${payment.groupNumber}` : ""}. The seller has been notified.`,
            actions: forWallet
                ? [["Back to wallet", () => navigate(walletPath), true]]
                : [[payment.orderId ? "View order" : "View my orders", () => navigate(payment.orderId ? `/orders/${payment.orderId}` : "/orders"), true]],
        };
    } else if (payment.status === "refunded") {
        view = {
            tone: "warn", icon: AlertTriangle, title: "Payment received, but it can't be used",
            text: `We received ${inr(payment.amount)}, but this order was already cancelled, paid, or changed. A full refund is being sent to your original payment method automatically.`,
            actions: [["Go to my orders", () => navigate("/saave/orders"), true]],
        };
    } else if (payment.status === "review") {
        view = {
            tone: "warn", icon: Clock, title: "We're verifying your payment",
            text: "The amount confirmed by the bank needs a quick manual check. Our team will resolve it shortly — you don't need to pay again.",
            actions: [["Go to my orders", () => navigate("/save/orders"), true]],
        };
    } else if (payment.status === "failed" || payment.status === "expired") {
        const forWallet = payment.purpose === "wallet_topup";
        view = {
            tone: "bad", icon: XCircle,
            title: payment.status === "expired" ? "Payment session expired" : "Payment didn't go through",
            text: "No money was taken. If an amount was deducted, it will be confirmed or refunded automatically.",
            actions: forWallet
                ? [["Back to wallet", () => navigate(walletPath), true]]
                : [[retrying ? "Starting…" : "Try again", retry, true, RotateCcw], ["Go to my orders", () => navigate("/save/orders"), false]],
        };
    } else if (timedOut) {
        view = {
            tone: "warn", icon: Clock, title: "Still waiting for the bank",
            text: "We haven't received a final answer yet. If money was deducted it will be confirmed automatically — check your orders in a few minutes. You don't need to pay again.",
            actions: [["Go to my orders", () => navigate(payment.purpose === "wallet_topup" ? walletPath : "/save/orders"), true]],
        };
    } else {
        view = { tone: "wait", icon: Loader2, spin: true, title: "Confirming your payment…", text: "Waiting for the bank's confirmation. Please don't pay again or close this page." };
    }

    const colors = {
        good: { bg: "#e8f7ee", fg: "#16a34a" },
        bad: { bg: "#FDECEC", fg: "#B3261E" },
        warn: { bg: "#FEF6E7", fg: "#92600A" },
        wait: { bg: `${C.secondary}12`, fg: C.secondary },
    }[view.tone];
    const Icon = view.icon;

    return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: colors.bg, color: colors.fg }}>
                <Icon className={`h-8 w-8 ${view.spin ? "animate-spin" : ""}`} />
            </span>
            <h1 className="mt-5 text-[20px] font-extrabold tracking-tight" style={{ color: C.ink }}>{view.title}</h1>
            {view.text && <p className="mt-2 text-[13.5px] font-medium leading-relaxed" style={{ color: C.muted }}>{view.text}</p>}

            {error && payment && !payment.final && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold" style={{ background: "#FEF6E7", color: "#92600A" }}>{error}</p>
            )}
            {error && payment?.final && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold" style={{ background: "#FDECEC", color: "#B3261E" }}>{error}</p>
            )}

            {view.actions && (
                <div className="mt-7 flex w-full flex-col gap-2.5">
                    {view.actions.map(([label, onClick, primary, ActionIcon]) => (
                        <button key={label} type="button" onClick={onClick} disabled={retrying}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold disabled:opacity-60"
                            style={primary
                                ? { background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)", color: "#fff" }
                                : { border: `1px solid ${C.hair}`, color: C.ink, background: "#fff" }}>
                            {ActionIcon && <ActionIcon className="h-4 w-4" />}{label}
                        </button>
                    ))}
                </div>
            )}

            {validRef && <p className="mt-8 font-mono text-[11px] font-semibold" style={{ color: C.muted }}>Ref {ref}</p>}
        </div>
    );
}