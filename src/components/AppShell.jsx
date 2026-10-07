import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { NotificationsProvider } from "../context/NotificationsContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { ChatProvider } from "../context/ChatContext.jsx";
import { ListingsProvider } from "../context/ListingsContext.jsx";
import { HelpRequestProvider } from "../context/HelpRequestContext.jsx";
import BottomNavStrip from "./BottomNavStrip.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const HIDE = [/^\/admin/, /^\/seller\/wallet/, /^\/chat\/[^/]+/, /^\/orders\//, /^\/seller\/orders\//, /^\/login/, /^\/terms/, /^\/privacy-policy/];

export default function AppShell() {
    const { pathname } = useLocation();
    const show = !HIDE.some((r) => r.test(pathname));
    return (
        <NotificationsProvider><CartProvider><ChatProvider><ListingsProvider><HelpRequestProvider>
            <Outlet />
            {show && <BottomNavStrip />}
        </HelpRequestProvider></ListingsProvider></ChatProvider></CartProvider></NotificationsProvider>
    );
}