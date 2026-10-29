// src/components/orderBook/OrderBookSheet.jsx
// Punch an order (salesperson).  CUSTOMER: pick one of your customers, or add a new one by GST number.
// The customer must have a mobile number or an email (at least one), so they can be told when the order is placed / processed.
// BUYER ADDRESS: filled from the GST number (full registered address), then editable.
// PRODUCTS: tag products from the company catalog (or type a name). Catalog products are ordered in whole packs or
// master packs, never single units; the sheet shows what one pack / master pack contains.
// PRICE: entered per unit (Kg, Pcs ...), per pack or per master pack, including or excluding GST. It is converted here to
// the price per pack / master pack with GST included, which is what the server stores. Prices are for the log only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, BadgeCheck, Search, UserPlus, PackagePlus, Plus, Trash2 } from "lucide-react";
import { fetchCatalogProducts } from "../../utils/salesThreadApi.js";
import { fetchSalesCustomers } from "../../utils/salesApi.js";
import { salesOrderBook } from "../../utils/orderBookApi.js";
import { RFQ_UNITS } from "../../utils/rfqUtils.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, ov, ol, initialOf, qty, inr } from "../sales/salesThreadFmt.js";
import { packLines, unitsPerSale, basisWord, minQty } from "./orderBookPack.js";
import { MANUAL, productPack, priceUnitOptions, defaultPriceUnit, convertPrice, inclPerUnit, salePrice } from "./orderBookPrice.js";
import "../sales/sales-threads.css";
import "./order-book.css";

const PAGE = 8;
const MAX_LINES = 20;
const CONTACT_MSG = "Add a mobile number or an email (at least one) so the customer gets their order updates.";

function useDebounced(value, ms = 300) {
    const [d, setD] = useState(value.trim());
    useEffect(() => { const t = setTimeout(() => setD(value.trim()), ms); return () => clearTimeout(t); }, [value, ms]);
    return d;
}

// Full company name + address for a GST number. status: idle | loading | ok | fail
function useGstAddress(token) {
    const [status, setStatus] = useState("idle");
    const seq = useRef(0);
    const run = useCallback(async (raw) => {
        const gstin = cleanGstin(raw);
        const my = ++seq.current;
        if (!GSTIN_RE.test(gstin)) { setStatus("idle"); return null; }
        setStatus("loading");
        const res = await salesOrderBook.gstAddress(token, gstin);
        if (my !== seq.current) return null;
        if (res.success && res.found) { setStatus("ok"); return res; }
        setStatus("fail");
        return null;
    }, [token]);
    const reset = useCallback(() => { seq.current++; setStatus("idle"); }, []);
    return { status, run, reset };
}

// Paged, searchable remote list. fetchPage(q, offset) -> { success, items, hasMore, nextOffset? }
function useRemoteList(fetchPage, q, enabled, keyOf) {
    const [items, setItems] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    const [notReady, setNotReady] = useState(false);
    const seq = useRef(0);
    const next = useRef(0);
    const fetchRef = useRef(fetchPage); fetchRef.current = fetchPage;
    const keyRef = useRef(keyOf); keyRef.current = keyOf;

    const load = useCallback(async (offset) => {
        const my = ++seq.current;
        if (offset) setMore(true); else { setLoading(true); setError(""); }
        const res = await fetchRef.current(q, offset);
        if (my !== seq.current) return;
        setLoading(false); setMore(false);
        if (!res.success) { setError(res.message || "Couldn't load the list."); return; }
        const inc = res.items || [];
        next.current = res.nextOffset ?? offset + inc.length;
        setItems((prev) => (offset ? [...prev, ...inc.filter((i) => !prev.some((p) => keyRef.current(p) === keyRef.current(i)))] : inc));
        setHasMore(!!res.hasMore);
        setNotReady(res.sellerReady === false);
    }, [q]);

    useEffect(() => { if (enabled) load(0); }, [enabled, load]);
    const loadMore = useCallback(() => load(next.current), [load]);
    return { items, hasMore, loading, more, error, notReady, reload: () => load(0), loadMore };
}

