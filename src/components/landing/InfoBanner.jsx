//InfoBanner.jsx

import { motion } from "framer-motion";
import { Package } from "lucide-react";
import { infoBanner } from "../../../data/content";

export default function InfoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5 }}
      className="mt-5 flex items-center gap-4 rounded-lg px-4 py-2 lg:max-w-xl"
        style={{ backgroundColor: "rgba(130, 182, 192, 0.10)", borderWidth: 1, borderColor: "rgba(130, 182, 192, 0.30)" }}

    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#057184] shadow-sm"
        style={{ backgroundColor: "rgba(130, 182, 192, 0.20)" }}
        >

        <Package className="h-5 w-5" />
      </span>

      <div>
        <p className="text-[14px] font-semibold text-slate-900 tracking-wide">
          Explore <span className="text-[#057184] font-bold">{infoBanner.highlight}</span>{" "}
          {infoBanner.text}
        </p>
        <p className="text-[12px] font-medium text-slate-700 mt-0">
          {infoBanner.subtext}
        </p>
      </div>
    </motion.div>
  );
}