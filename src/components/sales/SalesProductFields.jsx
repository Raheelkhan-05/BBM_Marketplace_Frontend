// src/components/sales/SalesProductFields.jsx
// The product + quantity part of an enquiry, shared by the "New enquiry" sheet and the "Add product" sheet
// (a cold call gets its product later). Catalog products are enquired in whole packs / master packs; typed-name products
// keep quantity + unit.
//
//   const form = useProductForm(token, { enabled, onTouch });
//   form.check()    -> validates, shows the errors, returns true when valid
//   form.payload()  -> { productSubmissionId?, productName, quantity, unit, basis?, packQuantity?, unitsPerSaleUnit?, specifications }
//   <ProductFields form={form} />
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Search, PackagePlus, Lock } from "lucide-react";
import { fetchCatalogProducts } from "../../utils/salesThreadApi.js";
import { RFQ_UNITS } from "../../utils/rfqUtils.js";
import { ov, ol, qty, round4 } from "./salesThreadFmt.js";
import { packLines, unitsPerSale, basisWord, minQty } from "../orderBook/orderBookPack.js";
import { productPack } from "../orderBook/orderBookPrice.js";
import "./sales-threads.css";
import "../orderBook/order-book.css";
import "./sales-threads.cold.css";

export const LIST_PAGE = 8;

export function useDebounced(value, ms = 300) {
    const [d, setD] = useState(value.trim());
    useEffect(() => { const t = setTimeout(() => setD(value.trim()), ms); return () => clearTimeout(t); }, [value, ms]);
    return d;
}

