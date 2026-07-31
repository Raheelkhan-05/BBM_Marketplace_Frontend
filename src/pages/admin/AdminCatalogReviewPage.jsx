import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, Tag, Sparkles, Plus, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminListCatalog } from "../../utils/api.js";
import CreateCatalogModal from "../../components/CreateCatalogModal.jsx";

const STATUS_TABS = [
    { key: "pending_review", label: "Pending Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];
const LEVEL_TABS = [
    { key: "all", label: "All levels" },
    { key: "category", label: "Category" },
    { key: "subcategory", label: "Subcategory" },
    { key: "product", label: "Product" },
    { key: "brand", label: "Brand" },
];
const STATUS_TONE = {
    pending_review: { bg: "rgba(217,119,6,0.1)", fg: "#b45309", label: "Pending" },
    approved: { bg: "rgba(22,163,74,0.1)", fg: "#15803d", label: "Approved" },
    rejected: { bg: "rgba(199,31,17,0.1)", fg: "#c71f11", label: "Rejected" },
};
const LEVEL_LABEL = { category: "Category", subcategory: "Subcategory", product: "Product", brand: "Brand" };

function parentLabel(entry) {
    if (entry.level === "subcategory") return entry.hs_categories?.name;
    if (entry.level === "product") return entry.hs_subcategories?.name;
    if (entry.level === "brand") return entry.hs_products?.name;
    return null;
}

function SkeletonRow() {
    return (
        <div className="flex animate-pulse items-center gap-3.5 px-4 py-3.5">
            <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-slate-100" />
                <div className="h-2.5 w-1/4 rounded bg-slate-100" />
            </div>
            <div className="h-5 w-16 shrink-0 rounded-full bg-slate-100" />
        </div>
    );
}

export default function AdminCatalogReviewPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState("pending_review");
    const [level, setLevel] = useState("all");
    const [q, setQ] = useState("");
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        if (!token) return;
        let active = true;
        setLoading(true);
        adminListCatalog(token, { level, status, q }).then((res) => {
            if (active && res?.success) setEntries(res.entries);
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [level, status, q, token]);

    function handleCreated(newLevel, entry) {
        navigate(`/admin/catalog/${newLevel}/${entry.id}`);
    }

    return (
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-[20px] font-extrabold text-slate-900 sm:text-[22px]">Catalog Review</h1>
                        <p className="text-[12.5px] font-medium text-slate-400">Review AI-suggested entries or add new ones manually</p>
                    </div>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-[#047084]/20 transition-transform hover:scale-[1.02] sm:inline-flex">
                    <Plus className="h-4 w-4" /> Add New
                </button>
            </div>

            <div className="mt-6 flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {STATUS_TABS.map((t) => (
                            <button key={t.key} onClick={() => setStatus(t.key)}
                                className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                                style={{ background: status === t.key ? "#047084" : "#f1f5f9", color: status === t.key ? "white" : "#64748b" }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100 transition-shadow focus-within:border-[#047084]/40 focus-within:ring-2 focus-within:ring-[#047084]/10">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog…" className="w-full bg-transparent text-[13px] font-medium focus:outline-none sm:w-44" />
                    </div>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {LEVEL_TABS.map((t) => (
                        <button key={t.key} onClick={() => setLevel(t.key)}
                            className="shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors"
                            style={{
                                borderColor: level === t.key ? "#047084" : "#e2e8f0",
                                color: level === t.key ? "#047084" : "#94a3b8",
                                background: level === t.key ? "rgba(4,112,132,0.06)" : "white",
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm shadow-slate-100/60">
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50">
                            <Tag className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-[13px] font-bold text-slate-500">No entries found</p>
                        <p className="text-[12px] font-medium text-slate-400">Try a different filter, or add one manually.</p>
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {!loading && entries.map((e) => {
                        const tone = STATUS_TONE[e.review_status] || STATUS_TONE.pending_review;
                        return (
                            <motion.button key={`${e.level}-${e.id}`} onClick={() => navigate(`/admin/catalog/${e.level}/${e.id}`)}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                whileHover={{ backgroundColor: "#f8fafc" }}
                                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-100">
                                    {e.image ? <img src={e.image} alt="" className="h-full w-full object-cover" /> : <Tag className="h-5 w-5 text-slate-300" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="truncate text-[14px] font-bold text-slate-900">{e.name}</p>
                                        {e.is_ai_generated && <Sparkles className="h-3 w-3 shrink-0 text-[#047084]" />}
                                    </div>
                                    <p className="text-[12px] font-medium text-slate-400">
                                        {LEVEL_LABEL[e.level]}{parentLabel(e) ? ` · under ${parentLabel(e)}` : ""}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
            </div>

            <motion.button onClick={() => setShowCreate(true)} whileTap={{ scale: 0.92 }}
                className="fixed bottom-5 right-5 flex items-center justify-center rounded-full bg-[#047084] text-white shadow-lg shadow-[#047084]/30 sm:hidden"
                style={{ height: 52, width: 52 }}>
                <Plus className="h-6 w-6" />
            </motion.button>

            <CreateCatalogModal
                token={token}
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
                defaultLevel={level === "all" ? "category" : level}
            />
        </div>
    );
}