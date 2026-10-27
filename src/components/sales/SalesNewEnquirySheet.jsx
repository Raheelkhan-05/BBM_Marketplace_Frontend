// src/components/sales/SalesNewEnquirySheet.jsx
// Start an enquiry in two steps of choice:
//  CUSTOMER: pick one of your existing customers (search) -> or add a new one by GST number / company name + contact.
//  PRODUCT:  tag a product from your company catalog (locked afterwards) -> or type the product name.
// The company name is always taken from the GST number by the server; a new customer is added to the customer list
// automatically when the first quotation is sent. `initialCustomer` pre-selects a customer (used from the Customers page).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, BadgeCheck, Search, UserPlus, PackagePlus, Lock } from "lucide-react";
import { createThread, fetchCatalogProducts } from "../../utils/salesThreadApi.js";
import { fetchSalesCustomers } from "../../utils/salesApi.js";
import { RFQ_UNITS } from "../../utils/rfqUtils.js";
import { useSheetBehavior, useGstLookup } from "../../hooks/useSalesSheet.js";
import { GSTIN_RE, cleanGstin, cleanPhone, cleanEmail, ov, ol, initialOf, qty } from "./salesThreadFmt.js";
import "./sales-threads.css";

const PAGE = 8;

function useDebounced(value, ms = 300) {
    const [d, setD] = useState(value.trim());
    useEffect(() => { const t = setTimeout(() => setD(value.trim()), ms); return () => clearTimeout(t); }, [value, ms]);
    return d;
}

// Paged, searchable remote list. `fetchPage(q, offset)` must resolve { success, items, hasMore, nextOffset? }.
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

