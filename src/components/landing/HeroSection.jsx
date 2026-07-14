//HeroSection.jsx

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { heroContent, TAGLINE } from "../../../data/content";

export default function HeroSection() {
  return (
    <div className="px-4 pt-2 sm:px-6 sm:pt-1 lg:px-0">

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-1 text-[2.5rem] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl xl:text-7xl"
      >
        {heroContent.titleLine1}{" "}
        <span className="text-[#d2462b]">{heroContent.titleAccent1}</span>
        <br />
        {heroContent.titleLine2}{" "}
        <span className="text-[#057184]">{heroContent.titleAccent2}</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-3 inline-block rounded-full bg-[#f5d7d0] px-2.5 py-1 text-[11px] font-bold text-[#d2462b]"
      >
        {TAGLINE}
      </motion.p>

      <motion.ul
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-2 space-y-1.5"
      >
        {heroContent.bullets.map((b) => (
          <li
            key={b}
            className="flex items-center gap-2 text-[12.5px] font-medium text-slate-700 sm:text-[14px]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#057184]" />
            {b}
          </li>
        ))}
      </motion.ul>
    </div>
  );
}