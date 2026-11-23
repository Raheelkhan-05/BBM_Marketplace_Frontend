// src/components/orders/OrderTransportPanel.jsx
//
// Optional, post-payment "Delivery transport" card on the order detail pages.
//   viewer="buyer"  -> SaveOrderDetailPage
//   viewer="seller" -> GrowOrderDetailPage
// Either side suggests; the other accepts / declines / counter-suggests. Everything is optional.
// Only what the SELLER services is offered (server-enforced, see orderTransport.controller.js).
// Shows an "Action needed" tag when a reply is waiting on you, flashes when the other side changes something
// while you are looking, and keeps an Activity log so both sides can see exactly what happened and when.
// If this seller + buyer + route already has an agreed transport, the server applies it to the order automatically and
// this card opens on "Transport already agreed for this route" (no choosing, no approving). Either side can still use
// "Change for this order"; once the other side accepts, the change becomes the new saved agreement.
// Renders nothing when there is nothing to show (unpaid / shipped / cancelled orders with no agreement).
import { useCallback, useEffect, useRef, useState } from "react";
import { Truck, ArrowRight, Check, X, Loader2, Clock, Info, Send, Undo2, Plus, ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import {
    fetchOrderTransport, proposeOrderTransport, acceptOrderTransport,
    declineOrderTransport, withdrawOrderTransport,
} from "../../utils/api.transport.js";
import { ROUTE_TRANSPORT_FIELDS, routeTransportModeLabel, routeOptionSummary } from "../../../shared/routeTransportFields.js";
import { toTitleCase } from "../growSeller/sellerHelpers.js";
import "./order-transport.css";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

function Choice({ mode, fields }) {
    const summary = routeOptionSummary(mode, fields || {});
    const label = routeTransportModeLabel(mode);
    return (
        <span className="ot-ct">
            <b>{summary}</b>
            {summary !== label && <small>{label}</small>}
        </span>
    );
}

function RouteLine({ route }) {
    if (!route?.originCity && !route?.destCity) return null;
    return (
        <p className="ot-route">
            <span>{toTitleCase(route.originCity) || "Seller"}</span>
            <ArrowRight size={13} />
            <span>{toTitleCase(route.destCity) || "Buyer"}</span>
        </p>
    );
}

// Flattens the request history into a readable timeline (newest first).
function buildActivity(history, viewer) {
    const who = (role) => (role === viewer ? "You" : viewer === "buyer" ? "The seller" : "The buyer");
    const out = [];
    for (const r of history || []) {
        const label = routeOptionSummary(r.mode, r.fields || {});
        out.push({ key: `${r.id}-c`, at: r.created_at, text: `${who(r.proposed_by_role)} suggested ${label}`, note: r.note });
        if (r.status === "accepted") out.push({ key: `${r.id}-r`, at: r.resolved_at, text: `${who(r.resolved_by_role)} accepted it`, tone: "ok" });
        else if (r.status === "declined") out.push({ key: `${r.id}-r`, at: r.resolved_at, text: `${who(r.resolved_by_role)} declined it`, note: r.decline_reason, tone: "bad" });
        else if (r.status === "withdrawn") out.push({ key: `${r.id}-r`, at: r.resolved_at, text: `${who(r.resolved_by_role)} withdrew the suggestion` });
        // "superseded" is implied by the newer suggestion above it
    }
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function ActivityLog({ items }) {
    const [open, setOpen] = useState(false);
    const [all, setAll] = useState(false);
    if (!items.length) return null;
    const shown = all ? items : items.slice(0, 5);
    return (
        <div className="ot-log">
            <button type="button" className="ot-logb" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                Activity ({items.length})
                <ChevronDown size={15} className={open ? "up" : ""} />
            </button>
            {open && (
                <>
                    <ul>
                        {shown.map((e) => (
                            <li key={e.key} className={e.tone || ""}>
                                <span className="ot-dot" />
                                <div>
                                    <p>{e.text}</p>
                                    {e.note && <p className="ot-lognote">“{e.note}”</p>}
                                    <small>{when(e.at)}</small>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {items.length > 5 && (
                        <button type="button" className="ot-btn ghost" onClick={() => setAll((v) => !v)}>{all ? "Show less" : `Show all ${items.length}`}</button>
                    )}
                </>
            )}
        </div>
    );
}

export default function OrderTransportPanel({ orderId, viewer, onChanged, onLoaded }) {
    const { token } = useAuth();
    const { socket } = useSocket();
    const isBuyer = viewer === "buyer";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(null);

    const [formOpen, setFormOpen] = useState(false);
    const [choice, setChoice] = useState(null); // "route:<id>" | "mode:<key>"
    const [fields, setFields] = useState({});
    const [note, setNote] = useState("");
    const [declineOpen, setDeclineOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState("");
    const [flash, setFlash] = useState(false);
    const seq = useRef(0);
    const sigRef = useRef(null);

    const load = useCallback(async (silent = false) => {
        const my = ++seq.current; // ignore stale responses
        if (!silent) { setLoading(true); setLoadError(false); }
        let res = null;
        try { res = await fetchOrderTransport(orderId, token); } catch { res = null; }
        if (my !== seq.current) return;
        if (res?.success) { setData(res); setLoadError(false); }
        else if (!silent) setLoadError(true);
        setLoading(false);
    }, [orderId, token]);

    useEffect(() => { load(); }, [load]);

    // Live: the other side suggested / accepted / declined / withdrew.
    useEffect(() => {
        if (!socket) return undefined;
        const onNotif = (p) => { if (String(p?.type || "").startsWith("order_transport_")) load(true); };
        const onChangedEvt = () => load(true);
        socket.on("notification:new", onNotif);
        socket.on("orders_changed", onChangedEvt);
        return () => { socket.off("notification:new", onNotif); socket.off("orders_changed", onChangedEvt); };
    }, [socket, load]);

    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === "visible") load(true); };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [load]);

    // Lets the page's "Delivery address" card show the same agreed / suggested transport without a second request.
    useEffect(() => { onLoaded?.(data); }, [data, onLoaded]);

    // Brief highlight when something changes after the first load (e.g. the other side just replied).
    useEffect(() => {
        if (!data) return undefined;
        const sig = `${data.phase}:${data.active?.id || ""}:${data.active?.status || ""}:${data.lastDeclined?.id || ""}`;
        const changed = sigRef.current !== null && sigRef.current !== sig;
        sigRef.current = sig;
        if (!changed) return undefined;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 2500);
        return () => clearTimeout(t);
    }, [data]);

    const run = async (fn) => {
        setBusy(true);
        setActionError(null);
        let res = null;
        try { res = await fn(); } catch { res = null; }
        setBusy(false);
        if (!res?.success) {
            setActionError(res?.message || "Something went wrong. Please try again.");
            load(true);
            return false;
        }
        await load(true);
        onChanged?.();
        return true;
    };

    if (loading) return <section className="ot" aria-busy="true"><div className="ot-skel" /></section>;
    if (loadError) {
        return (
            <section className="ot">
                <p className="ot-sub">Couldn't load the transport details.</p>
                <button type="button" className="ot-btn" onClick={() => load()}>Try again</button>
            </section>
        );
    }
    if (!data || data.phase === "closed") return null;

    const { agreed, active, lastDeclined, options, route } = data;
    const other = isBuyer ? (data.sellerName || "the seller") : "the buyer";
    const activity = buildActivity(data.history, viewer);

    /* ---------------- agreed ---------------- */
    const saved = data.agreedVia === "saved";
    if (data.phase === "agreed" && agreed && !data.canChange) {
        return (
            <section className={`ot ok${flash ? " flash" : ""}`}>
                <div className="ot-h"><span className="ot-ic ok"><Check size={16} strokeWidth={3} /></span><h3>Transport agreed</h3></div>
                <div className="ot-box">
                    <Choice mode={agreed.mode} fields={agreed.fields} />
                </div>
                <RouteLine route={route} />
                {saved && <p className="ot-sub">Agreed earlier by you and {other} for this route.</p>}
                {!isBuyer && <p className="ot-sub">You'll see this again when you mark the order as shipped.</p>}
                <ActivityLog items={activity} />
            </section>
        );
    }
    const isAgreed = data.phase === "agreed" && !!agreed; // agreed, but still changeable until the seller ships

    /* ---------------- open ---------------- */
    const modes = options?.modes || [];
    const routeOptions = options?.routeOptions || [];
    const routeModes = new Set(routeOptions.map((r) => r.mode));
    const extraModes = modes.filter((m) => !routeModes.has(m));
    const noOptions = !modes.length && !routeOptions.length;
    const mine = active && active.proposed_by_role === viewer;
    const theirs = active && active.proposed_by_role !== viewer;
    const canSuggest = !noOptions;

    const openForm = () => {
        setActionError(null);
        setNote("");
        setFields({});
        setChoice(routeOptions[0] ? `route:${routeOptions[0].id}` : null);
        setFormOpen(true);
    };

    const pickedMode = choice?.startsWith("mode:") ? choice.slice(5) : null;
    const modeSchema = pickedMode ? ROUTE_TRANSPORT_FIELDS[pickedMode] || [] : [];

    const submit = async () => {
        if (!choice || busy) return;
        const payload = choice.startsWith("route:")
            ? { routeOptionId: choice.slice(6), note }
            : { mode: pickedMode, fields, note };
        const ok = await run(() => proposeOrderTransport(orderId, payload, token));
        if (ok) setFormOpen(false);
    };

    const decline = async () => {
        const ok = await run(() => declineOrderTransport(active.id, declineReason, token));
        if (ok) { setDeclineOpen(false); setDeclineReason(""); }
    };

    return (
        <section className={`ot${isAgreed ? " ok" : ""}${theirs ? " hot" : ""}${flash ? " flash" : ""}`}>
            <div className="ot-h">
                {isAgreed
                    ? <span className="ot-ic ok"><Check size={16} strokeWidth={3} /></span>
                    : <span className="ot-ic"><Truck size={16} /></span>}
                <h3>{isAgreed ? (saved ? "Transport already agreed for this route" : "Transport agreed") : "Delivery transport"}</h3>
                {theirs ? <span className="ot-tag hot">Action needed</span> : !isAgreed && <span className="ot-tag">Optional</span>}
            </div>
            <RouteLine route={route} />
            {isAgreed ? (
                <>
                    <div className="ot-box">
                        <Choice mode={agreed.mode} fields={agreed.fields} />
                    </div>
                    <p className="ot-sub">
                        {saved
                            ? `You and ${other} have already agreed on this transport for this route${data.agreementAt ? ` (${when(data.agreementAt)})` : ""}.`
                            : `This transport is agreed and will be used automatically for your future orders on this route.`}
                        {!isBuyer && " You'll see it again when you mark the order as shipped."}
                    </p>
                </>
            ) : (
                <p className="ot-sub">
                    {isBuyer
                        ? "Choose how this order should reach you. You can skip this, and the seller can also suggest an option. Once agreed, it's remembered for future orders on this route."
                        : "Agree on delivery transport with the buyer. You can skip this and ship as usual. Once agreed, it's remembered for future orders on this route."}
                </p>
            )}

            {theirs && (
                <div className="ot-box in">
                    <p className="ot-lbl">{isBuyer ? "The seller suggested" : "The buyer suggested"} · {when(active.created_at)}</p>
                    <Choice mode={active.mode} fields={active.fields} />
                    {active.note && <p className="ot-note">“{active.note}”</p>}
                    {!declineOpen ? (
                        <div className="ot-acts">
                            <button type="button" className="ot-btn go" disabled={busy} onClick={() => run(() => acceptOrderTransport(active.id, token))}>
                                {busy ? <Loader2 size={15} className="ot-spin" /> : <Check size={15} />}Accept
                            </button>
                            <button type="button" className="ot-btn" disabled={busy} onClick={() => { setDeclineOpen(true); setFormOpen(false); }}>
                                <X size={15} />Decline
                            </button>
                            {canSuggest && !formOpen && (
                                <button type="button" className="ot-btn ghost" disabled={busy} onClick={openForm}>Suggest another</button>
                            )}
                        </div>
                    ) : (
                        <div className="ot-form">
                            <label htmlFor="ot-dr" className="ot-lbl">Reason (optional, shared with {other})</label>
                            <textarea id="ot-dr" className="ot-inp" rows={2} maxLength={300} value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)} placeholder="e.g. We can't deliver via this transporter" />
                            <div className="ot-acts">
                                <button type="button" className="ot-btn" disabled={busy} onClick={() => setDeclineOpen(false)}>Back</button>
                                <button type="button" className="ot-btn danger" disabled={busy} onClick={decline}>
                                    {busy ? <Loader2 size={15} className="ot-spin" /> : <X size={15} />}Decline suggestion
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mine && (
                <div className="ot-box wait">
                    <p className="ot-lbl"><Clock size={13} />Waiting for {other} to respond · sent {when(active.created_at)}</p>
                    <Choice mode={active.mode} fields={active.fields} />
                    {active.note && <p className="ot-note">“{active.note}”</p>}
                    <div className="ot-acts">
                        <button type="button" className="ot-btn" disabled={busy} onClick={() => run(() => withdrawOrderTransport(active.id, token))}>
                            {busy ? <Loader2 size={15} className="ot-spin" /> : <Undo2 size={15} />}Withdraw
                        </button>
                        {canSuggest && !formOpen && (
                            <button type="button" className="ot-btn ghost" disabled={busy} onClick={openForm}>Change suggestion</button>
                        )}
                    </div>
                </div>
            )}

            {!active && lastDeclined && (
                <div className="ot-box bad">
                    <p className="ot-lbl">
                        {isAgreed ? "Change not accepted, the agreed transport above still applies. " : ""}
                        {lastDeclined.proposed_by_role === viewer ? `${isBuyer ? "The seller" : "The buyer"} declined your suggestion` : "You declined the last suggestion"}
                        {lastDeclined.resolved_at ? ` · ${when(lastDeclined.resolved_at)}` : ""}
                    </p>
                    <Choice mode={lastDeclined.mode} fields={lastDeclined.fields} />
                    {lastDeclined.decline_reason && <p className="ot-note">“{lastDeclined.decline_reason}”</p>}
                </div>
            )}

            {!active && !formOpen && (
                canSuggest ? (
                    <div className="ot-acts">
                        <button type="button" className={`ot-btn${isAgreed ? "" : " go"}`} disabled={busy} onClick={openForm}><Plus size={15} />{isAgreed ? "Want to change?" : isBuyer ? "Choose transport" : "Suggest transport"}</button>
                    </div>
                ) : (
                    <p className="ot-hint"><Info size={14} />
                        {isBuyer
                            ? "This seller hasn't listed transport options yet. They may suggest one here."
                            : "You haven't added any transport options yet. Add them in Transport (or shop settings) so buyers can choose."}
                    </p>
                )
            )}

            {formOpen && canSuggest && (
                <div className="ot-form" role="group" aria-label="Choose a transport option">
                    {routeOptions.length > 0 && (
                        <div className="ot-grp">
                            <p className="ot-lbl">{isBuyer ? "Seller's routes to your city" : "Your saved routes for this order"}</p>
                            {routeOptions.map((r) => (
                                <label key={r.id} className={`ot-opt${choice === `route:${r.id}` ? " on" : ""}`}>
                                    <input type="radio" name="ot-choice" checked={choice === `route:${r.id}`} onChange={() => setChoice(`route:${r.id}`)} />
                                    <Choice mode={r.mode} fields={r.fields} />
                                </label>
                            ))}
                        </div>
                    )}

                    {extraModes.length > 0 && (
                        <div className="ot-grp">
                            <p className="ot-lbl">{routeOptions.length ? "Other ways the seller delivers" : "Ways the seller delivers"}</p>
                            {extraModes.map((m) => (
                                <label key={m} className={`ot-opt${choice === `mode:${m}` ? " on" : ""}`}>
                                    <input type="radio" name="ot-choice" checked={choice === `mode:${m}`} onChange={() => { setChoice(`mode:${m}`); setFields({}); }} />
                                    <span className="ot-ct"><b>{routeTransportModeLabel(m)}</b></span>
                                </label>
                            ))}
                        </div>
                    )}

                    {pickedMode && modeSchema.length > 0 && (
                        <div className="ot-grp">
                            <p className="ot-lbl">Details (all optional)</p>
                            {modeSchema.map((f) => (
                                <div className="ot-fld" key={f.key}>
                                    <label htmlFor={`ot-f-${f.key}`}>{f.label.replace(/\s*\((optional|if any)\)\s*$/i, "")}</label>
                                    {f.type === "textarea"
                                        ? <textarea id={`ot-f-${f.key}`} className="ot-inp" rows={2} maxLength={200} value={fields[f.key] || ""} onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))} />
                                        : <input id={`ot-f-${f.key}`} className="ot-inp" maxLength={200} value={fields[f.key] || ""} onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))} />}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="ot-fld">
                        <label htmlFor="ot-note">Note for {other} (optional)</label>
                        <textarea id="ot-note" className="ot-inp" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
                            placeholder={isBuyer ? "e.g. Our usual transporter is Patel Transport" : "e.g. We dispatch every Tuesday and Friday"} />
                    </div>

                    <div className="ot-acts">
                        <button type="button" className="ot-btn" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</button>
                        <button type="button" className="ot-btn go" disabled={busy || !choice} onClick={submit}>
                            {busy ? <Loader2 size={15} className="ot-spin" /> : <Send size={15} />}Send suggestion
                        </button>
                    </div>
                </div>
            )}

            {actionError && <p className="ot-err" role="alert">{actionError}</p>}

            {isBuyer && data.unpaid && (
                <p className="ot-hint"><Info size={14} />
                    {active
                        ? "The seller sees your suggestion as soon as you pay, and can accept it before confirming your order."
                        : "The seller is told about the transport once your payment is done."}
                </p>
            )}

            {isBuyer && !isAgreed && data.orderStatus === "pending_confirmation" && (
                <p className="ot-hint"><Info size={14} />Can't agree on transport? You can cancel this order below until the seller confirms it.</p>
            )}
            {!isBuyer && data.responseDueAt && (
                <p className="ot-hint"><Clock size={14} />Respond to this order by {when(data.responseDueAt)}.</p>
            )}

            <ActivityLog items={activity} />
        </section>
    );
}