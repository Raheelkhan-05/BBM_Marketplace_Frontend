import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, Tag, Sparkles, Plus, Folder } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminListCatalog } from "../../utils/api.js";
import CreateSimpleCatalogModal from "../../components/CreateSimpleCatalogModal.jsx";

const STATUS_TABS = [
    { key: "pending_review", label: "Pending Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];
const STATUS_TONE = {
    pending_review: { bg: "rgba(217,119,6,0.1)", fg: "#b45309", label: "Pending" },
    approved: { bg: "rgba(22,163,74,0.1)", fg: "#15803d", label: "Approved" },
    rejected: { bg: "rgba(199,31,17,0.1)", fg: "#c71f11", label: "Rejected" },
};

// Drill-down: Category -> Subcategory -> Generic Product. `path` holds the
// crumbs picked so far; the level currently being browsed is derived from
// its length. Each rung is admin-only (name + image).
const LEVEL_BY_DEPTH = ["category", "subcategory", "generic_product"];
const LEVEL_LABEL = { category: "Categories", subcategory: "Subcategories", generic_product: "Generic Products" };
const CHILD_NOUN = { category: "subcategory", subcategory: "generic product" };
const ADD_LABEL = { category: "category", subcategory: "subcategory", generic_product: "generic product" };

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
    const [path, setPath] = useState([]); // [{level, id, name}]
    const [status, setStatus] = useState("pending_review");
    const [q, setQ] = useState("");
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const depth = path.length;
    const level = LEVEL_BY_DEPTH[depth];
    const parent = path[depth - 1] || null;

    useEffect(() => {
        if (!token || !level) return;
        let active = true;
        setLoading(true);
        adminListCatalog(token, { level, status, q, parentId: parent?.id }).then((res) => {
            if (active && res?.success) setEntries(res.entries);
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [level, parent?.id, status, q, token, refreshKey]);

    function drillInto(entry) {
        setPath((p) => [...p, { level, id: entry.id, name: entry.name }]);
        setQ("");
    }
    function goToCrumb(i) {
        setPath((p) => p.slice(0, i + 1));
        setQ("");
    }
    function handleCreated() {
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
    }

    if (!level) return null;

    return (
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-[20px] font-extrabold text-slate-900 sm:text-[22px]">Catalog</h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12.5px] font-semibold text-slate-400">
                        <button onClick={() => setPath([])} className={depth === 0 ? "text-[#047084]" : "hover:text-slate-600"}>All categories</button>
                        {path.map((c, i) => (
                            <span key={c.id} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                <button onClick={() => goToCrumb(i)} className={i === depth - 1 ? "text-[#047084]" : "hover:text-slate-600"}>{c.name}</button>
                            </span>
                        ))}
                    </div>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-[#047084] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-[#047084]/20 transition-transform hover:scale-[1.02] sm:inline-flex">
                    <Plus className="h-4 w-4" /> Add {ADD_LABEL[level]}
                </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {STATUS_TABS.map((t) => (
                        <button key={t.key} onClick={() => setStatus(t.key)}
                            className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                            style={{ background: status === t.key ? "#047084" : "#f1f5f9", color: status === t.key ? "white" : "#64748b" }}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${LEVEL_LABEL[level].toLowerCase()}…`} className="w-full bg-transparent text-[13px] font-medium focus:outline-none sm:w-44" />
                </div>
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">{LEVEL_LABEL[level]}</p>

            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm shadow-slate-100/60">
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50">
                            {level === "category" ? <Folder className="h-5 w-5 text-slate-300" /> : <Tag className="h-5 w-5 text-slate-300" />}
                        </div>
                        <p className="text-[13px] font-bold text-slate-500">Nothing here yet</p>
                        <p className="text-[12px] font-medium text-slate-400">Add one, or try a different filter.</p>
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {!loading && entries.map((e) => {
                        const tone = STATUS_TONE[e.review_status] || STATUS_TONE.pending_review;
                        return (
                            <motion.button key={e.id}
                                onClick={() => (level === "generic_product" ? navigate(`/admin/catalog/generic_product/${e.id}`) : drillInto(e))}
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
                                    {level !== "generic_product" && (
                                        <p className="text-[12px] font-medium text-slate-400">Tap to open {CHILD_NOUN[level]} list</p>
                                    )}
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

            <CreateSimpleCatalogModal
                token={token}
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                level={level}
                parentId={parent?.id}
                onCreated={handleCreated}
            />
        </div>
    );
}