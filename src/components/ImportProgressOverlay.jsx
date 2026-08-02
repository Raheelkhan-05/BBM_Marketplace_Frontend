// components/ImportProgressOverlay.jsx
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2 } from "lucide-react";

const PHASE_LABEL = {
    reading_pdf: "Reading catalog...",
    classifying: "Classifying items...",
    attaching_images: "Attaching images...",
    queued: "Queued...",
};

export default function ImportProgressOverlay({ phase, progress }) {
    if (phase !== "uploading" && phase !== "processing") return null;

    // Defensive: progress may be null, undefined, or a partial object
    // depending on how far the job has gotten — never trust its shape.
    const processed = typeof progress?.processed === "number" ? progress.processed : null;
    const total = typeof progress?.total === "number" ? progress.total : null;
    const pct = total && total > 0 && processed != null ? Math.round((processed / total) * 100) : null;
    const subPhase = typeof progress?.phase === "string" ? progress.phase : null;

    const label = phase === "uploading"
        ? "Uploading file..."
        : (subPhase && PHASE_LABEL[subPhase]) || "Processing...";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-[90%] max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
                >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F1EEFF]">
                        {phase === "uploading"
                            ? <Loader2 className="h-5 w-5 animate-spin text-[#6655D8]" />
                            : <FileText className="h-5 w-5 text-[#6655D8]" />}
                    </div>
                    <p className="mt-3 text-[14px] font-extrabold text-slate-900">{label}</p>
                    {pct != null && (
                        <>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <motion.div className="h-full bg-[#047084]" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
                            </div>
                            <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                                {processed} of {total} items
                            </p>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}