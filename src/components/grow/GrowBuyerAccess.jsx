// src/components/grow/GrowBuyerAccess.jsx
// Buyer visibility + per-buyer custom pricing in the GROW look.
//  - GrowBuyerAccessDraft : create flow (no submission yet). All state lives in `value` ({ mode, buyers }),
//                           sent as `buyerAccessDraft`. Buyers added by GST number carry buyerId "gst:<GSTIN>".
//  - GrowBuyerAccessLive  : edit flow. Buyers on BBM use the existing per-listing APIs; buyers who haven't
//                           joined yet (added by GST number) use /seller/gst-access and apply when they join.
// BuyerPriceEditor / Seg / Field / emptyDraft are exported so GrowCustomerPricing uses the same editor and math.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
    searchEligibleBuyers, fetchListingAccess, setListingVisibilityMode, addListingVisibilityBuyer,
    removeListingVisibilityBuyer, saveCustomPricingForBuyer, deleteCustomPricingForBuyer,
} from "../../utils/sellerListingApi.js";
import { fetchListingPending, addPendingBuyer, removePendingBuyer } from "../../utils/gstAccessApi.js";
import {
    derivePriceBreakdown, percentFromCustomPrice, priceFromLevel, violatesMinUnitPrice,
    MIN_UNIT_PRICE, LEVEL_LABEL, LEVEL_FIELD, levelsFor,
} from "../../../shared/customPricing.js";
import GstBuyerAdd from "./GstBuyerAdd.jsx";
import "./grow-access.css";

/* ---------------- tiny shared bits (also used by GrowEditListing) ---------------- */
export const Seg = ({ v, on, o, disabled, fill }) => (
    <div className={`gax-chips${fill ? " fill" : ""}`}>{o.map(([k, t, tone]) => (
        <button key={String(k)} type="button" disabled={disabled} className={`gax-chip${tone ? ` ${tone}` : ""}`}
            aria-pressed={String(v) === String(k)} onClick={() => on(k)}>{t}</button>
    ))}</div>
);
export const YN = ({ v, on, disabled }) => (
    <Seg v={v === true ? "y" : v === false ? "n" : ""} on={(k) => on(k === "y")} disabled={disabled} o={[["y", "Yes"], ["n", "No"]]} />
);
export const Field = ({ label, cap, bad, children }) => (
    <div className={`gax-f${bad ? " bad" : ""}`}>{label && <label>{label}</label>}{children}{cap && <p className={`gax-cap${bad ? " err" : ""}`}>{cap}</p>}</div>
);

const inr = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const round2 = (n) => (n == null ? n : Math.round(n * 100) / 100);
const initials = (name) => (name || "?").trim().split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const byName = (a, b) => (a.shopName || a.name || "").localeCompare(b.shopName || b.name || "");
const MODES = [["public", "Everyone can see it"], ["restricted", "Selected buyers only"]];
const isGstId = (id) => String(id).startsWith("gst:");
const gstOf = (id) => String(id).slice(4);

export const emptyDraft = () => ({
    mode: "amount", gstMode: "incl", amounts: { unit: "", pack: "", master_pack: "" },
    percentValue: "", percentDirection: "decrease", canonicalPrice: null,
});

function draftFromOverride(buyer, product) {
    const canonical = buyer.effectivePrice;
    const bd = buyer.effectiveBreakdown || {};
    const pct = percentFromCustomPrice(product.defaultPrice, canonical);
    return {
        mode: "amount", gstMode: "incl", canonicalPrice: canonical,
        percentValue: String(pct), percentDirection: pct < 0 ? "increase" : "decrease",
        amounts: { unit: String(bd.perBaseUnit ?? ""), pack: String(bd.perPack ?? ""), master_pack: bd.perMasterPack != null ? String(bd.perMasterPack) : "" },
    };
}

