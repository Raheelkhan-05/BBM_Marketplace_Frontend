import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { TAGLINE } from "../../data/content";

const NAV_LINKS = [
  { label: "Nav1", href: "#nav1" },
  { label: "Nav2", href: "#nav2" },
  { label: "Nav3", href: "#nav3" },
  { label: "Nav4", href: "#nav4" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <img
              src="./Logo.png"
              alt="BBM"
              className="h-8 w-auto object-contain"
            />

            <h1
              className="text-xl font-bold text-slate-900"
              style={{ fontFamily: "Verdana, Geneva, Tahoma, sans-serif" }}
            >
              BBM
            </h1>
          </a>

          {/* Desktop Nav */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 md:flex items-center gap-10">
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="relative text-sm font-medium text-slate-600 transition hover:text-blue-600 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <a
              href="#login"
              className="hidden rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 md:inline-flex"
            >
              Sign In
            </a>

            <button
              onClick={() => setOpen(!open)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
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
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="fixed left-0 right-0 top-16 z-50 border-b border-slate-200 bg-white shadow-xl md:hidden"
            >
              <div className="mx-auto max-w-7xl px-5 py-4">
                <nav className="flex flex-col">
                  {NAV_LINKS.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-blue-600"
                    >
                      {item.label}
                    </a>
                  ))}

                  <a
                    href="#login"
                    onClick={() => setOpen(false)}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Sign In
                  </a>

                  <p className="mt-0 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
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