// src/components/grow/GrowLayout.jsx
// Dedicated layout for the GROW module: its own header, footer and dock.
// /grow          -> compact start flow (no section nav / dock, they only exist on the details page)
// /grow/details  -> full detailed page (section nav + dock)
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { House } from "lucide-react";
import { goTo } from "./scrollTo.js";
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

export default function GrowLayout() {
    const { pathname } = useLocation();
    const isStart = pathname.replace(/\/+$/, "") === "/grow";

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return (
        <div className="gl" id="grow-top">
            <header className="hd">
                <div className="wrap">
                    {isStart ? (
                        <Link className="logo" to="/grow" aria-label="GROW home">GR<i>O</i>W</Link>
                    ) : (
                        <a className="logo" href="#grow-top" onClick={goTo("grow-top")} aria-label="GROW home">GR<i>O</i>W</a>
                    )}

                    {!isStart && (
                        <nav aria-label="Page sections">
                            {NAV.map(([label, id]) => (
                                <a key={id} href={`#${id}`} onClick={goTo(id)}>{label}</a>
                            ))}
                        </nav>
                    )}

                    <Link className="btn" to="/grow?start=1">Start selling</Link>
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <footer className="ft" style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
                <div className="wrap">
                    <span><b>GROW</b> · More buyers. More business. Less selling effort.</span>
                    <span>People • Product • Partnership</span>
                </div>
            </footer>

            {/* <BottomNavStrip /> */}
        </div>
    );
}