/* ---------------- price editor (same math as the old BuyerPriceEditor) ---------------- */
export function BuyerPriceEditor({ product, draft, setDraft }) {
    const levels = levelsFor(product);
    const gst = Number(product.gstPercent) || 0;
    const gstMode = draft.gstMode || "incl";
    const hasPct = draft.percentValue !== "" && draft.percentValue != null;
    const direction = draft.percentDirection ?? (hasPct && Number(draft.percentValue) < 0 ? "increase" : "decrease");
    const pctAbs = hasPct ? String(draft.percentValue).replace("-", "") : "";
    // not a positive number, or below the minimum per-unit price the backend accepts
    const invalid = draft.canonicalPrice != null
        && (!(draft.canonicalPrice > 0) || violatesMinUnitPrice(draft.canonicalPrice, product.packSize, product.masterPackSize));
    const preview = draft.canonicalPrice != null && !invalid ? derivePriceBreakdown(draft.canonicalPrice, product.packSize, product.masterPackSize) : null;
    const applied = draft.canonicalPrice != null ? percentFromCustomPrice(product.defaultPrice, draft.canonicalPrice) : null;

    const toIncl = (raw) => (gstMode === "excl" ? Number(raw) * (1 + gst / 100) : Number(raw));
    const fromIncl = (v) => (gstMode === "excl" ? v / (1 + gst / 100) : v);
    const amountsFrom = (bd, conv) => ({
        unit: String(round2(conv(bd.perBaseUnit)) ?? ""),
        pack: String(round2(conv(bd.perPack)) ?? ""),
        master_pack: bd.perMasterPack != null ? String(round2(conv(bd.perMasterPack))) : "",
    });

    const changeGstMode = (next) => setDraft((prev) => {
        if (prev.canonicalPrice == null) return { ...prev, gstMode: next };
        const bd = derivePriceBreakdown(prev.canonicalPrice, product.packSize, product.masterPackSize);
        return { ...prev, gstMode: next, amounts: amountsFrom(bd, (x) => (next === "excl" ? x / (1 + gst / 100) : x)) };
    });

    const setFromAmount = (level, raw) => setDraft((prev) => {
        const typed = { ...prev.amounts, [level]: raw };
        if (raw === "" || raw == null || !(Number(raw) > 0)) return { ...prev, amounts: typed, canonicalPrice: raw === "" ? null : prev.canonicalPrice };
        const canonical = priceFromLevel(toIncl(raw), level, product.packSize, product.masterPackSize);
        const bd = derivePriceBreakdown(canonical, product.packSize, product.masterPackSize);
        const pct = percentFromCustomPrice(product.defaultPrice, canonical);
        const derived = amountsFrom(bd, fromIncl);
        return {
            ...prev, canonicalPrice: canonical, percentValue: String(pct),
            percentDirection: pct < 0 ? "increase" : pct > 0 ? "decrease" : (prev.percentDirection ?? "decrease"),
            amounts: { unit: level === "unit" ? raw : derived.unit, pack: level === "pack" ? raw : derived.pack, master_pack: level === "master_pack" ? raw : derived.master_pack },
        };
    });

    const setFromPct = (nextDir, absRaw) => setDraft((prev) => {
        if (absRaw === "" || absRaw == null) return { ...prev, percentDirection: nextDir, percentValue: "", canonicalPrice: null };
        const abs = Math.abs(Number(absRaw)) || 0;
        const signed = nextDir === "increase" ? -abs : abs;
        const canonical = Math.round(product.defaultPrice * (1 - signed / 100) * 100) / 100;
        const bd = derivePriceBreakdown(canonical, product.packSize, product.masterPackSize);
        return {
            ...prev, percentDirection: nextDir, canonicalPrice: canonical, amounts: amountsFrom(bd, fromIncl),
            percentValue: abs > 0 && nextDir === "increase" ? `-${absRaw}` : String(absRaw),
        };
    });

    return (
        <div className="gax-ed">
            <Seg fill v={draft.mode} on={(m) => setDraft((p) => ({ ...p, mode: m }))} o={[["amount", "Set a price"], ["percent", "Set a % change"]]} />

            {draft.mode === "amount" ? (
                <>
                    <Seg fill v={gstMode} on={changeGstMode} o={[["incl", "Incl. GST"], ["excl", "Excl. GST"]]} />
                    <div className="gax-grid">
                        {levels.map((level) => {
                            const refIncl = product.defaultBreakdown?.[LEVEL_FIELD[level]];
                            const ref = gstMode === "excl" ? fromIncl(refIncl) : refIncl;
                            return (
                                <Field key={`${level}-${gstMode}`} label={`${LEVEL_LABEL[level](product.unit)}`}>
                                    <div className="gax-inp"><span className="pre">₹</span>
                                        <input inputMode="decimal" value={draft.amounts[level] ?? ""} placeholder={ref != null ? String(round2(ref)) : ""}
                                            aria-label={`Price ${LEVEL_LABEL[level](product.unit)}`}
                                            onChange={(e) => setFromAmount(level, e.target.value.replace(/[^\d.]/g, ""))} /></div>
                                </Field>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <Seg fill v={direction} on={(d) => setFromPct(d, pctAbs)} o={[["decrease", "Decrease", "ok"], ["increase", "Increase", "warn"]]} />
                    <Field cap={direction === "increase" ? "0% or more." : "Between 0% and 99%."}>
                        <div className="gax-inp">
                            <input inputMode="decimal" value={pctAbs} placeholder="e.g. 5" aria-label="Percent change"
                                onChange={(e) => {
                                    let r = e.target.value.replace(/[^\d.]/g, "");
                                    if (direction === "decrease" && Number(r) > 99) r = "99";
                                    setFromPct(direction, r);
                                }}
                                onBlur={() => { if (pctAbs !== "") setFromPct(direction, String(Number(pctAbs))); }} />
                            <span className="suf">%</span>
                        </div>
                    </Field>
                </>
            )}

            {invalid && <p className="gax-sum err">That works out to below ₹{MIN_UNIT_PRICE} per {product.unit || "unit"}.</p>}

            {preview && (
                <div className="gax-prev" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0,1fr))` }}>
                    {levels.map((level) => (
                        <div key={level}>
                            <small>{LEVEL_LABEL[level](product.unit)}</small>
                            <s>₹{inr(product.defaultBreakdown?.[LEVEL_FIELD[level]])}</s>
                            <b className={applied < 0 ? "up" : ""}>₹{inr(preview[LEVEL_FIELD[level]])}</b>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ---------------- search (buyers on BBM) ---------------- */
function BuyerSearch({ token, submissionId = null, exclude, placeholder, onPick }) {
    const [q, setQ] = useState("");
    const [res, setRes] = useState([]);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const timer = useRef(null);
    const excl = exclude.join("|");

    useEffect(() => {
        clearTimeout(timer.current);
        if (q.trim().length < 2) { setRes([]); setOpen(false); return undefined; }
        setBusy(true); setOpen(true);
        timer.current = setTimeout(async () => {
            const r = await searchEligibleBuyers(token, q.trim(), submissionId);
            const skip = new Set(excl ? excl.split("|") : []);
            setRes(r?.success ? r.buyers.filter((b) => !skip.has(String(b.buyer_id))) : []);
            setBusy(false);
        }, 300);
        return () => clearTimeout(timer.current);
    }, [q, token, submissionId, excl]);

    return (
        <div>
            <div className="gax-search">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search buyers" autoComplete="off" />
                {q && <button type="button" className="gax-x" aria-label="Clear search" onClick={() => { setQ(""); setOpen(false); }}>×</button>}
            </div>
            {open && (
                <div className="gax-pop"><div className="gax-list">
                    {busy ? <p className="gax-msg">Searching…</p>
                        : !res.length ? <p className="gax-msg">No matching buyers. Not on BBM yet? Add them by GST number below.</p>
                            : res.map((b) => (
                                <button key={b.buyer_id} type="button" className="gax-opt" onClick={() => { setQ(""); setOpen(false); onPick(b); }}>
                                    <span className="gax-av" style={{ width: 34, height: 34, borderRadius: 10 }}>{initials(b.shop_name || b.name)}</span>
                                    <span className="t"><b>{b.shop_name || b.name || "Buyer"}</b><small>{[b.phone, b.email].filter(Boolean).join(" · ") || "—"}</small></span>
                                    <span className="plus">+</span>
                                </button>
                            ))}
                </div></div>
            )}
        </div>
    );
}

/* ---------------- one buyer ---------------- */
function BuyerCard({ buyer, product, mode, open, onToggle, draft, setDraft, onClearPrice, onRemove, removeLabel, clearing, removing, unsaved, stale }) {
    const name = buyer.shopName || buyer.name || "Buyer";
    const pct = buyer.override ? percentFromCustomPrice(product.defaultPrice, buyer.effectivePrice) : null;
    const showRemove = mode === "restricted" || !buyer.override;
    const sub = buyer.pendingGst ? `GSTIN ${buyer.gstin}` : (buyer.phone || buyer.email || "—");
    return (
        <div className={`gax-card${open ? " open" : ""}`}>
            <button type="button" className="gax-ch" aria-expanded={open} onClick={onToggle}>
                <span className="gax-av">{initials(name)}</span>
                <span className="t">
                    <b>
                        {name}
                        {buyer.pendingGst && <span className="gax-pill">Not on BBM yet</span>}
                        {unsaved && <span className="gax-pill">Unsaved</span>}
                        {stale && <span className="gax-pill red">Re-check price</span>}
                    </b>
                    <small>{sub}</small>
                    {buyer.override && (
                        <small className={`pr${pct < 0 ? " up" : ""}`}>
                            ₹{inr(buyer.effectiveBreakdown?.perPack)}/pack · {pct >= 0 ? `${Math.round(pct)}% off` : `${Math.abs(Math.round(pct))}% up`}
                        </small>
                    )}
                </span>
                <i className="gax-cv" />
            </button>
            {open && (
                <div className="gax-cb">
                    {stale && <p className="gax-sum warn">The listing price changed after this price was set. Re-enter it to be sure it is right.</p>}
                    {buyer.pendingGst && <p className="gax-sum info">This business isn't on BBM yet. What you set here is saved against its GST number and applies automatically when it joins.</p>}
                    <BuyerPriceEditor product={product} draft={draft} setDraft={setDraft} />
                    {(buyer.override || showRemove) && (
                        <div className="gax-acts">
                            {buyer.override && (
                                <button type="button" className="gax-btn del" disabled={clearing} onClick={onClearPrice}>{clearing ? "Removing…" : "Remove custom price"}</button>
                            )}
                            {showRemove && (
                                <button type="button" className="gax-btn del" disabled={removing} onClick={onRemove}>{removing ? "Removing…" : removeLabel}</button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const Intro = () => (
    <p className="gax-sum info tracking-wide">Choose who can see this listing and give specific buyers their own price. Everyone else pays the listing price. Buyers who haven't joined BBM yet can be added by GST number.</p>
);
const SlabNote = () => (
    <p className="gax-sum warn">A custom price switches off quantity discounts for that buyer. They pay exactly this price, however much they order.</p>
);

/* ---------------- DRAFT (create flow) ---------------- */
export function GrowBuyerAccessDraft({ token, product, value, onChange, quickBuyer = null }) {
    const [openId, setOpenId] = useState(null);
    const [drafts, setDrafts] = useState({});
    const mode = value?.mode || "public";
    const buyers = value?.buyers || [];
    const set = (patch) => onChange({ mode, buyers, ...patch });

    const onlyQuick = !!quickBuyer && mode === "restricted"
        && buyers.length === 1 && String(buyers[0].buyerId) === String(quickBuyer.buyerId);

    const showOnlyToEnquirer = () => {
        onChange({
            mode: "restricted",
            buyers: [{
                buyerId: quickBuyer.buyerId, name: quickBuyer.name || "Buyer", shopName: quickBuyer.name || "",
                phone: null, email: null, override: null,
            }],
        });
        setOpenId(null);
    };

    const openBuyer = (b) => {
        setDrafts((d) => ({ ...d, [b.buyerId]: d[b.buyerId] || (b.override ? { ...emptyDraft(), ...b.override } : emptyDraft()) }));
        setOpenId(b.buyerId);
    };
    const toggle = (b) => (openId === b.buyerId ? setOpenId(null) : openBuyer(b));

    const pick = (c) => {
        const exist = buyers.find((b) => b.buyerId === c.buyer_id);
        if (exist) { openBuyer(exist); return; }
        const nb = { buyerId: c.buyer_id, name: c.name, phone: c.phone, email: c.email, shopName: c.shop_name, override: null, ...(mode === "public" ? { pendingPricing: true } : {}) };
        set({ buyers: [...buyers, nb].sort(byName) });
        if (mode === "public") openBuyer(nb);
    };

    // a business found by GST number: on BBM -> same as a search hit; not on BBM -> kept as "gst:<GSTIN>"
    const pickGst = (r) => {
        if (r.state === "registered" && r.companyId) {
            pick({ buyer_id: r.companyId, name: r.name, phone: null, email: null, shop_name: r.name });
            return;
        }
        const id = `gst:${r.gstin}`;
        const exist = buyers.find((b) => b.buyerId === id);
        if (exist) { openBuyer(exist); return; }
        const nb = {
            buyerId: id, gstin: r.gstin, pendingGst: true, name: r.name, shopName: r.name, phone: null, email: null, override: null,
            ...(mode === "public" ? { pendingPricing: true } : {}),
        };
        set({ buyers: [...buyers, nb].sort(byName) });
        if (mode === "public") openBuyer(nb);
    };

    const update = (id, updater) => {
        const next = updater(drafts[id] || emptyDraft());
        setDrafts((d) => ({ ...d, [id]: next }));
        set({ buyers: buyers.map((b) => (b.buyerId === id ? { ...b, override: next.canonicalPrice != null ? next : null, basedOnPrice: product.defaultPrice } : b)) });
    };
    const clearPrice = (id) => {
        set({ buyers: buyers.map((b) => (b.buyerId === id ? { ...b, override: null } : b)) });
        setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    };
    const remove = (id) => {
        set({ buyers: buyers.filter((b) => b.buyerId !== id) });
        setOpenId((x) => (x === id ? null : x));
        setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    };

    const list = mode === "restricted" ? buyers : buyers.filter((b) => b.override || b.pendingPricing);

    return (
        <div className="gax gax-stack">
            <Intro />
            {quickBuyer && (
                onlyQuick ? (
                    <p className="gax-sum info">Only {quickBuyer.name || "the buyer who posted this enquiry"} can see this listing.</p>
                ) : (
                    <button type="button" className="gax-btn" onClick={showOnlyToEnquirer}>
                        Show only to {quickBuyer.name || "the buyer who posted this enquiry"}
                    </button>
                )
            )}
            <Field label="Who can see this listing?"><Seg fill v={mode} on={(m) => set({ mode: m })} o={MODES} /></Field>

            {mode === "restricted" && !buyers.length && (
                <p className="gax-sum err">No buyers added yet. The listing stays invisible to everyone until you add at least one.</p>
            )}

            <BuyerSearch token={token} exclude={buyers.map((b) => String(b.buyerId))}
                placeholder={mode === "restricted" ? "Search buyers to give access" : "Search a buyer to set a custom price"} onPick={pick} />
            <Field label="Or add a business by GST number"><GstBuyerAdd token={token} onAdd={pickGst} /></Field>

            {list.some((b) => b.override) && <SlabNote />}

            {!list.length ? (
                <p className="gax-empty">{mode === "restricted" ? "Add a buyer above to give access." : "No custom prices set yet. This step is optional."}</p>
            ) : (
                <div className="gax-cards">
                    {list.map((b) => {
                        const bd = b.override ? derivePriceBreakdown(b.override.canonicalPrice, product.packSize, product.masterPackSize) : product.defaultBreakdown;
                        const enriched = { ...b, effectivePrice: b.override?.canonicalPrice ?? product.defaultPrice, effectiveBreakdown: bd };
                        const stale = !!b.override && b.basedOnPrice != null && Math.abs(b.basedOnPrice - product.defaultPrice) > 0.005;
                        return (
                            <BuyerCard key={b.buyerId} buyer={enriched} product={product} mode={mode}
                                open={openId === b.buyerId} onToggle={() => toggle(b)}
                                draft={drafts[b.buyerId] || emptyDraft()} setDraft={(u) => update(b.buyerId, u)}
                                onClearPrice={() => clearPrice(b.buyerId)} onRemove={() => remove(b.buyerId)}
                                removeLabel={mode === "restricted" ? "Remove buyer" : "Remove"} stale={stale} />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ---------------- LIVE (edit flow) ---------------- */
// A buyer waiting for BBM, shaped like a registered buyer so BuyerCard / draftFromOverride work unchanged.
const asBuyer = (p, sub) => ({
    buyerId: `gst:${p.gstin}`, gstin: p.gstin, pendingGst: true, name: p.name, shopName: p.name, phone: null, email: null,
    hasVisibilityGrant: !!p.hasVisibilityGrant, pendingPricing: !!p.pendingPricing,
    override: p.override ? { overrideType: "fixed", fixedPrice: p.override.effectivePrice } : null,
    effectivePrice: p.override?.effectivePrice ?? sub.defaultPrice,
    effectiveBreakdown: p.override?.effectiveBreakdown ?? sub.defaultBreakdown,
});

export const GrowBuyerAccessLive = forwardRef(function GrowBuyerAccessLive({ token, submissionId }, ref) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [pending, setPending] = useState([]);   // buyers not on BBM yet (raw, from /gst-access)
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [drafts, setDrafts] = useState({});

    const load = useCallback((opts = {}) => {
        if (!opts.silent) setLoading(true);
        Promise.all([fetchListingAccess(token, submissionId), fetchListingPending(token, submissionId)]).then(([res, pen]) => {
            if (res?.success) { setData(res); setError(null); } else setError(res?.message || "Couldn't load buyer access.");
            if (pen?.success) {
                // keep "price not saved yet" cards the seller is still working on
                setPending((prev) => {
                    const server = pen.buyers || [];
                    const keep = prev.filter((p) => p.pendingPricing && !server.some((s) => s.gstin === p.gstin));
                    return [...server, ...keep];
                });
            }
            if (!opts.silent) setLoading(false);
        });
    }, [token, submissionId]);
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [submissionId]);

    const pendingBuyers = useMemo(() => (data ? pending.map((p) => asBuyer(p, data.submission)) : []), [pending, data]);

    const openBuyer = (b) => {
        setDrafts((d) => ({ ...d, [b.buyerId]: d[b.buyerId] || (b.override ? draftFromOverride(b, data.submission) : emptyDraft()) }));
        setOpenId(b.buyerId);
    };
    const toggle = (b) => (openId === b.buyerId ? setOpenId(null) : openBuyer(b));
    const setDraftFor = (id, updater) => setDrafts((p) => ({ ...p, [id]: updater(p[id] || emptyDraft()) }));
    const dropDraft = (id) => setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });

    const changeMode = (m) => {
        const prev = data;
        setData((d) => ({ ...d, submission: { ...d.submission, visibilityMode: m } }));
        setListingVisibilityMode(token, submissionId, m).then(async (res) => {
            if (!res?.success) { setData(prev); return; }
            if (m === "restricted") {
                // like registered buyers: someone who already has a price keeps access
                const need = pending.filter((p) => p.override && !p.hasVisibilityGrant);
                await Promise.all(need.map((p) => addPendingBuyer(token, submissionId, { gstin: p.gstin, grantVisibility: true })));
            }
            load({ silent: true });
        });
    };

    const synth = (c, grant) => ({
        buyerId: c.buyer_id, name: c.name, phone: c.phone, email: c.email, shopName: c.shop_name,
        hasVisibilityGrant: grant, grantedAt: grant ? new Date().toISOString() : null, override: null,
        effectivePrice: data.submission.defaultPrice, effectiveBreakdown: data.submission.defaultBreakdown,
        ...(grant ? {} : { pendingPricing: true }),
    });

    const pick = (c) => {
        const mode = data.submission.visibilityMode;
        const exist = data.buyers.find((b) => b.buyerId === c.buyer_id);
        if (exist) { openBuyer(exist); return; }
        const prev = data;
        if (mode === "restricted") {
            setData((d) => ({ ...d, buyers: [...d.buyers, synth(c, true)].sort(byName) }));
            addListingVisibilityBuyer(token, submissionId, c.buyer_id).then((res) => { if (res?.success) load({ silent: true }); else setData(prev); });
        } else {
            const nb = synth(c, false);
            setData((d) => ({ ...d, buyers: [...d.buyers, nb].sort(byName) }));
            openBuyer(nb);
        }
    };

    // a business found by GST number
    const pickGst = async (r) => {
        if (r.state === "registered" && r.companyId) {
            pick({ buyer_id: r.companyId, name: r.name, phone: null, email: null, shop_name: r.name });
            return;
        }
        const id = `gst:${r.gstin}`;
        const exist = pendingBuyers.find((b) => b.buyerId === id);
        if (exist) { openBuyer(exist); return; }
        if (data.submission.visibilityMode === "restricted") {
            const prev = pending;
            setPending((p) => [...p, { gstin: r.gstin, name: r.name, hasVisibilityGrant: true, override: null }]);
            const res = await addPendingBuyer(token, submissionId, { gstin: r.gstin, grantVisibility: true });
            if (res?.success) load({ silent: true });
            else { setPending(prev); setError(res?.message || "Couldn't add this buyer. Please try again."); }
        } else {
            const nb = { gstin: r.gstin, name: r.name, hasVisibilityGrant: false, override: null, pendingPricing: true };
            setPending((p) => [...p, nb]);
            openBuyer(asBuyer(nb, data.submission));
        }
    };

    const removeAccess = (id) => {
        if (isGstId(id)) {
            const prev = pending;
            setRemovingId(id);
            setPending((p) => p.filter((x) => `gst:${x.gstin}` !== id));
            setOpenId((x) => (x === id ? null : x)); dropDraft(id);
            removePendingBuyer(token, submissionId, gstOf(id), "all").then((res) => {
                setRemovingId(null);
                if (res?.success) load({ silent: true });
                else { setPending(prev); setError(res?.message || "Couldn't remove this buyer's access. Please try again."); }
            });
            return;
        }
        const prev = data;
        const had = !!data.buyers.find((b) => b.buyerId === id)?.override;
        setRemovingId(id);
        setData((d) => ({ ...d, buyers: d.buyers.filter((b) => b.buyerId !== id) }));
        setOpenId((x) => (x === id ? null : x));
        dropDraft(id);
        const calls = [removeListingVisibilityBuyer(token, submissionId, id)];
        if (had) calls.push(deleteCustomPricingForBuyer(token, id, submissionId));
        Promise.all(calls).then((rs) => {
            setRemovingId(null);
            if (rs.every((r) => r?.success)) load({ silent: true });
            else { setData(prev); setError("Couldn't remove this buyer's access. Please try again."); }
        });
    };

    const clearPrice = (id) => {
        if (isGstId(id)) {
            const prev = pending;
            setDeletingId(id);
            setPending((p) => p
                .map((x) => (`gst:${x.gstin}` === id ? { ...x, override: null } : x))
                .filter((x) => `gst:${x.gstin}` !== id || x.hasVisibilityGrant));
            dropDraft(id);
            removePendingBuyer(token, submissionId, gstOf(id), "price").then((res) => {
                setDeletingId(null);
                if (res?.success) load({ silent: true }); else { setPending(prev); setError(res?.message || "Couldn't remove the custom price."); }
            });
            return;
        }
        const prev = data;
        setDeletingId(id);
        setData((d) => ({
            ...d,
            buyers: d.buyers
                .map((b) => (b.buyerId === id ? { ...b, override: null, effectivePrice: d.submission.defaultPrice, effectiveBreakdown: d.submission.defaultBreakdown } : b))
                .filter((b) => b.buyerId !== id || b.hasVisibilityGrant),
        }));
        dropDraft(id);
        deleteCustomPricingForBuyer(token, id, submissionId).then((res) => {
            setDeletingId(null);
            if (res?.success) load({ silent: true }); else setData(prev);
        });
    };

    // a card that was never saved: just forget it
    const discard = (id) => {
        if (isGstId(id)) setPending((p) => p.filter((x) => `gst:${x.gstin}` !== id));
        else setData((d) => ({ ...d, buyers: d.buyers.filter((b) => b.buyerId !== id) }));
        setOpenId((x) => (x === id ? null : x));
        dropDraft(id);
    };

    // Called by the sheet's Save button. Only pushes buyers whose draft price differs from what is stored.
    const flushPendingChanges = useCallback(async () => {
        const all = [...(data?.buyers || []), ...pendingBuyers];
        const ids = Object.keys(drafts).filter((id) => {
            const d = drafts[id];
            if (!d?.canonicalPrice) return false;
            const b = all.find((x) => String(x.buyerId) === String(id));
            return !b || b.effectivePrice !== d.canonicalPrice;
        });
        if (!ids.length) return { success: true };
        let allOk = true;
        for (const id of ids) {
            const d = drafts[id];
            if (isGstId(id)) {
                const res = await addPendingBuyer(token, submissionId, { gstin: gstOf(id), grantVisibility: false, price: { canonicalPrice: d.canonicalPrice } });
                if (!res?.success) { allOk = false; setError(res?.message || "Couldn't save one or more buyer prices."); }
                continue;
            }
            const isIncrease = Number(d.canonicalPrice) > Number(data.submission.defaultPrice);
            const asFixed = d.mode === "amount" || isIncrease;
            const item = {
                submissionId, overrideType: asFixed ? "fixed" : "percent",
                value: asFixed ? d.canonicalPrice : Number(d.percentValue), inputMode: asFixed ? "fixed_price" : "percent",
            };
            const res = await saveCustomPricingForBuyer(token, all.find((x) => String(x.buyerId) === String(id))?.buyerId ?? id, [item]);
            if (res?.rejected?.length || (!res?.success && !res?.saved)) {
                allOk = false;
                setError(res?.rejected?.length
                    ? `That price would go below ₹${MIN_UNIT_PRICE}/unit for one or more buyers. Nothing was saved for them.`
                    : (res?.message || "Couldn't save one or more buyer prices."));
            }
        }
        setOpenId(null);
        load({ silent: true });
        return { success: allOk };
    }, [drafts, data, pendingBuyers, submissionId, token, load]);
    useImperativeHandle(ref, () => ({ flushPendingChanges }), [flushPendingChanges]);

    if (loading) return <div className="gax gax-load"><div className="gax-skel" /><div className="gax-skel" /></div>;
    if (error && !data) return <div className="gax"><p className="gax-sum err">{error}</p></div>;

    const mode = data.submission.visibilityMode;
    const everyone = [...data.buyers, ...pendingBuyers].sort(byName);
    const granted = everyone.filter((b) => b.hasVisibilityGrant);
    const list = mode === "restricted" ? everyone : everyone.filter((b) => b.override || b.pendingPricing);

    return (
        <div className="gax gax-stack">
            <Intro />
            <SlabNote />
            <Field label="Who can see this listing?"><Seg fill v={mode} on={changeMode} o={MODES} /></Field>
            {error && <p className="gax-sum err">{error}</p>}
            {mode === "restricted" && !granted.length && (
                <p className="gax-sum err">No buyers added yet. This listing is invisible to everyone until you add at least one.</p>
            )}

            <BuyerSearch token={token} submissionId={submissionId} exclude={everyone.map((b) => String(b.buyerId))}
                placeholder={mode === "restricted" ? "Search buyers to give access" : "Search a buyer to set a custom price"} onPick={pick} />
            <Field label="Or add a business by GST number"><GstBuyerAdd token={token} submissionId={submissionId} onAdd={pickGst} /></Field>

            {!list.length ? (
                <p className="gax-empty">{mode === "restricted" ? "Add a buyer above to give access." : "No custom prices set for any buyer yet."}</p>
            ) : (
                <div className="gax-cards">
                    {list.map((b) => (
                        <BuyerCard key={b.buyerId} buyer={b} product={data.submission} mode={mode}
                            open={openId === b.buyerId} onToggle={() => toggle(b)}
                            draft={drafts[b.buyerId] || emptyDraft()} setDraft={(u) => setDraftFor(b.buyerId, u)}
                            onClearPrice={() => clearPrice(b.buyerId)}
                            onRemove={() => (mode === "restricted" ? removeAccess(b.buyerId) : discard(b.buyerId))}
                            removeLabel={mode === "restricted" ? "Remove access" : "Remove"}
                            clearing={deletingId === b.buyerId} removing={removingId === b.buyerId}
                            unsaved={drafts[b.buyerId]?.canonicalPrice != null && drafts[b.buyerId].canonicalPrice !== b.effectivePrice} />
                    ))}
                </div>
            )}
        </div>
    );
});

export default GrowBuyerAccessDraft;