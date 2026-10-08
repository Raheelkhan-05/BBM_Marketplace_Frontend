// src/pages/GrowEnquiryDetailPage.jsx — one shareable enquiry (route: /grow/enquiry/:id).
// Design follows the "You're invited to quote" prototype, made responsive:
//   mobile  -> single column
//   desktop -> enquiry on the left, "why sellers join" / stats / brands in a sticky right column.
// "Quote now" opens RfqQuoteModal as a popup (dummy flow for now).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
    Share2, Moon, Sun, Send, Shuffle, Equal, Wallet, Repeat, MapPin, Clock, Check, ArrowRight, Package,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import RfqQuoteModal from "../components/rfq/RfqQuoteModal.jsx";
import * as rfqApi from "../utils/rfqApi.js";
import { fmtNum, timeAgo, paymentLabel, consumptionLabel, locationSummary } from "../utils/rfqUtils.js";
import { toTitleCase } from "../components/growSeller/sellerHelpers.js";
import { isSellerReady } from "../components/growSeller/growSeller.js";
import { shareEnquiry } from "../utils/rfqShare.js";
import BRAND_LOGOS from "../components/growSeller/brandLogos.js";
import "../components/rfq/growEnquiry.css";

const STATUS_LABEL = { pending_review: "In review", approved: "Live", rejected: "Needs changes", closed: "Closed" };
const WHY = [
    { t: "More buyers", d: "Reach relevant B2B buyers beyond your network.", a: "var(--or)" },
    { t: "Quote in a tap", d: "Answer live enquiries with price, delivery and validity.", a: "var(--bl)" },
    { t: "Pay on orders", d: "Fees start at 0.25%, charged only when an order is generated.", a: "var(--gr)" },
];
const STATS = [["23", "brands listed"], ["50+", "products live"], ["0.25%", "fees from"]];

const readTheme = () => {
    try { return localStorage.getItem("gth") === "dark" ? "dark" : "light"; } catch { return "light"; }
};

// Uses rfqApi.fetchRfqById(token, id, { signal }) -> { success, item } when you add it.
// Until then it pages through the existing list endpoint (max 500 rows) to find the enquiry.
async function findEnquiry(token, id, signal) {
    if (typeof rfqApi.fetchRfqById === "function") return rfqApi.fetchRfqById(token, id, { signal });
    const LIMIT = 50;
    let offset = 0;
    for (let page = 0; page < 10; page++) {
        const res = await rfqApi.fetchRfqList(token, { scope: "all", q: "", status: "", limit: LIMIT, offset, signal });
        if (!res.success) return res;
        const hit = (res.items || []).find((i) => String(i.id) === String(id));
        if (hit) return { success: true, item: hit };
        if (!res.hasMore) break;
        offset += LIMIT;
    }
    return { success: false, message: "This enquiry is no longer available." };
}

function copyFor(item) {
    if (item.status === "closed") {
        return { pill: "Closed", tone: "off", h: ["This enquiry is closed.", "No longer taking quotes."], lead: "The buyer has stopped collecting quotes on this one. Browse other live enquiries instead." };
    }
    if (item.isMine) {
        const live = item.status === "approved";
        return {
            pill: STATUS_LABEL[item.status] || item.status, tone: live ? "" : "warn",
            h: ["This is your enquiry.", live ? "Share it to get quotes." : "We are reviewing it."],
            lead: live ? "Anyone with the link can see it and send you a quote." : "Our team reviews every enquiry before it goes live to suppliers.",
        };
    }
    return {
        pill: "You are invited to quote", tone: "",
        h: ["A buyer needs this.", "Send your best price."],
        lead: "Quote in about a minute. Win the order, and grow your business with more buyers like this one.",
    };
}