// Paged, searchable remote list. `fetchPage(q, offset)` must resolve { success, items, hasMore, nextOffset? }.
export function useRemoteList(fetchPage, q, enabled, keyOf) {
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

export function SearchList({ placeholder, label, value, onChange, list, keyOf, renderRow, empty }) {
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

export function Thumb({ src, name }) {
    return <span className="st-th">{src ? <img src={src} alt="" loading="lazy" /> : (name || "?").trim()[0]?.toUpperCase()}</span>;
}

const blankProduct = { mode: "pick", picked: null, pack: null, name: "" };   // mode: pick | picked | manual
const blankFields = { quantity: "", unit: "", basis: "per_pack", specs: "" };
const packOf = productPack;

export function useProductForm(token, { enabled = true, onTouch } = {}) {
    const [p, setP] = useState(blankProduct);
    const [f, setF] = useState(blankFields);   // quantity is in packs / master packs for catalog products, in `unit` for typed ones
    const [search, setSearch] = useState("");
    const [errors, setErrors] = useState({});

    const units = useMemo(() => (RFQ_UNITS || []).map((o) => ({ value: ov(o), label: ol(o) })), []);
    const touch = useCallback(() => onTouch?.(), [onTouch]);
    const patchF = (patch) => { setF((s) => ({ ...s, ...patch })); touch(); };

    const dq = useDebounced(search);
    const list = useRemoteList(
        useCallback((q, offset) => fetchCatalogProducts(token, { q, limit: LIST_PAGE, offset }), [token]),
        dq, enabled && p.mode === "pick", (i) => i.submissionId,
    );

    const resetProduct = (mode = "pick") => {
        setP({ ...blankProduct, mode });
        setF((s) => ({ ...blankFields, specs: s.specs }));
        setErrors((e) => ({ ...e, product: undefined, quantity: undefined, unit: undefined }));
        touch();
    };

    // Catalog product: ordered in packs, or master packs when the product has them. Starts at the seller's MOQ.
    const pickProduct = (pr) => {
        if (pr.reason) return;
        const pk = packOf(pr);
        const basis = pk.per ? "per_master_pack" : "per_pack";
        setP({ mode: "picked", picked: pr, pack: pk, name: "" });
        setF((s) => ({ ...s, basis, unit: pr.unit || "", quantity: String(minQty(pk, basis, pr.moq)) }));
        setErrors((e) => ({ ...e, product: undefined, quantity: undefined })); touch();
    };

    // Switching between packs and master packs changes what the quantity means, so it restarts at the MOQ.
    const switchBasis = (basis) => patchF({ basis, quantity: String(minQty(p.pack, basis, p.picked?.moq)) });

    const pk = p.mode === "picked" ? p.pack : null;                  // null for a typed-name product
    const word = f.basis === "per_master_pack" ? "master pack" : "pack";
    const qn = Number(f.quantity) || 0;
    const totalUnits = pk ? qn * unitsPerSale(pk, f.basis) : 0;
    const moqMin = pk && Number(p.picked?.moq) > 0 ? minQty(pk, f.basis, p.picked.moq) : 0;

    const check = () => {
        const e = {};
        if (p.mode === "pick") e.product = "Choose a product, or type its name.";
        if (p.mode === "manual" && p.name.trim().length < 2) e.product = "Enter the product name.";
        if (!(qn > 0)) e.quantity = "Enter the quantity.";
        else if (pk && !Number.isInteger(qn)) e.quantity = `Enter a whole number of ${basisWord(f.basis, 2)}.`;
        if (!pk && !f.unit) e.unit = "Choose a unit.";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // `quantity` + `unit` stay in the listing's own unit (what the thread and quotation already understand);
    // basis / packQuantity / unitsPerSaleUnit carry the pack breakdown the person actually entered.
    const payload = () => {
        const pr = p.mode === "picked"
            ? { productSubmissionId: p.picked.submissionId, productName: p.picked.productName }
            : { productName: p.name.trim() };
        const per = pk ? unitsPerSale(pk, f.basis) : 0;
        const sale = pk
            ? { quantity: round4(qn * per), unit: p.picked.unit, basis: f.basis, packQuantity: qn, unitsPerSaleUnit: per }
            : { quantity: qn, unit: f.unit };
        return { ...pr, ...sale, specifications: f.specs.trim() };
    };

    return {
        p, setP, f, patchF, search, setSearch, dq, errors, units, list, touch,
        pk, word, qn, totalUnits, moqMin, resetProduct, pickProduct, switchBasis, check, payload,
    };
}

export function ProductFields({ form, idPrefix = "pf" }) {
    const { p, setP, f, patchF, search, setSearch, dq, errors, units, list, touch, pk, word, qn, totalUnits, moqMin, resetProduct, pickProduct, switchBasis } = form;
    return (
        <>
            <p className="st-sec">Product</p>

            {p.mode === "picked" && p.picked && (
                <div className="st-sel">
                    <Thumb src={p.picked.image} name={p.picked.productName} />
                    <span className="st-prod-t">
                        <b>{p.picked.productName}</b>
                        {p.picked.brandName && <small>{p.picked.brandName}</small>}
                        <small>{packLines(p.pack).join(" · ")}</small>
                        <small className="ok"><Lock size={11} style={{ verticalAlign: "-1px" }} /> Tagged from your catalog. It can't be changed after it is saved.</small>
                    </span>
                    <button type="button" className="st-lnk" onClick={() => resetProduct("pick")}>Change</button>
                </div>
            )}

            {p.mode === "pick" && (
                <>
                    <SearchList label="Search your company's products" placeholder="Search your company's products"
                        value={search} onChange={setSearch} list={list} keyOf={(i) => i.submissionId}
                        empty={dq ? `No product matches "${dq}".` : "Your company has no products yet."}
                        renderRow={(i) => (
                            <button type="button" className="st-prod pick" disabled={!!i.reason} onClick={() => pickProduct(i)}>
                                <Thumb src={i.image} name={i.productName} />
                                <span className="st-prod-t">
                                    <b>{i.productName}</b>
                                    {i.brandName && <small>{i.brandName}</small>}
                                    <small>{packLines(productPack(i)).join(" · ")}</small>
                                    {i.reason && <em>{i.reason}: can't be used right now</em>}
                                </span>
                            </button>
                        )} />
                    <button type="button" className="st-btn st-full" onClick={() => resetProduct("manual")}>
                        <PackagePlus size={16} />Product not listed? Type its name
                    </button>
                    {errors.product && <p className="st-err" style={{ marginTop: 6 }}>{errors.product}</p>}
                </>
            )}

            {p.mode === "manual" && (
                <>
                    <div className="st-f">
                        <label htmlFor={`${idPrefix}-prod`}>Product name *</label>
                        <input id={`${idPrefix}-prod`} className="st-in" value={p.name} placeholder="e.g. Stainless steel hinges 4 inch"
                            onChange={(e) => { setP((s) => ({ ...s, name: e.target.value })); touch(); }} />
                        {errors.product && <p className="st-err">{errors.product}</p>}
                    </div>
                    <button type="button" className="st-lnk" onClick={() => resetProduct("pick")}>Choose from my products instead</button>
                </>
            )}

            {(p.mode === "picked" || p.mode === "manual") && (
                <>
                    {pk && <div className="ob-pkbox" style={{ marginTop: 12 }}>{packLines(pk).map((t) => <span key={t}>{t}</span>)}</div>}

                    <div className="st-two" style={{ marginTop: pk ? 0 : 12 }}>
                        <div className="st-f">
                            <label htmlFor={`${idPrefix}-qty`}>{pk ? `Quantity (${word}s) *` : "Quantity *"}</label>
                            <input id={`${idPrefix}-qty`} className="st-in" inputMode={pk ? "numeric" : "decimal"} placeholder="e.g. 5" value={f.quantity}
                                onChange={(e) => patchF({ quantity: e.target.value.replace(pk ? /\D/g : /[^\d.]/g, "") })} />
                            {errors.quantity && <p className="st-err">{errors.quantity}</p>}
                        </div>
                        <div className="st-f">
                            {pk ? (
                                <>
                                    <label htmlFor={`${idPrefix}-unit`}>Ordered in *</label>
                                    <select id={`${idPrefix}-unit`} className="st-in" value={f.basis} disabled={!pk.per} onChange={(e) => switchBasis(e.target.value)}>
                                        {pk.per ? <option value="per_master_pack">Master packs</option> : null}
                                        <option value="per_pack">Packs</option>
                                    </select>
                                </>
                            ) : (
                                <>
                                    <label htmlFor={`${idPrefix}-unit`}>Unit *</label>
                                    <select id={`${idPrefix}-unit`} className="st-in" value={f.unit} onChange={(e) => patchF({ unit: e.target.value })}>
                                        <option value="">Select…</option>
                                        {units.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    {errors.unit && <p className="st-err">{errors.unit}</p>}
                                </>
                            )}
                        </div>
                    </div>
                    {pk && (
                        <p className="st-hint ob-conv">
                            {qn > 0 ? `= ${qty(totalUnits)} ${pk.unit} in total` : `Enter how many ${word}s.`}
                            {moqMin > 0 ? ` · Seller's MOQ: ${moqMin} ${basisWord(f.basis, moqMin)}` : ""}
                        </p>
                    )}
                </>
            )}

            <div className="st-f" style={{ marginTop: 12 }}>
                <label htmlFor={`${idPrefix}-spec`}>Specifications</label>
                <textarea id={`${idPrefix}-spec`} className="st-in" rows={3} placeholder="Grade, size, brand, anything the customer mentioned" value={f.specs} onChange={(e) => patchF({ specs: e.target.value })} />
            </div>
        </>
    );
}