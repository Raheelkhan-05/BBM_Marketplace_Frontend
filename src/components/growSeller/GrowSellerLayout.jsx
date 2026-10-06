// src/components/growSeller/GrowSellerLayout.jsx
// Shell for the new seller area (/grow/enquiries, /grow/products, /grow/orders[/:id], /grow/wallet).
// Header (logo, wallet), bottom dock (top tabs on desktop), toast, and the guard. Light theme only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationsContext.jsx";
import { useListings } from "../../context/ListingsContext.jsx";
import { fetchWalletStatus } from "../../utils/walletApi.js";
import { loadAccess } from "../grow/growAccess.js";
import { isSellerReady } from "./growSeller.js";
import { toTop } from "../grow/GrowAuthFlow.jsx";
import Ic from "./Ic.jsx";
import { GrowSellerCtx } from "../../context/GrowSellerContext.js";
import "./grow-seller.css";

const TABS = [
    { to: "/grow/enquiries", label: "Enquiries", icon: "mega", a: "var(--or)", c: "#fff", badge: null },
    { to: "/grow/products", label: "Products", icon: "box", a: "var(--go)", c: "#06161C", badge: "prod" },
    { to: "/grow/orders", label: "Orders", icon: "receipt", a: "var(--gr)", c: "#fff", badge: "ord" },
];
const fm = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

export default function GrowSellerLayout() {
    const { token, isLoggedIn, profile, needsOnboarding, initializing, registerResyncHandler } = useAuth();
    const { salesUnreadCount, markWalletTopupViewed } = useNotifications();
    const { reportWallet } = useListings();
    const nav = useNavigate();
    const { pathname } = useLocation();

    const [root, setRoot] = useState(null);
    const [toast, setToast] = useState("");
    const [wallet, setWallet] = useState(null);
    const [badges, setBadges] = useState({ prod: 0 });
    const tt = useRef(null);

    const say = useCallback((m) => {
        setToast(m); clearTimeout(tt.current);
        tt.current = setTimeout(() => setToast(""), 2600);
    }, []);
    useEffect(() => () => clearTimeout(tt.current), []);

    const setBadge = useCallback((k, n) => setBadges((b) => (b[k] === n ? b : { ...b, [k]: n })), []);

    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    // A seller who was approved a moment ago may not have the profile flag yet: confirm with the access check.
    const [probe, setProbe] = useState("idle"); // idle | loading | ok | no
    const needProbe = !initializing && isLoggedIn && !needsOnboarding && !ready;
    useEffect(() => {
        if (!needProbe) return undefined;
        let live = true;
        setProbe("loading");
        loadAccess(token).then((a) => { if (live) setProbe(a?.canPublish ? "ok" : "no"); });
        return () => { live = false; };
    }, [needProbe, token]);
    const allowed = ready || probe === "ok";

    const refreshWallet = useCallback(async () => {
        if (!token) return;
        const res = await fetchWalletStatus(token);
        if (res?.success) setWallet(res.wallet);
    }, [token]);

    useEffect(() => { if (allowed) refreshWallet(); }, [allowed, refreshWallet]);
    useEffect(() => { if (wallet) reportWallet?.(wallet); }, [wallet, reportWallet]);
    useEffect(() => registerResyncHandler?.(refreshWallet), [registerResyncHandler, refreshWallet]);
    useEffect(() => { toTop(); }, [pathname]);

    const openWallet = async () => { await markWalletTopupViewed?.(); nav("/grow/wallet"); };

    const ctx = useMemo(() => ({ root, say, wallet, refreshWallet, setBadge }), [root, say, wallet, refreshWallet, setBadge]);

    const blocked = !!wallet?.is_blocked;
    const balance = wallet ? fm(wallet.balance_due) : "—";
    const badgeFor = (k) => (k === "ord" ? salesUnreadCount : k === "prod" ? badges.prod : 0);

    let body;
    if (initializing || (needProbe && probe !== "no")) {
        body = <div className="app" aria-busy="true"><div className="sk line" style={{ marginTop: 28, width: "55%" }} /><div className="sk" style={{ marginTop: 18 }} /><div className="sk" style={{ marginTop: 14 }} /></div>;
    } else if (!isLoggedIn || needsOnboarding || !allowed) {
        return <Navigate to="/grow" replace />;
    } else {
        body = <main className="app"><Outlet /></main>;
    }

    const tabLink = (t) => {
        const n = t.badge ? badgeFor(t.badge) : 0;
        return (
            <NavLink key={t.to} to={t.to} style={{ "--a": t.a, "--c": t.c }}>
                <Ic n={t.icon} />{t.label}
                {n > 0 && <span className="bdg">{n > 9 ? "9+" : n}</span>}
            </NavLink>
        );
    };

    return (
        <GrowSellerCtx.Provider value={ctx}>
            <div className="gsl" ref={setRoot}>
                <header className="hd">
                    <div className="hd-in">
                        <Link className="logo" to="/grow/enquiries" aria-label="GROW seller home">GR<i>O</i>W</Link>
                        <nav className="tabs" aria-label="Main">{TABS.map(tabLink)}</nav>
                        <span className="sp" />
                        <button className={`wl${blocked ? " neg" : ""}`} type="button" aria-label="Open wallet" onClick={openWallet}>
                            <span className="wi"><Ic n="wallet" /></span>
                            <span><small>{blocked ? "Orders paused" : "Wallet"}</small><b>{balance}</b></span>
                        </button>
                    </div>
                </header>
                {body}
                <nav className="dock" aria-label="Main">{TABS.map(tabLink)}</nav>
                <div className={`toast${toast ? " on" : ""}`} role="status">{toast}</div>
            </div>
        </GrowSellerCtx.Provider>
    );
}