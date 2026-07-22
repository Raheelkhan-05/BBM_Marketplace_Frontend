//src/components/Layout.jsx

import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import BottomNav from "./BottomNav.jsx";
import BackgroundAmbience from "./landing/BackgroundAmbience.jsx";

export default function Layout() {
  return (
    <div className="relative min-h-screen bg-white overflow-x-clip">
      {/* <BackgroundAmbience /> */}

      <div className="relative z-1">
        <Header />

        {/* pb clearance so BottomNav never covers content on mobile */}
        <main className="pb-20 md:pb-0">
          <Outlet />
        </main>

        <div className="hidden md:block">
          <Footer />
        </div>

        <BottomNav />
      </div>
    </div>
  );
}