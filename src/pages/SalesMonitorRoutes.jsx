// src/pages/SalesMonitorRoutes.jsx: everything under /sales/monitor/*
//   /sales/monitor                      activity feed
//   /sales/monitor/enquiries            enquiries list
//   /sales/monitor/enquiries/:threadId  full-page enquiry chat (has its own back button)
//   /sales/monitor/orders               order book list
//
// Back button: one button on every tab. It always LEAVES the monitor and returns to the page the admin came from,
// no matter how many tabs or chats they opened on the way. Tabs use `replace`, so they never pile up in history.
import { lazy, useCallback, useRef } from "react";
import { NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, ClipboardList, Package } from "lucide-react";
import "../components/team/monitor/monitor-lists.css";

const SalesMonitorPage = lazy(() => import("./SalesMonitorPage.jsx"));
const SalesMonitorEnquiriesPage = lazy(() => import("./SalesMonitorEnquiriesPage.jsx"));
const SalesMonitorOrdersPage = lazy(() => import("./SalesMonitorOrdersPage.jsx"));
const SalesMonitorThreadPage = lazy(() => import("./SalesMonitorThreadPage.jsx"));

const TABS = [
    ["/sales/monitor", "Activity", Activity, true],
    ["/sales/monitor/enquiries", "Enquiries", ClipboardList, false],
    ["/sales/monitor/orders", "Orders", Package, false],
];

// position of the current page in the browser history (react-router keeps it in history.state.idx)
const histIdx = () => (typeof window !== "undefined" && Number.isInteger(window.history.state?.idx) ? window.history.state.idx : 0);

function Shell({ onBack }) {
    return (
        <div className="gd">
            <div className="ml-bar">
                <button type="button" className="ml-back" aria-label="Back" title="Back" onClick={onBack}>
                    <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <nav className="ml-nav" aria-label="Team activity sections">
                    {TABS.map(([to, label, Icon, end]) => (
                        <NavLink key={to} to={to} end={end} replace className={({ isActive }) => `ml-tab${isActive ? " on" : ""}`}>
                            <Icon size={15} aria-hidden="true" />{label}
                        </NavLink>
                    ))}
                </nav>
            </div>
            <Outlet />
        </div>
    );
}

export default function SalesMonitorRoutes() {
    const nav = useNavigate();
    // remembered once, when the admin first lands anywhere inside the monitor (this component stays mounted for all sub-pages)
    const entryIdx = useRef(histIdx());

    const leave = useCallback(() => {
        const steps = histIdx() - entryIdx.current + 1;          // pages visited inside the monitor + the entry page itself
        if (entryIdx.current > 0 && steps > 0) nav(-steps);      // back to where they came from
        else nav("/home", { replace: true });                    // opened directly (bookmark / new tab): go home
    }, [nav]);

    return (
        <Routes>
            <Route element={<Shell onBack={leave} />}>
                <Route index element={<SalesMonitorPage />} />
                <Route path="enquiries" element={<SalesMonitorEnquiriesPage />} />
                <Route path="orders" element={<SalesMonitorOrdersPage />} />
            </Route>
            <Route path="enquiries/:threadId" element={<SalesMonitorThreadPage />} />
        </Routes>
    );
}