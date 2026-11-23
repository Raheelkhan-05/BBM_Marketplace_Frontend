// src/pages/SaveTransportPage.jsx — Transport for buyers. Route: /save/transport (inside SaveLayout).
// Two views:
//   "My agreements" -> TransportAgreementsPanel (replies waiting on you, your suggestions, saved agreements per route;
//                      clicking a row opens the transport card in a modal).
//   "Browse"        -> read-only route library, same UI as the Grow transport page's Browse view.
//                      Same API call: browseTransportLibrary({ originCity, destCity }).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Truck, Search, ArrowRight, Loader2 } from "lucide-react";
import { browseTransportLibrary } from "../utils/api.transport.js";
import {
    routeTransportModeLabel, routeOptionSummary, routeOptionIdentity,
} from "../../shared/routeTransportFields.js";
import TransportAgreementsPanel from "../components/orders/TransportAgreementsPanel.jsx";
import { toTitleCase } from "../components/growSeller/sellerHelpers.js";
import "../components/growSeller/grow-modules.css";
import "../components/orders/transport-agreements.css";

const PAGE = 30; // rows rendered at a time

// Same de-duplication key as the Grow page: one row per origin / destination / mode / transporter.
const normPart = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
const keyOf = (o) => [o.origin_city, o.dest_city, o.mode, routeOptionIdentity(o.mode, o.fields)].map(normPart).join("::");

function RouteCard({ opt }) {
    return (
        <div className="gt-card">
            <span className="gk-ico" style={{ "--a": "var(--k-tt)" }}><Truck /></span>
            <div className="gt-main">
                <b>{routeOptionSummary(opt.mode, opt.fields)}</b>
                <small>
                    <span>{routeTransportModeLabel(opt.mode)}</span> · {" "}
                    <span>{toTitleCase(opt.origin_city)}</span> <ArrowRight size={12} /> <span>{toTitleCase(opt.dest_city)}</span>
                </small>
            </div>
        </div>
    );
}

function BrowseView() {
    const [originCity, setOriginCity] = useState("");
    const [destCity, setDestCity] = useState("");
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [visible, setVisible] = useState(PAGE);
    const seq = useRef(0);

    const run = useCallback(async (from, to) => {
        const my = ++seq.current; // ignore stale responses
        setLoading(true);
        setError(false);
        try {
            const res = await browseTransportLibrary({ originCity: from, destCity: to });
            if (my !== seq.current) return;
            setOptions(res?.options || []);
            setVisible(PAGE);
        } catch {
            if (my !== seq.current) return;
            setOptions([]);
            setError(true);
        }
        setLoading(false);
    }, []);

    useEffect(() => { run("", ""); }, [run]);

    const deduped = useMemo(() => {
        const seen = new Set();
        const out = [];
        for (const opt of options) {
            const k = keyOf(opt);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push({ k, opt });
        }
        return out;
    }, [options]);

    const search = () => run(originCity, destCity);
    const onKey = (e) => { if (e.key === "Enter") search(); };

    return (
        <div className="gt-sec tap">
            <div className="gt-search">
                <div className="gk-field"><label htmlFor="gt-from">From city</label>
                    <input id="gt-from" className="gk-inp" placeholder="e.g. Rajkot" value={originCity} onKeyDown={onKey} onChange={(e) => setOriginCity(e.target.value)} /></div>
                <div className="gk-field"><label htmlFor="gt-to">To city</label>
                    <input id="gt-to" className="gk-inp" placeholder="e.g. Surat" value={destCity} onKeyDown={onKey} onChange={(e) => setDestCity(e.target.value)} /></div>
                <button type="button" className="gk-btn go" style={{ height: 48 }} disabled={loading} onClick={search}>
                    {loading ? <Loader2 size={17} className="gk-spin" /> : <Search size={17} />}Search
                </button>
            </div>

            <div className="gt-list" style={{ marginTop: 16 }} aria-busy={loading}>
                {loading ? [0, 1, 2, 3].map((i) => <div key={i} className="gk-skel" style={{ height: 70 }} />)
                    : error ? (
                        <div className="gk-empty" style={{ gridColumn: "1 / -1" }}>
                            <Truck size={26} /><b>Couldn't load transport options</b>Please try again.
                            <button type="button" className="gk-btn go" onClick={search}>Try again</button>
                        </div>
                    ) : deduped.length === 0 ? (
                        <div className="gk-empty" style={{ gridColumn: "1 / -1" }}><Truck size={26} /><b>No transport options found</b>Try a different city, or check back later.</div>
                    ) : deduped.slice(0, visible).map(({ k, opt }) => <RouteCard key={k} opt={opt} />)}
            </div>

            {!loading && !error && deduped.length > visible && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                    <button type="button" className="gk-btn" onClick={() => setVisible((v) => v + PAGE)}>
                        Show more ({deduped.length - visible} left)
                    </button>
                </div>
            )}
        </div>
    );
}

export default function SaveTransportPage() {
    const [view, setView] = useState("agreements"); // "agreements" | "browse"

    return (
        // `sh-w svc` = the Save page container (width matches the tab bar), the content inside is the Grow UI.
        <div className="sh-w svc">
            <div className="gk gt">
                <div className="gk-ph gk-rise" style={{ "--i": 0 }}>
                    <div>
                        <h1>Transport</h1>
                        <p>Your agreed transport with sellers, and the routes available for delivery.</p>
                    </div>
                </div>

                <div className="gt-top gk-rise" style={{ "--i": 1, marginBottom: 16 }}>
                    <div className="gk-seg" role="group" aria-label="Transport views">
                        <button type="button" aria-pressed={view === "agreements"} onClick={() => setView("agreements")}>My agreements</button>
                        <button type="button" aria-pressed={view === "browse"} onClick={() => setView("browse")}>Browse</button>
                    </div>
                </div>

                {view === "agreements" ? <TransportAgreementsPanel viewer="buyer" /> : <BrowseView />}
            </div>
        </div>
    );
}