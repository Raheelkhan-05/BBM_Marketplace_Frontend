// src/pages/ImpersonatePage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { exchangeImpersonationCode } from "../utils/impersonation.js";

// The code arrives in the URL hash (never sent to any server). Read it ONCE and remove it from the address bar.
let captured = null;
function capture() {
    if (captured) return captured;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const next = params.get("next") || "/home";
    captured = { code: params.get("code") || "", next: next.startsWith("/") && !next.startsWith("//") ? next : "/home" };
    window.history.replaceState(null, "", window.location.pathname);
    return captured;
}

// The code is single-use, so StrictMode's double effect must reuse the same request.
const attempts = new Map();

export default function ImpersonatePage() {
    const { startImpersonation } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    useEffect(() => {
        const { code, next } = capture();
        if (!code) { setError("This link is missing its code. Open a new session from the admin panel."); return undefined; }

        let live = true;
        let promise = attempts.get(code);
        if (!promise) { promise = exchangeImpersonationCode(code); attempts.set(code, promise); }

        promise.then(async (res) => {
            if (!live) return;
            if (!res?.success || !res.token) { setError(res?.message || "Couldn't open the session."); return; }
            await startImpersonation(res.token, res.meta);
            navigate(next, { replace: true });
        });
        return () => { live = false; };
    }, [startImpersonation, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl">
                {error ? (
                    <>
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><ShieldAlert className="h-6 w-6" /></span>
                        <h1 className="mt-4 text-[18px] font-extrabold text-slate-900">Couldn't open the session</h1>
                        <p className="mt-1.5 text-[13px] font-medium text-slate-500">{error}</p>
                        <div className="mt-5 flex justify-center gap-2">
                            <button onClick={() => window.close()} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600">Close tab</button>
                            <a href="/home" className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-bold text-white">Go to marketplace</a>
                        </div>
                    </>
                ) : (
                    <>
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600"><ShieldCheck className="h-6 w-6" /></span>
                        <h1 className="mt-4 text-[18px] font-extrabold text-slate-900">Opening admin session</h1>
                        <p className="mt-1.5 flex items-center justify-center gap-2 text-[13px] font-medium text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Signing you in securely…
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}