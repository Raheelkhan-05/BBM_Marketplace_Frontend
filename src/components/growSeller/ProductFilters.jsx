// Cascading Category > Sub-category > Generic product filters for "My products".
// Options and counts are built by the page from the seller's own listings, so there are no empty choices.
import { memo } from "react";
import Ic from "./Ic.jsx";
import FilterSelect from "./FilterSelect.jsx";

export const UNMAPPED = "__none"; // listings admin hasn't mapped to a category yet

function ProductFilters({ cats, subs, gps, value, onChange, onClear }) {
    const { cat, sub, gp } = value;
    const unmapped = cat === UNMAPPED;
    const active = !!(cat || sub || gp);

    return (
        <div className="pfl" role="group" aria-label="Filter by category">
            <FilterSelect label="Category" allLabel="All categories" value={cat} options={cats}
                onChange={(v) => onChange({ cat: v, sub: "", gp: "" })} />
            <FilterSelect label="Sub-category" allLabel="All sub-categories" value={sub} options={subs}
                disabled={unmapped || !subs.length} onChange={(v) => onChange({ sub: v, gp: "" })} />
            <FilterSelect label="Generic product" allLabel="All generic products" value={gp} options={gps}
                disabled={unmapped || !gps.length} onChange={(v) => onChange({ gp: v })} />
            {active && (
                <button className="bt sm" type="button" onClick={onClear}><Ic n="x" />Clear filters</button>
            )}
        </div>
    );
}

export default memo(ProductFilters);