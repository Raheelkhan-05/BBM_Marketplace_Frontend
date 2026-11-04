// Cascading Category > Sub-category > Generic product filters for "My products".
// Options and counts are built by the page from the seller's own listings, so there are no empty choices.
import Ic from "./Ic.jsx";

export const UNMAPPED = "__none"; // listings admin hasn't mapped to a category yet

export default function ProductFilters({ cats, subs, gps, value, onChange, onClear }) {
    const { cat, sub, gp } = value;
    const unmapped = cat === UNMAPPED;
    const active = !!(cat || sub || gp);
    const opt = (o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>;

    return (
        <div className="pfl" role="group" aria-label="Filter by category">
            <select className={`sf${cat ? " on" : ""}`} aria-label="Category" value={cat}
                onChange={(e) => onChange({ cat: e.target.value, sub: "", gp: "" })}>
                <option value="">All categories</option>
                {cats.map(opt)}
            </select>
            <select className={`sf${sub ? " on" : ""}`} aria-label="Sub-category" value={sub} disabled={unmapped || !subs.length}
                onChange={(e) => onChange({ sub: e.target.value, gp: "" })}>
                <option value="">All sub-categories</option>
                {subs.map(opt)}
            </select>
            <select className={`sf${gp ? " on" : ""}`} aria-label="Generic product" value={gp} disabled={unmapped || !gps.length}
                onChange={(e) => onChange({ gp: e.target.value })}>
                <option value="">All generic products</option>
                {gps.map(opt)}
            </select>
            {active && (
                <button className="bt sm" type="button" onClick={onClear}><Ic n="x" />Clear filters</button>
            )}
        </div>
    );
}