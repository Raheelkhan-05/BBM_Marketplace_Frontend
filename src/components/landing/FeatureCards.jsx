import { motion } from "framer-motion";
import { Tag, ShieldCheck, Box, Zap } from "lucide-react";
import { features } from "../../../data/content";

const ICONS = {
  tag: Tag,
  "check-shield": ShieldCheck,
  box: Box,
  bolt: Zap,
};

export default function FeatureCards() {
  return (
    <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5 lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        {features.map((f, i) => {
          const Icon = ICONS[f.icon];
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col items-center rounded-2xl p-3 text-center lg:border lg:border-slate-100 lg:bg-white lg:p-6 lg:shadow-sm"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full ${f.bg} ${f.fg}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-[13px] font-bold leading-tight text-slate-900 sm:text-sm lg:text-base">
                {f.title}
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 sm:text-xs lg:text-sm">
                {f.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}