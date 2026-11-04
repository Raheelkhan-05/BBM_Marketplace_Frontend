// src/components/sales/SalesMonitorLayout.jsx
// Shell for /sales/monitor. Looks exactly like SalesLayout (same header, profile menu, main container, toast),
// but is for the company owner / team admins instead of salespeople. SalesLayout itself is untouched.
//   - not logged in            -> /login
//   - salesperson              -> /sales/dashboard (their own workspace)
//   - team member / other role -> /home
// No SalesTabs here: those tabs are the salesperson's own pages. The page has its own filters + side panel.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { toTitleCase } from "../growSeller/sellerHelpers.js";
import "../growSeller/grow-modules.css";
import "./sales.css";

export default function SalesMonitorLayout() {
    const { isLoggedIn, effectiveLoggedIn, profile, initializing, signOut, refreshProfile } = useAuth();
    const { pathname } = useLocation();
    const [toast, setToast] = useState("");
    const [menu, setMenu] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const tt = useRef(null);
    const menuRef = useRef(null);
    const say = useCallback((m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(""), 2600); }, []);
    useEffect(() => () => clearTimeout(tt.current), []);

    const logoUrl = profile?.businessProfile?.logo_url || "";
    useEffect(() => { setLogoFailed(false); }, [logoUrl]);
    useEffect(() => { setMenu(false); }, [pathname]);

    useEffect(() => {
        if (!menu) return undefined;
        const down = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
        const key = (e) => { if (e.key === "Escape") setMenu(false); };
        document.addEventListener("pointerdown", down);
        document.addEventListener("keydown", key);
        return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
    }, [menu]);

    if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: pathname }} />;
    if (!profile) {
        return initializing
            ? <div className="gk gs" aria-busy="true"><div className="gs-main"><div className="gk-skel" style={{ height: 120, marginTop: 24 }} /></div></div>
            : (
                <div className="gk gs"><div className="gs-main" style={{ paddingTop: 48, textAlign: "center" }}>
                    <p style={{ fontWeight: 800 }}>Couldn't load your workspace.</p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                        <button type="button" className="gk-btn go" onClick={() => refreshProfile()}>Try again</button>
                        <button type="button" className="gk-btn" onClick={signOut}>Sign out</button>
                    </div>
                </div></div>
            );
    }

    // Same rule as the Console "Sales" tab (the server enforces it too).
    const teamRole = profile.team?.role;
    if (teamRole === "salesperson") return <Navigate to="/sales/dashboard" replace />;
    const canMonitor = effectiveLoggedIn && (!teamRole || teamRole === "admin");
    if (!canMonitor) return <Navigate to="/home" replace />;

    const bp = profile.businessProfile;
    const company = toTitleCase(bp?.display_name || bp?.trade_name || bp?.legal_name || "Your company");
    const me = (profile.team?.actor?.name || profile.name || "").trim();
    const initial = (company || "C").charAt(0).toUpperCase();
    const showLogo = !!logoUrl && !logoFailed;

    const mark = (cls) => (
        <span className={`gs-mark ${cls}${showLogo ? "" : " ini"}`} aria-hidden="true">
            {showLogo ? <img src={logoUrl} alt="" onError={() => setLogoFailed(true)} /> : initial}
        </span>
    );

    return (
        <div className="gk gs">
            <header className="gs-hd">
                <div className="gs-hd-in">
                    {/* tapping the brand goes back to the app */}
                    <Link to="/home" className="gs-brand" aria-label="Back to BBM home" style={{ textDecoration: "none", color: "inherit" }}>
                        <img src="/Logo.png" alt="" />
                        <div className="gs-co"><b>BBM</b><small>Team activity</small></div>
                    </Link>

                    <div className="gs-menu" ref={menuRef}>
                        <button type="button" className="gs-prof" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                            {mark("sm")}
                        </button>
                        {menu && (
                            <div className="gs-pop" role="menu">
                                <div className="gs-pop-top">
                                    {mark("lg")}
                                    <div className="gs-pop-who">
                                        <b>{me || "Admin"}</b>
                                        <small>{company}</small>
                                    </div>
                                </div>
                                <button type="button" role="menuitem" className="gs-out" onClick={() => { setMenu(false); signOut(); }}>
                                    <LogOut size={16} aria-hidden="true" />Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="gs-main">
                <Suspense fallback={<div className="gk-skel" style={{ height: 140, marginTop: 24 }} aria-busy="true" />}>
                    <Outlet context={{ say, company }} />
                </Suspense>
            </main>
            <div className={`gs-toast${toast ? " on" : ""}`} role="status">{toast}</div>
        </div>
    );
}