// Shared by GrowTransportPage (viewer="seller") and SaveTransportPage (viewer="buyer").
// Same data as the order pages: open suggestions (accept / decline right here) + saved agreements (seller + buyer + route).
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, ArrowRight, Check, X, Loader2, Handshake } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import useOrderTransportSummary from "../../hooks/useOrderTransportSummary.js";
import { fetchTransportAgreements, endTransportAgreement, acceptOrderTransport, declineOrderTransport } from "../../utils/api.transport.js";
import { routeTransportModeLabel } from "../../../shared/routeTransportFields.js";
import { toTitleCase } from "../growSeller/sellerHelpers.js";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function TransportAgreementsPanel({ viewer }) {
    const { token } = useAuth();
    const { socket } = useSocket();
    const nav = useNavigate();
    const { summary, reload: reloadSummary } = useOrderTransportSummary(viewer);
    const [agreements, setAgreements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [msg, setMsg] = useState(null);
    const other = viewer === "seller" ? "Buyer" : "Seller";
    const orderPath = (id) => `${viewer === "seller" ? "/sell/orders/" : "/buy/orders/"}${id}`;

    const loadAgreements = useCallback(async () => {
        let res = null;
        try { res = await fetchTransportAgreements(viewer, token); } catch { res = null; }
        if (res?.success) setAgreements(res.agreements || []);
        setLoading(false);
    }, [viewer, token]);
    useEffect(() => { loadAgreements(); }, [loadAgreements]);

    useEffect(() => {
        if (!socket) return undefined;
        const onNotif = (p) => { if (String(p?.type || "").startsWith("order_transport_")) loadAgreements(); };
        socket.on("notification:new", onNotif);
        return () => socket.off("notification:new", onNotif);
    }, [socket, loadAgreements]);

    const act = async (key, fn, okText) => {
        setBusy(key); setMsg(null);
        let res = null;
        try { res = await fn(); } catch { res = null; }
        setBusy(null);
        setMsg(res?.success ? okText : (res?.message || "Something went wrong. Please try again."));
        reloadSummary(); loadAgreements();
    };

    const entries = Object.entries(summary || {}).map(([orderId, s]) => ({ orderId, ...s }));
    const needs = entries.filter((e) => e.state === "needs_you");
    const waiting = entries.filter((e) => e.state === "waiting");
    const declined = entries.filter((e) => e.state === "declined");

    const Row = ({ e, children }) => (
        <div className="gt-card">
            <span className="gk-ico" style={{ "--a": "var(--k-tt)" }}><Truck /></span>
            <div className="gt-main">
                <b>{e.summary}</b>
                <small><span>{routeTransportModeLabel(e.mode)}</span>·<span>Order {e.orderNumber}</span></small>
            </div>
            {children}
        </div>
    );

    if (loading) return <div className="gt-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="gk-skel" style={{ height: 70 }} />)}</div>;

    return (
        <div className="gt-sec">
            {msg && <p className="gt-note" role="status">{msg}</p>}

            {needs.length > 0 && (
                <section className="gt-sec">
                    <div className="gt-sech"><h2>Needs your reply<span className="gt-count">{needs.length}</span></h2></div>
                    <div className="gt-list">
                        {needs.map((e) => (
                            <Row key={e.orderId} e={e}>
                                <div className="gt-pend-acts">
                                    <button type="button" className="gk-btn sm gr" disabled={busy === e.requestId}
                                        onClick={() => act(e.requestId, () => acceptOrderTransport(e.requestId, token), "Transport agreed.")}>
                                        {busy === e.requestId ? <Loader2 size={15} className="gk-spin" /> : <Check size={15} />}Accept
                                    </button>
                                    <button type="button" className="gk-btn sm danger" disabled={busy === e.requestId}
                                        onClick={() => {
                                            const reason = window.prompt("Reason for declining (shared with the other side, optional):");
                                            if (reason === null) return;
                                            act(e.requestId, () => declineOrderTransport(e.requestId, reason || "", token), "Suggestion declined.");
                                        }}><X size={15} />Decline</button>
                                    <button type="button" className="gk-btn sm" onClick={() => nav(orderPath(e.orderId))}>Open order</button>
                                </div>
                            </Row>
                        ))}
                    </div>
                </section>
            )}

            {(waiting.length > 0 || declined.length > 0) && (
                <section className="gt-sec">
                    <div className="gt-sech"><h2>Your suggestions<span className="gt-count">{waiting.length + declined.length}</span></h2></div>
                    <div className="gt-list">
                        {[...waiting, ...declined].map((e) => (
                            <Row key={e.orderId} e={e}>
                                <span className="gt-note">{e.state === "waiting" ? "Waiting for reply" : "Declined"}</span>
                                <button type="button" className="gk-btn sm" onClick={() => nav(orderPath(e.orderId))}>Open order</button>
                            </Row>
                        ))}
                    </div>
                </section>
            )}

            <section className="gt-sec">
                <div className="gt-sech"><h2>Agreed transport<span className="gt-count">{agreements.length}</span></h2></div>
                {agreements.length === 0 ? (
                    <div className="gk-empty"><Handshake size={26} /><b>No saved agreements yet</b>
                        When you and a {other.toLowerCase()} agree a transport for a route, it is saved here and applied automatically to your next orders on that route.</div>
                ) : (
                    <div className="gt-list wide">
                        {agreements.map((a) => (
                            <div className="gt-card" key={a.id}>
                                <span className="gk-ico" style={{ "--a": "var(--k-tt)" }}><Handshake /></span>
                                <div className="gt-main">
                                    <b>{a.summary}</b>
                                    <small>
                                        <span>{a.counterparty}</span>·
                                        <span>{toTitleCase(a.originCity)}</span><ArrowRight size={12} /><span>{toTitleCase(a.destCity)}</span>
                                    </small>
                                    <small>{a.modeLabel} · agreed {when(a.agreedAt)}</small>
                                </div>
                                <button type="button" className="gk-btn sm danger" disabled={busy === a.id}
                                    onClick={() => {
                                        if (!window.confirm("End this agreement? Your next order on this route will need a new transport agreement. Existing orders are not affected.")) return;
                                        act(a.id, () => endTransportAgreement(a.id, token), "Agreement ended.");
                                    }}>
                                    {busy === a.id ? <Loader2 size={15} className="gk-spin" /> : <X size={15} />}End
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}