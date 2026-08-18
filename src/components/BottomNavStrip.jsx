// components/BottomNavStrip.jsx
//
// Mobile-only. Same nav items as Header's desktop row, rendered as a
// single horizontally-scrollable strip fixed to the bottom of the
// screen — replaces stuffing these into the slide-out "more" menu,
// which buried primary navigation behind an extra tap.
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { NAV_ITEMS } from "./navItems.js";

const C = { ink: "#141B22", muted: "#5B6672", secondary: "#0B7285", hair: "rgba(20,27,34,0.09)" };

export default function BottomNavStrip({ onOpenRfq }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { isLoggedIn, profile } = useAuth();
    const isApprovedSeller = profile?.seller_status === "approved";

    const items = NAV_ITEMS({ isLoggedIn, isApprovedSeller, onOpenRfq, navigate });

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-white backdrop-blur-md md:hidden"
            style={{ borderColor: C.hair, paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((it) => {
                    const Icon = it.icon;
                    const active = it.match(pathname);
                    return (
                        <button
                            key={it.id}
                            onClick={it.onClick}
                            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-150"
                            style={{
                                color: active ? "#fff" : C.ink,
                                background: active ? C.secondary : "rgba(20,27,34,0.045)",
                            }}
                        >
                            <Icon className="h-3.5 w-3.5" style={{ color: active ? "#fff" : C.muted }} />
                            {it.label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}