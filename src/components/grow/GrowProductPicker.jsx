// Brand -> product picker shown before the add-product wizard.
//   brand: null (choose a brand) | { name, image, none?, isNew? } (choose a product under it)
//   onExisting(item) -> locked wizard for an item already on GROW
//   onNew(identity)  -> full wizard for a brand-new product, name + brand already filled
import { useCallback, useEffect, useRef, useState } from "react";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";
import { resizedImageUrl } from "../../utils/imageUrl";
import { uploadSellerFile } from "../../utils/api.js";
import { fetchPickerBrands, fetchPickerItems } from "../../utils/sellerListingApi.js";
import { toTop } from "./GrowAuthFlow.jsx";

const BRAND_PAGE = 36, ITEM_PAGE = 30, DEBOUNCE = 250, SEED_TTL = 2 * 60 * 1000;
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
const norm = (s) => clean(s).toLowerCase();
const brandKey = (b) => norm(b.brand_name);
const itemKey = (i) => i.id;

// first page of the unfiltered brand list, so coming back from the wizard doesn't flash a skeleton
let brandSeed = null;
const cacheBrands = (term, rows, hasMore) => { if (!term) brandSeed = { rows, hasMore, ts: Date.now() }; };
const freshSeed = () => (brandSeed && Date.now() - brandSeed.ts < SEED_TTL ? brandSeed : null);

const SEARCH = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
const ico = (d) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

/* ---------- search + paging hook ---------- */
function usePaged(fetchPage, { skip = false, seed = null, keyOf, onPage } = {}) {
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");
    const [rows, setRows] = useState(seed?.rows || []);
    const [loading, setLoading] = useState(!skip && !seed);
    const [more, setMore] = useState(false);
    const [hasMore, setHasMore] = useState(seed ? seed.hasMore : !skip);
    const [err, setErr] = useState(false);
    const list = useRef(seed?.rows || []);
    const abort = useRef(null), seq = useRef(0), first = useRef(true);
    const fetchRef = useRef(fetchPage);
    fetchRef.current = fetchPage;

    useEffect(() => { const t = setTimeout(() => setQ(clean(input)), DEBOUNCE); return () => clearTimeout(t); }, [input]);
    useEffect(() => () => abort.current?.abort(), []);

    const load = useCallback((offset, append, term) => {
        abort.current?.abort();
        const ctl = new AbortController();
        abort.current = ctl;
        const n = ++seq.current;
        if (append) setMore(true); else setLoading(true);
        setErr(false);
        fetchRef.current(term, offset, ctl.signal).then(({ rows: incoming, hasMore: hm }) => {
            if (n !== seq.current) return;
            let next = incoming;
            if (append) {
                const seen = new Set(list.current.map(keyOf));
                next = [...list.current, ...incoming.filter((r) => !seen.has(keyOf(r)))];
            }
            list.current = next;
            setRows(next);
            setHasMore(hm);
            onPage?.(term, next, hm);
        }).catch((e) => {
            if (e?.name === "AbortError" || n !== seq.current) return;
            setErr(true);
            if (!append) { list.current = []; setRows([]); setHasMore(false); }
        }).finally(() => {
            if (n !== seq.current) return;
            setLoading(false);
            setMore(false);
        });
    }, [keyOf, onPage]);

    useEffect(() => {
        if (skip) return undefined;
        const isFirst = first.current;
        first.current = false;
        if (isFirst && seed && !q) return undefined;
        load(0, false, q);
        return () => abort.current?.abort();
    }, [q, skip, load]); // eslint-disable-line

    const sentinel = useInfiniteScrollSentinel(
        () => { if (!more && hasMore) load(list.current.length, true, q); },
        { lookahead: 500, disabled: skip || loading || more || !hasMore || err },
    );

    return {
        input, setInput, q, rows, loading, more, hasMore, err, sentinel,
        settled: clean(input) === q,
        reload: () => load(0, false, q),
        retryMore: () => load(list.current.length, true, q),
    };
}

