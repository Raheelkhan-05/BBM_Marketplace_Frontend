// src/pages/GrowEntry.jsx
// Gate for /grow: ready sellers go to the new seller area, everyone else gets the existing start flow.
import { useEffect, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isSellerReady, markSeenGrow } from "../components/growSeller/growSeller.js";
import GrowCheckSkeleton from "../components/grow/GrowCheckSkeleton.jsx";
import { enquiryReturnTo } from "../components/grow/growReturn.js";
import GrowStartPage from "./GrowStartPage.jsx";
import GrowPage from "./GrowPage.jsx";

export default function GrowEntry() {
    const { token, isLoggedIn, profile, needsOnboarding, initializing } = useAuth();
    const [sp] = useSearchParams();
    const location = useLocation();
    const [adding] = useState(() => sp.get("start") === "1");
    const [back] = useState(() => enquiryReturnTo(location.state?.from));

    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    useEffect(() => {
        if (!initializing && !ready) markSeenGrow(profile);
    }, [initializing, ready, profile]);

    if (initializing && !adding) return <div className="gs"><div className="app"><GrowCheckSkeleton /></div></div>;

    // Ready seller visiting plain /grow -> dashboard / enquiry (unchanged)
    if (ready && !adding) return <Navigate to={back || "/grow/enquiries"} replace />;

    // Login / onboarding / add-product flow (unchanged)
    if (adding || back) return <GrowStartPage />;

    // Everyone else (not a seller yet) -> the full details page
    return <GrowPage />;
}