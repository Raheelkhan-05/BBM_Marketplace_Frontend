// src/components/orderBook/OrderBookDetail.jsx
// One order. Shared by the salesperson (mode "sales": read only) and the company team (mode "team": can move it forward).
// Live: every change anyone makes shows up here without a refresh.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Phone, Mail, FileText, Download, Loader2, Truck, XCircle, CheckCircle2, ClipboardCheck, Info } from "lucide-react";
import useOrderBookLive from "../../hooks/useOrderBookLive.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { FLOW, STATUS_LABEL, inr, qty, dateTime, dateShort } from "./orderBookFmt.js";
import StatusChip from "./StatusChip.jsx";
import "../sales/sales-threads.css";
import "./order-book.css";

const ShipSheet = lazy(() => import("./OrderBookShipSheet.jsx"));   // team side only

function Steps({ o }) {
    const at = { placed: o.createdAt, processed: o.processedAt, shipped: o.shippedAt, completed: o.completedAt };
    const cur = FLOW.indexOf(o.status);
    return (
        <ol className="ob-steps" aria-label="Order progress">
            {FLOW.map((s, i) => {
                const done = i < cur || o.status === "completed";
                return (
                    <li key={s} className={done ? "done" : i === cur ? "cur" : ""} aria-current={i === cur && !done ? "step" : undefined}>
                        <span className="ob-dot">{done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                        <b>{STATUS_LABEL[s]}</b>
                        <small>{at[s] ? dateShort(at[s]) : "\u00A0"}</small>
                    </li>
                );
            })}
        </ol>
    );
}

// Confirmation for the two steps that can't be undone: complete and cancel.
function Confirm({ kind, busy, onCancel, onConfirm }) {
    useSheetBehavior(busy ? undefined : onCancel);
    const [reason, setReason] = useState("");
    const cancel = kind === "cancel";
    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
            <div className="st-sheet st-confirm" role="alertdialog" aria-modal="true" aria-label={cancel ? "Cancel order" : "Complete order"}>
                <div className="st-sh-b">
                    <div className={`st-okc ${cancel ? "lost" : ""}`}>{cancel ? <XCircle size={28} /> : <CheckCircle2 size={28} />}</div>
                    <h2 className="st-center st-conf-h">{cancel ? "Cancel this order?" : "Mark this order as completed?"}</h2>
                    <p className="st-hint st-center">
                        {cancel ? "The salesperson will be told it was cancelled. This can't be undone." : "Use this once the customer has received the goods. This can't be undone."}
                    </p>
                    {cancel && (
                        <div className="st-f" style={{ marginTop: 12 }}>
                            <label htmlFor="ob-reason">Reason (optional)</label>
                            <textarea id="ob-reason" className="st-in" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown to the salesperson" />
                        </div>
                    )}
                </div>
                <div className="st-sh-f">
                    <button type="button" className="st-btn" disabled={busy} onClick={onCancel}>{cancel ? "Keep order" : "Not yet"}</button>
                    <button type="button" className={`st-btn ${cancel ? "bad" : "ok"}`} disabled={busy} onClick={() => onConfirm(reason.trim())}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}{cancel ? "Cancel order" : "Mark as completed"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

const SALES_HINT = {
    placed: "Your team has been notified. You'll see every update here as it happens.",
    processed: "The team is preparing this order.",
    shipped: "The order is on its way. The LR details are below.",
    completed: "This order is complete.",
};

export default function OrderBookDetail({ mode, id, api, token, say, backTo, backLabel }) {
    const team = mode === "team";
    const [order, setOrder] = useState(null);
    const [events, setEvents] = useState([]);
    const [state, setState] = useState("loading");     // loading | ready | missing | error
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);       // "complete" | "cancel"
    const [shipOpen, setShipOpen] = useState(false);
    const seq = useRef(0);

    const load = useCallback(async (silent) => {
        const my = ++seq.current;
        const res = await api.get(token, id);
        if (my !== seq.current) return;
        if (!res.success) {
            if (silent) return;
            if (res.status === 404) setState("missing"); else { setMsg(res.message || "Couldn't load this order."); setState("error"); }
            return;
        }
        setOrder(res.order); setEvents(res.events || []); setState("ready");
    }, [api, token, id]);

    useEffect(() => { if (!token) return; setOrder(null); setEvents([]); setState("loading"); load(false); }, [token, id, load]);
    useOrderBookLive(() => load(true), { enabled: !!token && state === "ready" });

    // Runs one team action; the server answers with the new order, then the timeline is refreshed.
    const run = async (fn, ok) => {
        setBusy(true);
        const res = await fn();
        setBusy(false);
        if (!res.success) { say(res.message || "Couldn't update the order."); load(true); return res; }
        setOrder(res.order); setConfirm(null); say(ok); load(true);
        return res;
    };
    const onProcess = () => run(() => api.process(token, id), "Marked as processed.");
    const onComplete = () => run(() => api.complete(token, id), "Order completed.");
    const onCancel = (reason) => run(() => api.cancel(token, id, reason), "Order cancelled.");
    const onShip = async (fd) => {
        const res = await api.ship(token, id, fd);
        if (res.success) { setOrder(res.order); setShipOpen(false); say("Marked as shipped."); load(true); }
        return res;
    };

    if (state === "loading") return <div className="ob st-listpage"><div className="st-sk tall" style={{ marginTop: 22 }} /><div className="st-sk tall" /><div className="st-sk tall" /></div>;
    if (state !== "ready" || !order) {
        return (
            <div className="ob st-listpage"><div className="st-empty-card" style={{ marginTop: 22 }}>
                <b>{state === "missing" ? "This order isn't available" : msg}</b>
                {state === "missing" ? "It may have been removed, or it belongs to someone else." : ""}
                <Link to={backTo} className="st-btn">{state === "missing" ? backLabel : "Back"}</Link>
                {state === "error" && <button type="button" className="st-btn" onClick={() => { setState("loading"); load(false); }}>Try again</button>}
            </div></div>
        );
    }

    const o = order;
    const cancelled = o.status === "cancelled";
    const canCancel = team && ["placed", "processed"].includes(o.status);

    return (
        <div className="ob st-listpage">
            <header className="ob-head">
                <Link to={backTo} className="st-ib" aria-label={`Back to ${backLabel}`}><ArrowLeft size={18} /></Link>
                <div className="ob-head-t">
                    <h1>{o.customerName}</h1>
                    <p>{o.orderNo} · Placed {dateTime(o.createdAt)}</p>
                </div>
                <StatusChip status={o.status} />
            </header>

            {cancelled ? (
                <div className="ob-banner bad" role="status">
                    <XCircle size={18} />
                    <span><b>This order was cancelled{o.cancelledAt ? ` on ${dateShort(o.cancelledAt)}` : ""}.</b>{o.cancelReason && <small>{o.cancelReason}</small>}</span>
                </div>
            ) : <Steps o={o} />}

            {team && !cancelled && o.status !== "completed" && (
                <div className="ob-act">
                    <div className="ob-act-t">
                        <b>{o.status === "placed" ? "New order, ready to process" : o.status === "processed" ? "Ready to ship" : "Out for delivery"}</b>
                        <small>{o.status === "placed" ? `Punched by ${o.salespersonName || "a salesperson"}.`
                            : o.status === "processed" ? "Add the LR number and documents to ship it." : "Complete it once the customer has received the goods."}</small>
                    </div>
                    <div className="ob-act-b">
                        {canCancel && <button type="button" className="st-btn" disabled={busy} onClick={() => setConfirm("cancel")}>Cancel order</button>}
                        {o.status === "placed" && (
                            <button type="button" className="st-btn pri" disabled={busy} onClick={onProcess}>
                                {busy ? <Loader2 size={16} className="st-spin" /> : <ClipboardCheck size={16} />}Mark as processed
                            </button>
                        )}
                        {o.status === "processed" && <button type="button" className="st-btn pri" disabled={busy} onClick={() => setShipOpen(true)}><Truck size={16} />Mark as shipped</button>}
                        {o.status === "shipped" && <button type="button" className="st-btn ok" disabled={busy} onClick={() => setConfirm("complete")}><CheckCircle2 size={16} />Mark as completed</button>}
                    </div>
                </div>
            )}
            {!team && !cancelled && SALES_HINT[o.status] && <p className="ob-hint"><Info size={15} />{SALES_HINT[o.status]}</p>}

            <div className="ob-grid">
                <div className="ob-col">
                    <section className="ob-card">
                        <h2>Products</h2>
                        <ul className="ob-lines">
                            {o.items.map((i, k) => (
                                <li key={`${i.submissionId || i.productName}-${k}`}>
                                    <span className="ob-th">{i.image ? <img src={i.image} alt="" loading="lazy" /> : (i.productName || "?")[0].toUpperCase()}</span>
                                    <span className="ob-lt">
                                        <b>{i.productName}</b>
                                        <small>{qty(i.quantity)} {i.unit} × {inr(i.unitPrice, 4)}{i.brandName ? ` · ${i.brandName}` : ""}</small>
                                    </span>
                                    <b className="ob-amt">{inr(i.lineTotal)}</b>
                                </li>
                            ))}
                        </ul>
                        <p className="ob-total"><span>Order total</span><b>{inr(o.total)}</b></p>
                        <p className="ob-fine">Prices are logged as entered by the salesperson (GST included). They don't change any marketplace price.</p>
                        {o.notes && <p className="ob-notes"><b>Notes</b>{o.notes}</p>}
                    </section>

                    {o.lrNumber && (
                        <section className="ob-card">
                            <h2>Shipment</h2>
                            <dl className="ob-kv">
                                <div><dt>LR / tracking number</dt><dd>{o.lrNumber}</dd></div>
                                {o.shippedAt && <div><dt>Shipped on</dt><dd>{dateTime(o.shippedAt)}</dd></div>}
                                {o.lrNotes && <div><dt>Notes</dt><dd>{o.lrNotes}</dd></div>}
                            </dl>
                            <div className="ob-docs">
                                {o.docs?.lrUrl && <a className="st-file" href={o.docs.lrUrl} target="_blank" rel="noreferrer"><FileText size={18} /><span><b>LR document</b></span><Download size={14} aria-hidden="true" /></a>}
                                {o.docs?.billUrl && <a className="st-file" href={o.docs.billUrl} target="_blank" rel="noreferrer"><FileText size={18} /><span><b>Bill</b></span><Download size={14} aria-hidden="true" /></a>}
                            </div>
                        </section>
                    )}
                </div>

                <div className="ob-col">
                    <section className="ob-card">
                        <h2>Customer</h2>
                        <p className="ob-cn">{o.customerName}</p>
                        <div className="ob-cl">
                            {o.customerGstin && <span>GSTIN {o.customerGstin}</span>}
                            {o.customerPhone && <a href={`tel:+91${o.customerPhone}`}><Phone size={14} />+91 {o.customerPhone}</a>}
                            {o.customerEmail && <a href={`mailto:${o.customerEmail}`}><Mail size={14} />{o.customerEmail}</a>}
                            {!o.customerPhone && !o.customerEmail && <span className="mute">No phone or email added</span>}
                        </div>
                        {team && <p className="ob-fine" style={{ marginTop: 10 }}>Punched by {o.salespersonName || "a salesperson"}</p>}
                    </section>

                    <section className="ob-card">
                        <h2>Activity</h2>
                        <ol className="ob-tl">
                            {events.map((e) => (
                                <li key={e.id} className={e.kind}>
                                    <span className="ob-tl-d" />
                                    <span><b>{e.body}</b><small>{e.actorName ? `${e.actorName} · ` : ""}{dateTime(e.createdAt)}</small></span>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>
            </div>

            {confirm && <Confirm kind={confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={(reason) => (confirm === "cancel" ? onCancel(reason) : onComplete())} />}
            {shipOpen && (
                <Suspense fallback={null}>
                    <ShipSheet open order={o} onClose={() => setShipOpen(false)} onConfirm={onShip} />
                </Suspense>
            )}
        </div>
    );
}