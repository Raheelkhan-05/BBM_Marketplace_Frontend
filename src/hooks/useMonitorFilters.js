// src/hooks/useMonitorFilters.js
// Filters shared by the monitor list pages. Kept in the URL (?actor=&range=&from=&to=&q=&st=) so a view can be shared.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PRESET_KEYS, rangeFor } from "../components/team/monitor/monitorHelpers.js";

export default function useMonitorFilters(defaultPreset = "7d") {
    const [sp, setSp] = useSearchParams();
    const spRef = useRef(sp); spRef.current = sp;

    const [preset, setPreset] = useState(() => (PRESET_KEYS.includes(sp.get("range")) ? sp.get("range") : defaultPreset));
    const [custom, setCustom] = useState(() => ({ from: sp.get("from") || "", to: sp.get("to") || "" }));
    const [qInput, setQInput] = useState(() => sp.get("q") || "");
    const [q, setQ] = useState(() => (sp.get("q") || "").trim());
    const [actorId, setActorId] = useState(() => sp.get("actor") || "");
    const [status, setStatus] = useState(() => sp.get("st") || "");

    useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);

    useEffect(() => {
        const n = new URLSearchParams();
        if (actorId) n.set("actor", actorId);
        if (status) n.set("st", status);
        if (preset !== defaultPreset) n.set("range", preset);
        if (preset === "custom") { if (custom.from) n.set("from", custom.from); if (custom.to) n.set("to", custom.to); }
        if (q) n.set("q", q);
        if (n.toString() !== spRef.current.toString()) setSp(n, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actorId, status, preset, custom, q]);

    const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);
    const params = useMemo(
        () => ({ actorId, q, status, from: range.from, to: range.to }),
        [actorId, q, status, range.from, range.to],
    );
    const filtered = !!(actorId || q || status || preset !== defaultPreset);
    const reset = () => { setActorId(""); setStatus(""); setQInput(""); setQ(""); setPreset(defaultPreset); };

    return { preset, setPreset, custom, setCustom, qInput, setQInput, q, actorId, setActorId, status, setStatus, range, params, filtered, reset };
}