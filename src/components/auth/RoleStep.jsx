// components/auth/RoleStep.jsx — new, first step after OTP
import { motion } from "framer-motion";
import { ShoppingCart, Store, ArrowRightLeft, ArrowRight } from "lucide-react";

const OPTIONS = [
  { key: "buyer", label: "I'm here to buy", desc: "Source materials from verified suppliers", icon: ShoppingCart },
  { key: "seller", label: "I'm here to sell", desc: "List products, reach verified buyers", icon: Store },
  { key: "both", label: "Both", desc: "Buy and sell from the same account", icon: ArrowRightLeft },
];

export default function RoleStep({ onSubmit, loading }) {
  return (
    <motion.div key="role" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="flex flex-col">
      <h1 className="text-[26px] font-extrabold leading-tight text-slate-900 sm:text-[28px]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        What brings you here?
      </h1>
      <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
        This decides which details we ask for next — you can add seller info anytime later.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        {OPTIONS.map(({ key, label, desc, icon: Icon }) => (
          <button
            key={key}
            type="button"
            disabled={loading}
            onClick={() => onSubmit(key)}
            className="flex items-center gap-3.5 rounded-xl border-2 border-slate-100 px-4 py-3.5 text-left transition-colors hover:border-[#7fb3bd] disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold text-slate-900">{label}</span>
              <span className="block text-[12px] font-medium text-slate-500">{desc}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}