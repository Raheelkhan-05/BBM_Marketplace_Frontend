// src/components/ImpersonationBanner.jsx
import { useEffect, useState } from "react";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
    clearImpersonation, endImpersonationSession, fetchImpersonationStatus, leaveImpersonation,
} from "../utils/impersonation.js";

const POLL_MS = 45_000;

const msLeft = (meta) => (meta?.expiresAt ? new Date(meta.expiresAt).getTime() - Date.now() : 0);
function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export default function ImpersonationBanner() {
    const { impersonation, token } = useAuth();
    const [left, setLeft] = useState(() => msLeft(impersonation));
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    // countdown; leaves when the session expires
    useEffect(() => {
        if (!impersonation) return undefined;
        const tick = () => {
            const l = msLeft(impersonation);
            setLeft(l);
            if (l <= 0) leaveImpersonation("/home");
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [impersonation]);

    // notice a revoked/ended session within ~45s (and immediately when the tab regains focus)
    useEffect(() => {
        if (!impersonation || !token) return undefined;
        let stopped = false;
        const check = async () => {
            const res = await fetchImpersonationStatus(token);
            if (!stopped && res.status === 401) leaveImpersonation("/home");
        };
        const id = setInterval(check, POLL_MS);
        const onVis = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVis);
        return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    }, [impersonation, token]);

    if (!impersonation) return null;

    const exit = async () => {
        if (busy) return;
        setBusy(true);
        await endImpersonationSession(token);
        clearImpersonation();
        window.close(); // works when this tab was opened from the admin panel
        setTimeout(() => window.location.replace("/home"), 250);
    };

    const who = impersonation.companyName || impersonation.targetName;

    return (
        <>
            <div aria-hidden className="pointer-events-none fixed inset-0 z-[2147483000] ring-4 ring-inset ring-amber-400/80" />
            <div
                role="status" aria-live="polite"
                className="fixed left-1/2 z-[2147483001] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] md:bottom-5"
            >
                {open && (
                    <div className="mb-2 rounded-xl border border-amber-200 bg-white p-3.5 text-[12px] shadow-xl">
                        <p className="font-extrabold text-slate-800">Admin session</p>
                        <p className="mt-1 font-medium text-slate-500">Signed in as <b className="text-slate-700">{who}</b> by <b className="text-slate-700">{impersonation.adminName}</b>.</p>
                        {impersonation.reason && <p className="mt-1 font-medium text-slate-500">Reason: {impersonation.reason}</p>}
                        <p className="mt-1 font-medium text-slate-400">Every change is logged. Phone/email, bank, wallet, payments and team access are blocked.</p>
                    </div>
                )}
                <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 py-1.5 pl-3 pr-1.5 text-slate-900 shadow-xl">
                    <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                        className="flex min-w-0 items-center gap-1.5 text-left">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span className="max-w-[40vw] truncate text-[12px] font-extrabold sm:max-w-[260px]">Acting as {who}</span>
                        <span className="shrink-0 rounded-full bg-black/10 px-1.5 py-0.5 font-mono text-[10.5px] font-bold">{clock(left)}</span>
                    </button>
                    <button type="button" onClick={exit} disabled={busy}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-60">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Exit
                    </button>
                </div>
            </div>
        </>
    );
}