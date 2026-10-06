// src/components/grow/GrowLayout.jsx
// Dedicated layout for the GROW module: its own header, footer and dock.
// It intentionally does NOT render the main app Header / Footer / BottomNavStrip.

import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { MENU_ROUTES } from "../menuItems.js";
import { goTo } from "./scrollTo.js";
import "./grow.css";

const NAV = [
    ["Buyers", "grow-buyers"],
    ["Catalogue", "grow-catalogue"],
    ["Pricing", "grow-pricing"],
    ["Delivery", "grow-delivery"],
    ["Sales", "grow-sales"],
    ["Credit", "grow-credit"],
];

export default function GrowLayout() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="gl" id="grow-top">
            <header className="hd">
                <div className="wrap">
                    <a className="logo" href="#grow-top" onClick={goTo("grow-top")} aria-label="GROW home">
                        GR<i>O</i>W
                    </a>
                    <nav aria-label="Page sections">
                        {NAV.map(([label, id]) => (
                            <a key={id} href={`#${id}`} onClick={goTo(id)}>{label}</a>
                        ))}
                    </nav>
                    <Link className="btn" to={MENU_ROUTES.manageProducts}>Start selling</Link>
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <footer className="ft">
                <div className="wrap">
                    <span><b>GROW</b> · More buyers. More business. Less selling effort.</span>
                    <span>People • Product • Partnership</span>
                </div>
            </footer>

            <nav className="dock" aria-label="Quick links">
                <a className="dg" href="#grow-credit" onClick={goTo("grow-credit")} aria-label="Growth">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>
                </a>
                <a className="dy" href="#grow-pricing" onClick={goTo("grow-pricing")} aria-label="Pricing">₹</a>
                <a className="dm" href="#grow-top" onClick={goTo("grow-top")} aria-label="Back to top">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                </a>
            </nav>
        </div>
    );
}