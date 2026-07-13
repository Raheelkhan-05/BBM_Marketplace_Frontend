import { motion } from "framer-motion";
import { heroContent, TAGLINE } from "../../../data/content";

export default function HeroSection() {
  return (
    <div className="px-4 pt-5 sm:px-6 sm:pt-1 lg:px-0">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="inline-block rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600"
      >
        {TAGLINE}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-3 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl xl:text-7xl"
      >
        {heroContent.titleLine1}{" "}
        <span className="text-blue-600">{heroContent.titleAccent1}</span>
        <br />
        {heroContent.titleLine2}{" "}
        <span className="text-blue-600">{heroContent.titleAccent2}</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-3 max-w-md pe-16 text-[14px] text-slate-600 sm:text-lg lg:max-w-lg lg:text-lg"
      >
        {heroContent.subtitle}
      </motion.p>
    </div>
  );
}