// src/pages/GrowEntry.jsx
// Gate for /grow: ready sellers go to the new seller area, everyone else gets the existing start flow.
import { useEffect, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isSellerReady, markSeenGrow } from "../components/growSeller/growSeller.js";
import GrowCheckSkeleton from "../components/grow/GrowCheckSkeleton.jsx";
import { enquiryReturnTo } from "../components/grow/growReturn.js";
import GrowStartPage from "./GrowStartPage.jsx";

export default function GrowEntry() {
    const { token, isLoggedIn, profile, needsOnboarding, initializing } = useAuth();
    const [sp] = useSearchParams();
    const location = useLocation();
    // Captured once: GrowStartPage removes ?start=1 from the URL right after reading it,
    // and a seller adding a product must not be bounced back to the dashboard.
    const [adding] = useState(() => sp.get("start") === "1");
    // Enquiry page the person was sent here from (if any); a ready seller goes back there instead of the default.
    const [back] = useState(() => enquiryReturnTo(location.state?.from));

    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    useEffect(() => {
        if (!initializing && !ready) markSeenGrow(profile);
    }, [initializing, ready, profile]);

    // Same skeleton as the start flow's "check" screen, so the hand-over is seamless.
    if (initializing && !adding) return <div className="gs"><div className="app"><GrowCheckSkeleton /></div></div>;
    if (ready && !adding) return <Navigate to={back || "/grow/enquiries"} replace />;
    return <GrowStartPage />;
}