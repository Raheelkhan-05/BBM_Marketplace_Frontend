// Marketing & promotion for many listings at once: add services, remove services, or replace the plan.
// Reuses MarketingServicePicker (modes "add" / "remove" / "set") and the existing bulk endpoint.
import { useMemo, useState } from "react";
import { Sheet } from "./ui.jsx";
import Ic from "./Ic.jsx";
import { BulkResult } from "./BulkResult.jsx";
import MarketingServicePicker from "../seller/listingForm/MarketingServicePicker.jsx";
import { bulkMarketingChunked } from "../../utils/sellerListingApi.js";

const MODES = [["add", "Add services"], ["remove", "Remove services"], ["set", "Replace plan"]];

export default function BulkMarketingSheet({ items, token, onClose, onApplied }) {
    const [mode, setMode] = useState("add");
    const [draft, setDraft] = useState([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);

    // Listings still on the old custom-percentage plan move to the new plan when saved.
    const legacy = useMemo(
        () => items.filter((it) => !Array.isArray(it.marketing_services) || !it.marketing_services.length).length,
        [items],
    );

    const needsPick = mode !== "set";
    const canApply = !busy && (!needsPick || draft.length > 0);

    function changeMode(m) { setMode(m); setDraft([]); setErr(""); }

    async function apply() {
        if (!canApply) return;
        setBusy(true); setErr("");
        const res = await bulkMarketingChunked(token, { ids: items.map((it) => it.id), mode, services: draft });
        setBusy(false);
        if (!res.success && !res.partial) { setErr(res.message); return; }
        setResult(res);
        onApplied?.(res);
    }

    const n = items.length;
    const label = mode === "add" ? "Add to" : mode === "remove" ? "Remove from" : "Replace plan on";
    return (
        <Sheet light title="Marketing & promotion" sub={`${n} listing${n === 1 ? "" : "s"} selected`} onClose={onClose}>
            {result ? (
                <BulkResult items={items} done={result.updated.length} verb="updated" skipped={result.skipped}
                    error={result.success ? "" : result.message} onClose={onClose} />
            ) : (
                <>
                    <div className="seg segw" role="group" aria-label="What to do" style={{ marginTop: 12 }}>
                        {MODES.map(([k, l]) => (
                            <button key={k} type="button" aria-pressed={mode === k} onClick={() => changeMode(k)}>{l}</button>
                        ))}
                    </div>

                    <p className="sub2" style={{ marginBottom: 12 }}>
                        {mode === "add" && "Pick services to switch on. Services a listing already has stay as they are."}
                        {mode === "remove" && "Pick services to switch off. Product Listing is required and always stays."}
                        {mode === "set" && "The services you pick become the full plan on every selected listing."}
                    </p>

                    {legacy > 0 && (
                        <div className="note warn" style={{ marginBottom: 12 }}>
                            <Ic n="alert" />
                            <span>{legacy} of these {legacy === 1 ? "listing is" : "listings are"} on the old custom-percentage plan and will move to the new service plan.</span>
                        </div>
                    )}

                    <MarketingServicePicker key={mode} value={draft} onChange={setDraft} mode={mode} />

                    {err && <div className="note warn" style={{ marginTop: 14 }}><span>{err}</span></div>}

                    <div className="sfoot"><button className="bt go blk" type="button" disabled={!canApply} onClick={apply}>
                        {busy ? "Saving…" : needsPick && !draft.length ? "Pick at least one service" : `${label} ${n} listing${n === 1 ? "" : "s"}`}
                    </button></div>
                </>
            )}
        </Sheet>
    );
}