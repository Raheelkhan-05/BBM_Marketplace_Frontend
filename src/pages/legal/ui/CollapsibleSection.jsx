import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ic } from "../icons";
import { cls } from "./primitives";

/* ─── Generic collapsible (used in forms) ────────────────────── */
export function CollapsibleSection({ title, defaultOpen = false, noPadding = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50">
        <span className="text-[12px] font-semibold text-slate-600">{title}</span>
        {open ? <Ic.ChevU className="h-4 w-4 text-slate-400"/> : <Ic.ChevD className="h-4 w-4 text-slate-400"/>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden">
            <div className={noPadding ? "border-t border-slate-100" : "border-t border-slate-100 px-4 pb-4 pt-3 space-y-3"}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Accented collapsible (used in detail panel) ────────────── */
// `defaultOpen` is opt-in (defaults to false, same as before) so existing
// call sites (Company Info, Contact, Primary/Secondary Contact) keep
// starting closed — pass defaultOpen for sections like Enquiries that are
// the primary thing someone opens the detail panel to look at.
export function CollapsibleDetailSection({ title, icon: Icon, accent = "slate", className = "", defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const accentMap = {
    slate:  { border: "border-slate-100",  bg: "bg-slate-50/60",  header: "bg-slate-50",     icon: "text-slate-400",  text: "text-slate-500"  },
    sky:    { border: "border-sky-100",    bg: "bg-sky-50/40",    header: "bg-sky-50/60",    icon: "text-sky-500",    text: "text-sky-600"    },
    indigo: { border: "border-indigo-100", bg: "bg-indigo-50/40", header: "bg-indigo-50/60", icon: "text-indigo-500", text: "text-indigo-600" },
    violet: { border: "border-violet-100", bg: "bg-violet-50/40", header: "bg-violet-50/60", icon: "text-violet-500", text: "text-violet-600" },
  };
  const c = accentMap[accent] || accentMap.slate;
  return (
    <div className={cls("rounded-xl border overflow-hidden", c.border, c.bg, className)}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className={cls("flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:brightness-95", c.header)}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cls("h-3.5 w-3.5", c.icon)}/>}
          <span className={cls("text-[11px] font-bold uppercase tracking-widest", c.text)}>{title}</span>
        </div>
        {open
          ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/>
          : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>
        }
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden">
            <div className="px-4 border-t border-slate-100/60">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}