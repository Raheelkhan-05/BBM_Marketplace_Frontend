//src/components/BottomNav.jsx

import { useLocation } from "react-router-dom";
import { Home, LayoutGrid, FileText, Package, User } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import SmartLink from "./SmartLink.jsx";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Categories", icon: LayoutGrid, href: "/#" },
  { label: "RFQ", icon: FileText, href: "/#" },
  { label: "Orders", icon: Package, href: "/#" },
  { label: "Account", icon: User, href: "/#" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur-xl md:hidden"
      style={{ boxShadow: "0 -8px 24px -16px rgba(15,23,42,0.15)" }}
    >
      {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
        // "Home" means different things depending on auth state — the
        // guest landing page ("/") vs the logged-in marketplace ("/home").
        const resolvedHref = label === "Home" && !isLoggedIn ? "/" : href;
        const active = pathname === resolvedHref;

        return (
          <SmartLink
            key={label}
            to={resolvedHref}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
          >
            <Icon
              className="h-[22px] w-[22px]"
              strokeWidth={active ? 2.4 : 1.8}
              style={{ color: active ? "#047084" : "#94a3b8" }}
            />
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