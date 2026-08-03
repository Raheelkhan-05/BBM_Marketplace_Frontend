import { motion } from "framer-motion";
import { Ic } from "../icons";

/* ─── Utility ────────────────────────────────────────────────── */
export function cls(...a) { return a.filter(Boolean).join(" "); }
export function inp(extra = "") {
  return cls(
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",
    extra
  );
}

/* ─── Form primitives ────────────────────────────────────────── */
export function Lbl({ children, required }) {
  return (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}{required && <span className="text-rose-500">*</span>}
    </label>
  );
}
export function FErr({ name, errors }) {
  if (!errors?.[name]) return null;
  return <p className="mt-1 text-[11px] text-rose-500">{errors[name]}</p>;
}

export function FldInput({ label, name, value, onChange, type = "text", placeholder, required, icon: Icon_, errors, disabled = false, onBlur, min }) {
  return (
    <div className="flex flex-col">
      {label && (
        <Lbl required={required}>
          {label}{disabled && <Ic.Lock className="ml-1 h-2.5 w-2.5 text-slate-300 inline" />}
        </Lbl>
      )}
      <div className="relative">
        {Icon_ && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <Icon_ className={cls("h-4 w-4", disabled ? "text-slate-300" : "text-slate-400")} />
          </span>
        )}
        <input
          name={name} type={type} value={value} onChange={onChange} onBlur={onBlur}
          placeholder={placeholder} disabled={disabled} min={min}
          className={inp(cls(
            Icon_ ? "pl-9" : "",
            errors?.[name] ? "!border-rose-400 !ring-rose-100" : "",
            disabled ? "bg-slate-50 cursor-not-allowed opacity-70 select-none" : ""
          ))}
        />
      </div>
      <FErr name={name} errors={errors} />
    </div>
  );
}

// export function SelInput({ label, name, value, onChange, options, required, placeholder, errors }) {
//   return (
//     <div className="flex flex-col">
//       {label && <Lbl required={required}>{label}</Lbl>}
//       <div className="relative">
//         <select name={name} value={value} onChange={onChange}
//           className={inp(cls("appearance-none pr-9", errors?.[name] ? "!border-rose-400 !ring-rose-100" : ""))}>
//           <option value="">{placeholder || `Select ${label}`}</option>
//           {options.map(o =>
//             typeof o === "string"
//               ? <option key={o} value={o}>{o}</option>
//               : <option key={o.value} value={o.value}>{o.label}</option>
//           )}
//         </select>
//         <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
//       </div>
//       <FErr name={name} errors={errors}/>
//     </div>
//   );
// }


export function SelInput({
  label,
  name,
  value,
  onChange,
  options,
  required,
  placeholder,
  errors,
  disabled,
  icon,
  grouped,      // optional: pass grouped options
  searchable,   // optional: force show/hide search
  compact,      // optional: tighter padding
}) {
  return (
    <div className="flex flex-col">
      {label && <Lbl required={required}>{label}</Lbl>}
      <CustomSelect
        value={value || ""}
        onChange={(val) => {
          // Bridge back into synthetic-event shape that hc() expects
          onChange({ target: { name, value: val } });
        }}
        options={options}
        grouped={grouped}
        placeholder={placeholder || (label ? `Select ${label}` : "Select…")}
        label={label}
        required={required}
        disabled={disabled}
        error={errors?.[name]}
        icon={icon}
        searchable={searchable}
        compact={compact}
      />
    </div>
  );
}

export function TArea({ label, name, value, onChange, placeholder, rows = 3, errors }) {
  return (
    <div className="flex flex-col">
      {label && <Lbl>{label}</Lbl>}
      <textarea
        name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        className={inp(cls("resize-none", errors?.[name] ? "!border-rose-400 !ring-rose-100" : ""))}
      />
      <FErr name={name} errors={errors} />
    </div>
  );
}

/* ─── Section divider ────────────────────────────────────────── */
export function SecDiv({ title, icon: I, accent = "indigo" }) {
  const c = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    teal: "text-teal-600 bg-teal-50 border-teal-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
    slate: "text-slate-600 bg-slate-50 border-slate-200",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    sky: "text-sky-600 bg-sky-50 border-sky-100",
  };
  return (
    <div className={cls("mb-4 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2", c[accent])}>
      {I && <I className="h-3.5 w-3.5 shrink-0" />}
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}

/* ─── Tag ────────────────────────────────────────────────────── */
export function Tag({ children, className = "" }) {
  return (
    <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", className || "bg-slate-100 text-slate-600 ring-slate-500/15")}>
      {children}
    </span>
  );
}

/* ─── Buttons ────────────────────────────────────────────────── */
export function PBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={cls("inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60", className)}>
      {children}
    </button>
  );
}
export function GBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={cls("inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]", className)}>
      {children}
    </button>
  );
}

/* ─── Detail row ─────────────────────────────────────────────── */
export function DRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">{label}</span>
      <span className={cls("text-right text-sm text-slate-700 break-all", mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}

/* ─── Modal backdrop + sheet ─────────────────────────────────── */
export function Backdrop({ onClick, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4">
      {children}
    </motion.div>
  );
}
export function Sheet({ children, wide = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 16 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={e => e.stopPropagation()}
      className={cls("max-h-[94vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/8", wide ? "max-w-3xl" : "max-w-xl")}>
      {children}
    </motion.div>
  );
}

/* ─── Sheet header ───────────────────────────────────────────── */
export function SheetHead({ title, subtitle, onClose, accent = "", extraActions }) {
  return (
    <div className={cls("sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl px-5 py-4 border-b border-slate-100", accent || "bg-white")}>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold tracking-tight text-slate-900 truncate">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {extraActions}
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Ic.X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
