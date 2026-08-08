// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards.jsx";
import ScrollToTop from "./lib/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import HomePage from "./pages/HomePage.jsx";

import NewHomePage from "./pages/NewHomePage.jsx";

import HomePageSkeleton from "./components/skeletons/HomePageSkeleton.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import SellerOnboardingPage from "./pages/SellerOnboardingPage.jsx";
import SellerStatusPage from "./pages/SellerStatusPage.jsx";
import AdminSellersPage from "./pages/admin/AdminSellersPage.jsx";
import AdminSellerDetailPage from "./pages/admin/AdminSellerDetailPage.jsx";
import AdminManageAdminsPage from "./pages/admin/AdminManageAdminsPage.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import ShopRoute from "./pages/ShopRoute.jsx";
// import HierarchySearchPage from "./pages/HierarchySearchPage.jsx";
import CatalogHierarchySearchPage from "./pages/CatalogHierarchySearchPage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CategoryLandingPage from "./pages/CategoryLandingPage.jsx";
import SubcategoryLandingPage from "./pages/SubcategoryLandingPage.jsx";
import AdminCatalogReviewPage from "./pages/admin/AdminCatalogReviewPage.jsx";
import AdminCatalogDetailPage from "./pages/admin/AdminCatalogDetailPage.jsx";
import BrandDetailPage from "./pages/BrandDetailPage.jsx";
import BrandFamilyPage from "./pages/BrandFamilyPage.jsx";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy.jsx";
import CategorySubcategoriesPage from "./pages/CategorySubcategoriesPage";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import SubcategoryGenericProductsPage from "./pages/SubcategoryGenericProductsPage";
import GenericProductBrandsPage from "./pages/GenericProductBrandsPage";
import BrandItemSellersPage from "./pages/BrandItemSellersPage";
import SellPublishProductPage from "./pages/SellPublishProductPage.jsx";
import AdminSellerSubmissionsPage from "./pages/admin/AdminSellerSubmissionsPage.jsx";



function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />

        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<AuthPage />} />
          </Route>

          <Route element={<Layout />}>
            <Route path="/" element={<RequireGuest><LandingPage /></RequireGuest>} />

            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/category/:idOrSlug/subcategories" element={<CategorySubcategoriesPage />} />
            <Route path="/subcategory/:idOrSlug/products" element={<SubcategoryGenericProductsPage />} />
            <Route path="/product/:idOrSlug/brands" element={<GenericProductBrandsPage />} />
            <Route path="/brand-item/:idOrSlug/sellers" element={<BrandItemSellersPage />} />
            <Route path="/categories" element={<CategoriesPage />} />

            {/* <Route path="/home" element={<RequireAuth fallback={<HomePageSkeleton />}><NewHomePage /></RequireAuth>} /> */}
            <Route path="/seller/onboarding" element={<RequireAuth><SellerOnboardingPage /></RequireAuth>} />
            <Route path="/seller/status" element={<RequireAuth><SellerStatusPage /></RequireAuth>} />

            <Route path="/seller/sell" element={<SellPublishProductPage />} />

            <Route path="/admin/listings" element={<RequireAdmin><AdminSellerSubmissionsPage /></RequireAdmin>} />
            <Route path="/admin/sellers" element={<RequireAdmin><AdminSellersPage /></RequireAdmin>} />
            <Route path="/admin/sellers/:id" element={<RequireAdmin><AdminSellerDetailPage /></RequireAdmin>} />
            <Route path="/admin/admins" element={<RequireAdmin><AdminManageAdminsPage /></RequireAdmin>} />
            <Route path="/shop/:slug" element={<ShopRoute />} />
            {/* <Route path="/browse" element={<HierarchySearchPage />} /> */}
            <Route path="/browse-search" element={<CatalogHierarchySearchPage />} />
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
    </AuthProvider>
  );
}

export default App;