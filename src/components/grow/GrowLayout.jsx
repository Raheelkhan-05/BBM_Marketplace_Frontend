// src/components/grow/GrowLayout.jsx
// Dedicated layout for the GROW module: its own header, footer and dock.
// /sell          -> compact start flow (no section nav / dock, they only exist on the details page)
// /sell/details  -> full detailed page (section nav + dock)
//
// The header "Start selling" button is only for people who are NOT yet onboarded sellers.
// It is also hidden while the profile of a stored session is still loading, so an onboarded
// seller never sees it flash in and out.
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { goTo } from "./scrollTo.js";
import PublicFooter from "../PublicFooter.jsx";
import SmartLink from "../SmartLink.jsx";
import useSellerReady from "./useSellerReady.js";
import { track } from "../../lib/analytics.js";
import "./grow.css";
// import BottomNavStrip from "../BottomNavStrip.jsx";

const NAV = [
    ["Buyers", "grow-buyers"],
    ["Catalogue", "grow-catalogue"],
    ["Pricing", "grow-pricing"],
    ["Delivery", "grow-delivery"],
    ["Sales", "grow-sales"],
    ["Credit", "grow-credit"],
];

const BRAND_LINK_STYLE = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    textDecoration: "none",
    color: "#08222B",
};

// Logo + "BBM" wordmark, shared by both header variants.
function BrandMark() {
    return (
        <>
            <span
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    background: "#FFFFFF",
                    padding: "4px 0px",
                }}
            >
                <img
                    src="/Logo.png"
                    alt="BBM"
                    style={{
                        display: "block",
                        height: "28px",
                        width: "auto",
                        objectFit: "contain",
                    }}
                />
            </span>

            <span
                style={{
                    fontFamily: '"Bricolage Grotesque", "Figtree", system-ui, sans-serif',
                    fontWeight: 800,
                    fontSize: "1.125rem",
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                }}
            >
                BBM
            </span>
        </>
    );
}

export default function GrowLayout() {
    const { pathname } = useLocation();
    const isStart = pathname.replace(/\/+$/, "") === "/sell";
    const { ready, initializing } = useSellerReady();
    const showStartSelling = !initializing && !ready;

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return (
        <div className="gl" id="grow-top">
            <header className="hd">
                <div className="wrap">
                    {isStart ? (
                        <SmartLink to="/" aria-label="BBM home" style={BRAND_LINK_STYLE}>
                            <BrandMark />
                        </SmartLink>
                    ) : (
                        <a href="#grow-top" onClick={goTo("grow-top")} aria-label="BBM home" style={BRAND_LINK_STYLE}>
                            <BrandMark />
                        </a>
                    )}

                    {!isStart && (
                        <nav aria-label="Page sections">
                            {NAV.map(([label, id]) => (
                                <a key={id} href={`#${id}`} onClick={goTo(id)}>{label}</a>
                            ))}
                        </nav>
                    )}

                    {showStartSelling && (
                        <Link
                            className="btn"
                            to="/sell?start=1"
                            onClick={() => track("seller_cta_clicked", { placement: "header" })}
                        >
                            Start selling
                        </Link>
                    )}
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <PublicFooter dock />

            {/* <BottomNavStrip /> */}
        </div>
    );
}