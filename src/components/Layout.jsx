// src/components/Layout.jsx
//
// NOTE: NotificationsProvider, CartProvider, ChatProvider, ListingsProvider,
// HelpRequestProvider, TransportLibraryProvider and HomeFiltersProvider are provided ONCE by AppShell.
// Do not re-wrap them here.
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import { BuyerAddressProvider } from "../context/BuyerAddressContext.jsx";
import PublicFooter from "./PublicFooter.jsx";
import PublicServicesStrip from "./PublicServicesStrip.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { OrderResumeProvider } from "../context/OrderResumeContext.jsx";
import { useLightboxVisibility } from "../context/LightboxVisibilityContext.jsx";
import OrderNotificationToast from "./OrderNotificationToast.jsx";
import ChatNotificationToast from "./ChatNotificationToast.jsx";
import CreditNotificationToast from "./CreditNotificationToast.jsx";
import TransportResolutionBanner from "./TransportResolutionBanner.jsx";
import GlobalBuyNowLauncher from "./GlobalBuyNowLauncher.jsx";
import HelpBulb from "./HelpBulb.jsx";

export { useLightboxVisibility };

export default function Layout() {
  const { pathname } = useLocation();
  const { isLoggedIn, initializing } = useAuth();
  const isHome = pathname === "/home";

  const isAdminPage = pathname.startsWith("/admin");
  const isWalletPage = pathname.startsWith("/seller/wallet");
  const isChatDetailPage = /^\/chat\/[^/]+/.test(pathname);
  const isOrdersPage = pathname.startsWith("/orders/");
  const isSalesOrdersPage = pathname.startsWith("/seller/orders/");

  const { lightboxOpen } = useLightboxVisibility();
  const [rfqOpen, setRfqOpen] = useState(false);

  const showBottomNav = !isAdminPage && !isWalletPage && !isChatDetailPage
    && !isSalesOrdersPage && !isOrdersPage && !lightboxOpen;

  return (
    <BuyerAddressProvider>
      <OrderResumeProvider>
        <div className="relative min-h-screen bg-[#FFFFFF] overflow-x-clip">
          <div className="relative z-1">
            <Header onOpenRfq={() => setRfqOpen(true)} />

            <main className={showBottomNav ? "pb-0 md:pb-0" : ""}>
              <Outlet />
            </main>

            {isHome && !isLoggedIn && !initializing && <PublicServicesStrip />}

            <PublicFooter dock />
          </div>

          {/* <div className="hidden md:block">
            <HelpBulb />
          </div> */}

          <CreditNotificationToast />
          <OrderNotificationToast />
          <ChatNotificationToast />
          <TransportResolutionBanner />
          <GlobalBuyNowLauncher />
        </div>
      </OrderResumeProvider>
    </BuyerAddressProvider>
  );
}