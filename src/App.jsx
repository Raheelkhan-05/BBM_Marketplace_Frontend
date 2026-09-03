// src/App.jsx
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards.jsx";
import ScrollToTop from "./lib/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import InstallAppPrompt from "./components/InstallAppPrompt.jsx";
import PendingSubmissionWatcher from "./components/PendingSubmissionWatcher.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import PendingPaymentGate from './components/PendingPaymentGate.jsx';
import ContactsBootstrapper from "./components/ContactsBootstrapper.jsx";
import DeferredMount from "./components/DeferredMount.jsx";
import { routeImports, preloadRoutesWhenIdle } from "./routePreload.js";

// Every page below is now its own JS chunk instead of one bundle that
// includes admin/seller/chat/catalog-review code on a first-time
// visitor's home-page load. Pages registered in routeImports use that
// SAME import function here, so a prefetch triggered from routePreload.js
// (hover, idle) warms exactly the chunk this lazy() will resolve from.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"));
const HomePage = lazy(routeImports["/home"]);
const CatalogLevelPage = lazy(() => import("./pages/CatalogLevelPage.jsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const SellerOnboardingPage = lazy(() => import("./pages/SellerOnboardingPage.jsx"));
const SellerStatusPage = lazy(() => import("./pages/SellerStatusPage.jsx"));
const AdminSellersPage = lazy(() => import("./pages/admin/AdminSellersPage.jsx"));
const AdminSellerDetailPage = lazy(() => import("./pages/admin/AdminSellerDetailPage.jsx"));
const AdminManageAdminsPage = lazy(() => import("./pages/admin/AdminManageAdminsPage.jsx"));
const ShopRoute = lazy(() => import("./pages/ShopRoute.jsx"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage.jsx"));
const CategoryLandingPage = lazy(() => import("./pages/CategoryLandingPage.jsx"));
const SubcategoryLandingPage = lazy(() => import("./pages/SubcategoryLandingPage.jsx"));
const AdminCatalogReviewPage = lazy(() => import("./pages/admin/AdminCatalogReviewPage.jsx"));
const AdminCatalogDetailPage = lazy(() => import("./pages/admin/AdminCatalogDetailPage.jsx"));
const BrandDetailPage = lazy(() => import("./pages/BrandDetailPage.jsx"));
const BrandFamilyPage = lazy(() => import("./pages/BrandFamilyPage.jsx"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy.jsx"));
const SellPublishProductPage = lazy(routeImports["/seller/sell"]);
const AdminSellerSubmissionsPage = lazy(() => import("./pages/admin/AdminSellerSubmissionsPage.jsx"));
const OrdersPage = lazy(routeImports["/orders"]);
const SalesOrdersPage = lazy(() => import("./pages/SalesOrdersPage.jsx"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage.jsx"));
const SellerOrderDetailPage = lazy(() => import("./pages/SellerOrderDetailPage.jsx"));
const BrowsePage = lazy(() => import("./pages/BrowsePage.jsx"));
const GenericProductSellersPage = lazy(() => import("./pages/GenericProductSellersPage.jsx"));
const CategoryProductsPage = lazy(() => import("./pages/CategoryProductsPage.jsx"));
const GenericProductBrandsPage = lazy(() => import("./pages/GenericProductBrandsPage.jsx"));
const BrandItemSellersPage = lazy(() => import("./pages/BrandItemSellersPage.jsx"));
const SellerManageListingsPage = lazy(routeImports["/seller/listings"]);
const ChatPage = lazy(routeImports["/chat"]);
const PaymentVerificationPage = lazy(() => import('./pages/admin/PaymentVerificationPage.jsx'));
const AdminFullCatalogUploadPage = lazy(() => import('./pages/admin/AdminFullCatalogUploadPage.jsx'));
const CartPage = lazy(routeImports["/cart"]);
const AdminWalletSellersPage = lazy(() => import("./pages/admin/AdminWalletSellersPage.jsx"));
const SellerWalletPage = lazy(routeImports["/seller/wallet"]);
const AdminDatabasePanel = lazy(() => import("./pages/admin/AdminDatabasePanel.jsx"));
const AdminProductCommissionsPage = lazy(() => import("./pages/admin/AdminProductCommissionsPage.jsx"));
const SellerEditListingPage = lazy(() => import("./pages/SellerEditListingPage.jsx"));

function CatalogLevelPageWithKey({ configKey }) {
  const { idOrSlug } = useParams();
  return <CatalogLevelPage key={idOrSlug || "root"} configKey={configKey} />;
}

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
            <ContactsBootstrapper />
          </DeferredMount>

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<AuthPage />} />
              </Route>

              <Route element={<Layout />}>
                <Route path="/" element={<RequireGuest><LandingPage /></RequireGuest>} />

                <Route path="/search" element={<SearchResultsPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/product/:idOrSlug/sellers" element={<GenericProductSellersPage />} />
                <Route path="/categories" element={<CatalogLevelPageWithKey configKey="categories" />} />

                <Route path="/category/:idOrSlug/browse" element={<BrowsePage />} />
                <Route path="/browse" element={<BrowsePage />} />

                <Route path="/category/:idOrSlug/products" element={<CategoryProductsPage />} />
                <Route path="/product/:idOrSlug/brands" element={<GenericProductBrandsPage />} />
                <Route path="/brand-item/:idOrSlug/sellers" element={<BrandItemSellersPage />} />

                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/seller/orders" element={<SalesOrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
                <Route path="/seller/listings" element={<SellerManageListingsPage />} />

                <Route path="/admin/payments" element={<PaymentVerificationPage />} />

                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatPage />} />

                {/* <Route path="/seller/onboarding" element={<RequireAuth><SellerOnboardingPage /></RequireAuth>} /> */}
                <Route path="/seller/status" element={<RequireAuth><SellerStatusPage /></RequireAuth>} />

                <Route path="/seller/sell" element={<SellPublishProductPage />} />
                <Route path="/seller/sell/:id/edit" element={<SellerEditListingPage />} />

                <Route path="/cart" element={<CartPage />} />

                <Route path="/admin/wallets" element={<AdminWalletSellersPage />} />

                <Route path="/seller/wallet" element={<SellerWalletPage />} />

                <Route path="/admin/database" element={<AdminDatabasePanel />} />

                <Route path="/admin/product-commisions" element={<AdminProductCommissionsPage />} />

                <Route path="/admin/catalog/bulk-upload" element={<AdminFullCatalogUploadPage />} />

                <Route path="/admin/listings" element={<RequireAdmin><AdminSellerSubmissionsPage /></RequireAdmin>} />
                <Route path="/admin/sellers" element={<RequireAdmin><AdminSellersPage /></RequireAdmin>} />
                <Route path="/admin/sellers/:id" element={<RequireAdmin><AdminSellerDetailPage /></RequireAdmin>} />
                <Route path="/admin/admins" element={<RequireAdmin><AdminManageAdminsPage /></RequireAdmin>} />
                <Route path="/shop/:slug" element={<ShopRoute />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />

                <Route path="/admin/catalog" element={<RequireAdmin><AdminCatalogReviewPage /></RequireAdmin>} />
                <Route path="/admin/catalog/:level/:id" element={<RequireAdmin><AdminCatalogDetailPage /></RequireAdmin>} />

                <Route path="/category/:idOrSlug" element={<CategoryLandingPage />} />
                <Route path="/subcategory/:idOrSlug" element={<SubcategoryLandingPage />} />
                <Route path="/brand/:idOrSlug" element={<BrandDetailPage />} />
                <Route path="/brand-family/:brandName" element={<BrandFamilyPage />} />

                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;