// components/seller/listingForm/DispatchingLocationsPicker.jsx
import { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronRight, X, Plus } from "lucide-react";
import { fetchGeoCountries, fetchGeoStates, searchGeoLocationsByType } from "../../../utils/sellerListingApi.js";
import { C, Label } from "./FormPrimitives.jsx";

function StateRow({ state, checked, onToggle, cityMode, cities, onAddCity, onRemoveCity, cityInput, setCityInput }) {
    const [expanded, setExpanded] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    useEffect(() => {
        const q = cityInput[state.name];
        if (!q || q.length < 2) { setSuggestions([]); return; }
        const t = setTimeout(() => { searchGeoLocationsByType(q, "city").then((r) => { if (r?.success) setSuggestions(r.items.slice(0, 6)); }); }, 250);
        return () => clearTimeout(t);
    }, [cityInput[state.name]]);

    const cityCount = cities?.length || 0;

    return (
        <div className="border-b py-2" style={{ borderColor: C.hairSoft }}>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => setExpanded((e) => !e)} disabled={!checked} className="shrink-0">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" style={{ color: checked ? C.muted : C.hair }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: checked ? C.muted : C.hair }} />}
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={checked} onChange={() => onToggle(state.name)} className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-[12.5px] font-semibold" style={{ color: checked ? C.ink : C.muted }}>{state.name}</span>
                </label>
                {checked && cityCount > 0 && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={cityMode === "exclude" ? { background: `${C.primary}12`, color: C.primary } : { background: `${C.secondary}14`, color: C.secondary }}>
                        {cityMode === "exclude" ? `${cityCount} city excluded` : `${cityCount} cities only`}
                    </span>
                )}
            </div>
            {expanded && checked && (
                <div className="ml-9 mt-2 flex flex-col gap-1.5">
                    <p className="text-[10px] font-medium" style={{ color: C.muted }}>
                        {cityMode === "exclude" ? `Exclude specific cities within ${state.name} (optional):` : `Only deliver to these cities in ${state.name} — leave empty for the whole state:`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {(cities || []).map((city) => (
                            <span key={city} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={cityMode === "exclude" ? { background: `${C.primary}10`, color: C.primary } : { background: `${C.secondary}12`, color: C.secondary }}>
                                {city}
                                <button type="button" onClick={() => onRemoveCity(state.name, city)}><X className="h-2.5 w-2.5" /></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative flex gap-1.5">
                        <input value={cityInput[state.name] || ""} onChange={(e) => setCityInput((c) => ({ ...c, [state.name]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddCity(state.name, cityInput[state.name]); setCityInput((c) => ({ ...c, [state.name]: "" })); } }}
                            placeholder="Type a city and press Enter"
                            className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium focus:outline-none focus:ring-2"
                            style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }} />
                        <button type="button" onClick={() => { onAddCity(state.name, cityInput[state.name]); setCityInput((c) => ({ ...c, [state.name]: "" })); }} className="shrink-0 rounded-lg border px-2.5" style={{ borderColor: C.hair, color: C.secondary }}>
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                        {suggestions.length > 0 && (
                            <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border bg-white shadow-sm" style={{ borderColor: C.hairSoft }}>
                                {suggestions.map((s) => (
                                    <button key={s.id} type="button" onClick={() => { onAddCity(state.name, s.name); setCityInput((c) => ({ ...c, [state.name]: "" })); }}
                                        className="block w-full px-2.5 py-1.5 text-left text-[10.5px] font-semibold transition-colors duration-150 hover:bg-black/[0.03]" style={{ color: C.ink }}>
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DispatchingLocationsPicker({ value, onChange }) {
    // value: { country, mode: 'exclude'|'include', excludedStates, citiesByState, includedStates, includedCitiesByState }
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [cityInput, setCityInput] = useState({});
    const [q, setQ] = useState("");

    const mode = value?.mode || "exclude";
    const excludedStates = value?.excludedStates || [];
    const citiesByState = value?.citiesByState || {};
    const includedStates = value?.includedStates || [];
    const includedCitiesByState = value?.includedCitiesByState || {};

    useEffect(() => { fetchGeoCountries().then((r) => { if (r?.success) setCountries(r.items); }); }, []);
    useEffect(() => {
        if (!value?.country?.id) { setStates([]); return; }
        fetchGeoStates(value.country.id, q).then((r) => { if (r?.success) setStates(r.items); });
    }, [value?.country?.id, q]);

    const pickCountry = (c) => onChange({ country: c, mode: "exclude", excludedStates: [], citiesByState: {}, includedStates: [], includedCitiesByState: {} });
    const setMode = (m) => onChange({ ...value, mode: m });

    const toggleExcludeState = (name) => {
        const next = excludedStates.includes(name) ? excludedStates.filter((s) => s !== name) : [...excludedStates, name];
        onChange({ ...value, excludedStates: next });
    };
    const addExcludeCity = (state, city) => {
        if (!city?.trim()) return;
        const list = citiesByState[state] || [];
        if (list.includes(city.trim())) return;
        onChange({ ...value, citiesByState: { ...citiesByState, [state]: [...list, city.trim()] } });
    };
    const removeExcludeCity = (state, city) => onChange({ ...value, citiesByState: { ...citiesByState, [state]: (citiesByState[state] || []).filter((c) => c !== city) } });

    const toggleIncludeState = (name) => {
        const next = includedStates.includes(name) ? includedStates.filter((s) => s !== name) : [...includedStates, name];
        const nextCities = { ...includedCitiesByState };
        if (!next.includes(name)) delete nextCities[name];
        onChange({ ...value, includedStates: next, includedCitiesByState: nextCities });
    };
    const addIncludeCity = (state, city) => {
        if (!city?.trim()) return;
        const list = includedCitiesByState[state] || [];
        if (list.includes(city.trim())) return;
        onChange({ ...value, includedCitiesByState: { ...includedCitiesByState, [state]: [...list, city.trim()] } });
    };
    const removeIncludeCity = (state, city) => onChange({ ...value, includedCitiesByState: { ...includedCitiesByState, [state]: (includedCitiesByState[state] || []).filter((c) => c !== city) } });

    const summary = mode === "exclude"
        ? (excludedStates.length ? `Delivering everywhere except ${excludedStates.length} state${excludedStates.length === 1 ? "" : "s"}` : "Delivering to all states")
        : (includedStates.length ? `Delivering to ${includedStates.length} selected state${includedStates.length === 1 ? "" : "s"}` : "Pick at least one state");

    return (
        <div className="flex flex-col gap-1.5">
            <Label>Dispatching locations <span style={{ color: C.primary }}> *</span></Label>
            {!value?.country ? (
                <div className="flex flex-col gap-1.5 rounded-xl border p-3" style={{ borderColor: C.hair }}>
                    <p className="text-[11px] font-medium leading-relaxed" style={{ color: C.muted }}>Pick the country you ship to.</p>
                    <div className="flex flex-wrap gap-1.5">
                        {countries.map((c) => (
                            <button key={c.id} type="button" onClick={() => pickCountry(c)} className="rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 hover:bg-black/[0.02]" style={{ borderColor: C.hair, color: C.ink }}>{c.name}</button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border p-3" style={{ borderColor: C.hair }}>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-extrabold" style={{ color: C.ink }}>{value.country.name}</span>
                        <button type="button" onClick={() => onChange({ country: null, mode: "exclude", excludedStates: [], citiesByState: {}, includedStates: [], includedCitiesByState: {} })}
                            className="shrink-0 text-[10.5px] font-bold underline" style={{ color: C.muted }}>Change</button>
                    </div>

                    <div className="mb-2.5 flex w-fit gap-1 rounded-lg p-1" style={{ background: C.hairSoft }}>
                        <button type="button" onClick={() => setMode("exclude")} className="rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150" style={mode === "exclude" ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>Ship everywhere</button>
                        <button type="button" onClick={() => setMode("include")} className="rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150" style={mode === "include" ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>Only selected states</button>
                    </div>

                    <div className="mb-2 flex items-center gap-1.5">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search states…" className="w-full rounded-lg border px-8 py-1.5 text-[11.5px] font-medium focus:outline-none focus:ring-2" style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }} />
                        </div>
                        {mode === "exclude" ? (
                            <button type="button" onClick={() => onChange({ ...value, excludedStates: [] })} className="shrink-0 text-[10.5px] font-bold" style={{ color: C.secondary }}>Include all</button>
                        ) : (
                            <button type="button" onClick={() => onChange({ ...value, includedStates: [], includedCitiesByState: {} })} className="shrink-0 text-[10.5px] font-bold" style={{ color: C.muted }}>Clear all</button>
                        )}
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {states.map((s) => mode === "exclude" ? (
                            <StateRow key={s.id} state={s} checked={!excludedStates.includes(s.name)} onToggle={toggleExcludeState}
                                cityMode="exclude" cities={citiesByState[s.name]} onAddCity={addExcludeCity} onRemoveCity={removeExcludeCity}
                                cityInput={cityInput} setCityInput={setCityInput} />
                        ) : (
                            <StateRow key={s.id} state={s} checked={includedStates.includes(s.name)} onToggle={toggleIncludeState}
                                cityMode="include" cities={includedCitiesByState[s.name]} onAddCity={addIncludeCity} onRemoveCity={removeIncludeCity}
                                cityInput={cityInput} setCityInput={setCityInput} />
                        ))}
                    </div>

                    <p className="mt-2 text-[10.5px] font-semibold" style={{ color: mode === "include" && !includedStates.length ? C.primary : C.muted }}>{summary}</p>
                </div>
            )}
        </div>
    );
}