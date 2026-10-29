// Orders tab shell: Marketplace (/grow/orders) | Internal Orders (/grow/order-book)
// Stays mounted while the sub-tabs switch, so there is no refresh and no flicker.
import { Link, Outlet, useLocation } from "react-router-dom";
import useGrowBadges from "./useGrowBadges.js";
import useOrderBookPending from "../../hooks/useOrderBookPending.js";

const SEGS = [
    { key: "market", to: "/grow/orders", label: "Marketplace", color: "#22A06B" },
    { key: "internal", to: "/grow/order-book", label: "Internal Orders", color: "#6D3FD1" },
];

export default function GrowOrdersShell() {
    const { pathname } = useLocation();
    const counts = useGrowBadges();
    const pendingOB = useOrderBookPending();
    const activeKey = pathname.startsWith("/grow/order-book") ? "internal" : "market";
    const badge = { market: counts.orders || 0, internal: pendingOB || 0 };

    return (
        <>
            <div role="tablist" aria-label="Order type"
                style={{ display: "flex", gap: 4, padding: 4, margin: "14px 0 4px", borderRadius: 14, background: "#EEF1F2" }}>
                {SEGS.map((s) => {
                    const on = s.key === activeKey;
                    const n = badge[s.key];
                    return (
                        <Link key={s.key} to={s.to} role="tab" aria-selected={on} draggable={false}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                padding: "9px 10px", borderRadius: 11, fontSize: 13, fontWeight: 700,
                                textDecoration: "none", transition: "background .15s, color .15s",
                                background: on ? s.color : "transparent",
                                color: on ? "#fff" : "#5B6B72",
                                boxShadow: on ? "0 1px 3px rgba(0,0,0,.15)" : "none",
                            }}>
                            {s.label}
                            {n > 0 && (
                                <span style={{
                                    minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, fontSize: 10.5,
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    background: on ? "rgba(255,255,255,.25)" : s.color, color: "#fff",
                                }}>{n > 99 ? "99+" : n}</span>
                            )}
                        </Link>
                    );
                })}
            </div>
            <Outlet />
        </>
    );
}