/* ---------- small pieces ---------- */
function Hl({ text, term }) {
    const t = clean(term);
    const i = t ? text.toLowerCase().indexOf(t.toLowerCase()) : -1;
    if (i < 0) return <>{text}</>;
    return <>{text.slice(0, i)}<mark className="gp-hl">{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>;
}

function Logo({ src, name }) {
    const [ok, setOk] = useState(!!src);
    const [on, setOn] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        setOk(!!src); setOn(false);
        const el = ref.current;
        if (el?.complete && el.naturalWidth > 0) setOn(true);
    }, [src]);
    if (!src || !ok) return <span className="gp-ini">{clean(name).slice(0, 2).toUpperCase() || "?"}</span>;
    return (
        <img ref={ref} src={resizedImageUrl(src, { width: 160 })} alt="" loading="lazy" decoding="async"
            referrerPolicy="no-referrer" className={on ? "on" : ""} onLoad={() => setOn(true)} onError={() => setOk(false)} />
    );
}

function SearchBox({ value, onChange, placeholder, label }) {
    return (
        <div className="gp-search" role="search">
            {SEARCH}
            <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                aria-label={label} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") onChange(""); }} />
            {value && <button type="button" className="gp-clr" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange("")}>×</button>}
        </div>
    );
}

const packLine = (it) => {
    const ps = Number(it.packSize), mp = Number(it.masterPackSize);
    if (!it.unit || !(ps > 0)) return "Packaging not set yet";
    return [`1 Pack = ${ps} ${it.unit}`, mp > 1 ? `${mp} Packs per outer pack` : "", it.gstPercent != null ? `GST ${Number(it.gstPercent)}%` : ""]
        .filter(Boolean).join(" · ");
};

/* ================================ ENTRY ================================ */
export default function GrowProductPicker({ token, say, brand, setBrand, onExit, onExisting, onNew }) {
    return brand
        ? <ProductStage token={token} say={say} brand={brand} onBack={() => setBrand(null)} onExisting={onExisting} onNew={onNew} />
        : <BrandStage token={token} say={say} onPick={setBrand} onExit={onExit} />;
}

/* ============================== BRAND STAGE ============================== */
function BrandStage({ token, say, onPick, onExit }) {
    const seed = useRef(freshSeed()).current;
    const [adding, setAdding] = useState(false);
    const P = usePaged(async (term, offset, signal) => {
        const r = await fetchPickerBrands(token, { q: term, limit: BRAND_PAGE, offset, signal });
        if (!r?.success) throw new Error("bad response");
        return { rows: r.brands || [], hasMore: !!r.hasMore };
    }, { seed, keyOf: brandKey, onPage: cacheBrands });

    useEffect(() => { toTop(); }, [adding]);

    const exact = P.rows.some((b) => norm(b.brand_name) === norm(P.q));
    const canAdd = P.q.length >= 2 && P.settled && !P.loading && !P.err && !exact;
    const skeleton = P.loading && !P.rows.length;

    if (adding) return <AddBrand token={token} say={say} initial={clean(P.input)} onBack={() => setAdding(false)} onPick={onPick} />;

    return (
        <section className="scr on gp">
            <div className="gp-top"><button type="button" className="lnk" onClick={onExit}>Cancel</button></div>
            <p className="kick">Add product · Step 1 of 2</p>
            <h2>Which brand is it?</h2>
            <p className="sub">Pick the brand first. We will then show the products already on GROW, so there is less to fill in.</p>

            <SearchBox value={P.input} onChange={P.setInput} placeholder="Search brands…" label="Search brands" />

            <button type="button" className="gp-row" onClick={() => onPick({ none: true, name: "", image: "" })}>
                <span className="gp-ic">{ico("M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10")}</span>
                <span className="t"><b>Not a branded product</b><small>Loose, generic or unbranded items</small></span>
                <i className="gp-cv" />
            </button>

            {canAdd && (
                <button type="button" className="gp-row gp-new" onClick={() => setAdding(true)}>
                    <span className="gp-ic or">{ico("M12 5v14M5 12h14")}</span>
                    <span className="t"><b>Add “{clean(P.input)}”</b><small>New brand · not found on GROW yet</small></span>
                    <i className="gp-cv" />
                </button>
            )}

            {skeleton ? (
                <div className="gp-grid" aria-busy="true">
                    {Array.from({ length: 12 }).map((_, i) => <div className="gp-b" key={i}><span className="gp-logo gp-sk" /><span className="gp-sk gp-skl" /></div>)}
                </div>
            ) : P.err && !P.rows.length ? (
                <div className="gp-empty">
                    <p>Couldn't load brands. Check your connection and try again.</p>
                    <button type="button" className="sbtn sm" onClick={P.reload}>Try again</button>
                </div>
            ) : !P.rows.length ? (
                <div className="gp-empty">
                    <p>{P.q ? `No brand matches “${P.q}”.` : "No brands yet."}</p>
                </div>
            ) : (
                <div className={`gp-grid${P.loading ? " gp-dim" : ""}`}>
                    {P.rows.map((b) => (
                        <button type="button" className="gp-b" key={brandKey(b)}
                            onClick={() => onPick({ name: b.brand_name, image: b.brand_image || "" })}>
                            <span className="gp-logo"><Logo src={b.brand_image} name={b.brand_name} /></span>
                            <b><Hl text={b.brand_name} term={P.q} /></b>
                            <small>{Number(b.item_count)} product{Number(b.item_count) === 1 ? "" : "s"}</small>
                        </button>
                    ))}
                </div>
            )}

            {P.more && <div className="gp-grid" style={{ marginTop: 8 }}>{Array.from({ length: 6 }).map((_, i) => <div className="gp-b" key={i}><span className="gp-logo gp-sk" /><span className="gp-sk gp-skl" /></div>)}</div>}
            {P.err && P.rows.length > 0 && (
                <div className="gp-empty"><p>Couldn't load more brands.</p><button type="button" className="sbtn sm" onClick={P.retryMore}>Try again</button></div>
            )}
            {P.hasMore && !P.loading && !P.err && <div ref={P.sentinel} style={{ height: 4 }} />}
        </section>
    );
}

