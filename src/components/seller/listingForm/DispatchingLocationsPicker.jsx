// components/seller/listingForm/DispatchingLocationsPicker.jsx
//
// Redesigned for the 5-level hierarchy: Country (locked to India) -> State
// -> District -> Area (taluka) -> Village. Two ways to work with it, side
// by side:
//
//  1. Quick search — type "Ribda" or "Sapar" and act on it directly, with
//     its full breadcrumb shown, no manual tree expansion required. This is
//     the fast path for "I need to exclude/include one specific place."
//  2. The browse tree below — same exclude/include-mode checkbox pattern as
//     before, now one level deeper. This is the fast path for "I want to
//     eyeball everything under a state/district and bulk toggle."
//
// Both write into the same `value` shape, so switching between them mid-task
// is seamless.
import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, ChevronRight, X, Plus, Loader2, MapPin } from "lucide-react";
import {
    fetchGeoCountries,
    fetchGeoStates,
    fetchGeoDistricts,
    fetchGeoAreas,
    fetchGeoVillages,
    searchGeoLocationsByType,
} from "../../../utils/sellerListingApi.js";
import { C, Label } from "./FormPrimitives.jsx";

// ---------------------------------------------------------------------------
// Lenis hijack (unchanged from the original — inner scroll areas shouldn't
// fight the page's smooth-scroll)
// ---------------------------------------------------------------------------
function useLenisHijack() {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Mark this element so nested hijacked containers can be found
        // explicitly via closest(), instead of relying on however the
        // event happens to bubble through arbitrary intermediate DOM.
        el.setAttribute("data-lenis-hijack", "true");

        const handleWheel = (e) => {
            // Whichever hijacked container is nearest to the actual
            // hovered element owns this event — even if `el` is also an
            // ancestor further up the tree. This makes the behavior
            // correct regardless of nesting depth or DOM structure
            // between levels (state -> district -> area -> village).
            const owner = e.target.closest('[data-lenis-hijack="true"]');
            if (owner !== el) return;

            const atTop = el.scrollTop <= 0;
            const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
            const scrollingUp = e.deltaY < 0;
            const scrollingDown = e.deltaY > 0;

            // At this container's own edge in the scroll direction: let it
            // bubble so an ANCESTOR hijacked container (or Lenis at the
            // page level, if none) can take over from here.
            if ((scrollingUp && atTop) || (scrollingDown && atBottom)) return;

            e.preventDefault();
            e.stopPropagation();
            el.scrollTop += e.deltaY;
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, []);

    return ref;
}

function useDebouncedValue(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function HeaderCheckbox({ checked, indeterminate, onChange }) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
    return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5" />;
}

// Shared exclude/include selection logic for any single level, given the
// full list of sibling names and the current restriction value for that
// level (undefined | string[], meaning depends on mode).
function computeSelection(mode, allNames, restriction) {
    const isChecked = (name) => {
        if (mode === "exclude") return !(restriction || []).includes(name);
        return restriction === undefined || restriction.includes(name);
    };
    const toggle = (name, onSetRestriction) => {
        if (mode === "exclude") {
            const excluded = restriction || [];
            onSetRestriction(excluded.includes(name) ? excluded.filter((n) => n !== name) : [...excluded, name]);
        } else {
            const included = restriction === undefined ? allNames : restriction;
            onSetRestriction(included.includes(name) ? included.filter((n) => n !== name) : [...included, name]);
        }
    };
    const restrictedCount = mode === "exclude" ? (restriction || []).length : (restriction ? allNames.length - restriction.length : 0);
    const allSelected = restrictedCount === 0;
    const noneSelected = mode === "exclude"
        ? restriction?.length === allNames.length && allNames.length > 0
        : restriction?.length === 0;
    const isCustomized = mode === "exclude" ? (restriction?.length > 0) : (restriction !== undefined);
    return { isChecked, toggle, restrictedCount, allSelected, noneSelected, isCustomized };
}

function SelectAllRow({ label, allSelected, noneSelected, onSelectAll, onDeselectAll, countLabel, accent }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: C.ink }}>
                <HeaderCheckbox checked={allSelected} indeterminate={!allSelected && !noneSelected} onChange={() => (allSelected ? onDeselectAll() : onSelectAll())} />
                {label}
            </label>
            <span className="text-[11.5px] font-semibold" style={{ color: accent }}>{countLabel}</span>
        </div>
    );
}

