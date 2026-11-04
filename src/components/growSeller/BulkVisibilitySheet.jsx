// Buyer visibility for many listings at once:
//   Add buyers      -> allow-list them on every selected listing (optionally with a discount for them)
//   Remove buyers   -> take them off every selected listing (optionally clear their custom price)
//   Public / Restricted -> switch the visibility mode of all selected listings
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "./ui.jsx";
import Ic from "./Ic.jsx";
import { BulkResult } from "./BulkResult.jsx";
import { bulkVisibility, searchEligibleBuyers } from "../../utils/sellerListingApi.js";

const TABS = [["add", "Add buyers"], ["remove", "Remove buyers"], ["mode", "Public / Restricted"]];
const MAX_BUYERS = 20;

const buyerLabel = (b) => b.shop_name || b.name || b.phone || b.email || "Buyer";
const buyerSub = (b) => [b.shop_name ? b.name : null, b.phone || b.email].filter(Boolean).join(" · ");

export default function BulkVisibilitySheet({ items, token, onClose, onApplied }) {
    const [tab, setTab] = useState("add");
    const [q, setQ] = useState("");
    const [hits, setHits] = useState([]);
    const [searching, setSearching] = useState(false);
    const [picked, setPicked] = useState([]);           // [{ id, label }]
    const [discount, setDiscount] = useState("");
    const [makeRestricted, setMakeRestricted] = useState(false);
    const [clearPrice, setClearPrice] = useState(false);
    const [mode, setMode] = useState("restricted");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);
    const seen = useRef(new Map());   // search term -> results, so typing back and forth never re-asks the server

    const publicCount = useMemo(() => items.filter((it) => it.visibility_mode !== "restricted").length, [items]);
    const restrictedCount = items.length - publicCount;

    useEffect(() => {
        const term = q.trim();
        if (tab === "mode" || term.length < 2) { setHits([]); setSearching(false); return undefined; }
        const cached = seen.current.get(term.toLowerCase());
        if (cached) { setHits(cached); setSearching(false); return undefined; }
        setSearching(true);
        let live = true;
        const t = setTimeout(async () => {
            let res = null;
            try { res = await searchEligibleBuyers(token, term); } catch { res = null; }
            if (!live) return;
            const found = res?.success ? (res.buyers || []) : [];
            if (res?.success) seen.current.set(term.toLowerCase(), found);
            setHits(found);
            setSearching(false);
        }, 300);
        return () => { live = false; clearTimeout(t); };
    }, [q, tab, token]);

    function pick(b) {
        setPicked((p) => (p.some((x) => x.id === b.buyer_id) || p.length >= MAX_BUYERS ? p : [...p, { id: b.buyer_id, label: buyerLabel(b) }]));
        setQ(""); setHits([]);
    }
    const unpick = (id) => setPicked((p) => p.filter((x) => x.id !== id));
    function changeTab(t) { setTab(t); setQ(""); setHits([]); setErr(""); }

    const discNum = discount.trim() === "" ? null : Number(discount);
    const discOk = discNum === null || (Number.isFinite(discNum) && discNum >= 0 && discNum <= 95);
    const canApply = !busy && (tab === "mode" ? true : picked.length > 0 && (tab !== "add" || discOk));

    async function apply() {
        if (!canApply) return;
        setBusy(true); setErr("");
        const ids = items.map((it) => it.id);
        const buyerIds = picked.map((p) => p.id);
        const payload = tab === "add"
            ? { action: "add", buyerIds, discountPercent: discNum, makeRestricted }
            : tab === "remove"
                ? { action: "remove", buyerIds, clearPrice }
                : { action: "set_mode", mode };
        const res = await bulkVisibility(token, ids, payload);
        setBusy(false);
        if (!res.success && !res.partial) { setErr(res.message); return; }
        setResult({ ...res, verb: tab === "mode" ? "updated" : tab === "add" ? "shared with buyers" : "updated" });
        onApplied?.(res);
    }

    const n = items.length;
    const plural = n === 1 ? "" : "s";
    return (
        <Sheet title="Buyer visibility" sub={`${n} listing${plural} selected`} onClose={onClose}>
            {result ? (
                <BulkResult items={items} done={result.updated.length} verb={result.verb} skipped={result.skipped}
                    error={result.success ? "" : result.message} onClose={onClose} />
            ) : (
                <>
                    <div className="seg segw" role="group" aria-label="What to do">
                        {TABS.map(([k, l]) => (
                            <button key={k} type="button" aria-pressed={tab === k} onClick={() => changeTab(k)}>{l}</button>
                        ))}
                    </div>

                    {tab === "mode" ? (
                        <div className="f">
                            <div className="optl" role="radiogroup" aria-label="Visibility">
                                <button type="button" role="radio" aria-checked={mode === "public"} onClick={() => setMode("public")}>
                                    <b>Public</b><small>Every buyer can see these listings.</small>
                                </button>
                                <button type="button" role="radio" aria-checked={mode === "restricted"} onClick={() => setMode("restricted")}>
                                    <b>Restricted</b><small>Only buyers you add can see them. Buyers who already have a custom price on a listing keep access.</small>
                                </button>
                            </div>
                            <p className="sub2">{publicCount} public · {restrictedCount} restricted right now.</p>
                        </div>
                    ) : (
                        <>
                            <div className="f">
                                <label htmlFor="bulk-buyer">Find a buyer</label>
                                <label className="srch" style={{ margin: 0 }}>
                                    <Ic n="search" />
                                    <input id="bulk-buyer" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Shop name, person, phone or email" autoComplete="off" />
                                </label>
                                {(hits.length > 0 || searching || q.trim().length >= 2) && (
                                    <div className="bhits" role="listbox" aria-label="Matching buyers">
                                        {searching && <div className="bhx">Searching…</div>}
                                        {!searching && !hits.length && <div className="bhx">No eligible buyer found.</div>}
                                        {hits.map((b) => (
                                            <button key={b.buyer_id} type="button" role="option" aria-selected="false" className="bhit" onClick={() => pick(b)}>
                                                <b>{buyerLabel(b)}</b>
                                                {buyerSub(b) && <small>{buyerSub(b)}</small>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {picked.length > 0 && (
                                <div className="pks" aria-label="Chosen buyers">
                                    {picked.map((p) => (
                                        <span className="pk" key={p.id}>{p.label}
                                            <button type="button" aria-label={`Remove ${p.label}`} onClick={() => unpick(p.id)}><Ic n="x" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {picked.length >= MAX_BUYERS && <p className="sub2">You can choose up to {MAX_BUYERS} buyers at a time.</p>}

                            {tab === "add" ? (
                                <>
                                    <div className="f">
                                        <label htmlFor="bulk-disc">Discount for these buyers (optional)</label>
                                        <div className="inp">
                                            <input id="bulk-disc" inputMode="decimal" placeholder="Leave empty to keep the current price" value={discount} autoComplete="off"
                                                onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d{0,2}$/.test(v)) setDiscount(v); }} />
                                            <span className="suf">%</span>
                                        </div>
                                        {!discOk && <p className="sub2" style={{ color: "var(--red)" }}>Enter a discount between 0 and 95%.</p>}
                                    </div>
                                    {publicCount > 0 && (
                                        <label className="ck">
                                            <input type="checkbox" checked={makeRestricted} onChange={(e) => setMakeRestricted(e.target.checked)} />
                                            <span>Make the {publicCount} public listing{publicCount === 1 ? "" : "s"} restricted, so only these buyers can see {publicCount === 1 ? "it" : "them"}. Other buyers will no longer see {publicCount === 1 ? "it" : "them"}.</span>
                                        </label>
                                    )}
                                </>
                            ) : (
                                <label className="ck">
                                    <input type="checkbox" checked={clearPrice} onChange={(e) => setClearPrice(e.target.checked)} />
                                    <span>Also remove their custom price on these listings.</span>
                                </label>
                            )}
                        </>
                    )}

                    {err && <div className="note warn" style={{ marginTop: 14 }}><span>{err}</span></div>}

                    <div className="sfoot"><button className="bt go blk" type="button" disabled={!canApply} onClick={apply}>
                        {busy ? "Saving…"
                            : tab === "mode" ? `Make ${n} listing${plural} ${mode}`
                                : !picked.length ? "Choose a buyer"
                                    : tab === "add" ? `Add ${picked.length} buyer${picked.length === 1 ? "" : "s"} to ${n} listing${plural}`
                                        : `Remove ${picked.length} buyer${picked.length === 1 ? "" : "s"} from ${n} listing${plural}`}
                    </button></div>
                </>
            )}
        </Sheet>
    );
}