// New brand: name (+ optional logo). If the name already exists, the existing brand is selected instead.
function AddBrand({ token, say, initial, onBack, onPick }) {
    const [name, setName] = useState(initial);
    const [logo, setLogo] = useState("");
    const [busy, setBusy] = useState(false);
    const [up, setUp] = useState(false);

    const pickLogo = async (file) => {
        if (!file) return;
        if (!file.type?.startsWith("image/")) return say("Please choose an image file.");
        setUp(true);
        try {
            const r = await uploadSellerFile(token, file, "brands");
            if (r?.success) setLogo(r.url); else say("Logo upload failed. Try again.");
        } finally { setUp(false); }
    };

    const go = async () => {
        const n = clean(name);
        if (n.length < 2) return say("Enter the brand name.");
        setBusy(true);
        try {
            const r = await fetchPickerBrands(token, { q: n, limit: 5, offset: 0 });
            if (!r?.success) return say("Couldn't check this brand. Please try again.");
            const hit = (r.brands || []).find((b) => norm(b.brand_name) === norm(n));
            if (hit) {
                say("This brand already exists, so we selected it for you.");
                return onPick({ name: hit.brand_name, image: hit.brand_image || "" });
            }
            onPick({ name: n, image: logo, isNew: true });
        } finally { setBusy(false); }
    };

    return (
        <section className="scr on gp">
            <div className="gp-top"><button type="button" className="lnk" onClick={onBack}>Back</button></div>
            <p className="kick">Add product · Step 1 of 2</p>
            <h2>Add a new brand</h2>
            <p className="sub">Please check the spelling. Buyers see this name.</p>
            <div className="gp-panel">
                <div className="f">
                    <label>Brand name *</label>
                    <div className="inp"><input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Godrej" /></div>
                </div>
                <div className="f" style={{ marginBottom: 0 }}>
                    <label>Brand logo (optional)</label>
                    <div className="ph" style={{ marginBottom: 0 }}>
                        {logo && <div className="th" style={{ backgroundImage: `url(${logo})` }}><button type="button" className="x" aria-label="Remove logo" onClick={() => setLogo("")}>×</button></div>}
                        <label className="add">{up ? "…" : logo ? "Replace" : "+ Add"}
                            <input type="file" accept="image/*" hidden disabled={up} onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                    </div>
                </div>
            </div>
            <div className="gp-acts">
                <button type="button" className="sbtn" disabled={busy || up || clean(name).length < 2} onClick={go}>{busy ? "Checking…" : "Continue"}</button>
            </div>
        </section>
    );
}