function SearchList({ placeholder, label, value, onChange, list, keyOf, renderRow, empty }) {
    return (
        <>
            <label className="st-srch">
                <Search size={16} aria-hidden="true" />
                <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" />
                {value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X size={14} /></button>}
            </label>
            <div className="st-pick" data-lenis-prevent aria-label={label}>
                {list.loading && <div aria-busy="true">{[0, 1].map((i) => <div key={i} className="st-sk" />)}</div>}
                {!list.loading && list.error && <p className="st-err">{list.error} <button type="button" className="st-lnk" onClick={list.reload}>Try again</button></p>}
                {!list.loading && !list.error && list.items.length === 0 && <p className="st-empty">{empty}</p>}
                {!list.loading && list.items.map((i) => <div key={keyOf(i)}>{renderRow(i)}</div>)}
                {!list.loading && list.hasMore && (
                    <button type="button" className="st-btn st-full" disabled={list.more} onClick={list.loadMore}>
                        {list.more ? <Loader2 size={16} className="st-spin" /> : null}Show more
                    </button>
                )}
            </div>
        </>
    );
}

function Thumb({ src, name }) {
    return <span className="st-th">{src ? <img src={src} alt="" loading="lazy" /> : (name || "?").trim()[0]?.toUpperCase()}</span>;
}

const blankCustomer = { mode: "pick", picked: null, gstin: "", name: "", phone: "", email: "", fromGst: false };
const blankAddr = { address: "", city: "", state: "", pincode: "", touched: false, fromGst: false };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Price of one line, per pack / master pack (or per unit for typed products), GST included.
const lineSale = (l) => salePrice({ price: l.price, pu: l.pu, incl: l.incl, pct: l.gstPct, f: l.pack || MANUAL, basis: l.pack ? l.basis : null });
const lineTotalOf = (l) => r2(num(l.quantity) * lineSale(l));

