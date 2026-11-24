import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { NotificationsProvider } from "../context/NotificationsContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { ChatProvider } from "../context/ChatContext.jsx";
import { ListingsProvider } from "../context/ListingsContext.jsx";
import { HelpRequestProvider } from "../context/HelpRequestContext.jsx";
import { TransportLibraryProvider } from "../context/TransportLibraryContext.jsx";
import { NotificationActionsProvider } from "../context/NotificationActionsContext.jsx";
import { DockVisibilityProvider, useDockHidden } from "../context/DockVisibilityContext.jsx";
import { LightboxVisibilityContext } from "../context/LightboxVisibilityContext.jsx";
// Home filters (search text, selected category, GST) live here so Header, Home, Brands and Sellers all share them.
import { HomeFiltersProvider } from "../context/HomeFiltersContext.jsx";
import BottomNavStrip from "./BottomNavStrip.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const HIDE = [/^\/admin/, /^\/cart(\/|$)/, /^\/seller\/wallet/, /^\/sell\/bulk/, /^\/chat\/[^/]+/, /^\/orders\//, /^\/seller\/orders\//, /^\/login/, /^\/terms/, /^\/privacy-policy/, /^\/refund-policy/, /^\/contact/, /^\/services/, /^\/pricing/, /^\/payment\/return/, /^\/sales(\/|$)/];

function Dock({ show }) { const hidden = useDockHidden(); return show && !hidden ? <BottomNavStrip /> : null; }


export default function AppShell() {
    const { pathname } = useLocation();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const lightboxValue = useMemo(() => ({ lightboxOpen, setLightboxOpen }), [lightboxOpen]);

    // Keep the page width the same whether or not a scrollbar is needed, so content never shifts
    // sideways when switching pages (or when the menu locks scrolling).
    useEffect(() => {
        const el = document.documentElement;
        const prev = el.style.scrollbarGutter;
        el.style.scrollbarGutter = "stable";
        return () => { el.style.scrollbarGutter = prev; };
    }, []);

    // The dock is hidden on these pages, and while an image is open full screen.
    const show = !HIDE.some((r) => r.test(pathname)) && !lightboxOpen;

    const { profile } = useAuth();
    const isSales = profile?.team?.role === "salesperson";
    const salesExempt = /^\/(login|terms|privacy-policy|refund-policy|contact|services|pricing|sales|payment\/return)(\/|$)/.test(pathname);
    if (isSales && !salesExempt) return <Navigate to="/sales/dashboard" replace />;

    return (
        <NotificationsProvider><CartProvider><ChatProvider><ListingsProvider><HelpRequestProvider><TransportLibraryProvider>
            <NotificationActionsProvider>
                <DockVisibilityProvider>
                    <LightboxVisibilityContext.Provider value={lightboxValue}>
                        <HomeFiltersProvider>
                            <Outlet />
                            <Dock show={show} />
                        </HomeFiltersProvider>
                    </LightboxVisibilityContext.Provider>
                </DockVisibilityProvider>
            </NotificationActionsProvider>
        </TransportLibraryProvider ></HelpRequestProvider></ListingsProvider></ChatProvider></CartProvider></NotificationsProvider>
    );
}