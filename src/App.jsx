// src/App.jsx
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards.jsx";
import ScrollToTop from "./lib/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";
import GrowLayout from "./components/grow/GrowLayout.jsx";
import GrowSellerRoot from "./components/growSeller/GrowSellerRoot.jsx";
import SalesLayout from "./components/sales/SalesLayout.jsx";
import SalesMonitorLayout from "./components/sales/SalesMonitorLayout.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import InstallAppPrompt from "./components/InstallAppPrompt.jsx";
import PendingSubmissionWatcher from "./components/PendingSubmissionWatcher.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import PendingPaymentGate from './components/PendingPaymentGate.jsx';
// import ContactsBootstrapper from "./components/ContactsBootstrapper.jsx";
import DeferredMount from "./components/DeferredMount.jsx";
import { routeImports, preloadRoutesWhenIdle } from "./routePreload.js";
import GrowProviders from "./components/grow/GrowProviders.jsx";
import OnboardingGate from "./components/OnboardingGate.jsx";
import AppShell from "./components/AppShell.jsx";
import SaveLayout from "./components/save/SaveLayout.jsx";
import PaymentReturnPage from "./pages/PaymentReturnPage.jsx";
import SaveChatPage from "./pages/SaveChatPage.jsx";
import SaveTransportPage from "./pages/SaveTransportPage.jsx";
import GrowBulkUploadPage from "./pages/GrowBulkUploadPage.jsx";
import GrowOrderBookPage from "./pages/GrowOrderBookPage.jsx";
import GrowOrderBookDetailPage from "./pages/GrowOrderBookDetailPage.jsx";
import SalesOrderBookDetailPage from "./pages/SalesOrderBookDetailPage.jsx";
import SalesOrderBookPage from "./pages/SalesOrderBookPage.jsx";
import GrowOrdersShell from "./components/growSeller/GrowOrdersShell.jsx";
import AnalyticsBridge from "./components/analytics/AnalyticsBridge.jsx";
import PaymentAppBridge from "./components/PaymentAppBridge.jsx";
import PaymentAppHandoff from "./components/PaymentAppHandoff.jsx";

