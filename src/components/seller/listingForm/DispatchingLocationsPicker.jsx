// components/seller/listingForm/DispatchingLocationsPicker.jsx
//
// Tree: Country -> States (all included by default when country is
// picked) -> seller can deselect specific states -> within a state,
// seller can type free-text cities/districts to EXCLUDE from that
// state (since full India city data isn't seeded — see migration 003
// note). Stored shape:
//   [{ type:'country', name, code, excludedStates:[stateName,...] },
//    { type:'state', name, excludedCities:[cityName,...] }, ...]
// Simplified to a flat array of "included" nodes with an `excluded`
// list on each, matching the jsonb comment in your migration.

import { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronRight, X, Plus } from "lucide-react";
import { fetchGeoCountries, fetchGeoStates, searchGeoLocations } from "../../../utils/sellerListingApi.js";
import { searchGeoLocationsByType } from "../../../utils/sellerListingApi.js";
import { C } from "./FormPrimitives.jsx";

function StateRow({ state, excluded, onToggleExclude, onExcludeCity, onRemoveCityExclusion, cityInput, setCityInput }) {
    const [expanded, setExpanded] = useState(false);
    const isExcluded = excluded.states.includes(state.name);
    const [suggestions, setSuggestions] = useState([]);
    useEffect(() => {
        const q = cityInput[state.name];
        if (!q || q.length < 2) { setSuggestions([]); return; }
        const t = setTimeout(() => {
            searchGeoLocationsByType(q, "city").then((r) => { if (r?.success) setSuggestions(r.items.slice(0, 6)); });
        }, 250);
        return () => clearTimeout(t);
    }, [cityInput[state.name]]);

    return (
        <div className="border-b py-1.5" style={{ borderColor: C.hairSoft }}>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => setExpanded((e) => !e)} className="shrink-0">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" style={{ color: C.muted }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: C.muted }} />}
                </button>
                <input type="checkbox" checked={!isExcluded} onChange={() => onToggleExclude(state.name)} className="h-3.5 w-3.5" />
                <span className="flex-1 text-[12.5px] font-semibold" style={{ color: isExcluded ? C.muted : C.ink }}>{state.name}</span>
                {(excluded.citiesByState[state.name]?.length > 0) && (
                    <span className="text-[10px] font-bold" style={{ color: C.primary }}>{excluded.citiesByState[state.name].length} city excluded</span>
                )}
                {suggestions.length > 0 && (
                    <div className="rounded-lg border bg-white shadow-sm" style={{ borderColor: C.hairSoft }}>
                        {suggestions.map((s) => (
                            <button key={s.id} type="button" onClick={() => { onExcludeCity(state.name, s.name); setCityInput((c) => ({ ...c, [state.name]: "" })); }}
                                className="block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold hover:bg-black/[0.03]" style={{ color: C.ink }}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {expanded && !isExcluded && (
                <div className="ml-9 mt-1.5 flex flex-col gap-1.5">
                    <p className="text-[10.5px] font-medium" style={{ color: C.muted }}>Exclude specific cities/districts within {state.name} (optional):</p>
                    <div className="flex flex-wrap gap-1.5">
                        {(excluded.citiesByState[state.name] || []).map((city) => (
                            <span key={city} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${C.primary}10`, color: C.primary }}>
                                {city}
                                <button type="button" onClick={() => onRemoveCityExclusion(state.name, city)}><X className="h-2.5 w-2.5" /></button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-1.5">
                        <input
                            value={cityInput[state.name] || ""}
                            onChange={(e) => setCityInput((c) => ({ ...c, [state.name]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onExcludeCity(state.name, cityInput[state.name]); setCityInput((c) => ({ ...c, [state.name]: "" })); } }}
                            placeholder="Type a city/district and press Enter"
                            className="flex-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium focus:outline-none"
                            style={{ borderColor: C.hairSoft }}
                        />
                        <button type="button" onClick={() => { onExcludeCity(state.name, cityInput[state.name]); setCityInput((c) => ({ ...c, [state.name]: "" })); }} className="rounded-lg border px-2.5" style={{ borderColor: C.hairSoft, color: C.secondary }}>
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DispatchingLocationsPicker({ value, onChange }) {
    // value shape: { country: {id,name,code} | null, excludedStates: [], citiesByState: {} }
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [cityInput, setCityInput] = useState({});
    const [q, setQ] = useState("");

    const excluded = { states: value?.excludedStates || [], citiesByState: value?.citiesByState || {} };

    useEffect(() => { fetchGeoCountries().then((r) => { if (r?.success) setCountries(r.items); }); }, []);
    useEffect(() => {
        if (!value?.country?.id) { setStates([]); return; }
        fetchGeoStates(value.country.id, q).then((r) => { if (r?.success) setStates(r.items); });
    }, [value?.country?.id, q]);

    const pickCountry = (c) => onChange({ country: c, excludedStates: [], citiesByState: {} });
    const toggleExcludeState = (stateName) => {
        const next = excluded.states.includes(stateName) ? excluded.states.filter((s) => s !== stateName) : [...excluded.states, stateName];
        onChange({ ...value, excludedStates: next });
    };
    const excludeCity = (stateName, city) => {
        if (!city?.trim()) return;
        const list = excluded.citiesByState[stateName] || [];
        if (list.includes(city.trim())) return;
        onChange({ ...value, citiesByState: { ...excluded.citiesByState, [stateName]: [...list, city.trim()] } });
    };
    const removeCityExclusion = (stateName, city) => {
        onChange({ ...value, citiesByState: { ...excluded.citiesByState, [stateName]: (excluded.citiesByState[stateName] || []).filter((c) => c !== city) } });
    };

    return (
        <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-bold" style={{ color: C.ink }}>Dispatching locations <span style={{ color: C.primary }}>*</span></label>
            {!value?.country ? (
                <div className="flex flex-col gap-1.5 rounded-xl border-2 p-3" style={{ borderColor: C.hairSoft }}>
                    <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Pick the country you ship to. All its states are included by default — you can exclude specific states or cities after.</p>
                    <div className="flex flex-wrap gap-1.5">
                        {countries.map((c) => (
                            <button key={c.id} type="button" onClick={() => pickCountry(c)} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-bold" style={{ borderColor: C.hairSoft, color: C.ink }}>
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border-2 p-3" style={{ borderColor: C.hairSoft }}>
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12.5px] font-extrabold" style={{ color: C.ink }}>{value.country.name} — all states included</span>
                        <button type="button" onClick={() => onChange({ country: null, excludedStates: [], citiesByState: {} })} className="text-[11px] font-bold underline" style={{ color: C.muted }}>Change country</button>
                    </div>
                    <div className="relative mb-2">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search states…" className="w-full rounded-lg border px-8 py-1.5 text-[12px] font-medium focus:outline-none" style={{ borderColor: C.hairSoft }} />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {states.map((s) => (
                            <StateRow key={s.id} state={s} excluded={excluded}
                                onToggleExclude={toggleExcludeState} onExcludeCity={excludeCity} onRemoveCityExclusion={removeCityExclusion}
                                cityInput={cityInput} setCityInput={setCityInput} />
                        ))}
                    </div>
                    {excluded.states.length > 0 && (
                        <p className="mt-2 text-[10.5px] font-semibold" style={{ color: C.primary }}>{excluded.states.length} state(s) excluded from delivery.</p>
                    )}
                </div>
            )}
        </div>
    );
}