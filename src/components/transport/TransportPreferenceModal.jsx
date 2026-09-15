import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, Loader2, ChevronRight, ChevronLeft, Plus, Clock3, MapPin, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchBuyerAddresses } from "../../utils/api.js";
import {
    fetchSellerRouteOptions, fetchRouteSuggestions, proposeRouteOption,
} from "../../utils/api.transport.js";
import { saveBuyerTransportPreference } from "../../utils/api.transport.js";
import {
    ROUTE_TRANSPORT_GROUPS, getRouteTransportFields, routeTransportModeLabel, routeOptionSummary,
} from "../../../shared/routeTransportFields.js";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)",
};
const EASE = [0.16, 1, 0.3, 1];
const MAX_SUGGESTIONS_SHOWN = 30;

function parseDispatchOrigin(seller) {
    const parts = (seller?.dispatchOrigin || "").split(",").map((s) => s.trim());
    return { city: parts[0] || "", state: seller?.dispatchState || parts[1] || "" };
}

// Only offer modes the seller has actually marked themselves as servicing
// (seller_profiles.transport_options). If that's empty/missing — e.g. an
// older seller profile that never set it — fall back to showing every
// mode rather than leaving the buyer with nothing to propose.
function filterGroupsBySellerOptions(groups, allowedModes) {
    if (!Array.isArray(allowedModes) || !allowedModes.length) return groups;
    return groups
        .map((g) => ({ ...g, modes: g.modes.filter((m) => allowedModes.includes(m)) }))
        .filter((g) => g.modes.length > 0);
}

function toSentenceCase(value) {
    if (!value) return "";
    const text = String(value).trim();
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function Field({ field, value, onChange }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>
                {field.label}{field.required && <span style={{ color: C.primary }}> *</span>}
            </label>
            {field.type === "textarea" ? (
                <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)}
                    className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2"
                    style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }} />
            ) : (
                <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2"
                    style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }} />
            )}
        </div>
    );
}

