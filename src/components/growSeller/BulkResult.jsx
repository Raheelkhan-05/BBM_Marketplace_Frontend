// Shown inside a bulk sheet after the server answers: how many changed, and why the rest were skipped.
import { useMemo } from "react";
import Ic from "./Ic.jsx";
import { toTitleCase } from "./sellerHelpers.js";

const nameOf = (it) => toTitleCase(it.brand?.name || it.product_name || "Product");

export function BulkResult({ items, done, verb, skipped = [], error, onClose }) {
    const names = useMemo(() => new Map(items.map((it) => [String(it.id), nameOf(it)])), [items]);
    const groups = useMemo(() => {
        const m = new Map();
        for (const s of skipped) {
            const list = m.get(s.reason) || [];
            list.push(s.id);
            m.set(s.reason, list);
        }
        return [...m];
    }, [skipped]);

    return (
        <div className="bres">
            <div className={`bok${done ? "" : " none"}`}><Ic n={done ? "check" : "alert"} /></div>
            <div className="big">{done}</div>
            <b>{done === 1 ? "listing" : "listings"} {verb}</b>

            {error && <div className="note warn" style={{ marginTop: 14, textAlign: "left" }}><Ic n="alert" />{error}</div>}

            {groups.length > 0 && (
                <div className="skl">
                    <p className="lb">Skipped · {skipped.length}</p>
                    {groups.map(([reason, ids]) => {
                        const shown = ids.map((id) => names.get(String(id))).filter(Boolean);
                        return (
                            <div key={reason}>
                                <b>{reason} <em>{ids.length}</em></b>
                                {shown.length > 0 && (
                                    <small>{shown.slice(0, 3).join(", ")}{shown.length > 3 ? ` and ${shown.length - 3} more` : ""}</small>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <button className="bt go blk" type="button" style={{ marginTop: 18 }} onClick={onClose}>Done</button>
        </div>
    );
}