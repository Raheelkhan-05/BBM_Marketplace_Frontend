// Layout for the SAVE (buyer) page: same header and footer as GrowLayout.
// The floating dock now comes from AppShell (one shared copy for the whole app).
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { goTo } from "../grow/scrollTo.js";
import SmartLink from "../SmartLink.jsx";
import { MENU_ROUTES } from "../menuItems.js";
import "./save.css";

const NAV = [
    ["Find", "save-find"],
    ["Compare", "save-info"],
    ["Savings", "save-price"],
    ["Delivery", "save-delivery"],
    ["Orders", "save-orders"],
    ["Terms", "save-credit"],
];

export default function SaveLayout() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return (
        <div className="sv" id="save-top">
            <header className="hd">
                <div className="wrap">
                    <SmartLink
                        to="/"
                        aria-label="BBM home"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: 0,
                            textDecoration: "none",
                            color: "#08222B",
                        }}
                    >
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
                    </SmartLink>
                    <nav aria-label="Page sections">
                        {NAV.map(([label, id]) => (
                            <a key={id} href={`#${id}`} onClick={goTo(id)}>{label}</a>
                        ))}
                    </nav>
                    <Link className="btn" to={MENU_ROUTES.home}>Start buying</Link>
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <footer className="ft">
                <div className="wrap">
                    <span><b>BBM Marketplace</b> · Better buying. Better choices. Better savings.</span>
                    <span>People • Product • Partnership</span>
                </div>
            </footer>
        </div>
    );
}