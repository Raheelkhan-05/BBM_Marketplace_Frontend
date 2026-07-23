//src/components/BottomNav.jsx

import { useLocation } from "react-router-dom";
import { Home, LayoutGrid, FileText, Package, Store, User } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import SmartLink from "./SmartLink.jsx";

function getAccountNavItem(profile) {
  const status = profile?.seller_status;
  if (status === "approved") return { label: "My Shop", icon: Store, href: `/shop/${profile.shop_slug}` };
  if (status === "draft" || status === "rejected") return { label: "Sell", icon: Store, href: "/seller/onboarding", pending: true };
  if (status === "pending_review") return { label: "Sell", icon: Store, href: "/seller/status", pending: true };
  return { label: "Account", icon: User, href: "/account" };
}

const BASE_ITEMS = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Categories", icon: LayoutGrid, href: "/#" },
  { label: "RFQ", icon: FileText, href: "/#" },
  { label: "Orders", icon: Package, href: "/#" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { isLoggedIn, profile } = useAuth();

  const accountItem = getAccountNavItem(profile);
  const navItems = [...BASE_ITEMS, accountItem];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur-xl md:hidden"
      style={{ boxShadow: "0 -8px 24px -16px rgba(15,23,42,0.15)" }}
    >
      {navItems.map(({ label, icon: Icon, href, pending }) => {
        // "Home" means different things depending on auth state — the
        // guest landing page ("/") vs the logged-in marketplace ("/home").
        const resolvedHref = label === "Home" && !isLoggedIn ? "/" : href;
        const active = pathname === resolvedHref;

        return (
          <SmartLink
            key={label}
            to={resolvedHref}
            className="relative flex flex-col items-center gap-0.5 px-2 py-1"
          >
            <span className="relative">
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.4 : 1.8}
                style={{ color: active ? "#047084" : "#94a3b8" }}
              />
              {pending && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#d2462b] ring-2 ring-white" />
              )}
            </span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: active ? "#047084" : "#94a3b8" }}
            >
              {label}
            </span>
          </SmartLink>
        );
      })}
    </nav>
  );
}