// src/components/Layout.jsx

import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import BottomSearchBar from "./BottomSearchBar.jsx";
import BackgroundAmbience from "./landing/BackgroundAmbience.jsx";

export default function Layout() {

  const { pathname } = useLocation();
  const isLandingPage = pathname === "/";

  return (
    <div className="relative min-h-screen bg-white overflow-x-clip">
      <BackgroundAmbience />

      <div className="relative z-1">
        <Header />

        {/* pb clearance so BottomSearchBar never covers content on mobile */}
        <main className="pb-24 md:pb-0">
          <Outlet />
        </main>

        <div className="hidden md:block">
          <Footer />
        </div>

        {!isLandingPage && <BottomSearchBar />}
      </div>
    </div>
  );
}