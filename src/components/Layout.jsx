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
  const isAdminPage = pathname.startsWith("/admin");
  // /chat/:id (a specific conversation) hides the bottom nav,
  // but /chat itself (the chat list) keeps it.
  const isChatDetailPage = /^\/chat\/[^/]+/.test(pathname);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);

  const showBottomNav = !isLandingPage && !isAdminPage && !isChatDetailPage && !lightboxOpen;

  return (
    <LightboxVisibilityContext.Provider value={{ lightboxOpen, setLightboxOpen }}>
      <div className="relative min-h-screen bg-[#FCFBF9] overflow-x-clip">
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