/* ============================== PRODUCT STAGE ============================== */
function ProductStage({ token, say, brand, onBack, onExisting, onNew }) {
    const none = !!brand.none, fresh = !!brand.isNew;
    const P = usePaged(async (term, offset, signal) => {
        const r = await fetchPickerItems(token, { brand: brand.name, none, q: term, limit: ITEM_PAGE, offset, signal });
        if (!r?.success) throw new Error("bad response");
        return { rows: r.items || [], hasMore: !!r.hasMore };
    }, { skip: fresh, keyOf: itemKey });

    useEffect(() => { toTop(); }, []);

    const name = clean(P.input);
    const exact = P.rows.some((i) => norm(i.name) === norm(name));
    const canCreate = name.length >= 2 && !exact && (fresh || (P.settled && !P.loading && !P.err));
    const skeleton = !fresh && P.loading && !P.rows.length;
    const brandLabel = none ? "No brand" : brand.name;

    const create = () => onNew({
        productName: name,
        brandName: none ? "" : brand.name,
        brandImage: none ? "" : (brand.image || ""),
        brandNotApplicable: none,
        brandIsNew: fresh,
    });

    return (
        <section className="scr on gp">
            <div className="gp-top"><button type="button" className="lnk" onClick={onBack}>Back</button></div>
            <p className="kick">Add product · Step 2 of 2</p>
            <h2>What are you selling?</h2>
            <p className="sub">{fresh ? "Type the product name to add it under this new brand." : "Choose a product already on GROW, or type its name to add a new one."}</p>

            <div className="gp-sel">
                <span className="gp-logo sm"><Logo src={none ? "" : brand.image} name={none ? "NB" : brand.name} /></span>
                <span className="t"><small>Brand{fresh ? " · new" : ""}</small><b>{brandLabel}</b></span>
                <button type="button" className="lnk" onClick={onBack}>Change</button>
            </div>

            <SearchBox value={P.input} onChange={P.setInput} label={fresh ? "Product name" : "Search products"}
                placeholder={fresh ? "Product name" : `Search ${none ? "unbranded" : brand.name} products…`} />

            {canCreate && (
                <button type="button" className="gp-row gp-new" onClick={create}>
                    <span className="gp-ic or">{ico("M12 5v14M5 12h14")}</span>
                    <span className="t"><b>Add “{name}”</b><small>New product · {none ? "no brand" : `under ${brand.name}`}</small></span>
                    <i className="gp-cv" />
                </button>
            )}

            {skeleton ? (
                <div aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <div className="gp-row" key={i}><span className="gp-th gp-sk" /><span className="t"><span className="gp-sk gp-skl wide" /></span></div>)}</div>
            ) : P.err && !P.rows.length ? (
                <div className="gp-empty"><p>Couldn't load products. Check your connection and try again.</p><button type="button" className="sbtn sm" onClick={P.reload}>Try again</button></div>
            ) : !P.rows.length ? (
                <div className="gp-empty">
                    <p>{fresh ? "New brand: nothing to choose from yet." : P.q ? `No product matches “${P.q}”.` : `No products under ${brandLabel} yet.`}</p>
                    {!canCreate && <p>Type the product name above to add it.</p>}
                </div>
            ) : (
                <div className={P.loading ? "gp-dim" : ""}>
                    {P.rows.map((it) => (
                        <button type="button" className="gp-row" key={it.id} disabled={it.listed} onClick={() => onExisting(it)}>
                            <span className="gp-th" style={it.image ? { backgroundImage: `url(${resizedImageUrl(it.image, { width: 120 })})` } : undefined}>
                                {it.image ? "" : (it.name?.trim()[0] || "?").toUpperCase()}
                            </span>
                            <span className="t"><b><Hl text={it.name} term={P.q} /></b><small>{it.listed ? "You already list this product" : packLine(it)}</small></span>
                            {it.listed ? <em className="gp-tag">Listed</em> : <i className="gp-cv" />}
                        </button>
                    ))}
                </div>
            )}

            {P.more && <div>{Array.from({ length: 2 }).map((_, i) => <div className="gp-row" key={i}><span className="gp-th gp-sk" /><span className="t"><span className="gp-sk gp-skl wide" /></span></div>)}</div>}
            {P.err && P.rows.length > 0 && (
                <div className="gp-empty"><p>Couldn't load more products.</p><button type="button" className="sbtn sm" onClick={P.retryMore}>Try again</button></div>
            )}
            {P.hasMore && !P.loading && !P.err && <div ref={P.sentinel} style={{ height: 4 }} />}
        </section>
    );
}