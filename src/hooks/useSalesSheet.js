// src/hooks/useSalesSheet.js
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupSalesCustomer } from "../utils/salesApi.js";
import { GSTIN_RE, cleanGstin } from "../components/sales/salesThreadFmt.js";

// Locks page scroll (native + Lenis) and closes on Escape while a sheet is open.
export function useSheetBehavior(onClose) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const root = document.documentElement;
        const sw = window.innerWidth - root.clientWidth;
        const { style } = document.body;
        const prevO = style.overflow, prevP = style.paddingRight, prevR = root.style.overflow;
        style.overflow = "hidden";
        root.style.overflow = "hidden";
        if (sw > 0) style.paddingRight = `${sw}px`;
        try { window.lenis?.stop?.(); } catch { /* ignore */ }
        const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
        document.addEventListener("keydown", onKey);
        return () => {
            style.overflow = prevO; style.paddingRight = prevP; root.style.overflow = prevR;
            try { window.lenis?.start?.(); } catch { /* ignore */ }
            document.removeEventListener("keydown", onKey);
        };
    }, []);
}

// Company name from the response of the existing POST /sales/customers/lookup (shape-tolerant).
const pickName = (r) => {
    const c = r?.business ?? r?.customer ?? r?.data ?? r?.company ?? r ?? {};
    return String(c.name ?? c.tradeName ?? c.trade_name ?? c.legalName ?? c.legal_name ?? c.businessName ?? c.business_name ?? c.tradeNam ?? c.lgnm ?? "").trim();
};

// Fetches the company name for a GST number. status: idle | loading | ok | fail
export function useGstLookup(token) {
    const [state, setState] = useState({ status: "idle", name: "" });
    const seq = useRef(0);
    const run = useCallback(async (raw) => {
        const gstin = cleanGstin(raw);
        const my = ++seq.current;
        if (!GSTIN_RE.test(gstin)) { setState({ status: "idle", name: "" }); return ""; }
        setState({ status: "loading", name: "" });
        const res = await lookupSalesCustomer(token, gstin);
        if (my !== seq.current) return "";
        const name = res?.success ? pickName(res) : "";
        setState(name ? { status: "ok", name } : { status: "fail", name: "" });
        return name;
    }, [token]);
    const reset = useCallback(() => { seq.current++; setState({ status: "idle", name: "" }); }, []);
    return { ...state, run, reset };
}