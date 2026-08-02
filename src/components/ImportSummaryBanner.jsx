// components/ImportSummaryBanner.jsx
import { useState } from "react";
import { CheckCircle2, Sparkles, AlertTriangle, X, ChevronDown } from "lucide-react";

export default function ImportSummaryBanner({ summary, onDismiss }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="mt-3 rounded-xl border border-[#047084]/20 bg-[#F4FBFB] px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 text-[12px] font-semibold text-slate-700">
                    <span className="flex items-center gap-1 text-[#047084]"><CheckCircle2 className="h-3.5 w-3.5" />{summary.matched} matched</span>
                    <span className="flex items-center gap-1 text-emerald-600"><Sparkles className="h-3.5 w-3.5" />{summary.created} added</span>
                    {summary.rejected > 0 && (
                        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />{summary.rejected} skipped</span>
                    )}
                    {summary.rejections?.length > 0 && (
                        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-0.5 text-slate-500 hover:underline">
                            why? <ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>
                <button onClick={onDismiss}><X className="h-3.5 w-3.5 text-slate-400" /></button>
            </div>
            {expanded && (
                <ul className="mt-2 space-y-1 text-[11.5px] text-slate-500">
                    {summary.rejections.map((r) => <li key={r.rowId}>{r.rowId}: {r.reason}</li>)}
                </ul>
            )}
        </div>
    );
}