export default function TransportPreferenceModal({ open, seller, destCity: destCityProp, destState: destStateProp, removedNotice, onClose, onResolved }) {
    const { token } = useAuth();
    const origin = useMemo(() => parseDispatchOrigin(seller), [seller]);
    const allowedGroups = useMemo(
        () => filterGroupsBySellerOptions(ROUTE_TRANSPORT_GROUPS, seller?.transportOptions),
        [seller?.transportOptions]
    );

    const [destCity, setDestCity] = useState(destCityProp || "");
    const [destState, setDestState] = useState(destStateProp || "");
    const [needsManualDest, setNeedsManualDest] = useState(false);
    const [resolvingAddress, setResolvingAddress] = useState(!(destCityProp && destStateProp));

    const [loadingOptions, setLoadingOptions] = useState(false);
    const [approvedOptions, setApprovedOptions] = useState([]);

    // ---- Propose flow: collapsed -> modes -> suggestions -> form ----
    const [proposeStage, setProposeStage] = useState("collapsed");
    const [selectedMode, setSelectedMode] = useState(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [fieldValues, setFieldValues] = useState({});

    const [submitting, setSubmitting] = useState(false);
    const [pendingResult, setPendingResult] = useState(null);
    const [error, setError] = useState(null);

    // Step 1 — resolve destination: prefer what the caller (BuyNowModal /
    // HomeProductFeed) already knows from the buyer's selected address,
    // only falling back to a fresh lookup if neither was passed in.
    useEffect(() => {
        if (!open) return;
        if (destCityProp && destStateProp) {
            setDestCity(destCityProp);
            setDestState(destStateProp);
            setResolvingAddress(false);
            return;
        }
        setResolvingAddress(true);
        fetchBuyerAddresses(token).then((res) => {
            const def = res?.addresses?.find((a) => a.is_default) || res?.addresses?.[0];
            if (def?.city && def?.state) {
                setDestCity(def.city);
                setDestState(def.state);
            } else {
                setNeedsManualDest(true);
            }
            setResolvingAddress(false);
        });
    }, [open, token, destCityProp, destStateProp]);

    // Reset the propose flow whenever the modal reopens on a different
    // route, so a stale mode/search/fields from a previous route never
    // bleeds into a new one.
    useEffect(() => {
        if (!open) return;
        setProposeStage("collapsed");
        setSelectedMode(null);
        setPickerSearch("");
        setSuggestions([]);
        setFieldValues({});
        setPendingResult(null);
        setError(null);
    }, [open, destCity, destState, seller?.sellerId]);

    const canQueryRoute = !resolvingAddress && destCity && destState && origin.city && origin.state;

    // Step 2 — this seller's own approved options on the route.
    useEffect(() => {
        if (!open || !canQueryRoute) return;
        setLoadingOptions(true);
        fetchSellerRouteOptions({
            sellerId: seller.sellerId,
            originState: origin.state, originCity: origin.city,
            destState, destCity,
        }).then((res) => {
            setApprovedOptions(res?.options || []);
            setLoadingOptions(false);
        });
    }, [open, canQueryRoute, seller?.sellerId, origin.state, origin.city, destState, destCity]);

    // Step 3 — once a mode is picked in the propose flow, fetch every
    // OTHER seller's approved company for that mode on this exact route,
    // once. Search below then filters this in memory — no per-keystroke
    // network calls, so it stays instant even with a long list.
    useEffect(() => {
        if (proposeStage !== "suggestions" || !selectedMode) return;
        setLoadingSuggestions(true);
        fetchRouteSuggestions({ originState: origin.state, originCity: origin.city, destState, destCity })
            .then((res) => {
                setSuggestions((res?.suggestions || []).filter((s) => s.mode === selectedMode));
                setLoadingSuggestions(false);
            });
    }, [proposeStage, selectedMode, origin.state, origin.city, destState, destCity]);

    const filteredSuggestions = useMemo(() => {
        const needle = pickerSearch.trim().toLowerCase();
        const list = needle
            ? suggestions.filter((s) => routeOptionSummary(s.mode, s.fields).toLowerCase().includes(needle))
            : suggestions;
        return list.slice(0, MAX_SUGGESTIONS_SHOWN);
    }, [suggestions, pickerSearch]);
    const hasMoreSuggestions = useMemo(() => {
        const needle = pickerSearch.trim().toLowerCase();
        const total = needle
            ? suggestions.filter((s) => routeOptionSummary(s.mode, s.fields).toLowerCase().includes(needle)).length
            : suggestions.length;
        return total > MAX_SUGGESTIONS_SHOWN;
    }, [suggestions, pickerSearch]);

    const openProposeSection = () => setProposeStage("modes");
    const collapseProposeSection = () => { setProposeStage("collapsed"); setSelectedMode(null); setPickerSearch(""); };

    const pickMode = (mode) => {
        setSelectedMode(mode);
        setPickerSearch("");
        setFieldValues({});
        setError(null);
        setProposeStage("suggestions");
    };
    const backToModes = () => { setProposeStage("modes"); setSelectedMode(null); setPickerSearch(""); };


    const enterManually = () => {
        setFieldValues({});
        setError(null);
        setProposeStage("form");
    };
    const backToSuggestions = () => setProposeStage(suggestions.length || loadingSuggestions ? "suggestions" : "modes");

    const submitProposal = async (fieldsOverride) => {
        const fieldsToSubmit = fieldsOverride ?? fieldValues;
        setSubmitting(true);
        setError(null);
        const res = await proposeRouteOption({
            sellerId: seller.sellerId,
            originState: origin.state, originCity: origin.city,
            destState, destCity,
            mode: selectedMode, fields: fieldsToSubmit,
        }, token);
        setSubmitting(false);
        if (!res?.success) { setError(res?.message || "Couldn't submit that. Please try again."); return; }

        if (res.option.status === "approved") {
            const resolved = {
                routeOptionId: res.option.id, mode: res.option.mode, fields: res.option.fields,
                summary: routeOptionSummary(res.option.mode, res.option.fields),
                destState, destCity,
            };
            await saveBuyerTransportPreference({ sellerId: seller.sellerId, destState, destCity, preference: resolved }, token);
            onResolved(resolved);
            return;
        }
        setPendingResult(res);
    };

    // Tapping an existing cross-seller company now submits immediately with
    // its exact fields — one tap to reuse a known company instead of
    // prefill-then-manually-press-submit.
    const [submittingSuggestionKey, setSubmittingSuggestionKey] = useState(null);
    const useSuggestion = async (s) => {
        setSubmittingSuggestionKey(routeOptionSummary(s.mode, s.fields));
        setFieldValues(s.fields || {});
        setError(null);
        await submitProposal(s.fields || {});
        setSubmittingSuggestionKey(null);
    };

    const handleSelectApproved = async (opt) => {
        const resolved = {
            routeOptionId: opt.id, mode: opt.mode, fields: opt.fields,
            summary: routeOptionSummary(opt.mode, opt.fields),
            destState, destCity,
        };
        await saveBuyerTransportPreference({ sellerId: seller.sellerId, destState, destCity, preference: resolved }, token);
        onResolved(resolved);
    };

    const continueWithoutPreference = async () => {
        await saveBuyerTransportPreference({ sellerId: seller.sellerId, destState, destCity, preference: null }, token);
        // If we got here via a pending proposal, tell the caller so it can
        // keep showing "awaiting approval" context instead of a blank
        // "no preference" state — the buyer already made a choice, it's
        // just not approved yet.
        if (pendingResult?.option) {
            onResolved({
                pending: true,
                routeOptionId: pendingResult.option.id,
                mode: pendingResult.option.mode,
                fields: pendingResult.option.fields,
                summary: routeOptionSummary(pendingResult.option.mode, pendingResult.option.fields),
                destCity, destState,
            });
            return;
        }
        onResolved(null);
    };

    const groupFields = selectedMode ? getRouteTransportFields(selectedMode) : [];
    const canSubmitProposal = selectedMode && groupFields.filter((f) => f.required).every((f) => String(fieldValues[f.key] || "").trim());

    if (!open) return null;

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[20px]"
                initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }} onClick={(e) => e.stopPropagation()}>

                <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: C.hairSoft }}>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold tracking-wider" style={{ color: C.secondary }}>Transport preference</p>
                        <h2 className="mt-0.5 truncate text-[16px] font-bold tracking-wide" style={{ color: C.ink }}>{seller?.display_name}</h2>
                    </div>
                    <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                        <X className="h-4.5 w-4.5" style={{ color: C.muted }} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
                    {resolvingAddress ? (
                        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: C.muted }} /></div>
                    ) : needsManualDest ? (
                        <div className="flex flex-col gap-3">
                            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: C.muted }}>
                                <MapPin className="h-3.5 w-3.5" /> We need your city to check transport options on this route.
                            </p>
                            <div className="grid grid-cols-2 gap-2.5">
                                <input placeholder="Your city" value={destCity} onChange={(e) => setDestCity(e.target.value)}
                                    className="rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: C.hair }} />
                                <input placeholder="Your state" value={destState} onChange={(e) => setDestState(e.target.value)}
                                    className="rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: C.hair }} />
                            </div>
                            <button disabled={!destCity || !destState} onClick={() => setNeedsManualDest(false)}
                                className="w-fit rounded-lg px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                                style={{ background: C.secondary }}>
                                Continue
                            </button>
                        </div>
                    ) : pendingResult ? (
                        <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
                            className="flex flex-col items-center gap-3 py-8 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${C.secondary}12` }}>
                                <Clock3 className="h-5 w-5" style={{ color: C.secondary }} />
                            </span>
                            <p className="text-[14px] font-bold" style={{ color: C.ink }}>Sent to the seller for approval</p>
                            <p className="max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>
                                We'll let you know once {seller?.display_name} approves this transport option for {toSentenceCase(origin.city)} → {toSentenceCase(destCity)}. You can continue placing your order in the meantime.
                            </p>
                            <button onClick={continueWithoutPreference}
                                className="mt-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
                                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                Continue to order
                            </button>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {removedNotice && (
                                <div className="flex items-start gap-2 rounded-xl px-3.5 py-3" style={{ background: "#FEF6E7" }}>
                                    <Truck className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "#92600A" }} />
                                    <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: "#92600A" }}>
                                        {removedNotice} Please pick another option below, or propose a new one.
                                    </p>
                                </div>
                            )}

                            <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                {toSentenceCase(origin.city || "Seller")} → {toSentenceCase(destCity)}
                            </p>

                            {/* ---- This seller's own approved options — unchanged ---- */}
                            {loadingOptions ? (
                                <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: C.muted }} /></div>
                            ) : approvedOptions.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>Available on this route</p>
                                    {approvedOptions.map((opt) => (
                                        <button key={opt.id} onClick={() => handleSelectApproved(opt)}
                                            className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-black/[0.02]"
                                            style={{ borderColor: C.hair }}>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-bold" style={{ color: C.ink }}>{routeOptionSummary(opt.mode, opt.fields)}</p>
                                                <p className="text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>{routeTransportModeLabel(opt.mode)}</p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {loadingOptions ? (
                                        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: C.muted }} /></div>
                                    ) : approvedOptions.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                            <p className="text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>Available on this route</p>
                                            {approvedOptions.map((opt) => (
                                                <button key={opt.id} onClick={() => handleSelectApproved(opt)}
                                                    className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-black/[0.02]"
                                                    style={{ borderColor: C.hair }}>
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold" style={{ color: C.ink }}>{routeOptionSummary(opt.mode, opt.fields)}</p>
                                                        <p className="text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                            {routeTransportModeLabel(opt.mode)}
                                                            {opt.fields?.contact_number ? ` · ${opt.fields.contact_number}` : ""}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                                                </button>
                                            ))}
                                        </div>
                                    ) : proposeStage === "collapsed" ? (
                                        <div className="flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center" style={{ background: C.hairSoft }}>
                                            <Truck className="h-6 w-6" style={{ color: C.muted }} />
                                            <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>No transport options recorded yet</p>
                                            <p className="max-w-xs text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>
                                                Nobody has set up a transport route between {toSentenceCase(origin.city)} and {toSentenceCase(destCity)} with this seller yet.
                                            </p>
                                        </div>
                                    ) : null}
                                </>
                            )}

                            {/* ---- Propose flow: collapsed -> modes -> suggestions -> form ---- */}
                            <AnimatePresence mode="wait" initial={false}>
                                {proposeStage === "collapsed" && (
                                    <motion.button
                                        key="collapsed"
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.18, ease: EASE }}
                                        onClick={openProposeSection}
                                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2.5 text-[12.5px] font-bold tracking-wide transition-colors duration-150 hover:bg-black/[0.03]"
                                        style={{ borderColor: `${C.primary}40`, color: C.primary }}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Propose new transport option
                                    </motion.button>
                                )}

                                {proposeStage === "modes" && (
                                    <motion.div key="modes"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>Pick a transport type</p>
                                            <button onClick={collapseProposeSection} className="text-[11px] font-bold" style={{ color: C.muted }}>Cancel</button>
                                        </div>
                                        <div className="mt-2 flex flex-col gap-2">
                                            {allowedGroups.map((g, gi) => (
                                                <motion.div key={g.group} className="flex flex-wrap gap-1.5"
                                                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.15, delay: gi * 0.03, ease: EASE }}>
                                                    {g.modes.map((m) => (
                                                        <button key={m} onClick={() => pickMode(m)}
                                                            className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11.5px] font-bold tracking-wide transition-colors duration-150 hover:bg-black/[0.03]"
                                                            style={{ borderColor: C.hair, color: C.ink }}>
                                                            {routeTransportModeLabel(m)}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            ))}
                                            {allowedGroups.length === 0 && (
                                                <p className="text-[12px] font-medium" style={{ color: C.muted }}>This seller hasn't listed any transport types yet.</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {proposeStage === "suggestions" && (
                                    <motion.div key="suggestions"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <button onClick={backToModes} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                                                <ChevronLeft className="h-4 w-4" style={{ color: C.muted }} />
                                            </button>
                                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>{routeTransportModeLabel(selectedMode)}</p>
                                        </div>

                                        {(loadingSuggestions || suggestions.length > 0) && (
                                            <div className="relative mt-2.5">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
                                                <input
                                                    value={pickerSearch}
                                                    onChange={(e) => setPickerSearch(e.target.value)}
                                                    placeholder="Search company or number…"
                                                    className="w-full rounded-lg border py-2 pl-8 pr-3 text-[13px] font-medium focus:outline-none focus:ring-2"
                                                    style={{ borderColor: C.hair, ["--tw-ring-color"]: `${C.secondary}22` }}
                                                    autoFocus
                                                />
                                            </div>
                                        )}

                                        <div className="mt-2.5 max-h-56 overflow-y-auto" data-lenis-prevent>
                                            {loadingSuggestions ? (
                                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4.5 w-4.5 animate-spin" style={{ color: C.muted }} /></div>
                                            ) : filteredSuggestions.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <AnimatePresence initial={false}>
                                                        {filteredSuggestions.map((s, i) => (
                                                            <motion.button
                                                                key={`${s.mode}::${routeOptionSummary(s.mode, s.fields)}::${i}`}
                                                                layout
                                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                onClick={() => useSuggestion(s)}
                                                                disabled={!!submittingSuggestionKey}
                                                                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-60"
                                                                style={{ borderColor: C.hair }}>
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-[12.5px] font-bold" style={{ color: C.ink }}>{routeOptionSummary(s.mode, s.fields)}</p>
                                                                    {s.fields?.contact_number && (
                                                                        <p className="truncate text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>{s.fields.contact_number}</p>
                                                                    )}
                                                                </div>
                                                                {submittingSuggestionKey === routeOptionSummary(s.mode, s.fields)
                                                                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: C.muted }} />
                                                                    : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />}
                                                            </motion.button>
                                                        ))}
                                                    </AnimatePresence>
                                                    {hasMoreSuggestions && (
                                                        <p className="pt-1 text-center text-[10.5px] font-semibold" style={{ color: C.muted }}>
                                                            Keep typing to narrow the list…
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="py-4 text-center text-[12px] font-medium" style={{ color: C.muted }}>
                                                    {pickerSearch ? "No match — try a different search." : "No one's added this yet on this route."}
                                                </p>
                                            )}
                                        </div>

                                        <button onClick={enterManually} className="mt-2.5 w-fit text-[12px] font-bold" style={{ color: C.secondary }}>
                                            Can't find it? Enter new details →
                                        </button>
                                    </motion.div>
                                )}

                                {proposeStage === "form" && (
                                    <motion.div key="form"
                                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.2, ease: EASE }} className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <button onClick={backToSuggestions} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                                                <ChevronLeft className="h-4 w-4" style={{ color: C.muted }} />
                                            </button>
                                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>{routeTransportModeLabel(selectedMode)}</p>
                                        </div>

                                        <div className="flex flex-col gap-2.5">
                                            {groupFields.map((f) => (
                                                <Field key={f.key} field={f} value={fieldValues[f.key] || ""}
                                                    onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.key]: v }))} />
                                            ))}
                                        </div>

                                        {error && <p className="text-[12px] font-semibold" style={{ color: "#B3261E" }}>{error}</p>}

                                        <button disabled={!canSubmitProposal || submitting} onClick={() => submitProposal()}
                                            className="mt-1 rounded-xl px-4 py-3 text-[13px] font-bold text-white disabled:opacity-50"
                                            style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit to seller"}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button onClick={continueWithoutPreference} className="mt-1 w-fit text-[12px] font-bold tracking-wide" style={{ color: C.muted }}>
                                Skip — decide later
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}