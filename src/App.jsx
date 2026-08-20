// src/App.jsx
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards.jsx";
import ScrollToTop from "./lib/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import HomePage from "./pages/HomePage.jsx";
import CatalogLevelPage from "./pages/CatalogLevelPage.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import SellerOnboardingPage from "./pages/SellerOnboardingPage.jsx";
import SellerStatusPage from "./pages/SellerStatusPage.jsx";
import AdminSellersPage from "./pages/admin/AdminSellersPage.jsx";
import AdminSellerDetailPage from "./pages/admin/AdminSellerDetailPage.jsx";
import AdminManageAdminsPage from "./pages/admin/AdminManageAdminsPage.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import ShopRoute from "./pages/ShopRoute.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CategoryLandingPage from "./pages/CategoryLandingPage.jsx";
import SubcategoryLandingPage from "./pages/SubcategoryLandingPage.jsx";
import AdminCatalogReviewPage from "./pages/admin/AdminCatalogReviewPage.jsx";
import AdminCatalogDetailPage from "./pages/admin/AdminCatalogDetailPage.jsx";
import BrandDetailPage from "./pages/BrandDetailPage.jsx";
import BrandFamilyPage from "./pages/BrandFamilyPage.jsx";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy.jsx";
import SellPublishProductPage from "./pages/SellPublishProductPage.jsx";
import AdminSellerSubmissionsPage from "./pages/admin/AdminSellerSubmissionsPage.jsx";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage.jsx";
import SalesOrdersPage from "./pages/SalesOrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import SellerOrderDetailPage from "./pages/SellerOrderDetailPage.jsx";
import BrowsePage from "./pages/BrowsePage.jsx";
import GenericProductSellersPage from "./pages/GenericProductSellersPage.jsx";
import CategoryProductsPage from "./pages/CategoryProductsPage.jsx";
import GenericProductBrandsPage from "./pages/GenericProductBrandsPage.jsx";
import BrandItemSellersPage from "./pages/BrandItemSellersPage.jsx";
import SellerManageListingsPage from "./pages/SellerManageListingsPage.jsx";
import InstallAppPrompt from "./components/InstallAppPrompt.jsx";
import PendingSubmissionWatcher from "./components/PendingSubmissionWatcher.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";


function CatalogLevelPageWithKey({ configKey }) {
  const { idOrSlug } = useParams();
  return <CatalogLevelPage key={idOrSlug || "root"} configKey={configKey} />;
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <ScrollToTop />
          <InstallAppPrompt />
          {/*
          Runs on every page, app-wide. If the user has a product listing
          draft cached locally (because they tried to submit before being
          an approved seller), this silently checks seller access and
          auto-submits that draft the moment they become approved —
          e.g. right after finishing onboarding, or once admin approves
          their shop — without requiring them to revisit the listing form.
        */}
          <PendingSubmissionWatcher />
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

              <Route path="/orders" element={<PurchaseOrdersPage />} />
              <Route path="/seller/orders" element={<SalesOrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
              <Route path="/seller/listings" element={<SellerManageListingsPage />} />

              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:conversationId" element={<ChatPage />} />

              <Route path="/seller/onboarding" element={<RequireAuth><SellerOnboardingPage /></RequireAuth>} />
              <Route path="/seller/status" element={<RequireAuth><SellerStatusPage /></RequireAuth>} />

              <Route path="/seller/sell" element={<SellPublishProductPage />} />

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
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;