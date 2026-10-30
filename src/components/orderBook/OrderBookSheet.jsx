// src/components/orderBook/OrderBookSheet.jsx
// Punch an order (salesperson).  CUSTOMER: pick one of your customers, or add a new one by GST number.
// The customer must have a mobile number or an email (at least one), so they can be told when the order is placed / processed.
// A picked customer who is missing a mobile number or an email gets input(s) for just the missing one(s). What is typed is
// saved on the customer by the server, so it is pre-filled the next time that customer is picked.
// BUYER ADDRESS: filled from the GST number (full registered address), then editable.
// PRODUCTS: tag products from the company catalog (or type a name). Catalog products are ordered in whole packs or
// master packs, never single units; the sheet shows what one pack / master pack contains.
// PRICES SHOWN: every product shows its marketplace price. Once the customer has a full GST number, it also shows the custom
// price that customer has on BBM (if any) and the last price given to them. The same hints sit under the price field of
// every added product, and they refresh when the customer changes.
// PRICE: entered per unit (Kg, Pcs ...), per pack or per master pack, including or excluding GST. The number the salesperson
// types is NEVER rewritten: changing "Price per" or "Includes / Excludes GST" only changes how that number is read, and every
// other figure (per pack, per unit, line total) is recalculated from it. It is converted here to the price per pack / master
// pack with GST included, which is what the server stores.
// CUSTOM PRICES: like a quotation, the catalog prices become the customer's price on BBM, found by GST number. If the customer
// isn't on BBM yet, the prices are remembered and apply as soon as they join with that GST number. One checkbox turns it off.
// PO NUMBER: optional Purchase Order number of the customer; searchable in the Order Book.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, BadgeCheck, Search, UserPlus, PackagePlus, Plus, Trash2, Check } from "lucide-react";
import { fetchCatalogProducts } from "../../utils/salesThreadApi.js";
import { fetchSalesCustomers } from "../../utils/salesApi.js";
import { salesOrderBook } from "../../utils/orderBookApi.js";
import { RFQ_UNITS } from "../../utils/rfqUtils.js";
import { useSheetBehavior } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, ov, ol, initialOf, qty, inr } from "../sales/salesThreadFmt.js";
import { packLines, unitsPerSale, basisWord, minQty } from "./orderBookPack.js";
import { MANUAL, productPack, priceUnitOptions, defaultPriceUnit, inclPerUnit, salePrice } from "./orderBookPrice.js";
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

// Paged, searchable remote list. fetchPage(q, offset) -> { success, items, hasMore, nextOffset?, buyer? }
// depKey: when it changes, the list is fetched again from the start (the product list uses the customer's GST number).
function useRemoteList(fetchPage, q, enabled, keyOf, depKey = "") {
    const [items, setItems] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    const [notReady, setNotReady] = useState(false);
    const [buyer, setBuyer] = useState(null);
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
        setBuyer(res.buyer ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, depKey]);

    useEffect(() => { if (enabled) load(0); }, [enabled, load]);
    const loadMore = useCallback(() => load(next.current), [load]);
    return { items, hasMore, loading, more, error, notReady, buyer, reload: () => load(0), loadMore };
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
const r4 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e4) / 1e4;
const samePrice = (a, b) => Math.abs(a - b) < 0.00005;

// Price of one line, per pack / master pack (or per unit for typed products), GST included.
const lineSale = (l) => salePrice({ price: l.price, pu: l.pu, incl: l.incl, pct: l.gstPct, f: l.pack || MANUAL, basis: l.pack ? l.basis : null });
const lineTotalOf = (l) => r2(num(l.quantity) * lineSale(l));

// The prices of one catalog product, shown per pack / master pack with the per-unit figure beside it:
//   list   marketplace price (per base unit, GST incl.)       custom  this customer's custom price on BBM (or null)
//   last   last price given to this customer (or null)        hasCustomer / onBbm  whether a customer GST number is known / on BBM
// as = "small" inside a product row, "p" (a hint line) under the price field of an added product.
function PriceHints({ as: Tag = "small", list, custom, last, f, basis, hasCustomer, onBbm }) {
    const per = unitsPerSale(f, basis);
    const word = basis === "per_master_pack" ? "master pack" : "pack";
    const unit = f.unit || "unit";
    const fmt = (u) => `${inr(r4(u * per), 4)} per ${word} incl. GST (${inr(u, 4)} / ${unit})`;
    const cls = Tag === "p" ? "st-hint" : undefined;
    const okCls = Tag === "p" ? "st-hint ok" : "ok";
    return (
        <>
            {list != null && <Tag className={cls}>Marketplace price: {fmt(list)}</Tag>}
            {custom != null && <Tag className={okCls}>Custom price for this customer: <b>{fmt(custom)}</b></Tag>}
            {custom == null && hasCustomer && onBbm && <Tag className={cls}>No custom price for this customer yet.</Tag>}
            {last != null && (custom == null || !samePrice(last, custom)) && <Tag className={cls}>Last price given to this customer: {fmt(last)}</Tag>}
        </>
    );
}

