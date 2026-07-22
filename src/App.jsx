// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RequireAuth, RequireGuest } from "./components/RouteGuards.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import HomePage from "./pages/HomePage.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";

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
            {/* <Route path="/login" element={<RequireGuest><AuthPage /></RequireGuest>} /> */}
            <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;