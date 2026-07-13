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
      className="mt-5 flex items-center gap-4 rounded-lg bg-blue-50/60 px-4 py-2 border border-blue-100/50 lg:max-w-xl"
    >
      {/* Soft circular icon wrapper matching the image */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100/70 text-blue-600 shadow-sm">
        <Package className="h-5 w-5" />
      </span>
      
      <div>
        <p className="text-[14px] font-semibold text-slate-900 tracking-wide">
          Explore <span className="text-blue-600 font-bold">{infoBanner.highlight}</span>{" "}
          {infoBanner.text}
        </p>
        <p className="text-[12px] font-medium text-slate-700 mt-0">
          {infoBanner.subtext}
        </p>
      </div>
    </motion.div>
  );
}