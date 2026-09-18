// pages/TermsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, FileText, Menu, X } from "lucide-react";

import SmartLink from "../components/SmartLink.jsx";
import TERMS_CONTENT from "../data/termsData.js";

// ---------------------------------------------------------------------------
// Same design tokens as AuthPage.jsx, so this page feels like part of the
// same product rather than a bolted-on legal document.
// ---------------------------------------------------------------------------
const FONT = "'Amazon Ember', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const INK = "#0B1116";
const BRAND = "#047084";
const BRAND_SOFT = "rgba(4,112,132,0.07)";

// Bump this only when the terms content itself changes — this is a
// "last updated" marker, not today's date. Format: "MMMM D, YYYY".
const TERMS_LAST_UPDATED = "September 18, 2026";

// slugify a heading into a stable, unique anchor id
function slugify(text, index) {
    const base = text
        .toLowerCase()
        .replace(/[“”"']/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return `${base || "section"}-${index}`;
}

// Build a table of contents from the top-level ("h1") headings only —
// there are ~2,000 paragraphs in this agreement, so the nav stays readable
// by only surfacing the major sections; h2 sub-clauses are still rendered
// in the body with their own anchors for deep-linking.
function useTermsStructure() {
    return useMemo(() => {
        const withIds = TERMS_CONTENT.map((item, i) => ({
            ...item,
            id: item.k !== "body" ? slugify(item.t, i) : undefined,
        }));
        const toc = withIds.filter((i) => i.k === "h1");
        return { items: withIds, toc };
    }, []);
}

function TocList({ items, activeId, onNavigate, className = "" }) {
    return (
        <nav className={className}>
            <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                    const active = item.id === activeId;
                    return (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => onNavigate(item.id)}
                                className={`w-full rounded-xl px-3 py-2 text-left text-[12.5px] font-bold leading-snug tracking-wider transition-colors ${active ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                    }`}
                                style={active ? { background: INK } : undefined}
                            >
                                {item.t}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

export default function TermsPage() {
    const { items, toc } = useTermsStructure();
    const [activeId, setActiveId] = useState(toc[0]?.id);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const sectionRefs = useRef({});

    // Track which top-level section is in view, so the sidebar / mobile
    // dropdown can highlight where the reader currently is.
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
        );
        toc.forEach((item) => {
            const el = sectionRefs.current[item.id];
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toc.length]);

    const scrollToSection = (id) => {
        const doScroll = () => {
            const el = sectionRefs.current[id] || document.getElementById(id);
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 88;
                window.scrollTo({ top: y, behavior: "smooth" });
            }
        };

        if (mobileNavOpen) {
            // Sheet is still expanded / animating closed — measuring now gives
            // a wrong offset. Close it, then scroll once the collapse finishes.
            setMobileNavOpen(false);
            window.setTimeout(doScroll, 320);
        } else {
            doScroll();
        }
    };

    const activeLabel = toc.find((i) => i.id === activeId)?.t;

    return (
        <div className="min-h-screen w-full bg-white" style={{ fontFamily: FONT }}>
            {/* ---- header, same shell as AuthPage ---- */}
            <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2.5">
                        <SmartLink
                            to="/login"
                            aria-label="Back to home"
                            className="flex h-9 w-9 hidden md:block shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                        >
                            <ArrowLeft className="h-[18px] w-[18px]" />
                        </SmartLink>
                        <SmartLink to="/" className="flex shrink-0 items-center gap-2">
                            <img src="/Logo.png" alt="BBM" className="h-7 w-auto object-contain" />
                            <h1
                                className="text-[18px] font-extrabold tracking-wider"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: INK }}
                            >
                                BBM
                            </h1>
                        </SmartLink>
                    </div>

                    {/* mobile: dropdown trigger showing current section */}
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen((v) => !v)}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold tracking-wider lg:hidden"
                        style={{ color: BRAND, background: BRAND_SOFT }}
                    >
                        <Menu className="h-3.5 w-3.5" />
                        Sections
                    </button>
                </div>

                {/* mobile TOC sheet */}
                <AnimatePresence>
                    {mobileNavOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-t border-slate-100 lg:hidden"
                        >
                            <div className="max-h-[60vh] overflow-y-auto px-4 py-3 sm:px-6">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        Jump to section
                                    </p>
                                    <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close">
                                        <X className="h-4 w-4 text-slate-400" />
                                    </button>
                                </div>
                                <TocList items={toc} activeId={activeId} onNavigate={scrollToSection} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* ---- page body ---- */}
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:gap-4 sm:pb-8">
                    <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-white sm:h-12 sm:w-12"
                        style={{ background: INK }}
                    >
                        <FileText className="h-5 w-5" />
                    </span>
                    <h1
                        className="text-[26px] font-black leading-[1.08] tracking-wide sm:text-[34px]"
                        style={{ color: INK }}
                    >
                        B2B Marketplace Participant Agreement
                    </h1>
                    <p className="max-w-[640px] text-justify text-[13.5px] font-medium leading-relaxed tracking-wider text-slate-500 sm:text-[14.5px]">
                        These Terms govern registration and use of the BBM Platform, and the purchase and sale of
                        Products through it. By creating an account or using the Platform, you agree to be bound by
                        this Agreement.
                    </p>

                    <p className="text-[11.5px] font-bold uppercase tracking-widest text-slate-400">
                        Last updated: {TERMS_LAST_UPDATED}
                    </p>

                </div>

                <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
                    {/* ---- desktop sidebar TOC ---- */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pr-2">
                            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                Contents
                            </p>
                            <TocList items={toc} activeId={activeId} onNavigate={scrollToSection} />
                        </div>
                    </aside>

                    {/* ---- terms content ---- */}
                    <article className="min-w-0 max-w-[720px]">
                        {items.map((item, i) => {
                            if (item.k === "h1") {
                                return (
                                    <h2
                                        key={i}
                                        id={item.id}
                                        ref={(el) => (sectionRefs.current[item.id] = el)}
                                        className="mt-10 scroll-mt-24 text-[19px] font-black leading-tight tracking-wide first:mt-0 sm:text-[21px]"
                                        style={{ color: INK }}
                                    >
                                        {item.t}
                                    </h2>
                                );
                            }
                            if (item.k === "h2") {
                                return (
                                    <h3
                                        key={i}
                                        id={item.id}
                                        className="mt-6 scroll-mt-24 text-[14.5px] font-bold leading-snug tracking-wider text-slate-800 sm:text-[15px]"
                                    >
                                        {item.t}
                                    </h3>
                                );
                            }
                            return (
                                <p
                                    key={i}
                                    className="mt-2.5 text-justify text-[13.5px] font-medium leading-relaxed tracking-wider text-slate-500 sm:text-[14px]"
                                >
                                    {item.t}
                                </p>
                            );
                        })}

                        <div className="mt-12 rounded-2xl bg-slate-50 px-5 py-5 text-justify text-[12.5px] font-medium leading-relaxed tracking-wider text-slate-500">
                            This page is a plain rendering of the executed Agreement for reference. In case of any
                            discrepancy between this page and the signed Agreement, the signed Agreement shall prevail.
                        </div>
                    </article>
                </div>
            </main>
        </div>
    );
}