// src/components/team/monitor/MonitorFilters.jsx
// Search, employee chips and date range, shared by the monitor Enquiries / Orders pages.
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { fetchMonitorPeople } from "../../../utils/salesMonitorApi.js";
import { PRESETS, istDate } from "./monitorHelpers.js";
import "./monitor-lists.css";

export default function MonitorFilters({ f, placeholder }) {
    const { token } = useAuth();
    const [people, setPeople] = useState([]);

    // Names only, so load them once for all time (an employee never drops out of the list).
    useEffect(() => {
        if (!token) return undefined;
        let live = true;
        fetchMonitorPeople(token, { from: "", to: "", all: true }).then((r) => { if (live && r.success) setPeople(r.people || []); });
        return () => { live = false; };
    }, [token]);

    return (
        <div className="ml-filters">
            <label className="st-srch st-srch-l">
                <Search size={16} aria-hidden="true" />
                <input value={f.qInput} onChange={(e) => f.setQInput(e.target.value)} placeholder={placeholder} aria-label="Search" autoComplete="off" />
                {f.qInput && <button type="button" aria-label="Clear search" onClick={() => f.setQInput("")}><X size={14} /></button>}
            </label>

            {people.length > 0 && (
                <div className="ml-chips" role="group" aria-label="Filter by employee">
                    <button type="button" className={`ml-chip${!f.actorId ? " on" : ""}`} aria-pressed={!f.actorId} onClick={() => f.setActorId("")}>Everyone</button>
                    {people.map((p) => (
                        <button key={p.userId} type="button" className={`ml-chip${f.actorId === p.userId ? " on" : ""}`} aria-pressed={f.actorId === p.userId}
                            onClick={() => f.setActorId(f.actorId === p.userId ? "" : p.userId)}>{p.name}</button>
                    ))}
                </div>
            )}

            <div className="ml-chips" role="group" aria-label="Date range">
                {PRESETS.map(([k, t]) => (
                    <button key={k} type="button" className={`ml-chip${f.preset === k ? " on" : ""}`} aria-pressed={f.preset === k}
                        onClick={() => { if (k === "custom" && !f.custom.from) f.setCustom({ from: istDate(Date.now()), to: istDate(Date.now()) }); f.setPreset(k); }}>{t}</button>
                ))}
            </div>

            {f.preset === "custom" && (
                <div className="ml-dates">
                    {[["from", "From"], ["to", "To"]].map(([k, t]) => (
                        <label key={k}>
                            <span>{t}</span>
                            <input type="date" className="st-in" value={f.custom[k]} max={istDate(Date.now())} onChange={(e) => f.setCustom((c) => ({ ...c, [k]: e.target.value }))} />
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}