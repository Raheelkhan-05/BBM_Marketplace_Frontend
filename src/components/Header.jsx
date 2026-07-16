//Header.jsx

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { TAGLINE } from "../../data/content";

const NAV_LINKS = [
  { label: "Nav1", href: "#nav1" },
  { label: "Nav2", href: "#nav2" },
  { label: "Nav3", href: "#nav3" },
  { label: "Nav4", href: "#nav4" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/85 shadow-[0_1px_0_0_rgba(4,112,132,0.12),0_8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl"
            : "bg-white/60 backdrop-blur-md"
        }`}
      >

        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="./Logo.png" alt="BBM" className="h-8 w-auto object-contain" />
            <h1
              className="text-[21px] font-extrabold tracking-tight text-slate-900"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              BBM
            </h1>
          </a>

          {/* Desktop Nav */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 md:flex items-center gap-9">
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="group relative py-1 text-[13.5px] font-semibold tracking-wide text-slate-600 transition-colors hover:text-[#047084]"
              >
                {item.label}
                <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full bg-[#d2462b] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <a
              href="#login"
              className="hidden items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-4px_rgba(199,31,17,0.45)] transition-transform duration-200 hover:-translate-y-0.5 md:inline-flex"
              style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
            >
              Sign In
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
              className="rounded-lg border border-slate-200 bg-white/70 p-2 text-slate-700 transition hover:border-[#7fb3bd] hover:text-[#047084] md:hidden"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed left-0 right-0 top-[65px] z-50 border-b border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl md:hidden"
            >
              <div className="mx-auto max-w-7xl px-5 py-4">
                <nav className="flex flex-col">
                  {NAV_LINKS.map((item, i) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 text-[14px] font-semibold text-slate-700 transition hover:bg-[#e6ecee] hover:text-[#047084]"
                      style={{ transitionDelay: `${i * 20}ms` }}
                    >
                      {item.label}
                    </a>
                  ))}
                  <a
                    href="#login"
                    onClick={() => setOpen(false)}
                    className="mt-3 rounded-lg px-4 py-3 text-center text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(199,31,17,0.4)]"
                    style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
                  >
                    Sign In
                  </a>

                  <p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs font-medium text-slate-400">
                    {TAGLINE}
                  </p>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}