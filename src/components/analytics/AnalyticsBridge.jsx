// src/components/analytics/AnalyticsBridge.jsx
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { identifyUser, resetUser } from "../../lib/analytics.js";
import ConsentBanner from "./ConsentBanner.jsx";

// Rendered INSIDE <AuthProvider> and <BrowserRouter> (right after <OnboardingGate />).
export default function AnalyticsBridge() {
    const { isLoggedIn, profile } = useAuth();
    const { pathname } = useLocation();
    const lastId = useRef(null);

    // For a team member, `profile` is the COMPANY's profile; the real person is team.actorId.
    const actorId = profile?.team?.actorId || profile?.id || null;
    const role = profile?.role || null;
    const isTeamMember = !!profile?.team;
    const teamRole = profile?.team?.role || null;
    const companyId = isTeamMember ? profile?.id || null : null;
    const sellerStatus = profile?.seller_status ?? null;

    useEffect(() => {
        if (actorId && actorId !== lastId.current) {
            identifyUser(String(actorId), {
                role,                       // lets you filter admins/internal users out in PostHog
                is_team_member: isTeamMember,
                seller_status: sellerStatus,
                ...(isTeamMember ? { team_role: teamRole, company_id: companyId } : {}),
            });
            lastId.current = actorId;
        } else if (!isLoggedIn && lastId.current) {
            resetUser(); // logout: start a fresh anonymous identity
            lastId.current = null;
        }
    }, [actorId, isLoggedIn, role, isTeamMember, teamRole, companyId, sellerStatus]);

    // Never overlay the payment result screen.
    if (pathname.startsWith("/payment/return")) return null;
    return <ConsentBanner />;
}