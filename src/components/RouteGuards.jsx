// src/components/RouteGuards.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import HomePageSkeleton from "./skeletons/HomePageSkeleton.jsx";

export function RequireAuth({ children }) {
  const { isLoggedIn, profile, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <HomePageSkeleton />;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location }} />;

  // Session exists but onboarding isn't finished — e.g. they closed the
  // tab mid-signup and came back via a bookmarked /home, or a stale link.
  // Send them back to finish it rather than rendering a page that
  // expects a completed profile + business_profiles row.
  if (profile && profile.onboarding_step !== "done") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function RequireAdmin({ children }) {
  const { profile, isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (profile?.role !== "admin") return <Navigate to="/home" replace />;
  return children;
}

export function RequireGuest({ children }) {
  const { isLoggedIn, profile, initializing } = useAuth();

  if (initializing) return <GuestLoadingScreen />;

  // The bug this fixes: `profile.name` gets saved after the CONTACT step,
  // well before onboarding is actually complete. Gating on name alone
  // meant a reload mid-company-step looked "done" and bounced the user
  // to /home, silently discarding everything they'd filled in. Only
  // redirect once onboarding_step is genuinely "done".
  if (isLoggedIn && profile?.onboarding_step === "done") {
    return <Navigate to="/home" replace />;
  }
  return children;
}

function GuestLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#047084]" />
    </div>
  );
}