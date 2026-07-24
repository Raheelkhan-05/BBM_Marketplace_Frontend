// src/components/RouteGuards.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function DefaultLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#047084]" />
    </div>
  );
}

export function RequireAuth({ children, fallback }) {
  const { isLoggedIn, profile, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return fallback ?? <DefaultLoader />;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location }} />;

  if (profile && profile.onboarding_step !== "done") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function RequireAdmin({ children, fallback }) {
  const { profile, isLoggedIn, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return fallback ?? <DefaultLoader />;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profile?.role !== "admin") return <Navigate to="/home" replace />;

  return children;
}

export function RequireGuest({ children, fallback }) {
  const { isLoggedIn, profile, initializing } = useAuth();

  if (initializing) return fallback ?? <DefaultLoader />;

  if (isLoggedIn && profile?.onboarding_step === "done") {
    return <Navigate to="/home" replace />;
  }
  return children;
}