function CustomAddRow({ value, onChange, onAdd, placeholder }) {
    return (
        <div className="flex gap-1.5 border-t pt-2" style={{ borderColor: C.hairSoft }}>
            <input value={value} onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
                placeholder={placeholder}
                className="min-w-0 flex-1 rounded-md border px-2 py-1 text-[12px] font-medium focus:outline-none" style={{ borderColor: C.hair }} />
            <button type="button" onClick={onAdd} className="shrink-0 rounded-md border px-2" style={{ borderColor: C.hair, color: C.secondary }}>
                <Plus className="h-3 w-3" />
            </button>
        </div>
    );
}

// A single expandable node used at every non-leaf level (state / district /
// area). Leaf level (village) renders as a plain checkbox instead — see
// VillagePanel below.
function ExpandableRow({ name, checked, onToggle, isCustomized, expanded, onToggleExpand, size = "md", forceOpenGlow }) {
    const textSize = size === "lg" ? "text-[14px]" : "text-[13px]";
    const iconSize = size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";
    return (
        <div className="flex items-center gap-2">
            <button type="button" onClick={onToggleExpand} disabled={!checked} className="shrink-0">
                {expanded ? <ChevronDown className={iconSize} style={{ color: checked ? C.muted : C.hair }} /> : <ChevronRight className={iconSize} style={{ color: checked ? C.muted : C.hair }} />}
            </button>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={checked} onChange={onToggle} className={size === "lg" ? "h-3.5 w-3.5 shrink-0" : "h-3 w-3 shrink-0"} />
                <span className={`flex-1 truncate ${textSize} font-semibold`} style={{ color: checked ? C.ink : C.muted }}>{name}</span>
            </label>
            {checked && isCustomized && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${C.primary}12`, color: C.primary }}>Customized</span>
            )}
            {forceOpenGlow && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.secondary }} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Level 4 (leaf): Villages within an area
// ---------------------------------------------------------------------------
function VillagePanel({ area, mode, restriction, onSetRestriction, focusName }) {
    const [allVillages, setAllVillages] = useState(null);
    const [filter, setFilter] = useState("");
    const [customInput, setCustomInput] = useState("");
    const scrollRef = useLenisHijack();

    useEffect(() => {
        setAllVillages(null);
        fetchGeoVillages(area.id).then((r) => setAllVillages(r?.success ? r.items.map((v) => v.name) : []));
    }, [area.id]);

    useEffect(() => {
        if (focusName && filter && !focusName.toLowerCase().includes(filter.toLowerCase())) setFilter("");
    }, [focusName]); // eslint-disable-line react-hooks/exhaustive-deps

    if (allVillages === null) {
        return <div className="ml-9 mt-2 flex items-center gap-2 text-[12.5px] font-medium" style={{ color: C.muted }}><Loader2 className="h-3 w-3 animate-spin" /> Loading villages…</div>;
    }

    const { isChecked, toggle, restrictedCount, allSelected, noneSelected } = computeSelection(mode, allVillages, restriction);
    const visible = filter.trim() ? allVillages.filter((v) => v.toLowerCase().includes(filter.trim().toLowerCase())) : allVillages;

    const countLabel = mode === "exclude"
        ? (restrictedCount > 0 ? `${restrictedCount} excluded` : "All included")
        : (restriction === undefined ? "All included" : `${restriction.length} of ${allVillages.length} included`);

    const addCustom = () => {
        const name = customInput.trim();
        if (!name) return;
        if (mode === "exclude") onSetRestriction([...(restriction || []), name]);
        else onSetRestriction([...(restriction === undefined ? allVillages : restriction), name]);
        setCustomInput("");
    };

    return (
        <div className="ml-9 mt-2 flex flex-col gap-2 rounded-lg border p-2.5" style={{ borderColor: C.hairSoft }}>
            <SelectAllRow
                label="Select all villages"
                allSelected={allSelected}
                noneSelected={noneSelected}
                onSelectAll={() => onSetRestriction(undefined)}
                onDeselectAll={() => onSetRestriction(mode === "exclude" ? [...allVillages] : [])}
                countLabel={countLabel}
                accent={mode === "exclude" ? C.primary : C.secondary}
            />

            {allVillages.length > 6 && (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: C.muted }} />
                    <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter villages…"
                        className="w-full rounded-md border py-1 pl-6 pr-2 text-[12px] font-medium focus:outline-none" style={{ borderColor: C.hair }} />
                </div>
            )}

            {allVillages.length === 0 ? (
                <p className="text-[12px] font-medium" style={{ color: C.muted }}>No villages on file for {area.name} yet — add one manually below.</p>
            ) : (
                <div ref={scrollRef} className="grid max-h-40 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-3">
                    {visible.map((village) => (
                        <label key={village} className="flex items-center gap-1.5 text-[12.5px] font-semibold"
                            style={{ color: village === focusName ? C.secondary : C.ink }}>
                            <input type="checkbox" checked={isChecked(village)} onChange={() => toggle(village, onSetRestriction)} className="h-3 w-3 shrink-0" />
                            <span className="truncate">{village}</span>
                        </label>
                    ))}
                </div>
            )}

            <CustomAddRow value={customInput} onChange={setCustomInput} onAdd={addCustom} placeholder="Village not listed? Type and press Enter" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Level 3: Areas within a district (each area can expand into its villages)
// ---------------------------------------------------------------------------
function AreaRow({ district, area, checked, onToggleArea, mode, restriction, onSetRestriction, focusPath, forceExpand }) {
    const [expanded, setExpanded] = useState(false);
    const hasVillageRestriction = mode === "exclude" ? (restriction?.length > 0) : (restriction !== undefined);

    useEffect(() => { if (forceExpand) setExpanded(true); }, [forceExpand]);

    return (
        <div className="border-b py-1.5" style={{ borderColor: C.hairSoft }}>
            <ExpandableRow
                name={area.name}
                checked={checked}
                onToggle={() => onToggleArea(area.name)}
                isCustomized={hasVillageRestriction}
                expanded={expanded}
                onToggleExpand={() => setExpanded((e) => !e)}
                forceOpenGlow={forceExpand}
            />
            {expanded && checked && (
                <VillagePanel
                    area={area}
                    mode={mode}
                    restriction={restriction}
                    onSetRestriction={(next) => onSetRestriction(area.name, next)}
                    focusName={focusPath?.village}
                />
            )}
        </div>
    );
}

function AreaPanel({ district, mode, areaRestriction, onSetAreaRestriction, villagesByArea, onSetVillageRestriction, focusPath }) {
    const [allAreas, setAllAreas] = useState(null);
    const [filter, setFilter] = useState("");
    const [customInput, setCustomInput] = useState("");
    const scrollRef = useLenisHijack();

    useEffect(() => {
        setAllAreas(null);
        fetchGeoAreas(district.id).then((r) => setAllAreas(r?.success ? r.items : []));
    }, [district.id]);

    if (allAreas === null) {
        return <div className="ml-9 mt-2 flex items-center gap-2 text-[12.5px] font-medium" style={{ color: C.muted }}><Loader2 className="h-3 w-3 animate-spin" /> Loading areas…</div>;
    }

    const allNames = allAreas.map((a) => a.name);
    const { isChecked, toggle, restrictedCount, allSelected, noneSelected } = computeSelection(mode, allNames, areaRestriction);
    const visible = filter.trim() ? allAreas.filter((a) => a.name.toLowerCase().includes(filter.trim().toLowerCase())) : allAreas;

    const countLabel = mode === "exclude"
        ? (restrictedCount > 0 ? `${restrictedCount} excluded` : "All included")
        : (areaRestriction === undefined ? "All included" : `${areaRestriction.length} of ${allNames.length} included`);

    const addCustom = () => {
        const name = customInput.trim();
        if (!name) return;
        if (mode === "exclude") onSetAreaRestriction([...(areaRestriction || []), name]);
        else onSetAreaRestriction([...(areaRestriction === undefined ? allNames : areaRestriction), name]);
        setCustomInput("");
    };

    return (
        <div className="ml-9 mt-2 flex flex-col gap-2 rounded-lg border p-2.5" style={{ borderColor: C.hairSoft }}>
            <SelectAllRow
                label="Select all areas"
                allSelected={allSelected}
                noneSelected={noneSelected}
                onSelectAll={() => onSetAreaRestriction(undefined)}
                onDeselectAll={() => onSetAreaRestriction(mode === "exclude" ? [...allNames] : [])}
                countLabel={countLabel}
                accent={mode === "exclude" ? C.primary : C.secondary}
            />

            {allNames.length > 6 && (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: C.muted }} />
                    <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter areas…"
                        className="w-full rounded-md border py-1 pl-6 pr-2 text-[12px] font-medium focus:outline-none" style={{ borderColor: C.hair }} />
                </div>
            )}

            {allAreas.length === 0 ? (
                <p className="text-[12px] font-medium" style={{ color: C.muted }}>No areas on file for {district.name} yet — add one manually below.</p>
            ) : (
                <div ref={scrollRef} className="max-h-56 overflow-y-auto pr-1">
                    {visible.map((a) => (
                        <AreaRow
                            key={a.id}
                            district={district}
                            area={a}
                            checked={isChecked(a.name)}
                            onToggleArea={(name) => toggle(name, onSetAreaRestriction)}
                            mode={mode}
                            restriction={villagesByArea[a.name]}
                            onSetRestriction={onSetVillageRestriction}
                            focusPath={focusPath?.area === a.name ? focusPath : null}
                            forceExpand={focusPath?.area === a.name}
                        />
                    ))}
                </div>
            )}

            <CustomAddRow value={customInput} onChange={setCustomInput} onAdd={addCustom} placeholder="Area not listed? Type and press Enter" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Level 2: Districts within a state (each district can expand into areas)
// ---------------------------------------------------------------------------
function DistrictRow({ state, district, checked, onToggleDistrict, mode, districtLevelRestrictions, onSetAreaRestriction, onSetVillageRestriction, focusPath, forceExpand }) {
    const [expanded, setExpanded] = useState(false);
    const areaRestriction = districtLevelRestrictions.areasByDistrict[district.name];
    const villagesByArea = districtLevelRestrictions.villagesByDistrict[district.name] || {};
    const hasAreaRestriction = mode === "exclude" ? (areaRestriction?.length > 0) : (areaRestriction !== undefined);
    const hasNestedVillageCustomization = Object.values(villagesByArea).some(
        (v) => v !== undefined && !(mode === "exclude" && v.length === 0)
    );

    useEffect(() => { if (forceExpand) setExpanded(true); }, [forceExpand]);

    return (
        <div className="border-b py-1.5" style={{ borderColor: C.hairSoft }}>
            <ExpandableRow
                name={district.name}
                checked={checked}
                onToggle={() => onToggleDistrict(district.name)}
                isCustomized={hasAreaRestriction || hasNestedVillageCustomization}
                expanded={expanded}
                onToggleExpand={() => setExpanded((e) => !e)}
                forceOpenGlow={forceExpand}
            />
            {expanded && checked && (
                <AreaPanel
                    district={district}
                    mode={mode}
                    areaRestriction={areaRestriction}
                    onSetAreaRestriction={(next) => onSetAreaRestriction(district.name, next)}
                    villagesByArea={villagesByArea}
                    onSetVillageRestriction={(areaName, next) => onSetVillageRestriction(district.name, areaName, next)}
                    focusPath={focusPath?.district === district.name ? focusPath : null}
                />
            )}
        </div>
    );
}

function DistrictPanel({ state, mode, districtRestriction, onSetDistrictRestriction, districtLevelRestrictions, onSetAreaRestriction, onSetVillageRestriction, focusPath }) {
    const [allDistricts, setAllDistricts] = useState(null);
    const [filter, setFilter] = useState("");
    const [customInput, setCustomInput] = useState("");
    const scrollRef = useLenisHijack();

    useEffect(() => {
        setAllDistricts(null);
        fetchGeoDistricts(state.id).then((r) => setAllDistricts(r?.success ? r.items : []));
    }, [state.id]);

    if (allDistricts === null) {
        return <div className="ml-9 mt-2 flex items-center gap-2 text-[12.5px] font-medium" style={{ color: C.muted }}><Loader2 className="h-3 w-3 animate-spin" /> Loading districts…</div>;
    }

    const allNames = allDistricts.map((d) => d.name);
    const { isChecked, toggle, restrictedCount, allSelected, noneSelected } = computeSelection(mode, allNames, districtRestriction);
    const visible = filter.trim() ? allDistricts.filter((d) => d.name.toLowerCase().includes(filter.trim().toLowerCase())) : allDistricts;

    const countLabel = mode === "exclude"
        ? (restrictedCount > 0 ? `${restrictedCount} excluded` : "All included")
        : (districtRestriction === undefined ? "All included" : `${districtRestriction.length} of ${allNames.length} included`);

    const addCustom = () => {
        const name = customInput.trim();
        if (!name) return;
        if (mode === "exclude") onSetDistrictRestriction([...(districtRestriction || []), name]);
        else onSetDistrictRestriction([...(districtRestriction === undefined ? allNames : districtRestriction), name]);
        setCustomInput("");
    };

    return (
        <div className="ml-9 mt-2 flex flex-col gap-2 rounded-lg border p-2.5" style={{ borderColor: C.hairSoft }}>
            <SelectAllRow
                label="Select all districts"
                allSelected={allSelected}
                noneSelected={noneSelected}
                onSelectAll={() => onSetDistrictRestriction(undefined)}
                onDeselectAll={() => onSetDistrictRestriction(mode === "exclude" ? [...allNames] : [])}
                countLabel={countLabel}
                accent={mode === "exclude" ? C.primary : C.secondary}
            />

            {allNames.length > 6 && (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: C.muted }} />
                    <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter districts…"
                        className="w-full rounded-md border py-1 pl-6 pr-2 text-[12px] font-medium focus:outline-none" style={{ borderColor: C.hair }} />
                </div>
            )}

            {allDistricts.length === 0 ? (
                <p className="text-[12px] font-medium" style={{ color: C.muted }}>No districts on file for {state.name} yet — add one manually below.</p>
            ) : (
                <div ref={scrollRef} className="max-h-56 overflow-y-auto pr-1">
                    {visible.map((d) => (
                        <DistrictRow
                            key={d.id}
                            state={state}
                            district={d}
                            checked={isChecked(d.name)}
                            onToggleDistrict={(name) => toggle(name, onSetDistrictRestriction)}
                            mode={mode}
                            districtLevelRestrictions={districtLevelRestrictions}
                            onSetAreaRestriction={onSetAreaRestriction}
                            onSetVillageRestriction={onSetVillageRestriction}
                            focusPath={focusPath?.district === d.name ? focusPath : null}
                            forceExpand={focusPath?.district === d.name}
                        />
                    ))}
                </div>
            )}

            <CustomAddRow value={customInput} onChange={setCustomInput} onAdd={addCustom} placeholder="District not listed? Type and press Enter" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Level 1: States within the country
// ---------------------------------------------------------------------------
function StateRow({ state, checked, onToggleState, mode, districtRestriction, onSetDistrictRestriction, districtLevelRestrictions, onSetAreaRestriction, onSetVillageRestriction, hasNestedCustomization, focusPath, forceExpand }) {
    const [expanded, setExpanded] = useState(false);
    const hasDistrictRestriction = mode === "exclude" ? (districtRestriction?.length > 0) : (districtRestriction !== undefined);
    const isCustomized = hasDistrictRestriction || hasNestedCustomization;

    useEffect(() => { if (forceExpand) setExpanded(true); }, [forceExpand]);

    return (
        <div className="border-b py-2" style={{ borderColor: C.hairSoft }}>
            <ExpandableRow
                name={state.name}
                checked={checked}
                onToggle={() => onToggleState(state.name)}
                isCustomized={isCustomized}
                expanded={expanded}
                onToggleExpand={() => setExpanded((e) => !e)}
                size="lg"
                forceOpenGlow={forceExpand}
            />
            {expanded && checked && (
                <DistrictPanel
                    state={state}
                    mode={mode}
                    districtRestriction={districtRestriction}
                    onSetDistrictRestriction={onSetDistrictRestriction}
                    districtLevelRestrictions={districtLevelRestrictions}
                    onSetAreaRestriction={onSetAreaRestriction}
                    onSetVillageRestriction={onSetVillageRestriction}
                    focusPath={focusPath?.state === state.name ? focusPath : null}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Quick search bar — the fast path. Type "Ribda", see its breadcrumb, act on
// it immediately without touching the tree. Selecting a result also expands
// the tree down to it (the glowing dot on ExpandableRow marks the live path)
// so the seller can confirm what they just did in context.
// ---------------------------------------------------------------------------
const TYPE_LABEL = { state: "state", district: "district", taluka: "area", village: "village" };

function QuickSearch({ mode, onApplyDirect, onJumpTo }) {
    const [raw, setRaw] = useState("");
    const q = useDebouncedValue(raw, 250);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const resultsScrollRef = useLenisHijack(); // <-- new

    useEffect(() => {
        if (q.trim().length < 2) { setResults([]); return; }
        setLoading(true);
        searchGeoLocationsByType(q.trim()).then((r) => {
            setResults(r?.success ? r.items : []);
            setLoading(false);
        });
    }, [q]);

    const breadcrumbOf = (item) => [...(item.ancestors || []).map((a) => a.name)].join(" › ");

    return (
        <div className="mb-3 rounded-xl border p-3" style={{ borderColor: C.hair, background: `${C.secondary}05` }}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.secondary }}>
                <MapPin className="h-3.5 w-3.5" /> Quick find
            </div>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder="Search any village, area, district or state — e.g. Ribda, Sapar…"
                    className="w-full rounded-lg border px-8 py-2 text-[13px] font-medium focus:outline-none focus:ring-2" style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }}
                />
                {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin" style={{ color: C.muted }} />}
            </div>

            {q.trim().length >= 2 && !loading && (
                results.length === 0 ? (
                    <p className="mt-2 px-1 py-1 text-[12px] font-medium" style={{ color: C.muted }}>No match for "{q}". You can still add it manually inside the tree below.</p>
                ) : (
                    <div ref={resultsScrollRef} className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                        {results.map((item) => (
                            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1.5" style={{ borderColor: C.hairSoft }}>
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-semibold" style={{ color: C.ink }}>{item.name}</div>
                                    <div className="truncate text-[11px] font-medium" style={{ color: C.muted }}>
                                        {TYPE_LABEL[item.type] || item.type}{breadcrumbOf(item) ? ` · ${breadcrumbOf(item)}` : ""}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <button type="button"
                                        onClick={() => onApplyDirect(item, mode === "exclude" ? "exclude" : "includeOnly")}
                                        className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: C.primary, color: "#fff" }}>
                                        {mode === "exclude" ? "Exclude" : "Include only this"}
                                    </button>
                                    <button type="button" onClick={() => onJumpTo(item)} className="rounded-md border px-2 py-1 text-[11px] font-bold" style={{ borderColor: C.hair, color: C.secondary }}>
                                        View in tree
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function DispatchingLocationsPicker({ value, onChange }) {
    // value shape:
    // {
    //   country,
    //   mode: 'exclude' | 'include',
    //   excludedStates, includedStates,
    //   districtsByState:  { [stateName]: string[] | undefined },
    //   areasByDistrict:   { "state::district": string[] | undefined },
    //   villagesByArea:    { "state::district::area": string[] | undefined },
    // }
    // Country is locked to India — no country picker is shown to the seller.
    const [states, setStates] = useState([]);
    const [q, setQ] = useState("");
    const [focusPath, setFocusPath] = useState(null); // { state, district, area, village }
    const statesScrollRef = useLenisHijack();

    const mode = value?.mode || "exclude";
    const excludedStates = value?.excludedStates || [];
    const includedStates = value?.includedStates || [];
    const districtsByState = value?.districtsByState || {};
    const areasByDistrict = value?.areasByDistrict || {};
    const villagesByArea = value?.villagesByArea || {};

    useEffect(() => {
        if (value?.country?.id) return;
        fetchGeoCountries().then((r) => {
            if (!r?.success) return;
            if (value?.country?.name) {
                const match = r.items.find((c) => c.name?.toLowerCase() === value.country.name.toLowerCase());
                if (match) onChange({ ...value, country: match });
                return;
            }
            const india = r.items.find((c) => c.name?.toLowerCase() === "india");
            if (india) pickCountry(india);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.country?.id, value?.country?.name]);

    useEffect(() => {
        if (!value?.country?.id) { setStates([]); return; }
        fetchGeoStates(value.country.id, q).then((r) => { if (r?.success) setStates(r.items); });
    }, [value?.country?.id, q]);

    const pickCountry = (c) => onChange({
        country: c, mode: "exclude", excludedStates: [], includedStates: [],
        districtsByState: {}, areasByDistrict: {}, villagesByArea: {},
    });
    const setMode = (m) => onChange({ ...value, mode: m });

    const toggleExcludeState = (name) => {
        const next = excludedStates.includes(name) ? excludedStates.filter((s) => s !== name) : [...excludedStates, name];
        onChange({ ...value, excludedStates: next });
    };
    const toggleIncludeState = (name) => {
        const next = includedStates.includes(name) ? includedStates.filter((s) => s !== name) : [...includedStates, name];
        const nextDistricts = { ...districtsByState };
        const nextAreas = { ...areasByDistrict };
        const nextVillages = { ...villagesByArea };
        if (!next.includes(name)) {
            delete nextDistricts[name];
            Object.keys(nextAreas).forEach((key) => { if (key.startsWith(`${name}::`)) delete nextAreas[key]; });
            Object.keys(nextVillages).forEach((key) => { if (key.startsWith(`${name}::`)) delete nextVillages[key]; });
        }
        onChange({ ...value, includedStates: next, districtsByState: nextDistricts, areasByDistrict: nextAreas, villagesByArea: nextVillages });
    };

    const setDistrictRestriction = (stateName, districts) =>
        onChange({ ...value, districtsByState: { ...districtsByState, [stateName]: districts } });

    const setAreaRestriction = (stateName, districtName, areas) =>
        onChange({ ...value, areasByDistrict: { ...areasByDistrict, [`${stateName}::${districtName}`]: areas } });

    const setVillageRestriction = (stateName, districtName, areaName, villages) =>
        onChange({ ...value, villagesByArea: { ...villagesByArea, [`${stateName}::${districtName}::${areaName}`]: villages } });

    const selectAllStates = () => onChange({ ...value, excludedStates: [] });
    const clearAllStates = () => onChange({ ...value, includedStates: [], districtsByState: {}, areasByDistrict: {}, villagesByArea: {} });

    const stateHasNestedCustomization = (stateName) => {
        const areaCustomized = Object.entries(areasByDistrict).some(([key, v]) => key.startsWith(`${stateName}::`) && v !== undefined && !(mode === "exclude" && v.length === 0));
        const villageCustomized = Object.entries(villagesByArea).some(([key, v]) => key.startsWith(`${stateName}::`) && v !== undefined && !(mode === "exclude" && v.length === 0));
        return areaCustomized || villageCustomized;
    };

    const excludedStateCount = excludedStates.length;
    const summary = mode === "exclude"
        ? (excludedStateCount === 0 ? `Delivering to all of ${value?.country?.name || "the country"}` : `Delivering to ${value.country?.name} except ${excludedStateCount} state${excludedStateCount === 1 ? "" : "s"}`)
        : (includedStates.length === 0 ? "No states selected yet — pick at least one" : `Delivering only to ${includedStates.length} selected state${includedStates.length === 1 ? "" : "s"}`);

    // ---- Quick-search actions ----
    // A search hit gives us the node + its ancestor chain. We resolve that
    // into { state, district, area, village } names (whichever apply) so we
    // can both apply a direct restriction and drive the tree's auto-expand.
    const pathOf = (item) => {
        const chain = [...(item.ancestors || []), { type: item.type, name: item.name }];
        const path = {};
        chain.forEach((n) => {
            if (n.type === "state") path.state = n.name;
            if (n.type === "district") path.district = n.name;
            if (n.type === "taluka") path.area = n.name;
            if (n.type === "village") path.village = n.name;
        });
        return path;
    };

    const applyDirect = (item, action) => {
        const path = pathOf(item);
        if (!path.state) return;

        if (item.type === "state") {
            if (action === "exclude") onChange({ ...value, excludedStates: [...new Set([...excludedStates, path.state])] });
            else onChange({ ...value, mode: "include", includedStates: [...new Set([...includedStates, path.state])] });
        } else if (item.type === "district" && path.district) {
            const current = districtsByState[path.state];
            if (mode === "exclude") setDistrictRestriction(path.state, [...new Set([...(current || []), path.district])]);
            else setDistrictRestriction(path.state, [...new Set([...(current === undefined ? [] : current), path.district])]);
        } else if (item.type === "taluka" && path.district && path.area) {
            const key = `${path.state}::${path.district}`;
            const current = areasByDistrict[key];
            if (mode === "exclude") setAreaRestriction(path.state, path.district, [...new Set([...(current || []), path.area])]);
            else setAreaRestriction(path.state, path.district, [...new Set([...(current === undefined ? [] : current), path.area])]);
        } else if (item.type === "village" && path.district && path.area && path.village) {
            const current = villagesByArea[`${path.state}::${path.district}::${path.area}`];
            if (mode === "exclude") setVillageRestriction(path.state, path.district, path.area, [...new Set([...(current || []), path.village])]);
            else setVillageRestriction(path.state, path.district, path.area, [...new Set([...(current === undefined ? [] : current), path.village])]);
        }
        setFocusPath(path);
    };

    const jumpTo = (item) => setFocusPath(pathOf(item));

    return (
        <div className="flex flex-col gap-1.5">
            <Label>Dispatching locations <span style={{ color: C.primary }}> *</span></Label>

            {value?.country && (
                <QuickSearch mode={mode} onApplyDirect={applyDirect} onJumpTo={jumpTo} />
            )}

            {!value?.country ? (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-[12.5px] font-medium" style={{ borderColor: C.hair, color: C.muted }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading India…
                </div>
            ) : (
                <div className="rounded-xl border p-3" style={{ borderColor: C.hair }}>
                    <div className="mb-2 flex items-center justify-between tracking-wider gap-2">
                        <span className="truncate text-[13.5px] font-extrabold" style={{ color: C.ink }}>{value.country.name}</span>
                    </div>

                    <div className="mb-2 flex w-fit gap-1 rounded-lg p-1 tracking-wide" style={{ background: C.hairSoft }}>
                        <button type="button" onClick={() => setMode("exclude")} className="rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors duration-150" style={mode === "exclude" ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>Exclude specific places</button>
                        <button type="button" onClick={() => setMode("include")} className="rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors duration-150" style={mode === "include" ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>Include specific places only</button>
                    </div>

                    <div className="mb-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold tracking-wide" style={{ background: excludedStateCount > 0 || mode === "include" ? `${C.primary}0c` : `${C.secondary}0c`, color: excludedStateCount > 0 || mode === "include" ? C.primary : C.secondary }}>
                        {summary}
                    </div>

                    <div className="mb-2 flex items-center gap-1.5">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter the states list…" className="w-full rounded-lg border px-8 py-1.5 text-[13px] font-medium focus:outline-none focus:ring-2 tracking-wide" style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }} />
                        </div>
                        {q && (
                            <button type="button" onClick={() => setQ("")} className="shrink-0 rounded-lg border p-1.5" style={{ borderColor: C.hair, color: C.muted }}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div ref={statesScrollRef} className="max-h-64 overflow-y-auto">
                        {states.length === 0 ? (
                            <p className="py-3 text-center text-[12.5px] font-medium" style={{ color: C.muted }}>
                                {q ? "No states match that search." : "No states on file."}
                            </p>
                        ) : states.map((s) => {
                            const districtLevelRestrictions = {
                                areasByDistrict: Object.fromEntries(Object.entries(areasByDistrict).filter(([k]) => k.startsWith(`${s.name}::`)).map(([k, v]) => [k.split("::")[1], v])),
                                villagesByDistrict: Object.entries(villagesByArea)
                                    .filter(([k]) => k.startsWith(`${s.name}::`))
                                    .reduce((acc, [k, v]) => {
                                        const [, districtName, areaName] = k.split("::");
                                        acc[districtName] = acc[districtName] || {};
                                        acc[districtName][areaName] = v;
                                        return acc;
                                    }, {}),
                            };
                            const checked = mode === "exclude" ? !excludedStates.includes(s.name) : includedStates.includes(s.name);
                            const onToggleState = mode === "exclude" ? toggleExcludeState : toggleIncludeState;
                            return (
                                <StateRow key={s.id} state={s} checked={checked} onToggleState={onToggleState}
                                    mode={mode}
                                    districtRestriction={districtsByState[s.name]}
                                    onSetDistrictRestriction={(districts) => setDistrictRestriction(s.name, districts)}
                                    districtLevelRestrictions={districtLevelRestrictions}
                                    onSetAreaRestriction={(districtName, areas) => setAreaRestriction(s.name, districtName, areas)}
                                    onSetVillageRestriction={(districtName, areaName, villages) => setVillageRestriction(s.name, districtName, areaName, villages)}
                                    hasNestedCustomization={stateHasNestedCustomization(s.name)}
                                    focusPath={focusPath?.state === s.name ? focusPath : null}
                                    forceExpand={focusPath?.state === s.name}
                                />
                            );
                        })}
                    </div>

                    {mode === "exclude" && excludedStateCount > 0 && (
                        <button type="button" onClick={selectAllStates} className="mt-2 text-[11.5px] font-bold" style={{ color: C.secondary }}>Reset — include all states</button>
                    )}
                    {mode === "include" && includedStates.length > 0 && (
                        <button type="button" onClick={clearAllStates} className="mt-2 text-[11.5px] font-bold" style={{ color: C.secondary }}>Clear all selected states</button>
                    )}
                </div>
            )}
        </div>
    );
}