// src/components/sales/SalesQuoteSheet.jsx
// Quotation flow: pick company products -> set this customer's price -> choose WhatsApp / email -> send.
// Products are quoted in whole packs or master packs (never single units): the quantity is a number of packs / master
// packs and the price is per pack / master pack. Every line shows what one pack contains and the total in the listing's unit.
// Prices are tied to the customer's GST number and pre-filled next time (saved prices are per listing unit; they are
// converted to the pack / master pack price shown here).
// The product tagged on the enquiry (if any) is pre-selected. The customer is added to the customer list on send.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Check, Loader2, ArrowLeft, Trash2, MessageCircle, Mail, AlertCircle } from "lucide-react";
import { fetchQuoteProducts, sendThreadQuote, updateThread } from "../../utils/salesThreadApi.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, inr, qty, round4 } from "./salesThreadFmt.js";
import { packFacts, packLines, unitsPerSale, basisWord, minQty } from "../orderBook/orderBookPack.js";
import "./sales-threads.css";
import "../orderBook/order-book.css";

const PAGE = 20;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const packOf = (p) => packFacts({ packSize: p.packSize, packsPerMaster: p.masterPackSize, unit: p.unit });
const defaultBasis = (f) => (f.per ? "per_master_pack" : "per_pack");

function Thumb({ src, name }) {
    return <span className="st-th">{src ? <img src={src} alt="" loading="lazy" /> : (name || "?").trim()[0]?.toUpperCase()}</span>;
}

// l.qty = number of packs / master packs, l.price = price per pack / master pack.
function calcLine(l) {
    const g = 1 + (Number(l.p.gstPercent) || 0) / 100;
    const price = parseFloat(l.price) || 0, q = parseFloat(l.qty) || 0;
    const unitIncl = l.gstIncl ? price : price * g;
    const total = r2(unitIncl * q);
    return { total, taxable: r2(total / g) };
}

// The single most useful price to show for a product: this customer's current price, else the last quote, else list.
// These are stored per listing unit (Kg, Pcs ...).
function priceHint(p) {
    if (p.customUnitPriceIncl != null) return { label: "Current price for this customer", price: p.customUnitPriceIncl, strong: true };
    if (p.lastUnitPriceIncl != null) return { label: "Last quoted to this customer", price: p.lastUnitPriceIncl, strong: true };
    if (p.listUnitPriceIncl != null) return { label: "List price", price: p.listUnitPriceIncl, strong: false };
    return null;
}

// "Last quoted to this customer: ₹1,250 per master pack incl. GST (₹1.25 / Kg)"
function hintText(h, f, basis, unit) {
    const per = unitsPerSale(f, basis);
    const word = basis === "per_master_pack" ? "master pack" : "pack";
    return `${h.label}: ${inr(round4(h.price * per), 4)} per ${word} incl. GST (${inr(h.price, 4)} / ${unit})`;
}

// New line: ordered in master packs when the product has them, else packs. Quantity starts at what the customer asked for
// (rounded up to whole packs) but never below the seller's MOQ; the price is the best known per-unit price converted to a pack price.
const newLine = (p, thread) => {
    const f = packOf(p);
    const basis = defaultBasis(f);
    const per = unitsPerSale(f, basis);
    const start = p.customUnitPriceIncl ?? p.lastUnitPriceIncl ?? p.listUnitPriceIncl;
    const asked = p.unitMatches ? Math.ceil((Number(thread.quantity) || 0) / per) : 0;
    const q = Math.max(1, asked, minQty(f, basis, p.moq));
    return { p, f, basis, qty: String(q), price: start != null ? String(round4(start * per)) : "", gstIncl: true, setCustom: true };
};

function CustomPricingNote({ cp }) {
    if (!cp || cp.status === "none") return null;
    if (cp.status === "not_on_bbm") return <p className="st-hint st-center">This customer isn't on BBM yet, so no BBM price was set. The quoted prices are remembered against their GST number.</p>;
    if (cp.status === "own_company") return <p className="st-hint st-center">This GST number is your own company, so no custom price was set.</p>;
    if (cp.status === "failed") return <p className="st-err" role="alert">The quotation was sent, but the custom prices couldn't be set. Set them from the Customers page.</p>;
    const n = cp.applied.length, r = cp.removed.length;
    return (
        <div className="st-sum">
            {n > 0 && <p><span>BBM price set for {cp.buyerName || "the customer"}</span><b>{n} product{n === 1 ? "" : "s"}</b></p>}
            {r > 0 && <p><span>Custom price removed (quoted at list price)</span><b>{r} product{r === 1 ? "" : "s"}</b></p>}
            {cp.skipped.map((s) => <p key={s.submissionId} className="bad"><span>{s.productName}</span><small>{s.reason}</small></p>)}
        </div>
    );
}