export default function OrderBookSheet({ token, onClose, onCreated }) {
    useSheetBehavior(onClose);
    const [c, setC] = useState(blankCustomer);
    const [addr, setAddr] = useState(blankAddr);
    const [lines, setLines] = useState([]);
    const [picking, setPicking] = useState(true);       // product picker open
    const [manual, setManual] = useState(false);        // typing a product name instead
    const [manualName, setManualName] = useState("");
    const [notes, setNotes] = useState("");
    const [cSearch, setCSearch] = useState("");
    const [pSearch, setPSearch] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const gst = useGstAddress(token);

    const units = useMemo(() => (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) })), []);
    const touch = () => setFormErr("");
    const patchC = (patch) => { setC((s) => ({ ...s, ...patch })); setErrors((e) => ({ ...e, contact: undefined })); touch(); };
    const patchAddr = (patch) => { setAddr((a) => ({ ...a, ...patch, touched: true, fromGst: false })); setErrors((e) => ({ ...e, pincode: undefined })); touch(); };
    const patchLine = (key, patch) => { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); touch(); };
    const removeLine = (key) => { setLines((ls) => { const next = ls.filter((l) => l.key !== key); if (!next.length) setPicking(true); return next; }); touch(); };

    // Packs <-> master packs only changes the quantity (it restarts at the MOQ). The price is entered in its own unit, so it stays as typed.
    const switchBasis = (l, basis) => patchLine(l.key, { basis, quantity: String(minQty(l.pack, basis, l.moq)) });
    // Changing the unit or the GST mode converts the number, so the real price stays the same.
    const switchPu = (l, pu) => patchLine(l.key, { pu, price: convertPrice(l.price, { pu: l.pu, incl: l.incl }, { pu, incl: l.incl }, l.pack || MANUAL, l.gstPct) || l.price });
    const switchIncl = (l, incl) => {
        if (l.incl === incl) return;
        patchLine(l.key, { incl, price: convertPrice(l.price, { pu: l.pu, incl: l.incl }, { pu: l.pu, incl }, l.pack || MANUAL, l.gstPct) || l.price });
    };

    // Fill the address from a GST lookup result, unless the salesperson already typed in it while the lookup ran.
    const applyGstAddress = (r) => setAddr((a) => (a.touched ? a : {
        address: r.address || "", city: r.city || "", state: r.state || "", pincode: r.pincode || "", touched: false, fromGst: !!r.address,
    }));

    const dCq = useDebounced(cSearch);
    const custList = useRemoteList(
        useCallback((q, offset) => fetchSalesCustomers(token, { q, filter: "all", limit: PAGE, offset }), [token]),
        dCq, c.mode === "pick", (i) => i.id,
    );
    const dPq = useDebounced(pSearch);
    const prodList = useRemoteList(
        useCallback((q, offset) => fetchCatalogProducts(token, { q, limit: PAGE, offset }), [token]),
        dPq, picking && !manual, (i) => i.submissionId,
    );

    // New customer: a full GST number fetches the company name and the full address.
    useEffect(() => {
        if (c.mode !== "new") return undefined;
        const g = cleanGstin(c.gstin);
        if (!GSTIN_RE.test(g)) { gst.reset(); return undefined; }
        let live = true;
        setAddr(blankAddr);
        gst.run(g).then((r) => {
            if (!live || !r) return;
            if (r.name) setC((s) => ({ ...s, name: r.name, fromGst: true }));
            applyGstAddress(r);
        });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c.gstin, c.mode]);

    // Picked customer with a GST number: prefill the address the same way.
    const pickedGstin = c.mode === "picked" ? c.picked?.gstin || "" : "";
    useEffect(() => {
        if (!pickedGstin) return undefined;
        let live = true;
        setAddr(blankAddr);
        gst.run(pickedGstin).then((r) => { if (live && r) applyGstAddress(r); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickedGstin]);

    const pickCustomer = (cu) => {
        setC({ ...blankCustomer, mode: "picked", picked: cu });
        setAddr(blankAddr); gst.reset();
        setErrors((e) => ({ ...e, customer: undefined, contact: undefined })); touch();
    };
    const resetCustomer = () => { setC({ ...blankCustomer }); setAddr(blankAddr); gst.reset(); };

    const addCatalog = (pr) => {
        if (pr.reason || lines.some((l) => l.submissionId === pr.submissionId) || lines.length >= MAX_LINES) return;
        const f = productPack(pr);
        const basis = f.per ? "per_master_pack" : "per_pack";
        const gstKnown = pr.gstPercent != null && pr.gstPercent !== "" && Number.isFinite(Number(pr.gstPercent));
        setLines((ls) => [...ls, {
            key: pr.submissionId, submissionId: pr.submissionId, productName: pr.productName, brandName: pr.brandName || "", image: pr.image || null,
            pack: f, basis, moq: pr.moq, unit: pr.unit, quantity: String(minQty(f, basis, pr.moq)),
            price: "", pu: defaultPriceUnit(f, basis), incl: true, gstPct: gstKnown ? String(Number(pr.gstPercent)) : "", gstKnown,
        }]);
        setPicking(false); setPSearch(""); setErrors((e) => ({ ...e, items: undefined })); touch();
    };
    const addManual = () => {
        const name = manualName.trim();
        if (name.length < 2) { setErrors((e) => ({ ...e, manual: "Enter the product name." })); return; }
        setLines((ls) => [...ls, {
            key: `m-${Date.now()}`, submissionId: null, productName: name, brandName: "", image: null, pack: null, basis: null, moq: null, unit: "",
            quantity: "", price: "", pu: "unit", incl: true, gstPct: "", gstKnown: false,
        }]);
        setManual(false); setManualName(""); setPicking(false); setErrors((e) => ({ ...e, manual: undefined, items: undefined })); touch();
    };

    const total = lines.reduce((a, l) => a + lineTotalOf(l), 0);

    // The contact the order will be sent with. A picked customer's saved details win; if they have none,
    // the phone / email typed in the sheet are used.
    const picked = c.picked;
    const pickedNoContact = c.mode === "picked" && picked && !picked.phone && !picked.email;
    const contactPhone = c.mode === "picked" ? (picked?.phone || c.phone.trim()) : c.phone.trim();
    const contactEmail = c.mode === "picked" ? (picked?.email || c.email.trim()) : c.email.trim();

    const validate = () => {
        const e = {};
        if (c.mode === "pick") e.customer = "Choose a customer, or add a new one.";
        if (c.mode === "new") {
            const g = cleanGstin(c.gstin);
            if (g && !GSTIN_RE.test(g)) e.gstin = "Enter all 15 characters of the GST number, or clear it.";
            if (!g && !c.name.trim()) e.name = "Enter the GST number or the company name.";
        }
        if (c.mode === "new" || pickedNoContact) {
            if (c.phone.trim() && !cleanPhone(c.phone)) e.phone = "Enter a valid 10-digit mobile number.";
            if (c.email.trim() && !cleanEmail(c.email)) e.email = "Enter a valid email address.";
        }
        // At least one way to reach the customer.
        if (c.mode !== "pick" && !contactPhone && !contactEmail) e.contact = CONTACT_MSG;
        if (addr.pincode.trim() && !/^\d{6}$/.test(addr.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode.";
        if (!lines.length) e.items = "Add at least one product.";
        const le = {};
        for (const l of lines) {
            const x = {};
            if (!(num(l.quantity) > 0)) x.quantity = "Enter the quantity.";
            else if (l.pack && !Number.isInteger(num(l.quantity))) x.quantity = `Enter a whole number of ${basisWord(l.basis, 2)}.`;
            if (!l.pack && !l.unit) x.unit = "Choose a unit.";
            if (!(num(l.price) > 0)) x.price = "Enter the price.";
            if (!l.incl && !l.gstKnown && !(l.gstPct !== "" && num(l.gstPct) >= 0 && num(l.gstPct) <= 100)) x.gst = "Enter the GST % to add on top of the price.";
            if (Object.keys(x).length) le[l.key] = x;
        }
        if (Object.keys(le).length) e.lines = le;
        return e;
    };

    const submit = async () => {
        if (busy) return;
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length) { setFormErr(e.contact && Object.keys(e).length === 1 ? e.contact : "Please fix the highlighted fields."); return; }

        const cu = c.mode === "picked"
            ? { customerGstin: picked.gstin || "", customerName: picked.name || "", customerPhone: contactPhone, customerEmail: contactEmail }
            : { customerGstin: cleanGstin(c.gstin), customerName: c.name.trim(), customerPhone: c.phone.trim(), customerEmail: c.email.trim() };

        setBusy(true); setFormErr("");
        const res = await salesOrderBook.create(token, {
            ...cu, notes: notes.trim(),
            customerAddress: addr.address.trim(), customerCity: addr.city.trim(), customerState: addr.state.trim(), customerPincode: addr.pincode.trim(),
            items: lines.map((l) => ({
                productSubmissionId: l.submissionId || undefined, productName: l.productName,
                // unitPrice is always per pack / master pack (per unit for typed products), GST included: what the server expects.
                quantity: num(l.quantity), unitPrice: lineSale(l),
                ...(l.pack ? { basis: l.basis } : { unit: l.unit }),
            })),
        });
        setBusy(false);
        if (!res.success) return setFormErr(res.message || "Couldn't punch the order. Please try again.");
        onCreated?.(res.order);
    };

    const gstHint = gst.status === "loading" ? "Finding the company and its address…"
        : gst.status === "ok" ? "Company name and address filled from the GST number."
            : gst.status === "fail" ? "Couldn't find this GST number. Type the company name below." : "Optional. We fill in the company name and address from it.";

    // Mobile + email inputs. Used for a new customer, and for a picked customer who has no contact saved.
    const contactFields = (idSuffix) => (
        <>
            <div className="st-two">
                <div className="st-f">
                    <label htmlFor={`ob-ph${idSuffix}`}>Mobile number</label>
                    <input id={`ob-ph${idSuffix}`} className="st-in" inputMode="tel" autoComplete="off" placeholder="10 digits" value={c.phone}
                        onChange={(e) => patchC({ phone: e.target.value.replace(/[^\d+\s-]/g, "") })} />
                    {errors.phone && <p className="st-err">{errors.phone}</p>}
                </div>
                <div className="st-f">
                    <label htmlFor={`ob-em${idSuffix}`}>Email</label>
                    <input id={`ob-em${idSuffix}`} className="st-in" type="email" autoComplete="off" placeholder="name@company.com" value={c.email} onChange={(e) => patchC({ email: e.target.value })} />
                    {errors.email && <p className="st-err">{errors.email}</p>}
                </div>
            </div>
            {errors.contact
                ? <p className="st-err" role="alert">{errors.contact}</p>
                : <p className="st-hint">Add at least one. The customer gets an order confirmation on WhatsApp / email as soon as the order is placed.</p>}
        </>
    );

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="Punch order">
                <div className="st-sh-h">
                    <div><h2>Punch order</h2><p>Your team is notified as soon as you place it.</p></div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" data-lenis-prevent>
                    {/* ------------------------------ customer ------------------------------ */}
                    <p className="st-sec">Customer</p>

                    {c.mode === "picked" && picked && (
                        <>
                            <div className="st-sel">
                                <span className="st-av">{initialOf(picked.name)}</span>
                                <span className="st-prod-t">
                                    <b>{picked.name}</b>
                                    {picked.gstin && <small>GSTIN {picked.gstin}</small>}
                                    <small>{[picked.phone, picked.email].filter(Boolean).join(" · ") || "No phone or email saved yet."}</small>
                                </span>
                                <button type="button" className="st-lnk" onClick={resetCustomer}>Change</button>
                            </div>
                            {pickedNoContact && <div style={{ marginTop: 10 }}>{contactFields("-p")}</div>}
                        </>
                    )}

                    {c.mode === "pick" && (
                        <>
                            <SearchList label="Search your customers" placeholder="Search your customers by name, GST number or contact"
                                value={cSearch} onChange={setCSearch} list={custList} keyOf={(i) => i.id}
                                empty={custList.notReady ? "Your company isn't set up to sell yet." : dCq ? "No customer matches your search." : "You have no customers yet."}
                                renderRow={(i) => (
                                    <button type="button" className="st-prod pick" onClick={() => pickCustomer(i)}>
                                        <span className="st-av">{initialOf(i.name)}</span>
                                        <span className="st-prod-t">
                                            <b>{i.name}</b>
                                            <small>{[i.gstin ? `GSTIN ${i.gstin}` : null, i.status === "active" ? "On BBM" : null].filter(Boolean).join(" · ")}</small>
                                            {(i.phone || i.email) && <small>{[i.phone, i.email].filter(Boolean).join(" · ")}</small>}
                                        </span>
                                    </button>
                                )} />
                            <button type="button" className="st-btn st-full" onClick={() => { setC({ ...blankCustomer, mode: "new" }); setAddr(blankAddr); touch(); }}>
                                <UserPlus size={16} />Customer not listed? Add a new one
                            </button>
                            {errors.customer && <p className="st-err" style={{ marginTop: 6 }}>{errors.customer}</p>}
                        </>
                    )}

                    {c.mode === "new" && (
                        <>
                            <div className="st-f">
                                <label htmlFor="ob-gst">GST number</label>
                                <div className="st-inw">
                                    <input id="ob-gst" className="st-in" value={c.gstin} maxLength={15} autoCapitalize="characters" autoComplete="off"
                                        placeholder="e.g. 24ABCDE1234F1Z5" onChange={(e) => patchC({ gstin: cleanGstin(e.target.value) })} />
                                    {gst.status === "loading" && <Loader2 size={16} className="st-spin st-inw-i" />}
                                    {gst.status === "ok" && <BadgeCheck size={18} className="st-inw-i ok" />}
                                </div>
                                <p className={`st-hint${gst.status === "fail" ? " warn" : ""}`}>{errors.gstin ? <span className="st-err">{errors.gstin}</span> : gstHint}</p>
                            </div>
                            <div className="st-f">
                                <label htmlFor="ob-name">Company name {!cleanGstin(c.gstin) && "*"}</label>
                                <input id="ob-name" className="st-in" value={c.name} placeholder="Customer's company name" onChange={(e) => patchC({ name: e.target.value, fromGst: false })} />
                                {c.fromGst && <p className="st-hint">From the GST records. The saved name always comes from the GST number.</p>}
                                {errors.name && <p className="st-err">{errors.name}</p>}
                            </div>
                            {contactFields("")}
                            <button type="button" className="st-lnk" onClick={resetCustomer}>Search my customers instead</button>
                        </>
                    )}

                    {/* ------------------------------ buyer address ------------------------------ */}
                    {c.mode !== "pick" && (
                        <>
                            <p className="st-sec">Buyer address</p>
                            <div className="st-f">
                                <label htmlFor="ob-addr">Full address</label>
                                <textarea id="ob-addr" className="st-in" rows={3} maxLength={400} value={addr.address}
                                    placeholder="Building, street, area" onChange={(e) => patchAddr({ address: e.target.value })} />
                                <p className="st-hint">
                                    {gst.status === "loading" ? "Fetching the address from the GST number…"
                                        : addr.fromGst ? "Filled from the GST records. Change anything that is different."
                                            : "Optional. Add it so the team knows where the order goes."}
                                </p>
                            </div>
                            <div className="st-two">
                                <div className="st-f">
                                    <label htmlFor="ob-city">City / district</label>
                                    <input id="ob-city" className="st-in" maxLength={80} value={addr.city} onChange={(e) => patchAddr({ city: e.target.value })} />
                                </div>
                                <div className="st-f">
                                    <label htmlFor="ob-state">State</label>
                                    <input id="ob-state" className="st-in" maxLength={60} value={addr.state} onChange={(e) => patchAddr({ state: e.target.value })} />
                                </div>
                            </div>
                            <div className="st-f">
                                <label htmlFor="ob-pin">Pincode</label>
                                <input id="ob-pin" className="st-in" inputMode="numeric" maxLength={6} placeholder="6 digits" value={addr.pincode}
                                    onChange={(e) => patchAddr({ pincode: e.target.value.replace(/\D/g, "") })} />
                                {errors.pincode && <p className="st-err">{errors.pincode}</p>}
                            </div>
                        </>
                    )}

                    {/* ------------------------------ products ------------------------------ */}
                    <p className="st-sec">Products</p>

                    {lines.map((l) => {
                        const le = errors.lines?.[l.key] || {};
                        const f = l.pack;                                   // null for a typed-name product
                        const fx = f || MANUAL;
                        const word = l.basis === "per_master_pack" ? "master pack" : "pack";
                        const perSale = f ? unitsPerSale(f, l.basis) : 0;
                        const totalUnits = f ? num(l.quantity) * perSale : 0;
                        const moqMin = f && num(l.moq) > 0 ? minQty(f, l.basis, l.moq) : 0;
                        const sp = lineSale(l);                             // per pack / master pack (per unit if typed), GST incl.
                        const perUnit = inclPerUnit({ price: l.price, pu: l.pu, incl: l.incl, pct: l.gstPct, f: fx });
                        const puOpts = f ? priceUnitOptions(f) : [];
                        return (
                            <div className="ob-le" key={l.key}>
                                <div className="ob-le-h">
                                    <Thumb src={l.image} name={l.productName} />
                                    <span className="st-prod-t"><b>{l.productName}</b><small>{l.brandName || (l.submissionId ? "From your catalog" : "Typed by hand")}</small></span>
                                    <button type="button" className="st-ib sm" aria-label={`Remove ${l.productName}`} onClick={() => removeLine(l.key)}><Trash2 size={16} /></button>
                                </div>

                                {f && <div className="ob-pkbox">{packLines(f).map((t) => <span key={t}>{t}</span>)}</div>}

                                <div className="st-two">
                                    <div className="st-f">
                                        <label htmlFor={`q-${l.key}`}>{f ? `Quantity (${word}s) *` : "Quantity *"}</label>
                                        <input id={`q-${l.key}`} className="st-in" inputMode={f ? "numeric" : "decimal"} placeholder="e.g. 5" value={l.quantity}
                                            onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(f ? /\D/g : /[^\d.]/g, "") })} />
                                        {le.quantity && <p className="st-err">{le.quantity}</p>}
                                    </div>
                                    <div className="st-f">
                                        {f ? (
                                            <>
                                                <label htmlFor={`u-${l.key}`}>Ordered in *</label>
                                                <select id={`u-${l.key}`} className="st-in" value={l.basis} disabled={!f.per} onChange={(e) => switchBasis(l, e.target.value)}>
                                                    {f.per ? <option value="per_master_pack">Master packs</option> : null}
                                                    <option value="per_pack">Packs</option>
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label htmlFor={`u-${l.key}`}>Unit *</label>
                                                <select id={`u-${l.key}`} className="st-in" value={l.unit} onChange={(e) => patchLine(l.key, { unit: e.target.value })}>
                                                    <option value="">Select…</option>
                                                    {units.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                                {le.unit && <p className="st-err">{le.unit}</p>}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {f && (
                                    <p className="st-hint ob-conv">
                                        {num(l.quantity) > 0 ? `= ${qty(totalUnits)} ${f.unit} in total` : `Enter how many ${word}s.`}
                                        {moqMin > 0 ? ` · Seller's MOQ: ${moqMin} ${basisWord(l.basis, moqMin)}` : ""}
                                    </p>
                                )}

                                {/* price: any unit, with or without GST */}
                                <div className="st-two">
                                    <div className="st-f">
                                        <label htmlFor={`p-${l.key}`}>Price (₹) *</label>
                                        <input id={`p-${l.key}`} className="st-in" inputMode="decimal" placeholder="e.g. 1250" value={l.price}
                                            onChange={(e) => patchLine(l.key, { price: e.target.value.replace(/[^\d.]/g, "") })} />
                                        {le.price && <p className="st-err">{le.price}</p>}
                                    </div>
                                    <div className="st-f">
                                        <label htmlFor={`pu-${l.key}`}>Price per</label>
                                        {f ? (
                                            <select id={`pu-${l.key}`} className="st-in" value={l.pu} onChange={(e) => switchPu(l, e.target.value)}>
                                                {puOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        ) : (
                                            <select id={`pu-${l.key}`} className="st-in" value="unit" disabled><option value="unit">Per unit</option></select>
                                        )}
                                    </div>
                                </div>
                                <div className="st-seg" role="group" aria-label="GST">
                                    <button type="button" aria-pressed={l.incl} onClick={() => switchIncl(l, true)}>Includes GST</button>
                                    <button type="button" aria-pressed={!l.incl} onClick={() => switchIncl(l, false)}>Excludes GST</button>
                                </div>
                                {!l.incl && l.gstKnown && <p className="st-hint">GST {qty(num(l.gstPct))}% is added on top of this price.</p>}
                                {!l.incl && !l.gstKnown && (
                                    <div className="st-f" style={{ marginTop: 6 }}>
                                        <label htmlFor={`g-${l.key}`}>GST % to add *</label>
                                        <input id={`g-${l.key}`} className="st-in" inputMode="decimal" placeholder="e.g. 18" value={l.gstPct}
                                            onChange={(e) => patchLine(l.key, { gstPct: e.target.value.replace(/[^\d.]/g, "") })} />
                                        {le.gst && <p className="st-err">{le.gst}</p>}
                                    </div>
                                )}
                                {sp > 0 && (
                                    <p className="st-hint ob-conv">
                                        = {inr(sp, 4)} per {f ? word : "unit"} incl. GST{f && (f.pack > 1 || f.per) ? ` · about ${inr(perUnit, 4)} per ${f.unit}` : ""}
                                    </p>
                                )}
                                <div className="st-line-t"><span>Line total (incl. GST)</span><b>{inr(lineTotalOf(l))}</b></div>
                            </div>
                        );
                    })}

                    {picking && !manual && (
                        <>
                            <SearchList label="Search your company's products" placeholder="Search your company's products"
                                value={pSearch} onChange={setPSearch} list={prodList} keyOf={(i) => i.submissionId}
                                empty={dPq ? `No product matches "${dPq}".` : "Your company has no products yet."}
                                renderRow={(i) => {
                                    const added = lines.some((l) => l.submissionId === i.submissionId);
                                    const pf = productPack(i);
                                    return (
                                        <button type="button" className="st-prod pick" disabled={!!i.reason || added} onClick={() => addCatalog(i)}>
                                            <Thumb src={i.image} name={i.productName} />
                                            <span className="st-prod-t">
                                                <b>{i.productName}</b>
                                                {i.brandName && <small>{i.brandName}</small>}
                                                <small>{packLines(pf).join(" · ")}</small>
                                                {i.gstPercent ? <small>GST {qty(i.gstPercent)}%</small> : null}
                                                {added && <em className="soft">Already added</em>}
                                                {i.reason && <em>{i.reason}: can't be used right now</em>}
                                            </span>
                                        </button>
                                    );
                                }} />
                            <button type="button" className="st-btn st-full" onClick={() => { setManual(true); touch(); }}><PackagePlus size={16} />Product not listed? Type its name</button>
                            {lines.length > 0 && <button type="button" className="st-lnk" style={{ marginTop: 8 }} onClick={() => setPicking(false)}>Done adding products</button>}
                        </>
                    )}

                    {picking && manual && (
                        <>
                            <div className="st-f">
                                <label htmlFor="ob-prod">Product name *</label>
                                <input id="ob-prod" className="st-in" value={manualName} placeholder="e.g. Stainless steel hinges 4 inch" maxLength={200}
                                    onChange={(e) => { setManualName(e.target.value); setErrors((x) => ({ ...x, manual: undefined })); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} />
                                {errors.manual && <p className="st-err">{errors.manual}</p>}
                            </div>
                            <div className="ob-row-btns">
                                <button type="button" className="st-btn pri" onClick={addManual}><Plus size={16} />Add product</button>
                                <button type="button" className="st-lnk" onClick={() => { setManual(false); setManualName(""); }}>Choose from my products instead</button>
                            </div>
                        </>
                    )}

                    {!picking && lines.length < MAX_LINES && (
                        <button type="button" className="st-btn st-full" onClick={() => setPicking(true)}><Plus size={16} />Add another product</button>
                    )}
                    {errors.items && <p className="st-err" style={{ marginTop: 6 }}>{errors.items}</p>}
                    <p className="st-hint" style={{ marginTop: 8 }}>Prices are for your records only. They are saved with GST included and don't change any price on BBM.</p>

                    <div className="st-f" style={{ marginTop: 14 }}>
                        <label htmlFor="ob-notes">Notes</label>
                        <textarea id="ob-notes" className="st-in" rows={2} maxLength={1000} placeholder="Delivery instructions, payment terms, anything the team should know" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </div>

                <div className="st-sh-f">
                    {formErr && <p className="st-err st-ferr" role="alert">{formErr}</p>}
                    <span className="st-grow">{lines.length > 0 ? `Total ${inr(total)}` : ""}</span>
                    <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy || gst.status === "loading"} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}Punch order
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}