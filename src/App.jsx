// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest, RequireAdmin } from "./components/RouteGuards.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import HomePage from "./pages/HomePage.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import SellerOnboardingPage from "./pages/SellerOnboardingPage.jsx";
import AdminSellersPage from "./pages/admin/AdminSellersPage.jsx";
import AdminSellerDetailPage from "./pages/admin/AdminSellerDetailPage.jsx";
import AdminManageAdminsPage from "./pages/admin/AdminManageAdminsPage.jsx";
import ShopPage from "./pages/ShopPage.jsx";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<AuthPage />} />
          </Route>

          <Route element={<Layout />}>
            <Route path="/" element={<RequireGuest><LandingPage /></RequireGuest>} />
            <Route path="/search" element={<RequireGuest><SearchResultsPage /></RequireGuest>} />
            <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/seller/onboarding" element={<RequireAuth><SellerOnboardingPage/></RequireAuth>} />
            <Route path="/admin/sellers" element={<RequireAdmin><AdminSellersPage /></RequireAdmin>} />
            <Route path="/admin/sellers/:id" element={<RequireAdmin><AdminSellerDetailPage /></RequireAdmin>} />
            <Route path="/admin/admins" element={<RequireAdmin><AdminManageAdminsPage /></RequireAdmin>} />
            <Route path="/shop/:slug" element={<ShopPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;