import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { NotificationsProvider } from "../context/NotificationsContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { ChatProvider } from "../context/ChatContext.jsx";
import { ListingsProvider } from "../context/ListingsContext.jsx";
import { HelpRequestProvider } from "../context/HelpRequestContext.jsx";
import { TransportLibraryProvider } from "../context/TransportLibraryContext.jsx";
import BottomNavStrip from "./BottomNavStrip.jsx";
import { useAuth } from "../context/AuthContext.jsx";


const HIDE = [/^\/admin/, /^\/seller\/wallet/, /^\/chat\/[^/]+/, /^\/orders\//, /^\/seller\/orders\//, /^\/login/, /^\/terms/, /^\/privacy-policy/, /^\/payment\/return/];

export default function AppShell() {
    const { pathname } = useLocation();

    // Keep the page width the same whether or not a scrollbar is needed, so content never shifts
    // sideways when switching pages (or when the menu locks scrolling).
    useEffect(() => {
        const el = document.documentElement;
        const prev = el.style.scrollbarGutter;
        el.style.scrollbarGutter = "stable";
        return () => { el.style.scrollbarGutter = prev; };
    }, []);

    const show = !HIDE.some((r) => r.test(pathname));
    return (
        <NotificationsProvider><CartProvider><ChatProvider><ListingsProvider><HelpRequestProvider><TransportLibraryProvider>
            <Outlet />
            {show && <BottomNavStrip />}
        </TransportLibraryProvider ></HelpRequestProvider></ListingsProvider></ChatProvider></CartProvider></NotificationsProvider>
    );
}