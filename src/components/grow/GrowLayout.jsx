// src/components/grow/GrowLayout.jsx
// Dedicated layout for the GROW module: its own header, footer and dock.
// /grow          -> compact start flow (no section nav / dock, they only exist on the details page)
// /grow/details  -> full detailed page (section nav + dock)
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { House } from "lucide-react";
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

                    {isStart
                        ? <Link className="btn ghost" to="/grow/details">Full seller page</Link>
                        : <Link className="btn" to="/grow?start=1">Start selling</Link>}
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

            {!isStart && (
                <nav className="dock" aria-label="Quick links">
                    <a className="dg" href="#grow-credit" onClick={goTo("grow-credit")} aria-label="Growth">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>
                    </a>
                    <a className="dy" href="#grow-pricing" onClick={goTo("grow-pricing")} aria-label="Pricing">₹</a>
                    <Link className="dm" to="/home" aria-label="Home">
                        <House size={22} strokeWidth={1.8} aria-hidden="true" />
                    </Link>
                </nav>
            )}
        </div>
    );
}