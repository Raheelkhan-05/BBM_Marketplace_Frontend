// src/components/Layout.jsx
import { createContext, useContext, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import BottomNavStrip from "./BottomNavStrip.jsx";
import BackgroundAmbience from "./landing/BackgroundAmbience.jsx";

const LightboxVisibilityContext = createContext(null);

// Lets any page deep in the tree tell Layout "hide the bottom search bar
// right now" without threading a prop through every intermediate component.
export function useLightboxVisibility() {
  const ctx = useContext(LightboxVisibilityContext);
  if (!ctx) throw new Error("useLightboxVisibility must be used inside <Layout>");
  return ctx;
}

export default function Layout() {
  const { pathname } = useLocation();
  const isLandingPage = pathname === "/";
  // Admin pages have their own bottom-fixed bars (save/reject/approve bar,
  // mobile add-new FAB) — stacking the bottom nav strip on top of those
  // covered their buttons and blocked taps, so it's hidden here.
  const isAdminPage = pathname.startsWith("/admin");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);

  const showBottomNav = !isLandingPage && !isAdminPage && !lightboxOpen;

  return (
    <LightboxVisibilityContext.Provider value={{ lightboxOpen, setLightboxOpen }}>
      <div className="relative min-h-screen bg-white overflow-x-clip">
        <BackgroundAmbience />

        <div className="relative z-1">
          <Header onOpenRfq={() => setRfqOpen(true)} />

          <main className={showBottomNav ? "pb-10 md:pb-0" : ""}>
            <Outlet />
          </main>

          <div className="hidden md:block">
            <Footer />
          </div>

          {showBottomNav && <BottomNavStrip onOpenRfq={() => setRfqOpen(true)} />}
        </div>
      </div>
    </LightboxVisibilityContext.Provider>
  );
}