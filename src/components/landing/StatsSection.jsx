//StatsSection.jsx

import { motion } from "framer-motion";
import { Users, Store, Box } from "lucide-react";
import { stats, closingLine } from "../../../data/content";

const ICONS = { users: Users, storefront: Store, box: Box };
const STAT_COLORS = ["text-[#d2462b]", "text-[#057184]", "text-[#d85a41]"];

export default function StatsSection() {
  return (
    <div className="mt-6 lg:mt-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f8f7f6] p-4 sm:gap-4 sm:p-6 lg:max-w-3xl lg:mx-auto lg:gap-8"
      >
        {stats.map((s, i) => {
          const Icon = ICONS[s.icon];
          return (
            <div key={s.id} className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-center sm:gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${STAT_COLORS[i % STAT_COLORS.length]} sm:h-5 sm:w-5`} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                <span className="text-[13px] font-extrabold text-slate-900 sm:text-lg">
                  {s.value}
                </span>
                <span className="text-[11px] text-slate-500 sm:text-sm">{s.label}</span>
              </div>
            </div>
          );
        })}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-6 text-center text-[11px] text-slate-400 lg:text-base"
      >
        {closingLine}
      </motion.p>
    </div>
  );
}