export default function GrowEnquiryDetailPage() {
    const { id } = useParams();
    const location = useLocation();
    const nav = useNavigate();
    const { token, isLoggedIn, profile, needsOnboarding, initializing } = useAuth();

    // Not signed in (or signed-in but not a ready seller): send them through the start flow at /grow?start=1.
    // `from` brings them back to this exact enquiry once login / onboarding is done.
    const goToStart = () => nav("/grow?start=1", { state: { from: `${location.pathname}${location.search}` } });
    const isReady = isLoggedIn && !needsOnboarding && isSellerReady(profile, token);

    const seeded = location.state?.enquiry && String(location.state.enquiry.id) === String(id) ? location.state.enquiry : null;
    const [item, setItem] = useState(seeded);
    const [loading, setLoading] = useState(!seeded);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [theme, setTheme] = useState(readTheme);
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [quoted, setQuoted] = useState(false);
    const [toast, setToast] = useState("");
    const toastTimer = useRef(null);
    const joinRef = useRef(null);

    const say = (m) => {
        setToast(m);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(""), 2200);
    };
    useEffect(() => () => clearTimeout(toastTimer.current), []);

    useEffect(() => {
        const prev = document.title;
        document.title = item ? `${toTitleCase(item.productName)} · Quote request | GROW` : "You're invited to quote | GROW";
        return () => { document.title = prev; };
    }, [item]);

    useEffect(() => {
        if (seeded) { setItem(seeded); setLoading(false); setError(null); return undefined; }
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);
        setQuoted(false);
        findEnquiry(token, id, ctrl.signal)
            .then((res) => {
                if (ctrl.signal.aborted) return;
                if (res?.success && res.item) setItem(res.item);
                else { setItem(null); setError(res?.message || "Couldn't load this enquiry."); }
            })
            .catch((e) => {
                if (e?.name === "AbortError") return;
                setItem(null);
                setError("Couldn't load this enquiry. Check your connection and try again.");
            })
            .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
        return () => ctrl.abort();
    }, [id, token, seeded, reloadKey]);

    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        try { localStorage.setItem("gth", next); } catch { /* storage unavailable */ }
    };

    const onShare = async () => {
        const r = await shareEnquiry(item || { id });
        if (r === "copied") say("Link copied. Share it with sellers");
        else if (r === "failed") say("Copy the page address to share");
    };

    const onQuoteClick = () => {
        if (initializing) return; // button is disabled meanwhile; guards a fast double tap
        if (!isReady) { goToStart(); return; }
        setQuoteOpen(true);
    };

    const onQuoteDone = () => {
        setQuoteOpen(false);
        setQuoted(true);
        say("Quote sent to the buyer");
        setTimeout(() => joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    };

    const copy = item ? copyFor(item) : null;
    const total = item ? Number(item.quantity) * Number(item.packSize) : 0;
    const published = item ? item.publishedAt || item.createdAt : null;
    const pubDate = published ? new Date(published) : null;
    const pubText = pubDate && !Number.isNaN(pubDate.getTime())
        ? pubDate.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
    const canQuote = !!item && item.status === "approved" && !item.isMine;

    return (
        <div className="ged ged-page" data-theme={theme}>
            <header className="ged-hd">
                <div className="ged-hd-in">
                    <Link className="ged-logo" to="/grow">GR<i>O</i>W</Link>
                    <span className="ged-sp" />
                    <button className="ged-pill" type="button" onClick={onShare}><Share2 className="ged-ic" />Share</button>
                    {/* <button className="ged-ib" type="button" aria-label="Switch theme" onClick={toggleTheme}>
                        {theme === "light" ? <Moon className="ged-ic" /> : <Sun className="ged-ic" />}
                    </button> */}
                </div>
            </header>

            <div className="ged-w">
                <div className="ged-grid">
                    <main className="ged-main">
                        {loading && (
                            <div className="ged-card ged-sk" style={{ marginTop: 28 }} aria-busy="true" aria-label="Loading enquiry">
                                <i /><i /><i /><i />
                            </div>
                        )}

                        {!loading && error && (
                            <div className="ged-card ged-empty" style={{ marginTop: 28 }} role="alert">
                                <h2>We couldn't open this enquiry</h2>
                                <p>{error}</p>
                                <div className="row">
                                    <button type="button" className="ged-btn go" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
                                    {!isLoggedIn
                                        ? <button type="button" className="ged-btn" onClick={goToStart}>Log in to view</button>
                                        : <button type="button" className="ged-btn" onClick={() => nav("/grow/enquiries")}>See all enquiries</button>}
                                </div>
                            </div>
                        )}

                        {!loading && item && copy && (
                            <>
                                <span className={`ged-inv ${copy.tone}`}><i />{copy.pill}</span>
                                <h1 className="ged-h1">{copy.h[0]}<br /><em>{copy.h[1]}</em></h1>
                                <p className="ged-lead">{copy.lead}</p>

                                <article className="ged-card">
                                    <div className="ged-rt">
                                        <div className="ged-th">
                                            {item.images?.[0] ? <img src={item.images[0]} alt={item.productName} /> : <Package aria-hidden="true" />}
                                        </div>
                                        <div className="ged-ri">
                                            <h2>{toTitleCase(item.productName)}</h2>
                                            <b className="ged-q">{fmtNum(item.quantity)} Pack{item.quantity === 1 ? "" : "s"} × {fmtNum(item.packSize)} {item.unit}</b>
                                            <small>Total {fmtNum(total)} {item.unit}</small><br />
                                            <span className="ged-eq">
                                                {item.acceptEquivalent ? <><Shuffle className="ged-ic" />Equivalent OK</> : <><Equal className="ged-ic" />Same product only</>}
                                            </span>
                                        </div>
                                    </div>

                                    {item.specifications && <p className="ged-ds">{item.specifications}</p>}
                                    <ul className="ged-mt">
                                        <li><Wallet className="ged-ic" /><span>{paymentLabel(item)}</span></li>
                                        <li><Repeat className="ged-ic" /><span>{consumptionLabel(item)}</span></li>
                                        <li><MapPin className="ged-ic" /><span>Deliver to {item.deliveryCity}, {item.deliveryState}</span></li>
                                        <li><MapPin className="ged-ic" /><span>Suppliers: {locationSummary(item.supplierLocations)}</span></li>
                                    </ul>

                                    {item.isMine && item.status === "rejected" && item.reviewNote && <p className="ged-note">{item.reviewNote}</p>}
                                    {item.isMine && item.status === "pending_review" && <p className="ged-note">Our team is reviewing this. It will go live once approved.</p>}

                                    <div className="ged-rf">
                                        <div className="ged-tm">
                                            <Clock className="ged-ic" />
                                            <span><b>{timeAgo(published)}</b>{pubText && <small>{pubText}</small>}</span>
                                        </div>
                                        {canQuote && (quoted
                                            ? <span className="ged-qd"><Check className="ged-ic" />Quote sent</span>
                                            : <button type="button" className="ged-btn go" onClick={() => setQuoteOpen(true)}><Send className="ged-ic" />Quote now</button>)}
                                    </div>
                                </article>

                                {quoted && (
                                    <section className="ged-join ged-in" ref={joinRef} style={{ scrollMarginTop: 90 }}>
                                        <h3>Win more orders like this.</h3>
                                        <p>Join GROW to see live enquiries, quote in a tap and manage orders, all in one place. Your mobile number is already verified.</p>
                                        <Link className="ged-btn go blk" to="/seller/onboarding">Set up my seller profile <ArrowRight className="ged-ic" /></Link>
                                        <Link className="ged-btn blk" to="/grow/details">See how GROW works</Link>
                                    </section>
                                )}
                            </>
                        )}
                    </main>

                    <aside className="ged-side">
                        <p className="ged-cap">Why sellers join</p>
                        <div className="ged-why">
                            {WHY.map((w) => (
                                <div key={w.t} style={{ "--a": w.a }}><b>{w.t}</b><span>{w.d}</span></div>
                            ))}
                        </div>
                        <div className="ged-stt">
                            {STATS.map(([n, l]) => (<div key={l}><b>{n}</b><span>{l}</span></div>))}
                        </div>
                        <div className="ged-lg" aria-label="Brands already on the marketplace">
                            {BRAND_LOGOS.map((l) => (
                                <div key={l.name}>{l.src ? <img src={l.src} alt={l.name} loading="lazy" /> : <span>{l.name}</span>}</div>
                            ))}
                        </div>
                    </aside>
                </div>

                <footer className="ged-ft">
                    <b>BBM Marketplace</b> · More buyers. More business. Less selling effort.<br />People • Product • Partnership
                </footer>
            </div>

            <div className={`ged-toast ${toast ? "on" : ""}`} role="status">{toast}</div>

            {createPortal(
                <AnimatePresence>
                    {quoteOpen && item && (
                        <RfqQuoteModal key="quote" enquiry={item} theme={theme} onClose={() => setQuoteOpen(false)} onDone={onQuoteDone} />
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}