// Every page below is now its own JS chunk instead of one bundle that
// includes admin/seller/chat/catalog-review code on a first-time
// visitor's home-page load. Pages registered in routeImports use that
// SAME import function here, so a prefetch triggered from routePreload.js
// (hover, idle) warms exactly the chunk this lazy() will resolve from.
const HomePage = lazy(routeImports["/home"]);
const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const ShopRoute = lazy(() => import("./pages/ShopRoute.jsx"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage.jsx"));
const BrandItemSellersPage = lazy(() => import("./pages/BrandItemSellersPage.jsx"));
const SharedProductPage = lazy(() => import("./pages/SharedProductPage.jsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.jsx"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage.jsx"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage.jsx"));
const ContactPage = lazy(() => import("./pages/ContactPage.jsx"));
const ServicesPage = lazy(() => import("./pages/ServicesPage.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const SellerMarketingPage = lazy(() => import("./pages/SellerMarketingPage.jsx"));
const BrandsPage = lazy(() => import("./pages/BrandsPage.jsx"));
const SellersPage = lazy(() => import("./pages/SellersPage.jsx"));

const GrowPage = lazy(() => import("./pages/GrowPage.jsx"));
const GrowEntry = lazy(() => import("./pages/GrowEntry.jsx"));
const GrowSellItemPage = lazy(() => import("./pages/GrowSellItemPage.jsx"));
const GrowEnquiriesPage = lazy(() => import("./pages/GrowEnquiriesPage.jsx"));
const GrowEnquiryDetailPage = lazy(() => import("./pages/GrowEnquiryDetailPage.jsx"));
const GrowProductsPage = lazy(() => import("./pages/GrowProductsPage.jsx"));
const GrowOrdersPage = lazy(() => import("./pages/GrowOrdersPage.jsx"));
const GrowOrderDetailPage = lazy(() => import("./pages/GrowOrderDetailPage.jsx"));
const GrowWalletPage = lazy(() => import("./pages/GrowWalletPage.jsx"));
const GrowStorePage = lazy(() => import("./pages/GrowStorePage.jsx"));
const GrowChatPage = lazy(() => import("./pages/GrowChatPage.jsx"));
const GrowTransportPage = lazy(() => import("./pages/GrowTransportPage.jsx"));
const GrowDashboardPage = lazy(() => import("./pages/GrowDashboardPage.jsx"));
const GrowCustomersPage = lazy(() => import("./pages/GrowCustomersPage.jsx"));
const GrowQuoteProductPage = lazy(() => import("./pages/GrowQuoteProductPage.jsx"));
const JoinTeamPage = lazy(() => import("./pages/JoinTeamPage.jsx"));

// const SavePage = lazy(() => import("./pages/SavePage.jsx"));
const SaveEntry = lazy(() => import("./pages/SaveEntry.jsx"));
const SaveOrdersPage = lazy(() => import("./pages/SaveOrdersPage.jsx"));
const SaveCartPage = lazy(() => import("./pages/SaveCartPage.jsx"));
const SaveOrderDetailPage = lazy(() => import("./pages/SaveOrderDetailPage.jsx"));
const SaveCreditPage = lazy(() => import("./pages/SaveCreditPage.jsx"));
const SaveHomePage = lazy(() => import("./pages/SaveHomePage.jsx"));

const SalesDashboardPage = lazy(() => import("./pages/SalesDashboardPage.jsx"));
const SalesCustomersPage = lazy(() => import("./pages/SalesCustomersPage.jsx"));
const SalesEnquiriesPage = lazy(() => import("./pages/SalesEnquiriesPage.jsx"));
const SalesPipelinePage = lazy(() => import("./pages/SalesPipelinePage.jsx"));
const SalesThreadPage = lazy(() => import("./pages/SalesThreadPage.jsx"));
const SalesMonitorRoutes = lazy(() => import("./pages/SalesMonitorRoutes.jsx"));

// Deliberately blank: any visible fallback here would itself flash before
// a route's own (much cheaper) internal skeleton takes over, on every
// single navigation. A blank frame for the ~100-300ms a chunk takes to
// fetch beats a layout jump on every nav — and with the prefetching below,
// most navigations won't even hit this path, since the chunk is usually
// already warm by the time the person clicks.
function RouteFallback() {
  return null;
}

function App() {
  // The primary bottom-nav destinations (Home, Seller Listing, Chat, Cart,
  // Orders, Wallet) are reachable from almost every screen in the app —
  // so once the CURRENT page has had first crack at the network, warm all
  // of them in the background. By the time someone taps any nav tab, that
  // page's code is very likely already sitting in the browser's cache —
  // this is what makes tab switches feel instant/native instead of
  // "tap, then wait."
  useEffect(() => {
    preloadRoutesWhenIdle(Object.keys(routeImports));
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <ScrollToTop />
          <OnboardingGate />
          <AnalyticsBridge />
          <PaymentAppBridge />
          <PaymentAppHandoff />
          {/*
            InstallAppPrompt, PendingSubmissionWatcher, PendingPaymentGate and
            ContactsBootstrapper are app-wide background features unrelated
            to the page currently on screen. Mounting them immediately means
            their fetches compete on the network with the requests the
            visible page actually needs — on a slow connection that's the
            difference between "product images show up" and "everything
            crawls together". DeferredMount holds them off until the browser
            reports idle (or ~2.5s pass), after the above-the-fold content
            has had first crack at the network.
          */}
          <DeferredMount>
            <InstallAppPrompt />
            <PendingSubmissionWatcher />
            <PendingPaymentGate />
            {/* <ContactsBootstrapper /> */}
          </DeferredMount>

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<AuthPage />} />
                </Route>
                <Route path="/join-team" element={<JoinTeamPage />} />

                {/* Public policy / information pages. Must stay reachable without
                    login: payment-gateway and bank reviewers open them logged out.
                    Real HTML for these routes is written at build time by
                    scripts/prerender-public.mjs. */}
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy-policy" element={<PrivacyPage />} />
                <Route path="/refund-policy" element={<RefundPolicyPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/pricing" element={<PricingPage />} />

                {/* URLs reviewers and search engines commonly guess */}
                <Route path="/terms-and-conditions" element={<Navigate to="/terms" replace />} />
                <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
                <Route path="/refund-and-cancellation" element={<Navigate to="/refund-policy" replace />} />
                <Route path="/refund" element={<Navigate to="/refund-policy" replace />} />
                <Route path="/cancellation-policy" element={<Navigate to="/refund-policy" replace />} />
                <Route path="/return-policy" element={<Navigate to="/refund-policy" replace />} />
                <Route path="/contact-us" element={<Navigate to="/contact" replace />} />
                <Route path="/fees" element={<Navigate to="/pricing" replace />} />

                <Route path="/payment/return" element={<PaymentReturnPage />} />

                {/* Single, shareable enquiry. Standalone (own header, no Layout / GrowSellerRoot)
                    so a link opened by someone who isn't a seller yet still renders. */}
                <Route path="/sell/enquiry/:id" element={<GrowEnquiryDetailPage />} />

                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/home" replace />} />

                  <Route path="/home" element={<HomePage />} />
                  <Route path="/cart" element={<RequireAuth><SaveCartPage /></RequireAuth>} />

                  <Route path="/brand-item/:idOrSlug/sellers" element={<BrandItemSellersPage />} />

                  <Route path="/seller/marketing" element={<RequireAuth><SellerMarketingPage /></RequireAuth>} />

                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/brand/:brandName" element={<HomePage />} />

                  <Route path="/sellers" element={<SellersPage />} />
                  <Route path="/seller/:shopSlug" element={<HomePage />} />

                  <Route path="/shop/:slug" element={<ShopRoute />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />

                  <Route path="/p/:submissionId" element={<SharedProductPage />} />
                </Route>

                <Route element={<GrowProviders />}>
                  <Route element={<GrowLayout />}>
                    <Route path="/sell" element={<GrowEntry />} />
                    <Route path="/sell/details" element={<GrowPage />} />
                    {/* "I want to sell this" from the catalogue: locked-identity add-product wizard */}
                    <Route path="/sell/sell/:brandId" element={<GrowSellItemPage />} />
                    <Route path="/sell/enquiry/:enquiryId/add-product" element={<GrowQuoteProductPage />} />
                    <Route path="/sell/enquiry/:enquiryId/add-product/:brandId" element={<GrowQuoteProductPage />} />
                  </Route>

                  <Route element={<GrowSellerRoot />}>
                    <Route path="/sell/dashboard" element={<GrowDashboardPage />} />
                    <Route path="/sell/enquiries" element={<GrowEnquiriesPage />} />
                    <Route path="/sell/transport" element={<GrowTransportPage />} />
                    <Route path="/sell/chat/:conversationId?" element={<GrowChatPage />} />
                    <Route path="/sell/products" element={<GrowProductsPage />} />
                    <Route path="/sell/bulk" element={<GrowBulkUploadPage />} />
                    <Route path="/sell/wallet" element={<GrowWalletPage />} />
                    <Route path="/sell/shop" element={<GrowStorePage />} />
                    <Route element={<GrowOrdersShell />}>
                      <Route path="/sell/orders" element={<GrowOrdersPage />} />
                      <Route path="/sell/order-book" element={<GrowOrderBookPage />} />
                    </Route>
                    <Route path="/sell/orders/:id" element={<GrowOrderDetailPage />} />
                    <Route path="/sell/order-book/:id" element={<GrowOrderBookDetailPage />} />
                    <Route path="/sell/customers" element={<GrowCustomersPage />} />
                  </Route>

                  <Route path="/buy" element={<SaveLayout />}>
                    <Route index element={<SaveEntry />} />
                    <Route path="rfq" element={<SaveHomePage />} />
                    <Route path="orders" element={<SaveOrdersPage />} />
                    <Route path="chat/:conversationId?" element={<SaveChatPage />} />
                    <Route path="transport" element={<SaveTransportPage />} />
                    <Route path="orders/:id" element={<SaveOrderDetailPage />} />
                    <Route path="cart" element={<SaveCartPage />} />
                    <Route path="credit" element={<SaveCreditPage />} />
                  </Route>

                  <Route element={<SalesMonitorLayout />}>
                    <Route path="/sales/monitor/*" element={<SalesMonitorRoutes />} />
                  </Route>

                  <Route path="/sales" element={<SalesLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<SalesDashboardPage />} />
                    <Route path="customers" element={<SalesCustomersPage />} />
                    <Route path="enquiries" element={<SalesEnquiriesPage />} />
                    <Route path="enquiries/:threadId" element={<SalesThreadPage />} />
                    <Route path="pipeline" element={<SalesPipelinePage />} />
                    <Route path="order-book" element={<SalesOrderBookPage />} />
                    <Route path="order-book/:id" element={<SalesOrderBookDetailPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;