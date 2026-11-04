// Pause or take live every selected listing that can be switched.
// Listings in review, rejected or expired can't be switched; the server skips them with a reason.
import { useMemo, useState } from "react";
import { Sheet } from "./ui.jsx";
import { BulkResult } from "./BulkResult.jsx";
import { bulkSetActive } from "../../utils/sellerListingApi.js";
import { getListingExpiry } from "../../shared/listingValidity.js";

export default function BulkActiveSheet({ items, token, onClose, onApplied }) {
    const [busy, setBusy] = useState(null); // "live" | "pause"
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);
    const [verb, setVerb] = useState("");

    const c = useMemo(() => {
        const now = Date.now();
        const out = { live: 0, paused: 0, blocked: 0 };
        for (const it of items) {
            if (it.review_status !== "approved" || getListingExpiry(it, now).expired) out.blocked++;
            else if (it.is_active !== false) out.live++;
            else out.paused++;
        }
        return out;
    }, [items]);

    async function run(isActive) {
        if (busy) return;
        setBusy(isActive ? "live" : "pause"); setErr("");
        const res = await bulkSetActive(token, items.map((it) => it.id), isActive);
        setBusy(null);
        if (!res.success && !res.partial) { setErr(res.message); return; }
        setVerb(isActive ? "taken live" : "paused");
        setResult(res);
        onApplied?.(res, isActive);
    }

    const n = items.length;
    return (
        <Sheet title="Pause or go live" sub={`${n} listing${n === 1 ? "" : "s"} selected`} onClose={onClose}>
            {result ? (
                <BulkResult items={items} done={result.updated.length} verb={verb} skipped={result.skipped}
                    error={result.success ? "" : result.message} onClose={onClose} />
            ) : (
                <>
                    <div className="brk">
                        <div><span>Live now</span><b>{c.live}</b></div>
                        <div><span>Paused</span><b>{c.paused}</b></div>
                        {c.blocked > 0 && <div><span>Can't be switched (in review, rejected or expired)</span><b>{c.blocked}</b></div>}
                    </div>
                    {err && <div className="note warn" style={{ marginTop: 14 }}><span>{err}</span></div>}
                    <div className="sfoot stack">
                        <button className="bt gr blk" type="button" disabled={!c.paused || !!busy} onClick={() => run(true)}>
                            {busy === "live" ? "Taking live…" : `Take ${c.paused} live`}
                        </button>
                        <button className="bt blk" type="button" disabled={!c.live || !!busy} onClick={() => run(false)}>
                            {busy === "pause" ? "Pausing…" : `Pause ${c.live}`}
                        </button>
                    </div>
                    <p className="sub2">Paused listings are hidden from buyers until you take them live again.</p>
                </>
            )}
        </Sheet>
    );
}