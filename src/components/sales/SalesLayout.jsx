import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, Users, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import "../growSeller/grow-modules.css";
import "./sales.css";

const TABS = [
    { to: "/sales/dashboard", label: "Dashboard", Icon: LayoutGrid, a: "var(--bl, #1E78D6)", ai: "var(--bt, #0F63B5)" },
    { to: "/sales/customers", label: "Customers", Icon: Users, a: "var(--tt, #0D6E7E)", ai: "var(--tt, #0D6E7E)" },
];
const tabStyle = (t) => ({ "--a": t.a, "--c": "#fff", "--ai": t.ai });

export default function SalesLayout() {
    const { isLoggedIn, profile, initializing, signOut, refreshProfile } = useAuth();
    const { pathname } = useLocation();
    const [toast, setToast] = useState("");
    const tt = useRef(null);
    const say = useCallback((m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(""), 2600); }, []);
    useEffect(() => () => clearTimeout(tt.current), []);

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
    if (profile.team?.role !== "salesperson") return <Navigate to="/home" replace />;

    const bp = profile.businessProfile;
    const company = bp?.display_name || bp?.trade_name || bp?.legal_name || "Your company";
    const me = profile.team.actor?.name || "";

    return (
        <div className="gk gs">
            <header className="gs-hd">
                <div className="gs-hd-in">
                    <img src="/Logo.png" alt="BBM" />
                    <div className="gs-co"><b>{company}</b><small>Sales{me ? ` · ${me}` : ""}</small></div>
                    <button type="button" className="gk-icbtn" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={18} /></button>
                </div>
            </header>

            <nav className="gk gn gs-nav" aria-label="Sales sections">
                <div className="gn-panel"><div className="gn-gridwrap"><div className="gn-clip"><div className="gn-tiles">
                    {TABS.map((t) => (
                        <NavLink key={t.to} to={t.to} className="gn-tab" style={tabStyle(t)} draggable={false}>
                            <span className="gn-ico2"><t.Icon aria-hidden="true" /></span>
                            <span className="gn-lb">{t.label}</span>
                        </NavLink>
                    ))}
                </div></div></div></div>
            </nav>

            <main className="gs-main">
                <Suspense fallback={<div className="gk-skel" style={{ height: 140, marginTop: 24 }} aria-busy="true" />}>
                    <Outlet context={{ say, company }} />
                </Suspense>
            </main>
            <div className={`gs-toast${toast ? " on" : ""}`} role="status">{toast}</div>
        </div>
    );
}