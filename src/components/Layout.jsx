// src/components/Layout.jsx
import { createContext, useContext, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import BottomSearchBar from "./BottomSearchBar.jsx";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <LightboxVisibilityContext.Provider value={{ lightboxOpen, setLightboxOpen }}>
      <div className="relative min-h-screen bg-white overflow-x-clip">
        <BackgroundAmbience />

        <div className="relative z-1">
          <Header />

          <main className="pb-24 md:pb-0">
            <Outlet />
          </main>

          <div className="hidden md:block">
            <Footer />
          </div>

          {!isLandingPage && !lightboxOpen && <BottomSearchBar />}
        </div>
      </div>
    </LightboxVisibilityContext.Provider>
  );
}