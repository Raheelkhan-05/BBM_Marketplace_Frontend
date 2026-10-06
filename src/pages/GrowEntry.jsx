// src/pages/GrowEntry.jsx
// Gate for /grow: ready sellers go to the new seller area, everyone else gets the existing start flow.
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isSellerReady, markSeenGrow } from "../components/growSeller/growSeller.js";
import GrowStartPage from "./GrowStartPage.jsx";

export default function GrowEntry() {
    const { token, isLoggedIn, profile, needsOnboarding, initializing } = useAuth();
    const [sp] = useSearchParams();
    // Captured once: GrowStartPage removes ?start=1 from the URL right after reading it,
    // and a seller adding a product must not be bounced back to the dashboard.
    const [adding] = useState(() => sp.get("start") === "1");

    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    useEffect(() => {
        if (!initializing && !ready) markSeenGrow(profile);
    }, [initializing, ready, profile]);

    if (initializing && !adding) return <div style={{ minHeight: "60vh" }} aria-busy="true" />;
    if (ready && !adding) return <Navigate to="/grow/enquiries" replace />;
    return <GrowStartPage />;
}