// src/components/sales/SalesQuoteSheet.jsx
// Quotation flow: pick company products -> set this customer's price -> choose WhatsApp / email -> send.
// Prices are tied to the customer's GST number and pre-filled next time.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Check, Loader2, ArrowLeft, Trash2, MessageCircle, Mail, AlertCircle } from "lucide-react";
import { fetchQuoteProducts, sendThreadQuote, updateThread } from "../../utils/salesThreadApi.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, inr, qty, round4 } from "./salesThreadFmt.js";
import "./sales-threads.css";

const PAGE = 20;
const VALIDITY = [[1, "1 day"], [3, "3 days"], [7, "7 days"], [15, "15 days"], [30, "30 days"]];
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function Thumb({ src, name }) {
    return <span className="st-th">{src ? <img src={src} alt="" loading="lazy" /> : (name || "?").trim()[0]?.toUpperCase()}</span>;
}

function calcLine(l) {
    const g = 1 + (Number(l.p.gstPercent) || 0) / 100;
    const price = parseFloat(l.price) || 0, q = parseFloat(l.qty) || 0;
    const unitIncl = l.gstIncl ? price : price * g;
    const total = r2(unitIncl * q);
    return { total, taxable: r2(total / g) };
}

export default function SalesQuoteSheet({ token, thread, onClose, onSent }) {
    useSheetBehavior(onClose);
    const [view, setView] = useState("pick"); // pick | review | done
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [products, setProducts] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [lines, setLines] = useState([]); // { p, qty, price, gstIncl }
    const [gstin, setGstin] = useState(thread.customerGstin || "");
    const [phone, setPhone] = useState(thread.customerPhone || "");
    const [email, setEmail] = useState(thread.customerEmail || "");
    const [chan, setChan] = useState({ whatsapp: !!thread.customerPhone, email: !!thread.customerEmail });
    const [validity, setValidity] = useState(7);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);
    const seq = useRef(0);
    const bodyRef = useRef(null);

    useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

    const load = useCallback(async (offset) => {
        const my = ++seq.current;
        if (!offset) { setLoading(true); setLoadError(""); }
        const res = await fetchQuoteProducts(token, thread.id, { q, limit: PAGE, offset });
        if (my !== seq.current) return;
        setLoading(false);
        if (!res.success) { setLoadError(res.message || "Couldn't load your products."); return; }
        setProducts((prev) => (offset ? [...prev, ...res.items.filter((i) => !prev.some((p) => p.submissionId === i.submissionId))] : res.items));
        setHasMore(!!res.hasMore);
    }, [token, thread.id, q]);
    useEffect(() => { load(0); }, [load]);

    const picked = useMemo(() => new Set(lines.map((l) => l.p.submissionId)), [lines]);
    const toggle = (p) => {
        if (p.reason) return;
        setErr("");
        setLines((prev) => {
            if (prev.some((l) => l.p.submissionId === p.submissionId)) return prev.filter((l) => l.p.submissionId !== p.submissionId);
            const start = p.lastUnitPriceIncl ?? p.listUnitPriceIncl;
            return [...prev, { p, qty: p.unitMatches ? String(thread.quantity) : "1", price: start != null ? String(round4(start)) : "", gstIncl: true }];
        });
    };
    const patchLine = (id, patch) => { setErr(""); setLines((prev) => prev.map((l) => (l.p.submissionId === id ? { ...l, ...patch } : l))); };
    // Keep the same real price when switching between incl. / excl. GST.
    const switchGst = (l, incl) => {
        const g = 1 + (Number(l.p.gstPercent) || 0) / 100, price = parseFloat(l.price);
        if (!(price > 0) || l.gstIncl === incl) return patchLine(l.p.submissionId, { gstIncl: incl });
        patchLine(l.p.submissionId, { gstIncl: incl, price: String(round4(incl ? price * g : price / g)) });
    };

    const totals = useMemo(() => lines.reduce((a, l) => {
        const c = calcLine(l); return { taxable: a.taxable + c.taxable, total: a.total + c.total };
    }, { taxable: 0, total: 0 }), [lines]);

    const goReview = () => {
        if (!lines.length) return setErr("Choose at least one product.");
        setErr(""); setView("review");
        requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 }));
    };

    const send = async () => {
        if (busy) return;
        for (const l of lines) {
            if (!(parseFloat(l.price) > 0)) return setErr(`Enter a price for ${l.p.productName}.`);
            if (!(parseFloat(l.qty) > 0)) return setErr(`Enter a quantity for ${l.p.productName}.`);
        }
        const g = cleanGstin(gstin);
        if (!GSTIN_RE.test(g)) return setErr("Enter the customer's 15-character GST number. It's needed to send a quotation.");
        const channels = ["whatsapp", "email"].filter((c) => chan[c]);
        if (!channels.length) return setErr("Choose WhatsApp, email or both.");
        if (chan.whatsapp && !cleanPhone(phone)) return setErr("Enter a valid 10-digit mobile number for WhatsApp.");
        if (chan.email && !cleanEmail(email)) return setErr("Enter a valid email address.");

        setBusy(true); setErr("");
        const patch = {};
        if (g !== thread.customerGstin) patch.customerGstin = g;
        if (chan.whatsapp && cleanPhone(phone) !== thread.customerPhone) patch.customerPhone = phone;
        if (chan.email && cleanEmail(email) !== thread.customerEmail) patch.customerEmail = email;
        if (Object.keys(patch).length) {
            const u = await updateThread(token, thread.id, patch);
            if (!u.success) { setBusy(false); return setErr(u.message || "Couldn't save the customer details."); }
        }
        const res = await sendThreadQuote(token, thread.id, {
            items: lines.map((l) => ({ submissionId: l.p.submissionId, quantity: Number(l.qty), price: Number(l.price), gstInclusive: l.gstIncl })),
            channels, validityDays: validity, note: note.trim(),
        });
        setBusy(false);
        if (!res.success) return setErr(res.message || "Couldn't send the quotation. Please try again.");
        setResult(res); setView("done"); onSent?.(res);
        requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 }));
    };

    const title = view === "pick" ? "Choose products" : view === "review" ? "Set prices and send" : "Quotation";

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && view !== "done") onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="Send quotation">
                <div className="st-sh-h">
                    {view === "review" && <button type="button" className="st-ib" aria-label="Back to products" onClick={() => { setErr(""); setView("pick"); }}><ArrowLeft size={18} /></button>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h2>{title}</h2>
                        <p>{thread.displayName} · {thread.productName} · {qty(thread.quantity)} {thread.unit}</p>
                    </div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" ref={bodyRef} data-lenis-prevent>
                    {view === "pick" && (<>
                        <label className="st-srch">
                            <Search size={16} aria-hidden="true" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your company's products" aria-label="Search products" />
                            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}
                        </label>

                        {loading && <div aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="st-sk" />)}</div>}
                        {!loading && loadError && <p className="st-err">{loadError} <button type="button" className="st-lnk" onClick={() => load(0)}>Try again</button></p>}
                        {!loading && !loadError && products.length === 0 && (
                            <p className="st-empty">{q ? `No product matches "${q}".` : "Your company has no products yet. Add products from the Grow section first."}</p>
                        )}
                        {!loading && products.map((p) => {
                            const on = picked.has(p.submissionId);
                            return (
                                <button key={p.submissionId} type="button" className={`st-prod${on ? " on" : ""}`} disabled={!!p.reason}
                                    aria-pressed={on} onClick={() => toggle(p)}>
                                    <Thumb src={p.image} name={p.productName} />
                                    <span className="st-prod-t">
                                        <b>{p.productName}</b>
                                        <small>{[p.brandName, `Sold in ${p.unit}`, p.packSize > 1 ? `1 pack = ${qty(p.packSize)} ${p.unit}` : null].filter(Boolean).join(" · ")}</small>
                                        {p.description && <small className="st-clip">{p.description}</small>}
                                        {p.lastUnitPriceIncl != null
                                            ? <small className="ok">Last quoted to this customer: {inr(p.lastUnitPriceIncl, 4)} / {p.unit}</small>
                                            : p.listUnitPriceIncl != null && <small>List price {inr(p.listUnitPriceIncl, 4)} / {p.unit} incl. GST</small>}
                                        {p.reason && <em>{p.reason}: can't be quoted right now</em>}
                                        {!p.unitMatches && !p.reason && <em className="soft">Customer asked in {thread.unit}; this is sold in {p.unit}</em>}
                                    </span>
                                    <span className="st-tick" aria-hidden="true">{on ? <Check size={16} strokeWidth={3} /> : null}</span>
                                </button>
                            );
                        })}
                        {!loading && hasMore && <button type="button" className="st-btn" style={{ width: "100%" }} onClick={() => load(products.length)}>Show more</button>}
                    </>)}

                    {view === "review" && (<>
                        {lines.map((l) => {
                            const c = calcLine(l);
                            return (
                                <div className="st-line" key={l.p.submissionId}>
                                    <div className="st-line-h">
                                        <Thumb src={l.p.image} name={l.p.productName} />
                                        <span className="st-prod-t"><b>{l.p.productName}</b><small>{[l.p.brandName, `GST ${l.p.gstPercent}%`].filter(Boolean).join(" · ")}</small></span>
                                        <button type="button" className="st-ib sm" aria-label={`Remove ${l.p.productName}`} onClick={() => toggle(l.p)}><Trash2 size={15} /></button>
                                    </div>
                                    <div className="st-two">
                                        <div className="st-f">
                                            <label>Quantity ({l.p.unit})</label>
                                            <input className="st-in" inputMode="decimal" value={l.qty} onChange={(e) => patchLine(l.p.submissionId, { qty: e.target.value.replace(/[^\d.]/g, "") })} />
                                        </div>
                                        <div className="st-f">
                                            <label>Price per {l.p.unit} (₹)</label>
                                            <input className="st-in" inputMode="decimal" value={l.price} onChange={(e) => patchLine(l.p.submissionId, { price: e.target.value.replace(/[^\d.]/g, "") })} />
                                        </div>
                                    </div>
                                    <div className="st-seg" role="group" aria-label="GST">
                                        <button type="button" aria-pressed={l.gstIncl} onClick={() => switchGst(l, true)}>Includes GST</button>
                                        <button type="button" aria-pressed={!l.gstIncl} onClick={() => switchGst(l, false)}>Excludes GST</button>
                                    </div>
                                    {l.p.lastUnitPriceIncl != null && <p className="st-hint">Last quoted to this customer: {inr(l.p.lastUnitPriceIncl, 4)} per {l.p.unit} incl. GST.</p>}
                                    <p className="st-line-t"><span>Line total (incl. GST)</span><b>{inr(c.total)}</b></p>
                                </div>
                            );
                        })}

                        <div className="st-sum">
                            <p><span>Total before GST</span><b>{inr(totals.taxable)}</b></p>
                            <p><span>GST</span><b>{inr(totals.total - totals.taxable)}</b></p>
                            <p className="tot"><span>Total (incl. GST)</span><b>{inr(totals.total)}</b></p>
                        </div>

                        <p className="st-sec">Send to</p>
                        {!thread.customerGstin && (
                            <div className="st-f">
                                <label htmlFor="qs-gst">Customer's GST number *</label>
                                <input id="qs-gst" className="st-in" value={gstin} maxLength={15} autoCapitalize="characters" placeholder="e.g. 24ABCDE1234F1Z5" onChange={(e) => { setGstin(cleanGstin(e.target.value)); setErr(""); }} />
                                <p className="st-hint">Required. The prices you set are saved against this GST number.</p>
                            </div>
                        )}
                        <div className={`st-chan${chan.whatsapp ? " on" : ""}`}>
                            <button type="button" role="checkbox" aria-checked={chan.whatsapp} onClick={() => setChan((s) => ({ ...s, whatsapp: !s.whatsapp }))}>
                                <i>{chan.whatsapp ? <Check size={14} strokeWidth={3} /> : null}</i><MessageCircle size={16} />WhatsApp
                            </button>
                            {chan.whatsapp && <input className="st-in" inputMode="tel" aria-label="Customer mobile number" placeholder="Customer's 10-digit mobile number" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^\d+\s-]/g, "")); setErr(""); }} />}
                        </div>
                        <div className={`st-chan${chan.email ? " on" : ""}`}>
                            <button type="button" role="checkbox" aria-checked={chan.email} onClick={() => setChan((s) => ({ ...s, email: !s.email }))}>
                                <i>{chan.email ? <Check size={14} strokeWidth={3} /> : null}</i><Mail size={16} />Email
                            </button>
                            {chan.email && <input className="st-in" type="email" aria-label="Customer email" placeholder="Customer's email address" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />}
                        </div>

                        <div className="st-f">
                            <label>Quotation valid for</label>
                            <div className="st-seg wrap" role="group">
                                {VALIDITY.map(([d, l]) => <button key={d} type="button" aria-pressed={validity === d} onClick={() => setValidity(d)}>{l}</button>)}
                            </div>
                        </div>
                        <div className="st-f">
                            <label htmlFor="qs-note">Message to the customer (optional)</label>
                            <textarea id="qs-note" className="st-in" rows={2} maxLength={500} placeholder="e.g. Delivery within 5 days of confirmation" value={note} onChange={(e) => setNote(e.target.value)} />
                        </div>
                        <p className="st-hint">Each product is sent with its name, short description, your price and a link to the product page.</p>
                    </>)}

                    {view === "done" && result && (<>
                        <div className="st-okc"><Check size={30} strokeWidth={3} /></div>
                        <p className="st-center"><b>{result.message}</b></p>
                        <div className="st-sum">
                            {Object.entries(result.delivery || {}).map(([ch, d]) => (
                                <p key={ch} className={d.status === "sent" ? "" : "bad"}>
                                    <span>{ch === "whatsapp" ? "WhatsApp" : "Email"}</span>
                                    <b>{d.status === "sent" ? "Sent" : "Failed"}</b>
                                    {d.status !== "sent" && d.error && <small>{d.error}</small>}
                                </p>
                            ))}
                            <p className="tot"><span>Total (incl. GST)</span><b>{inr(result.quote.total)}</b></p>
                        </div>
                        <p className="st-hint st-center">The quotation is saved in the thread. You can retry any failed channel from there.</p>
                    </>)}
                </div>

                <div className="st-sh-f">
                    {err && <p className="st-err" role="alert" style={{ flex: "1 1 100%" }}><AlertCircle size={14} /> {err}</p>}
                    {view === "pick" && (<>
                        <span className="st-grow">{lines.length ? `${lines.length} selected` : "Nothing selected"}</span>
                        <button type="button" className="st-btn pri" onClick={goReview}>Continue</button>
                    </>)}
                    {view === "review" && (<>
                        <span className="st-grow">Total {inr(totals.total)}</span>
                        <button type="button" className="st-btn pri" disabled={busy} onClick={send}>
                            {busy ? <Loader2 size={16} className="st-spin" /> : null}{busy ? "Sending…" : "Send quotation"}
                        </button>
                    </>)}
                    {view === "done" && <button type="button" className="st-btn pri" style={{ marginLeft: "auto" }} onClick={onClose}>Done</button>}
                </div>
            </div>
        </div>,
        document.body,
    );
}