export default function OrderBookSheet({ token, onClose, onCreated }) {
    useSheetBehavior(onClose);
    const [c, setC] = useState(blankCustomer);
    const [addr, setAddr] = useState(blankAddr);
    const [lines, setLines] = useState([]);
    const [picking, setPicking] = useState(true);       // product picker open
    const [manual, setManual] = useState(false);        // typing a product name instead
    const [manualName, setManualName] = useState("");
    const [po, setPo] = useState("");                   // optional purchase order number
    const [notes, setNotes] = useState("");
    const [setCustom, setSetCustom] = useState(true);   // use the catalog prices as the customer's BBM prices
    const [cSearch, setCSearch] = useState("");
    const [pSearch, setPSearch] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const [info, setInfo] = useState({});               // `${gstin}|${listingId}` -> catalog row with this customer's prices
    const [lineBuyer, setLineBuyer] = useState(null);   // { gstin, onBbm } for the added products
    const gst = useGstAddress(token);

    const units = useMemo(() => (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) })), []);
    const touch = () => setFormErr("");
    const patchC = (patch) => { setC((s) => ({ ...s, ...patch })); setErrors((e) => ({ ...e, contact: undefined })); touch(); };
    const patchAddr = (patch) => { setAddr((a) => ({ ...a, ...patch, touched: true, fromGst: false })); setErrors((e) => ({ ...e, pincode: undefined })); touch(); };
    const patchLine = (key, patch) => { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); touch(); };
    const removeLine = (key) => { setLines((ls) => { const next = ls.filter((l) => l.key !== key); if (!next.length) setPicking(true); return next; }); touch(); };

    // Packs <-> master packs only changes the quantity (it restarts at the MOQ). The price is entered in its own unit, so it stays as typed.
    const switchBasis = (l, basis) => patchLine(l.key, { basis, quantity: String(minQty(l.pack, basis, l.moq)) });
    // Changing "Price per" or the GST mode NEVER touches the typed price. The same number is simply read under the new option,
    // and the per pack / per unit / line total figures are recalculated from it.
    const switchPu = (l, pu) => { if (l.pu !== pu) patchLine(l.key, { pu }); };
    const switchIncl = (l, incl) => { if (l.incl !== incl) patchLine(l.key, { incl }); };

    // Fill the address from a GST lookup result, unless the salesperson already typed in it while the lookup ran.
    const applyGstAddress = (r) => setAddr((a) => (a.touched ? a : {
        address: r.address || "", city: r.city || "", state: r.state || "", pincode: r.pincode || "", touched: false, fromGst: !!r.address,
    }));

    // The customer's full GST number ("" until there is one). BBM prices are found by it.
    const picked = c.picked;
    const rawGstin = c.mode === "picked" ? cleanGstin(picked?.gstin || "") : c.mode === "new" ? cleanGstin(c.gstin) : "";
    const pricingGstin = GSTIN_RE.test(rawGstin) ? rawGstin : "";

    const dCq = useDebounced(cSearch);
    const custList = useRemoteList(
        useCallback((q, offset) => fetchSalesCustomers(token, { q, filter: "all", limit: PAGE, offset }), [token]),
        dCq, c.mode === "pick", (i) => i.id,
    );
    const dPq = useDebounced(pSearch);
    const prodList = useRemoteList(
        useCallback((q, offset) => fetchCatalogProducts(token, { q, limit: PAGE, offset, gstin: pricingGstin }), [token, pricingGstin]),
        dPq, picking && !manual, (i) => i.submissionId, pricingGstin,
    );

    // Added products: fetch this customer's prices for them whenever the customer (or the set of products) changes.
    // Only products not already known for this GST number are fetched.
    const idsKey = useMemo(() => lines.filter((l) => l.submissionId).map((l) => l.submissionId).sort().join(","), [lines]);
    useEffect(() => {
        if (!idsKey || !pricingGstin) return undefined;
        const missing = idsKey.split(",").filter((id) => !info[`${pricingGstin}|${id}`]);
        if (!missing.length) return undefined;
        let live = true;
        fetchCatalogProducts(token, { ids: missing.join(","), gstin: pricingGstin }).then((res) => {
            if (!live || !res.success) return;
            setInfo((prev) => {
                const n = { ...prev };
                (res.items || []).forEach((it) => { n[`${pricingGstin}|${it.submissionId}`] = it; });
                return n;
            });
            setLineBuyer({ gstin: pricingGstin, onBbm: res.buyer?.onBbm === true });
        });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, pricingGstin, token]);

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
        setErrors((e) => ({ ...e, customer: undefined, contact: undefined, phone: undefined, email: undefined })); touch();
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
            listUnit: pr.listUnitPriceIncl ?? null,
        }]);
        if (pricingGstin) {
            // the picker already fetched this customer's prices for it, so no second request is needed
            setInfo((prev) => ({ ...prev, [`${pricingGstin}|${pr.submissionId}`]: pr }));
            setLineBuyer({ gstin: pricingGstin, onBbm: prodList.buyer?.onBbm === true });
        }
        setPicking(false); setPSearch(""); setErrors((e) => ({ ...e, items: undefined })); touch();
    };
    const addManual = () => {
        const name = manualName.trim();
        if (name.length < 2) { setErrors((e) => ({ ...e, manual: "Enter the product name." })); return; }
        setLines((ls) => [...ls, {
            key: `m-${Date.now()}`, submissionId: null, productName: name, brandName: "", image: null, pack: null, basis: null, moq: null, unit: "",
            quantity: "", price: "", pu: "unit", incl: true, gstPct: "", gstKnown: false, listUnit: null,
        }]);
        setManual(false); setManualName(""); setPicking(false); setErrors((e) => ({ ...e, manual: undefined, items: undefined })); touch();
    };

    const total = lines.reduce((a, l) => a + lineTotalOf(l), 0);

    // The contact the order will be sent with. A picked customer's saved details win; for whatever they are missing,
    // the phone / email typed in the sheet are used (and saved on the customer by the server).
    const needPhone = c.mode === "picked" && !!picked && !picked.phone;
    const needEmail = c.mode === "picked" && !!picked && !picked.email;
    const pickedMissing = needPhone || needEmail;
    const contactPhone = c.mode === "picked" ? (picked?.phone || c.phone.trim()) : c.phone.trim();
    const contactEmail = c.mode === "picked" ? (picked?.email || c.email.trim()) : c.email.trim();

    // BBM prices are found by the customer's GST number, so they only apply to catalog lines of a customer with a full GST number.
    const hasCatalogLine = lines.some((l) => !!l.submissionId);
    const canSetPrices = hasCatalogLine && !!pricingGstin;

    // One short line above the product list about what the shown prices mean.
    const pickerNote = !pricingGstin
        ? "Choose a customer with a full GST number to also see their custom prices."
        : prodList.buyer?.own ? "This is your own company, so no custom prices apply."
            : prodList.buyer?.onBbm === false ? "This customer isn't on BBM yet. The prices you set are saved and apply as soon as they join."
                : prodList.buyer?.onBbm ? `Showing marketplace prices and ${prodList.buyer.name || "this customer"}'s custom prices.` : "";

    const validate = () => {
        const e = {};
        if (c.mode === "pick") e.customer = "Choose a customer, or add a new one.";
        if (c.mode === "new") {
            const g = cleanGstin(c.gstin);
            if (g && !GSTIN_RE.test(g)) e.gstin = "Enter all 15 characters of the GST number, or clear it.";
            if (!g && !c.name.trim()) e.name = "Enter the GST number or the company name.";
        }
        if (c.mode === "new" || pickedMissing) {
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

        // customerId lets the server save the contact on the picked customer even when they have no GST number.
        const cu = c.mode === "picked"
            ? { customerId: picked.id, customerGstin: picked.gstin || "", customerName: picked.name || "", customerPhone: contactPhone, customerEmail: contactEmail }
            : { customerGstin: cleanGstin(c.gstin), customerName: c.name.trim(), customerPhone: c.phone.trim(), customerEmail: c.email.trim() };

        setBusy(true); setFormErr("");
        const res = await salesOrderBook.create(token, {
            ...cu, notes: notes.trim(), poNumber: po.trim(), setCustomPrices: setCustom,
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
        onCreated?.(res.order, res.customPricing);
    };

    const gstHint = gst.status === "loading" ? "Finding the company and its address…"
        : gst.status === "ok" ? "Company name and address filled from the GST number."
            : gst.status === "fail" ? "Couldn't find this GST number. Type the company name below." : "Optional. We fill in the company name and address from it.";

    // Mobile + email inputs. Used for a new customer (both), and for a picked customer for whatever they are missing.
    const contactFields = (idSuffix, showPhone = true, showEmail = true) => {
        const both = showPhone && showEmail;
        const phoneField = showPhone && (
            <div className="st-f">
                <label htmlFor={`ob-ph${idSuffix}`}>Mobile number</label>
                <input id={`ob-ph${idSuffix}`} className="st-in" inputMode="tel" autoComplete="off" placeholder="10 digits" value={c.phone}
                    onChange={(e) => patchC({ phone: e.target.value.replace(/[^\d+\s-]/g, "") })} />
                {errors.phone && <p className="st-err">{errors.phone}</p>}
            </div>
        );
        const emailField = showEmail && (
            <div className="st-f">
                <label htmlFor={`ob-em${idSuffix}`}>Email</label>
                <input id={`ob-em${idSuffix}`} className="st-in" type="email" autoComplete="off" placeholder="name@company.com" value={c.email} onChange={(e) => patchC({ email: e.target.value })} />
                {errors.email && <p className="st-err">{errors.email}</p>}
            </div>
        );
        return (
            <>
                {both ? <div className="st-two">{phoneField}{emailField}</div> : <>{phoneField}{emailField}</>}
                {errors.contact
                    ? <p className="st-err" role="alert">{errors.contact}</p>
                    : both
                        ? <p className="st-hint">Add at least one. The customer gets an order confirmation on WhatsApp / email as soon as the order is placed.{c.mode === "picked" ? " It is also saved to this customer for next time." : ""}</p>
                        : <p className="st-hint">Optional. Saved to this customer for next time.</p>}
            </>
        );
    };

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
                            {pickedMissing && <div style={{ marginTop: 10 }}>{contactFields("-p", needPhone, needEmail)}</div>}
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
                            {!cleanGstin(c.gstin) && <p className="st-hint">Without a GST number the customer is only saved on this order, not added to your customers.</p>}
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
                        const it = pricingGstin ? info[`${pricingGstin}|${l.key}`] : null;   // this customer's prices for the product
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

                                {/* price: any unit, with or without GST. The typed number is never rewritten. */}
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
                                {/* {f && (
                                    <PriceHints as="p" f={f} basis={l.basis}
                                        list={it?.listUnitPriceIncl ?? l.listUnit} custom={it?.customUnitPriceIncl ?? null} last={it?.lastUnitPriceIncl ?? null}
                                        hasCustomer={!!pricingGstin} onBbm={lineBuyer?.gstin === pricingGstin && !!lineBuyer?.onBbm} />
                                )} */}
                                <div className="st-line-t"><span>Line total (incl. GST)</span><b>{inr(lineTotalOf(l))}</b></div>
                            </div>
                        );
                    })}

                    {picking && !manual && (
                        <>
                            {pickerNote && <p className="st-hint">{pickerNote}</p>}
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
                                                <PriceHints f={pf} basis={pf.per ? "per_master_pack" : "per_pack"}
                                                    list={i.listUnitPriceIncl} custom={i.customUnitPriceIncl} last={i.lastUnitPriceIncl}
                                                    hasCustomer={!!pricingGstin} onBbm={!!prodList.buyer?.onBbm} />
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

                    {/* ------------------------------ BBM prices (by GST number) ------------------------------ */}
                    {canSetPrices ? (
                        <>
                            {/* <div className={`st-chan${setCustom ? " on" : ""}`} style={{ marginTop: 12 }}>
                                <button type="button" role="checkbox" aria-checked={setCustom} onClick={() => { setSetCustom((v) => !v); touch(); }}>
                                    <i>{setCustom ? <Check size={14} strokeWidth={3} /> : null}</i>Use these prices as this customer's BBM prices
                                </button>
                            </div>
                            <p className="st-hint">
                                {setCustom
                                    ? "Your catalog products will be priced like this for this GST number on BBM. If they aren't on BBM yet, the prices are saved and apply as soon as they join with it. A custom price switches off quantity discounts for that buyer."
                                    : "The prices stay in this order only. Nothing changes on BBM."}
                            </p> */}
                        </>
                    ) : (
                        <p className="st-hint" style={{ marginTop: 8 }}>
                            {hasCatalogLine
                                ? "Prices are saved with GST included. Add the customer's full GST number to also set their prices on BBM."
                                : "Prices are saved with GST included, for your records."}
                        </p>
                    )}

                    {/* ------------------------------ PO number + notes ------------------------------ */}
                    <div className="st-f" style={{ marginTop: 14 }}>
                        <label htmlFor="ob-po">Purchase order (PO) number</label>
                        <input id="ob-po" className="st-in" value={po} maxLength={60} autoComplete="off" placeholder="Optional. The customer's PO number"
                            onChange={(e) => { setPo(e.target.value); touch(); }} />
                        <p className="st-hint">Optional. You and your team can search orders by this number.</p>
                    </div>

                    <div className="st-f" style={{ marginTop: 6 }}>
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