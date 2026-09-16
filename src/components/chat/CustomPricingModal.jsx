// components/chat/CustomPricingModal.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Percent, AlertTriangle, IndianRupee, Trash2, Check, Loader2, Tag, ChevronLeft, ArrowRight, Info } from "lucide-react";
import {
    fetchCustomPricing, saveCustomPricing, deleteCustomPricing as deleteCustomPricingApi, bulkClearCustomPricing,
} from "../../utils/api.js";
import { priceFromLevel, derivePriceBreakdown, percentFromCustomPrice, violatesMinUnitPrice, MIN_UNIT_PRICE } from "../../../shared/customPricing.js";


const C = {
    ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)", ok: "#059669", okBg: "#EAF7F2",
    canvas: "#FCFBF9", warnBg: "#FDF3D8", warn: "#a16207",
};
const EASE = [0.16, 1, 0.3, 1];

function inr(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

const LEVEL_LABEL = { unit: (u) => u || "unit", pack: () => "pack", master_pack: () => "master pack" };
const LEVEL_FIELD = { unit: "perBaseUnit", pack: "perPack", master_pack: "perMasterPack" };
function levelsFor(row) { return row.hasMasterPack ? ["unit", "pack", "master_pack"] : ["unit", "pack"]; }

function ModeToggle({ mode, onChange, size = "sm" }) {
    const dim = size === "sm" ? "h-8" : "h-9";
    return (
        <div className={`flex ${dim} shrink-0 overflow-hidden rounded-lg border`} style={{ borderColor: C.hair }}>
            <button type="button" onClick={() => onChange("amount")}
                className="flex items-center gap-1.5 px-2.5 text-[11px] font-bold tracking-wide transition-colors"
                style={mode === "amount" ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>
                <IndianRupee className="h-3 w-3" /> Amount
            </button>
            <button
                type="button"
                onClick={() => onChange("percent")}
                className="flex items-center gap-1.5 border-l px-2.5 text-[11px] font-bold tracking-wide transition-colors"
                style={{
                    borderColor: C.hair,
                    background: mode === "percent" ? C.secondary : "transparent",
                    color: mode === "percent" ? "#fff" : C.muted,
                }}
            >
                <Percent className="h-3 w-3" />
                Percent
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------
// Screen 1 — List
// ---------------------------------------------------------------------
function ListScreen({ rows, loading, query, setQuery, tab, setTab, selected, toggleSelect, onEditSingle, onEditSelected, onClearSelected, onClearAll, customCount }) {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
        if (tab === "custom" && !r.override) return false;
        if (q && !r.name?.toLowerCase().includes(q) && !r.brandName?.toLowerCase().includes(q)) return false;
        return true;
    });

    return (
        <>
            <div className="flex shrink-0 flex-col gap-2.5 border-b px-4 py-3 sm:px-5" style={{ borderColor: C.hairSoft }}>
                <div className="flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: C.hair }}>
                    <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…"
                        className="w-full min-w-0 bg-transparent text-[13px] font-medium tracking-wide outline-none" />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto">
                    <div className="flex shrink-0 gap-1 rounded-full p-0.5" style={{ background: C.hairSoft }}>
                        {[["all", `All (${rows.length})`], ["custom", `Custom (${customCount})`]].map(([v, label]) => (
                            <button key={v} onClick={() => setTab(v)}
                                className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide transition-colors sm:text-[11.5px]"
                                style={tab === v ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {customCount > 0 && (
                        <button onClick={onClearAll} className="ml-auto shrink-0 whitespace-nowrap text-[11px] font-bold tracking-wide underline underline-offset-2 sm:text-[11.5px]" style={{ color: C.primary }}>
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" style={{ color: C.muted }} /></div>
                ) : filtered.length === 0 ? (
                    <p className="py-16 text-center text-[12.5px] font-medium tracking-wide" style={{ color: C.muted }}>No products match.</p>
                ) : (
                    <div className="flex flex-col divide-y" style={{ borderColor: C.hairSoft }}>
                        {filtered.map((row) => (
                            <div key={row.submissionId} className="flex items-center gap-3 py-2.5">
                                <input type="checkbox" checked={selected.has(row.submissionId)} onChange={() => toggleSelect(row.submissionId)}
                                    className="h-4 w-4 shrink-0 accent-[#006F83]" />
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor: C.hair, background: "#F4F5F6" }}>
                                    {row.image ? <img src={row.image} alt="" className="h-full w-full object-cover" /> : null}
                                </span>
                                <button onClick={() => onEditSingle(row.submissionId)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>{row.name}</p>
                                    <p className="truncate text-[10.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                                        ₹{inr(row.defaultBreakdown.perPack)}/pack
                                        {row.hasMasterPack ? ` · ₹${inr(row.defaultBreakdown.perMasterPack)}/master pack` : ""}
                                        {row.override && (
                                            <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider" style={{ background: C.okBg, color: C.ok }}>
                                                Custom
                                            </span>
                                        )}
                                    </p>
                                </button>
                                <button onClick={() => onEditSingle(row.submissionId)}
                                    className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold tracking-wide" style={{ borderColor: C.hair, color: C.secondary }}>
                                    Edit
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selected.size > 0 && (
                    <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="shrink-0 border-t px-4 py-3 sm:px-5" style={{ borderColor: C.hairSoft, background: C.canvas }}>
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[12px] font-extrabold tracking-wide text-white" style={{ background: C.secondary }}>
                                {selected.size}
                            </span>
                            <span className="flex-1 text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>selected</span>
                            <button onClick={onClearSelected} className="shrink-0 text-[11.5px] font-bold tracking-wide underline underline-offset-2" style={{ color: C.muted }}>
                                Clear pricing
                            </button>
                            <button onClick={onEditSelected}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] font-bold tracking-wide text-white" style={{ background: C.secondary }}>
                                Set price <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ---------------------------------------------------------------------
// Screen 2 — Edit. Each product: Amount/Percent toggle, and a live
// preview strip showing the resulting unit/pack/master-pack breakdown
// regardless of which mode was used to get there — so the seller always
// sees the full picture, never has to guess what a % translates to.
// ---------------------------------------------------------------------
// ProductEditCard — now surfaces the floor violation inline, and never
// lets an invalid canonicalPrice sit silently in the draft.
// ---------------------------------------------------------------------
function ProductEditCard({ row, draft, onDraftChange }) {
    const levels = levelsFor(row);
    const invalid = draft.canonicalPrice != null && violatesMinUnitPrice(draft.canonicalPrice, row.packSize, row.masterPackSize);
    const preview = draft.canonicalPrice != null ? derivePriceBreakdown(draft.canonicalPrice, row.packSize, row.masterPackSize) : null;
    const appliedPercent = draft.canonicalPrice != null ? percentFromCustomPrice(row.defaultPrice, draft.canonicalPrice) : null;

    const setFromAmount = (level, raw) => {
        onDraftChange(row.submissionId, (prev) => {
            const nextAmounts = { ...prev.amounts, [level]: raw };
            if (raw === "" || raw == null) return { ...prev, amounts: nextAmounts, canonicalPrice: null };
            const canonical = priceFromLevel(raw, level, row.packSize, row.masterPackSize);
            const bd = derivePriceBreakdown(canonical, row.packSize, row.masterPackSize);
            return {
                ...prev,
                canonicalPrice: canonical,
                percentValue: String(percentFromCustomPrice(row.defaultPrice, canonical)),
                amounts: {
                    unit: level === "unit" ? raw : String(bd.perBaseUnit ?? ""),
                    pack: level === "pack" ? raw : String(bd.perPack ?? ""),
                    master_pack: level === "master_pack" ? raw : (bd.perMasterPack != null ? String(bd.perMasterPack) : ""),
                },
            };
        });
    };

    const setFromPercent = (raw) => {
        onDraftChange(row.submissionId, (prev) => {
            if (raw === "" || raw == null) return { ...prev, percentValue: raw, canonicalPrice: null };
            const canonical = Math.round(row.defaultPrice * (1 - Number(raw) / 100) * 100) / 100;
            const bd = derivePriceBreakdown(canonical, row.packSize, row.masterPackSize);
            return {
                ...prev,
                percentValue: raw,
                canonicalPrice: canonical,
                amounts: {
                    unit: String(bd.perBaseUnit ?? ""),
                    pack: String(bd.perPack ?? ""),
                    master_pack: bd.perMasterPack != null ? String(bd.perMasterPack) : "",
                },
            };
        });
    };

    const clear = () => onDraftChange(row.submissionId, () => ({
        mode: "amount", amounts: { unit: "", pack: "", master_pack: "" }, percentValue: "", canonicalPrice: null,
    }));

    return (
        <div className="flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4" style={{ borderColor: invalid ? C.danger : C.hair }}>
            <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor: C.hair, background: "#F4F5F6" }}>
                    {row.image ? <img src={row.image} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>{row.name}</p>
                    <p className="truncate text-[10.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                        Default ₹{inr(row.defaultBreakdown.perPack)}/pack
                        {row.hasMasterPack ? ` · ₹${inr(row.defaultBreakdown.perMasterPack)}/master pack` : ""}
                    </p>
                </div>
                {draft.canonicalPrice != null && (
                    <button onClick={clear} className="shrink-0 rounded-lg p-1.5 hover:bg-black/5">
                        <Trash2 className="h-3.5 w-3.5" style={{ color: C.muted }} />
                    </button>
                )}
            </div>

            <ModeToggle mode={draft.mode} onChange={(m) => onDraftChange(row.submissionId, (prev) => ({ ...prev, mode: m }))} />

            {draft.mode === "amount" ? (
                <div className={`grid gap-2 ${levels.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
                    {levels.map((level) => (
                        <div key={level} className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                                Price / {LEVEL_LABEL[level](row.unit)}
                            </span>
                            <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2" style={{ borderColor: invalid ? C.danger : C.hair }}>
                                <span className="text-[12px] font-bold tracking-wide" style={{ color: C.muted }}>₹</span>
                                <input
                                    type="number" inputMode="decimal"
                                    value={draft.amounts[level] ?? ""}
                                    onChange={(e) => setFromAmount(level, e.target.value)}
                                    placeholder={inr(row.defaultBreakdown[LEVEL_FIELD[level]])}
                                    className="w-full min-w-0 bg-transparent text-[13px] font-bold tabular-nums tracking-wide outline-none"
                                    style={{ color: C.ink }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2" style={{ borderColor: invalid ? C.danger : C.hair }}>
                        <input
                            type="number" inputMode="decimal"
                            value={draft.percentValue ?? ""}
                            onChange={(e) => setFromPercent(e.target.value)}
                            placeholder="e.g. 10"
                            className="w-full min-w-0 bg-transparent text-[13px] font-bold tabular-nums tracking-wide outline-none"
                            style={{ color: C.ink }}
                        />
                        <span className="shrink-0 text-[12px] font-bold tracking-wide" style={{ color: C.muted }}>% off default</span>
                    </div>
                    <p className="flex items-start gap-1 text-[10.5px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                        <Info className="mt-[1px] h-3 w-3 shrink-0" />
                        Positive discounts this buyer. Negative (e.g. -10) charges them 10% more than your default price.
                    </p>
                </div>
            )}

            {/* NEW — floor violation, blocks nothing else on the card but
                makes it impossible to miss and impossible to proceed with. */}
            {invalid && (
                <p className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold leading-snug tracking-wide" style={{ background: C.dangerBg, color: C.danger }}>
                    <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                    That works out to below ₹{MIN_UNIT_PRICE} per {row.unit || "unit"} — raise the price to continue.
                </p>
            )}

            {preview && !invalid && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2.5 py-2" style={{ background: C.okBg }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.ok }}>
                        {appliedPercent >= 0 ? `${appliedPercent}% off` : `${Math.abs(appliedPercent)}% markup`}
                    </span>
                    {levels.map((level) => (
                        <span key={level} className="text-[11.5px] font-bold tabular-nums tracking-wide" style={{ color: C.ok }}>
                            ₹{inr(preview[LEVEL_FIELD[level]])}<span className="font-medium">/{LEVEL_LABEL[level](row.unit)}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// EditScreen — the "Review changes" button is now blocked while ANY
// visible card is in a violating state, and the bulk-percent apply skips
// (rather than silently saves) any product it would push below the floor.
function EditScreen({ selectedRows, drafts, onDraftChange, onReview, bulkPercent, setBulkPercent, onApplyBulkPercent, bulkSkippedCount }) {
    const anyInvalid = selectedRows.some((row) => {
        const d = drafts[row.submissionId];
        return d?.canonicalPrice != null && violatesMinUnitPrice(d.canonicalPrice, row.packSize, row.masterPackSize);
    });

    return (
        <>
            <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {selectedRows.length > 1 && (
                    <div className="mb-3 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: C.hair, background: C.canvas }}>
                            <Percent className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                            <span className="shrink-0 text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>Apply % to all</span>
                            <input type="number" value={bulkPercent} onChange={(e) => setBulkPercent(e.target.value)}
                                placeholder="e.g. 10, or -10 for markup"
                                className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] font-bold tabular-nums tracking-wide outline-none" style={{ borderColor: C.hair }} />
                            <button onClick={onApplyBulkPercent} disabled={!bulkPercent}
                                className="shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-white disabled:opacity-50" style={{ background: C.secondary }}>
                                Apply
                            </button>
                        </div>
                        {/* NEW — bulk apply never silently drops a product; it
                            tells the seller exactly how many it skipped and why. */}
                        {bulkSkippedCount > 0 && (
                            <p className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold leading-snug tracking-wide" style={{ background: C.warnBg, color: C.warn }}>
                                <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                                Skipped {bulkSkippedCount} product{bulkSkippedCount === 1 ? "" : "s"} — that percentage would take it below ₹{MIN_UNIT_PRICE}/unit. Set those individually.
                            </p>
                        )}
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    {selectedRows.map((row) => (
                        <ProductEditCard key={row.submissionId} row={row} draft={drafts[row.submissionId]} onDraftChange={onDraftChange} />
                    ))}
                </div>
            </div>
            <div className="shrink-0 border-t px-4 py-3 sm:px-5" style={{ borderColor: C.hairSoft }}>
                <button onClick={onReview} disabled={anyInvalid}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold tracking-wide text-white disabled:opacity-50" style={{ background: C.secondary }}>
                    {anyInvalid ? "Fix prices below the minimum first" : "Review changes"} {!anyInvalid && <ArrowRight className="h-4 w-4" />}
                </button>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------
// Screen 3 — Review
// ---------------------------------------------------------------------
function ReviewRow({ row, canonicalPrice }) {
    const after = derivePriceBreakdown(canonicalPrice, row.packSize, row.masterPackSize);
    const before = row.effectiveBreakdown;
    const levels = levelsFor(row);
    const pct = percentFromCustomPrice(row.defaultPrice, canonicalPrice);

    return (
        <div className="rounded-2xl border p-3.5 sm:p-4" style={{ borderColor: C.hair }}>
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>{row.name}</p>
                <span className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-bold tracking-wider" style={{ background: pct >= 0 ? C.okBg : C.warnBg, color: pct >= 0 ? C.ok : C.warn }}>
                    {pct >= 0 ? `${pct}% off` : `${Math.abs(pct)}% markup`}
                </span>
            </div>
            <div className="flex flex-col gap-1.5">
                {levels.map((level) => {
                    const field = LEVEL_FIELD[level];
                    const beforeVal = before[field];
                    const afterVal = after[field];
                    if (beforeVal == null && afterVal == null) return null;
                    return (
                        <div key={level} className="flex items-center justify-between gap-2 text-[12px] tracking-wide">
                            <span className="font-semibold" style={{ color: C.muted }}>{LEVEL_LABEL[level](row.unit)}</span>
                            <span className="flex items-center gap-1.5 font-bold tabular-nums">
                                <span style={{ color: C.muted, textDecoration: "line-through" }}>₹{inr(beforeVal)}</span>
                                <ArrowRight className="h-3 w-3 shrink-0" style={{ color: C.muted }} />
                                <span style={{ color: C.secondary }}>₹{inr(afterVal)}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ReviewScreen({ selectedRows, drafts, onConfirm, saving }) {
    const changed = selectedRows.filter((r) => drafts[r.submissionId]?.canonicalPrice != null);
    return (
        <>
            <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {changed.length === 0 ? (
                    <p className="py-16 text-center text-[12.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                        No price entered yet — go back and set at least one price.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {changed.map((row) => (
                            <ReviewRow key={row.submissionId} row={row} canonicalPrice={drafts[row.submissionId].canonicalPrice} />
                        ))}
                    </div>
                )}
            </div>
            <div className="shrink-0 border-t px-4 py-3 sm:px-5" style={{ borderColor: C.hairSoft }}>
                <button onClick={onConfirm} disabled={saving || changed.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold tracking-wide text-white disabled:opacity-50" style={{ background: C.ok }}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirm &amp; save {changed.length ? `${changed.length} ` : ""}change{changed.length === 1 ? "" : "s"}
                </button>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------
export default function CustomPricingModal({ open, onClose, buyerId, buyerLabel, token }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const [screen, setScreen] = useState("list");
    const [editingIds, setEditingIds] = useState([]);
    const [bulkSkippedCount, setBulkSkippedCount] = useState(0);
    const [drafts, setDrafts] = useState({});
    const [bulkPercent, setBulkPercent] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!buyerId) return;
        setLoading(true);
        const res = await fetchCustomPricing(token, buyerId);
        if (res?.success) setRows(res.items);
        setLoading(false);
    }, [buyerId, token]);

    useEffect(() => {
        if (open) { load(); setSelected(new Set()); setQuery(""); setScreen("list"); setDrafts({}); setBulkPercent(""); }
    }, [open, load]);

    const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.submissionId, r])), [rows]);

    const initDraftFor = (row) => {
        if (row.override) {
            // Backward-compatible read for rows saved under the old
            // fixed/lock model — displayed as an equivalent amount, but
            // will be re-saved as percent going forward like everything else.
            const canonical = row.effectivePrice;
            const bd = row.effectiveBreakdown;
            return {
                mode: "amount",
                canonicalPrice: canonical,
                percentValue: String(percentFromCustomPrice(row.defaultPrice, canonical)),
                amounts: { unit: String(bd.perBaseUnit ?? ""), pack: String(bd.perPack ?? ""), master_pack: bd.perMasterPack != null ? String(bd.perMasterPack) : "" },
            };
        }
        return { mode: "amount", canonicalPrice: null, percentValue: "", amounts: { unit: "", pack: "", master_pack: "" } };
    };

    const openEditor = (ids) => {
        const next = {};
        ids.forEach((id) => { if (rowById[id]) next[id] = initDraftFor(rowById[id]); });
        setDrafts(next);
        setEditingIds(ids);
        setScreen("edit");
    };

    const toggleSelect = (id) => setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });

    const handleDraftChange = (submissionId, updater) => setDrafts((prev) => ({ ...prev, [submissionId]: updater(prev[submissionId]) }));

    const applyBulkPercent = () => {
        const pct = Number(bulkPercent);
        if (!Number.isFinite(pct)) return;
        let skipped = 0;
        setDrafts((prev) => {
            const next = { ...prev };
            editingIds.forEach((id) => {
                const row = rowById[id];
                if (!row) return;
                const canonical = Math.round(row.defaultPrice * (1 - pct / 100) * 100) / 100;
                if (violatesMinUnitPrice(canonical, row.packSize, row.masterPackSize)) {
                    skipped += 1;
                    return; // leave this product's draft untouched — no silent bad write
                }
                const bd = derivePriceBreakdown(canonical, row.packSize, row.masterPackSize);
                next[id] = {
                    mode: "percent",
                    canonicalPrice: canonical,
                    percentValue: String(pct),
                    amounts: { unit: String(bd.perBaseUnit ?? ""), pack: String(bd.perPack ?? ""), master_pack: bd.perMasterPack != null ? String(bd.perMasterPack) : "" },
                };
            });
            return next;
        });
        setBulkSkippedCount(skipped);
    };

    const confirmSave = async () => {
        const items = editingIds
            .map((id) => ({ id, row: rowById[id], draft: drafts[id] }))
            .filter((x) => x.draft?.canonicalPrice != null)
            .filter((x) => !violatesMinUnitPrice(x.draft.canonicalPrice, x.row.packSize, x.row.masterPackSize)) // defensive, see comment above
            .map(({ id, row, draft }) => ({
                submissionId: id,
                overrideType: "percent",
                value: percentFromCustomPrice(row.defaultPrice, draft.canonicalPrice),
                inputMode: "percent",
            }));

        if (!items.length) return;
        setSaving(true);
        const res = await saveCustomPricing(token, buyerId, items);
        setSaving(false);
        // NEW — surface a partial-save rejection from the backend, in case
        // something changed server-side (e.g. seller's own default price
        // dropped) between opening the editor and hitting confirm.
        if (res?.rejected?.length) {
            setSaveWarning(`${res.rejected.length} product${res.rejected.length === 1 ? "" : "s"} couldn't be saved — price would go below ₹${MIN_UNIT_PRICE}/unit.`);
        } else {
            setSaveWarning(null);
        }
        setSelected(new Set());
        setScreen("list");
        await load();
    };

    const clearSelected = async () => {
        if (!selected.size) return;
        await bulkClearCustomPricing(token, buyerId, [...selected]);
        setSelected(new Set());
        await load();
    };

    const clearAll = async () => {
        await bulkClearCustomPricing(token, buyerId);
        setSelected(new Set());
        await load();
    };

    const customCount = rows.filter((r) => r.override).length;
    const editingRows = editingIds.map((id) => rowById[id]).filter(Boolean);
    const titleForScreen = { list: "Custom pricing", edit: "Set pricing", review: "Review & confirm" }[screen];

    return (
        <AnimatePresence>
            {open && (
                <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
                    <motion.div
                        className="flex h-[94vh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:h-[85vh] sm:max-w-2xl sm:rounded-[18px]"
                        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }} onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 justify-center pb-1 pt-2 sm:hidden">
                            <span className="h-1 w-9 rounded-full" style={{ background: C.hair }} />
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3 sm:px-5" style={{ borderColor: C.hairSoft }}>
                            {screen !== "list" && (
                                <button onClick={() => setScreen(screen === "review" ? "edit" : "list")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
                                    <ChevronLeft className="h-4.5 w-4.5" style={{ color: C.ink }} />
                                </button>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider" style={{ color: C.secondary }}>
                                    <Tag className="h-3 w-3" /> {buyerLabel}
                                </p>
                                <h2 className="truncate text-[16px] font-bold tracking-wide sm:text-[17px]" style={{ color: C.ink }}>{titleForScreen}</h2>
                                {screen === "list" ? (
                                    <p className="text-[11px] font-medium tracking-wide sm:text-[11.5px]" style={{ color: C.muted }}>
                                        {customCount} of {rows.length} product{rows.length === 1 ? "" : "s"} custom priced
                                    </p>
                                ) : (
                                    <p className="text-[11px] font-medium tracking-wide sm:text-[11.5px]" style={{ color: C.muted }}>
                                        {editingIds.length} product{editingIds.length === 1 ? "" : "s"}
                                    </p>
                                )}
                            </div>
                            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5 sm:h-9 sm:w-9">
                                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" style={{ color: C.muted }} />
                            </button>
                        </div>

                        {screen === "list" && (
                            <ListScreen
                                rows={rows} loading={loading} query={query} setQuery={setQuery} tab={tab} setTab={setTab}
                                selected={selected} toggleSelect={toggleSelect}
                                onEditSingle={(id) => openEditor([id])}
                                onEditSelected={() => openEditor([...selected])}
                                onClearSelected={clearSelected}
                                onClearAll={clearAll}
                                customCount={customCount}
                            />
                        )}
                        {screen === "edit" && (
                            <EditScreen
                                selectedRows={editingRows} drafts={drafts} onDraftChange={handleDraftChange}
                                onReview={() => setScreen("review")}
                                bulkPercent={bulkPercent} setBulkPercent={setBulkPercent} onApplyBulkPercent={applyBulkPercent}
                            />
                        )}
                        {screen === "review" && (
                            <ReviewScreen selectedRows={editingRows} drafts={drafts} onConfirm={confirmSave} saving={saving} />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}