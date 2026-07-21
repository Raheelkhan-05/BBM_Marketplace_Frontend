// src/components/RouteGuards.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import HomePageSkeleton from "./skeletons/HomePageSkeleton.jsx";

export function RequireAuth({ children }) {
  const { isLoggedIn, initializing } = useAuth();
  const location = useLocation();

  // Skeleton matches /home's layout specifically, since that's the
  // overwhelmingly common destination for an authenticated route check.
  if (initializing) return <HomePageSkeleton />;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function RequireGuest({ children }) {
  const { isLoggedIn, initializing } = useAuth();

  if (initializing) return <GuestLoadingScreen />;
  if (isLoggedIn) return <Navigate to="/home" replace />;
  return children;
}

// Landing/search/login don't have one dominant layout shape the way
// /home does, so a lightweight centered spinner stays appropriate there.
function GuestLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#047084]" />
    </div>
  );
}