export default function SalesNewEnquirySheet({ token, onClose, onCreated, initialCustomer = null }) {
    useSheetBehavior(onClose);
    const [c, setC] = useState(() => (initialCustomer ? { ...blankCustomer, mode: "picked", picked: initialCustomer } : blankCustomer));
    const [p, setP] = useState({ mode: "pick", picked: null, name: "" });   // mode: pick | picked | manual
    const [f, setF] = useState({ quantity: "", unit: "", specs: "" });
    const [cSearch, setCSearch] = useState("");
    const [pSearch, setPSearch] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [formErr, setFormErr] = useState("");
    const gst = useGstLookup(token);

    const units = useMemo(() => (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) })), []);
    const touch = () => setFormErr("");
    const patchC = (patch) => { setC((s) => ({ ...s, ...patch })); touch(); };
    const patchF = (patch) => { setF((s) => ({ ...s, ...patch })); touch(); };

    // ---- customers (the salesperson's own customers, same list as the Customers tab) ----
    const dCq = useDebounced(cSearch);
    const custList = useRemoteList(
        useCallback((q, offset) => fetchSalesCustomers(token, { q, filter: "all", limit: PAGE, offset }), [token]),
        dCq, c.mode === "pick", (i) => i.id,
    );

    // ---- products (company catalog) ----
    const dPq = useDebounced(pSearch);
    const prodList = useRemoteList(
        useCallback((q, offset) => fetchCatalogProducts(token, { q, limit: PAGE, offset }), [token]),
        dPq, p.mode === "pick", (i) => i.submissionId,
    );

    // New customer: as soon as a full GST number is typed, the company name is fetched from it.
    useEffect(() => {
        if (c.mode !== "new") return undefined;
        const g = cleanGstin(c.gstin);
        if (!GSTIN_RE.test(g)) { gst.reset(); return undefined; }
        let live = true;
        gst.run(g).then((name) => { if (live && name) setC((s) => ({ ...s, name, fromGst: true })); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c.gstin, c.mode]);

    const pickCustomer = (cu) => { setC({ ...blankCustomer, mode: "picked", picked: cu }); setErrors((e) => ({ ...e, customer: undefined })); touch(); };
    const pickProduct = (pr) => {
        if (pr.reason) return;
        setP({ mode: "picked", picked: pr, name: "" });
        setF((s) => ({
            ...s,
            unit: units.some((u) => u.value === pr.unit) ? pr.unit : s.unit,
            quantity: s.quantity || (pr.moq ? String(pr.moq) : ""),
        }));
        setErrors((e) => ({ ...e, product: undefined })); touch();
    };
    const lockedUnit = p.mode === "picked" && units.some((u) => u.value === p.picked.unit);

    const validate = () => {
        const e = {};
        if (c.mode === "pick") e.customer = "Choose a customer, or add a new one.";
        if (c.mode === "new") {
            const g = cleanGstin(c.gstin);
            if (g && !GSTIN_RE.test(g)) e.gstin = "Enter all 15 characters of the GST number, or clear it.";
            if (!g && !c.name.trim()) e.name = "Enter the GST number or the company name.";
            if (c.phone.trim() && !cleanPhone(c.phone)) e.phone = "Enter a valid 10-digit mobile number.";
            if (c.email.trim() && !cleanEmail(c.email)) e.email = "Enter a valid email address.";
        }
        if (p.mode === "pick") e.product = "Choose a product, or type its name.";
        if (p.mode === "manual" && p.name.trim().length < 2) e.product = "Enter the product name.";
        if (!(Number(f.quantity) > 0)) e.quantity = "Enter the quantity.";
        if (!f.unit) e.unit = "Choose a unit.";
        return e;
    };

    const submit = async () => {
        if (busy) return;
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length) return;

        const cu = c.mode === "picked"
            ? { customerGstin: c.picked.gstin || "", customerName: c.picked.name || "", customerPhone: c.picked.phone || "", customerEmail: c.picked.email || "" }
            : { customerGstin: cleanGstin(c.gstin), customerName: c.name.trim(), customerPhone: c.phone.trim(), customerEmail: c.email.trim() };
        const pr = p.mode === "picked"
            ? { productSubmissionId: p.picked.submissionId, productName: p.picked.productName }
            : { productName: p.name.trim() };

        setBusy(true); setFormErr("");
        const res = await createThread(token, { ...cu, ...pr, quantity: Number(f.quantity), unit: f.unit, specifications: f.specs.trim() });
        setBusy(false);
        if (!res.success) return setFormErr(res.message || "Couldn't create the enquiry. Please try again.");
        onCreated?.(res.thread);
    };

    const gstHint = gst.status === "loading" ? "Finding the company…"
        : gst.status === "ok" ? "Company name filled from the GST number."
            : gst.status === "fail" ? "Couldn't find this GST number. Type the company name below." : "Optional. We fill in the company name from it.";

    const picked = c.picked;

    return createPortal(
        <div className="st-ov" data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="New enquiry">
                <div className="st-sh-h">
                    <div><h2>New enquiry</h2><p>Only you and your team admin can see it.</p></div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="st-sh-b" data-lenis-prevent>
                    {/* ------------------------------ customer ------------------------------ */}
                    <p className="st-sec">Customer</p>

                    {c.mode === "picked" && picked && (
                        <div className="st-sel">
                            <span className="st-av">{initialOf(picked.name)}</span>
                            <span className="st-prod-t">
                                <b>{picked.name}</b>
                                {picked.gstin && <small>GSTIN {picked.gstin}</small>}
                                <small>{[picked.phone, picked.email].filter(Boolean).join(" · ") || "No phone or email yet. You can add it in the thread."}</small>
                            </span>
                            <button type="button" className="st-lnk" onClick={() => setC({ ...blankCustomer })}>Change</button>
                        </div>
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
                            <button type="button" className="st-btn st-full" onClick={() => { setC({ ...blankCustomer, mode: "new" }); touch(); }}>
                                <UserPlus size={16} />Customer not listed? Add a new one
                            </button>
                            {errors.customer && <p className="st-err" style={{ marginTop: 6 }}>{errors.customer}</p>}
                        </>
                    )}

                    {c.mode === "new" && (
                        <>
                            <div className="st-f">
                                <label htmlFor="ne-gst">GST number</label>
                                <div className="st-inw">
                                    <input id="ne-gst" className="st-in" value={c.gstin} maxLength={15} autoCapitalize="characters" autoComplete="off"
                                        placeholder="e.g. 24ABCDE1234F1Z5" onChange={(e) => patchC({ gstin: cleanGstin(e.target.value) })} />
                                    {gst.status === "loading" && <Loader2 size={16} className="st-spin st-inw-i" />}
                                    {gst.status === "ok" && <BadgeCheck size={18} className="st-inw-i ok" />}
                                </div>
                                <p className={`st-hint${gst.status === "fail" ? " warn" : ""}`}>{errors.gstin ? <span className="st-err">{errors.gstin}</span> : gstHint}</p>
                            </div>

                            <div className="st-f">
                                <label htmlFor="ne-name">Company name {!cleanGstin(c.gstin) && "*"}</label>
                                <input id="ne-name" className="st-in" value={c.name} placeholder="Customer's company name"
                                    onChange={(e) => patchC({ name: e.target.value, fromGst: false })} />
                                {c.fromGst && <p className="st-hint">From the GST records. The saved name always comes from the GST number.</p>}
                                {errors.name && <p className="st-err">{errors.name}</p>}
                            </div>

                            <div className="st-two">
                                <div className="st-f">
                                    <label htmlFor="ne-ph">Mobile number</label>
                                    <input id="ne-ph" className="st-in" inputMode="tel" autoComplete="off" placeholder="10 digits" value={c.phone}
                                        onChange={(e) => patchC({ phone: e.target.value.replace(/[^\d+\s-]/g, "") })} />
                                    {errors.phone && <p className="st-err">{errors.phone}</p>}
                                </div>
                                <div className="st-f">
                                    <label htmlFor="ne-em">Email</label>
                                    <input id="ne-em" className="st-in" type="email" autoComplete="off" placeholder="name@company.com" value={c.email}
                                        onChange={(e) => patchC({ email: e.target.value })} />
                                    {errors.email && <p className="st-err">{errors.email}</p>}
                                </div>
                            </div>
                            <p className="st-hint" style={{ marginTop: -4 }}>You need the GST number plus a mobile number or email to send a quotation. This customer is added to your customers when you send it.</p>
                            <button type="button" className="st-lnk" onClick={() => { setC({ ...blankCustomer }); gst.reset(); }}>Search my customers instead</button>
                        </>
                    )}

                    {/* ------------------------------ product ------------------------------ */}
                    <p className="st-sec">Product</p>

                    {p.mode === "picked" && p.picked && (
                        <div className="st-sel">
                            <Thumb src={p.picked.image} name={p.picked.productName} />
                            <span className="st-prod-t">
                                <b>{p.picked.productName}</b>
                                <small>{[p.picked.brandName, `Sold in ${p.picked.unit}`, p.picked.packSize > 1 ? `1 pack = ${qty(p.picked.packSize)} ${p.picked.unit}` : null].filter(Boolean).join(" · ")}</small>
                                <small className="ok"><Lock size={11} style={{ verticalAlign: "-1px" }} /> Tagged from your catalog. It can't be changed after the enquiry is created.</small>
                            </span>
                            <button type="button" className="st-lnk" onClick={() => setP({ mode: "pick", picked: null, name: "" })}>Change</button>
                        </div>
                    )}

                    {p.mode === "pick" && (
                        <>
                            <SearchList label="Search your company's products" placeholder="Search your company's products"
                                value={pSearch} onChange={setPSearch} list={prodList} keyOf={(i) => i.submissionId}
                                empty={dPq ? `No product matches "${dPq}".` : "Your company has no products yet."}
                                renderRow={(i) => (
                                    <button type="button" className="st-prod pick" disabled={!!i.reason} onClick={() => pickProduct(i)}>
                                        <Thumb src={i.image} name={i.productName} />
                                        <span className="st-prod-t">
                                            <b>{i.productName}</b>
                                            <small>{[i.brandName, `Sold in ${i.unit}`, i.packSize > 1 ? `1 pack = ${qty(i.packSize)} ${i.unit}` : null].filter(Boolean).join(" · ")}</small>
                                            {i.reason && <em>{i.reason}: can't be used right now</em>}
                                        </span>
                                    </button>
                                )} />
                            <button type="button" className="st-btn st-full" onClick={() => { setP({ mode: "manual", picked: null, name: "" }); touch(); }}>
                                <PackagePlus size={16} />Product not listed? Type its name
                            </button>
                            {errors.product && <p className="st-err" style={{ marginTop: 6 }}>{errors.product}</p>}
                        </>
                    )}

                    {p.mode === "manual" && (
                        <>
                            <div className="st-f">
                                <label htmlFor="ne-prod">Product name *</label>
                                <input id="ne-prod" className="st-in" value={p.name} placeholder="e.g. Stainless steel hinges 4 inch"
                                    onChange={(e) => { setP((s) => ({ ...s, name: e.target.value })); touch(); }} />
                                {errors.product && <p className="st-err">{errors.product}</p>}
                            </div>
                            <button type="button" className="st-lnk" onClick={() => setP({ mode: "pick", picked: null, name: "" })}>Choose from my products instead</button>
                        </>
                    )}

                    <div className="st-two" style={{ marginTop: 12 }}>
                        <div className="st-f">
                            <label htmlFor="ne-qty">Quantity *</label>
                            <input id="ne-qty" className="st-in" inputMode="decimal" placeholder="e.g. 500" value={f.quantity}
                                onChange={(e) => patchF({ quantity: e.target.value.replace(/[^\d.]/g, "") })} />
                            {errors.quantity && <p className="st-err">{errors.quantity}</p>}
                        </div>
                        <div className="st-f">
                            <label htmlFor="ne-unit">Unit *</label>
                            <select id="ne-unit" className="st-in" value={f.unit} disabled={lockedUnit} onChange={(e) => patchF({ unit: e.target.value })}>
                                <option value="">Select…</option>
                                {units.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {errors.unit && <p className="st-err">{errors.unit}</p>}
                        </div>
                    </div>
                    <div className="st-f">
                        <label htmlFor="ne-spec">Specifications</label>
                        <textarea id="ne-spec" className="st-in" rows={3} placeholder="Grade, size, brand, anything the customer mentioned" value={f.specs} onChange={(e) => patchF({ specs: e.target.value })} />
                    </div>
                </div>

                <div className="st-sh-f">
                    {formErr && <p className="st-err st-ferr" role="alert">{formErr}</p>}
                    <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="st-btn pri" disabled={busy || gst.status === "loading"} onClick={submit}>
                        {busy ? <Loader2 size={16} className="st-spin" /> : null}Create enquiry
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}