export default function SalesQuoteSheet({ token, thread, onClose, onSent }) {
    const [view, setView] = useState("pick"); // pick | review | done
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [products, setProducts] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [lines, setLines] = useState([]); // { p, f, basis, qty, price, gstIncl, setCustom }
    const [gstin, setGstin] = useState(thread.customerGstin || "");
    const [phone, setPhone] = useState(thread.customerPhone || "");
    const [email, setEmail] = useState(thread.customerEmail || "");
    const [chan, setChan] = useState({ whatsapp: !!thread.customerPhone, email: !!thread.customerEmail });
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [buyer, setBuyer] = useState(null);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);
    const seq = useRef(0);
    const nextOffset = useRef(0);
    const taggedDone = useRef(false);
    const bodyRef = useRef(null);

    // Don't lose a half-built quotation to a stray tap on the backdrop or Escape.
    const requestClose = () => {
        if (view !== "done" && lines.length && !window.confirm("Discard this quotation?")) return;
        onClose?.();
    };
    useSheetBehavior(requestClose);

    useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

    const load = useCallback(async (offset) => {
        const my = ++seq.current;
        if (offset) setLoadingMore(true); else { setLoading(true); setLoadError(""); }
        const res = await fetchQuoteProducts(token, thread.id, { q, limit: PAGE, offset });
        if (my !== seq.current) return;
        setLoading(false); setLoadingMore(false);
        if (!res.success) { setLoadError(res.message || "Couldn't load your products."); return; }
        nextOffset.current = res.nextOffset ?? offset + res.items.length;
        setProducts((prev) => (offset ? [...prev, ...res.items.filter((i) => !prev.some((p) => p.submissionId === i.submissionId))] : res.items));
        setHasMore(!!res.hasMore);
        if (!offset) {
            setBuyer(res.buyer ?? null);
            // the product tagged on the enquiry starts out selected
            if (!taggedDone.current) {
                taggedDone.current = true;
                const t = res.items.find((i) => i.tagged && !i.reason);
                if (t) setLines((prev) => (prev.length ? prev : [newLine(t, thread)]));
            }
        }
    }, [token, thread, q]);
    useEffect(() => { load(0); }, [load]);

    const picked = useMemo(() => new Set(lines.map((l) => l.p.submissionId)), [lines]);
    const canSetCustom = buyer?.onBbm !== false;

    const toggle = (p) => {
        if (p.reason) return;
        setErr("");
        setLines((prev) => {
            if (prev.some((l) => l.p.submissionId === p.submissionId)) return prev.filter((l) => l.p.submissionId !== p.submissionId);
            return [...prev, newLine(p, thread)];
        });
    };
    const patchLine = (id, patch) => { setErr(""); setLines((prev) => prev.map((l) => (l.p.submissionId === id ? { ...l, ...patch } : l))); };

    // Keep the same real price when switching between incl. / excl. GST.
    const switchGst = (l, incl) => {
        const g = 1 + (Number(l.p.gstPercent) || 0) / 100, price = parseFloat(l.price);
        if (!(price > 0) || l.gstIncl === incl) return patchLine(l.p.submissionId, { gstIncl: incl });
        patchLine(l.p.submissionId, { gstIncl: incl, price: String(round4(incl ? price * g : price / g)) });
    };

    // Switching between packs and master packs: the quantity restarts at the MOQ, the price is converted
    // so the price per listing unit (e.g. per Kg) stays exactly the same.
    const switchBasis = (l, basis) => {
        if (l.basis === basis) return;
        const from = unitsPerSale(l.f, l.basis), to = unitsPerSale(l.f, basis);
        const price = parseFloat(l.price);
        patchLine(l.p.submissionId, {
            basis, qty: String(minQty(l.f, basis, l.p.moq)),
            price: price > 0 ? String(round4((price / from) * to)) : "",
        });
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
            const n = parseFloat(l.qty);
            if (!(n > 0)) return setErr(`Enter a quantity for ${l.p.productName}.`);
            if (!Number.isInteger(n)) return setErr(`Enter a whole number of ${basisWord(l.basis, 2)} for ${l.p.productName}.`);
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
            // quantity / price stay per listing unit (what the quotation and custom prices already understand);
            // basis / packQuantity / packPrice / unitsPerSaleUnit carry the pack breakdown that was entered.
            items: lines.map((l) => {
                const per = unitsPerSale(l.f, l.basis), n = Number(l.qty), pp = Number(l.price);
                return {
                    submissionId: l.p.submissionId, quantity: round4(n * per), price: round4(pp / per), gstInclusive: l.gstIncl,
                    setCustomPrice: canSetCustom && l.setCustom,
                    basis: l.basis, packQuantity: n, packPrice: pp, unitsPerSaleUnit: per,
                };
            }),
            channels, note: note.trim(),
        });
        setBusy(false);
        if (!res.success) return setErr(res.message || "Couldn't send the quotation. Please try again.");
        setResult(res); setView("done"); onSent?.(res);
        requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 }));
    };

    const title = view === "pick" ? "Choose products" : view === "review" ? "Set prices and send" : "Quotation";

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget && view === "pick" && !lines.length) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="Send quotation">
                <div className="st-sh-h">
                    {view === "review" && <button type="button" className="st-ib" aria-label="Back to products" onClick={() => { setErr(""); setView("pick"); }}><ArrowLeft size={18} /></button>}
                    <div>
                        <h2>{title}</h2>
                        <p>{thread.displayName} · {thread.productName} · {qty(thread.quantity)} {thread.unit}</p>
                    </div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={requestClose}><X size={18} /></button>
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
                            const hint = priceHint(p);
                            const pf = packOf(p);
                            return (
                                <button key={p.submissionId} type="button" className={`st-prod${on ? " on" : ""}`} disabled={!!p.reason}
                                    aria-pressed={on} onClick={() => toggle(p)}>
                                    <Thumb src={p.image} name={p.productName} />
                                    <span className="st-prod-t">
                                        <b>{p.productName}</b>
                                        {p.brandName && <small>{p.brandName}</small>}
                                        <small>{packLines(pf).join(" · ")}</small>
                                        {p.tagged && <small className="ok">Tagged on this enquiry</small>}
                                        {p.description && <small className="st-clip">{p.description}</small>}
                                        {hint && <small className={hint.strong ? "ok" : ""}>{hintText(hint, pf, defaultBasis(pf), p.unit)}</small>}
                                        {p.reason && <em>{p.reason}: can't be quoted right now</em>}
                                        {!p.unitMatches && !p.reason && <em className="soft">Customer asked in {thread.unit}; this is sold in packs of {p.unit}</em>}
                                    </span>
                                    <span className="st-tick" aria-hidden="true">{on ? <Check size={16} strokeWidth={3} /> : null}</span>
                                </button>
                            );
                        })}
                        {!loading && hasMore && (
                            <button type="button" className="st-btn st-full" disabled={loadingMore} onClick={() => load(nextOffset.current)}>
                                {loadingMore ? <Loader2 size={16} className="st-spin" /> : null}Show more
                            </button>
                        )}
                    </>)}

                    {view === "review" && (<>
                        {lines.map((l) => {
                            const c = calcLine(l);
                            const hint = priceHint(l.p);
                            const id = l.p.submissionId;
                            const word = l.basis === "per_master_pack" ? "master pack" : "pack";
                            const per = unitsPerSale(l.f, l.basis);
                            const n = parseFloat(l.qty) || 0;
                            const price = parseFloat(l.price) || 0;
                            const moqMin = Number(l.p.moq) > 0 ? minQty(l.f, l.basis, l.p.moq) : 0;
                            const perUnitIncl = price > 0 ? (l.gstIncl ? price : price * (1 + (Number(l.p.gstPercent) || 0) / 100)) / per : 0;
                            return (
                                <div className="st-line" key={id}>
                                    <div className="st-line-h">
                                        <Thumb src={l.p.image} name={l.p.productName} />
                                        <span className="st-prod-t"><b>{l.p.productName}</b><small>{[l.p.brandName, `GST ${l.p.gstPercent}%`].filter(Boolean).join(" · ")}</small></span>
                                        <button type="button" className="st-ib sm" aria-label={`Remove ${l.p.productName}`} onClick={() => toggle(l.p)}><Trash2 size={15} /></button>
                                    </div>

                                    <div className="ob-pkbox">{packLines(l.f).map((t) => <span key={t}>{t}</span>)}</div>

                                    <div className="st-two">
                                        <div className="st-f">
                                            <label htmlFor={`q-${id}`}>Quantity ({word}s)</label>
                                            <input id={`q-${id}`} className="st-in" inputMode="numeric" placeholder="e.g. 5" value={l.qty} onChange={(e) => patchLine(id, { qty: e.target.value.replace(/\D/g, "") })} />
                                        </div>
                                        <div className="st-f">
                                            <label htmlFor={`u-${id}`}>Ordered in</label>
                                            <select id={`u-${id}`} className="st-in" value={l.basis} disabled={!l.f.per} onChange={(e) => switchBasis(l, e.target.value)}>
                                                {l.f.per ? <option value="per_master_pack">Master packs</option> : null}
                                                <option value="per_pack">Packs</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="st-hint ob-conv">
                                        {n > 0 ? `= ${qty(n * per)} ${l.f.unit} in total` : `Enter how many ${word}s.`}
                                        {moqMin > 0 ? ` · Seller's MOQ: ${moqMin} ${basisWord(l.basis, moqMin)}` : ""}
                                    </p>

                                    <div className="st-f">
                                        <label htmlFor={`p-${id}`}>Price per {word} (₹)</label>
                                        <input id={`p-${id}`} className="st-in" inputMode="decimal" value={l.price} onChange={(e) => patchLine(id, { price: e.target.value.replace(/[^\d.]/g, "") })} />
                                    </div>
                                    <div className="st-seg" role="group" aria-label="GST">
                                        <button type="button" aria-pressed={l.gstIncl} onClick={() => switchGst(l, true)}>Includes GST</button>
                                        <button type="button" aria-pressed={!l.gstIncl} onClick={() => switchGst(l, false)}>Excludes GST</button>
                                    </div>
                                    {perUnitIncl > 0 && <p className="st-hint">About {inr(perUnitIncl, 4)} per {l.f.unit} incl. GST.</p>}
                                    {hint && <p className="st-hint">{hintText(hint, l.f, l.basis, l.p.unit)}.</p>}
                                    <p className="st-line-t"><span>Line total (incl. GST)</span><b>{inr(c.total)}</b></p>
                                </div>
                            );
                        })}

                        {canSetCustom && lines.some((l) => l.setCustom) && (
                            <p className="st-hint">A custom price switches off quantity discounts for that buyer. They pay exactly this price, however much they order.</p>
                        )}

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

                        <div className="st-f" style={{ marginTop: 14 }}>
                            <label htmlFor="qs-note">Message to the customer (optional)</label>
                            <textarea id="qs-note" className="st-in" rows={2} maxLength={500} placeholder="e.g. Delivery within 5 days of confirmation" value={note} onChange={(e) => setNote(e.target.value)} />
                        </div>
                        <p className="st-hint">Each product is sent with its name, short description, your price and a link to the product page. If this customer isn't in your customers yet, they're added when you send.</p>
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
                        {result.customerAdded && <p className="st-hint st-center">{result.customerAdded} was added to your customers.</p>}
                        <CustomPricingNote cp={result.customPricing} />
                        <p className="st-hint st-center">The quotation is saved in the thread. You can retry any failed channel from there.</p>
                    </>)}
                </div>

                <div className="st-sh-f">
                    {err && <p className="st-err st-ferr" role="alert"><AlertCircle size={14} /> {err}</p>}
                    {view === "pick" && (<>
                        <span className="st-grow">{lines.length ? `${lines.length} selected` : "Nothing selected"}</span>
                        <button type="button" className="st-btn pri" disabled={!lines.length} onClick={goReview}>Continue</button>
                    </>)}
                    {view === "review" && (<>
                        <span className="st-grow">Total {inr(totals.total)}</span>
                        <button type="button" className="st-btn pri" disabled={busy} onClick={send}>
                            {busy ? <Loader2 size={16} className="st-spin" /> : null}{busy ? "Sending…" : "Send quotation"}
                        </button>
                    </>)}
                    {view === "done" && <button type="button" className="st-btn pri st-right" onClick={onClose}>Done</button>}
                </div>
            </div>
        </div>,
        document.body,
    );
}