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

    const startParam = sp.get("start") === "1";
    const [sticky, setSticky] = useState(startParam);
    if (startParam && !sticky) setSticky(true);
    const adding = sticky || startParam;

    // New run of the flow every time ?start=1 arrives via a fresh navigation.
    // location.key changes per navigation, so GrowStartPage remounts and re-reads
    // ?start=1 and location.state.from. The later replace to "/grow" has no param,
    // so it does not change this key and the flow is not interrupted.
    const [startKey, setStartKey] = useState(startParam ? location.key : null);
    if (startParam && startKey !== location.key) setStartKey(location.key);

    const [back] = useState(() => enquiryReturnTo(location.state?.from));

    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    useEffect(() => {
        if (!initializing && !ready) markSeenGrow(profile);
    }, [initializing, ready, profile]);

    if (initializing && !adding) return <div className="gs"><div className="app"><GrowCheckSkeleton /></div></div>;
    if (ready && !adding) return <Navigate to={back || "/grow/enquiries"} replace />;
    if (adding || back) return <GrowStartPage key={startKey ?? "flow"} />;
    return <GrowPage />;
}