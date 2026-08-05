// components/BackButton.jsx
//
// Global back control. Layout renders this on every page that doesn't
// manage its own back button (landing, admin, and /browse are excluded —
// /browse's back button is stack-aware, not history-based, so it stays
// local to HierarchySearchPage). Floating + frosted so it reads correctly
// over both light backgrounds and dark hero gradients.

import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="fixed left-3 top-[58px] z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/85 text-slate-700 shadow-[0_6px_18px_-6px_rgba(11,17,22,0.3)] backdrop-blur-md transition hover:bg-white active:scale-95 md:left-6 md:top-[64px]"
        >
            <ArrowLeft className="h-4.5 w-4.5" />
        </button>
    );
}