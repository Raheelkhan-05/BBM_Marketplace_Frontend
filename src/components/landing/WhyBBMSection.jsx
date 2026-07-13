//WhyBBMSection.jsx

import { useState, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Scale, Wallet, ShieldCheck, Repeat, Boxes, Zap, BarChart3, CircleUserRound,
  MapPin, MessageSquareCheck, Store, Link2, Clock, TrendingDown, Layers, Tags,
  Flag, Users, Lock, Factory, Eye, TrendingUp, ChevronDown,
} from "lucide-react";
import { whyBBM } from "../../../data/content";

const ICONS = {
  scale: Scale, wallet: Wallet, "check-shield": ShieldCheck, repeat: Repeat,
  boxes: Boxes, bolt: Zap, "bar-chart": BarChart3, "user-circle": CircleUserRound,
  map: MapPin, "message-check": MessageSquareCheck, store: Store, link: Link2,
  clock: Clock, "trending-down": TrendingDown, layers: Layers, tags: Tags,
  flag: Flag, users: Users, lock: Lock, factory: Factory, eye: Eye,
  "trending-up": TrendingUp,
};

const HEADING_ICONS = { buy: Scale, sell: MapPin, platform: Flag };

function HeadingCard({ item, isOpen, onToggle }) {
  const Icon = HEADING_ICONS[item.id] ?? Boxes;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all duration-300 sm:gap-3 sm:px-5 sm:py-6"
      style={{
        borderColor: isOpen ? item.accent : "#e7e5e4",
        backgroundColor: isOpen ? item.tint : "#ffffff",
        boxShadow: isOpen ? `0 4px 20px -6px ${item.accent}55` : "none",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300 sm:h-11 sm:w-11"
        style={{
          backgroundColor: isOpen ? item.accent : "#f8f7f6",
          color: isOpen ? "#ffffff" : item.accent,
        }}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="text-[12px] font-bold leading-tight text-slate-900 sm:text-[15px]">
          {item.heading}
        </span>
        <span
          className="text-[10px] font-medium leading-tight sm:text-[12px]"
          style={{ color: item.accent }}
        >
          {item.hero}
        </span>
      </span>

      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="text-slate-400"
      >
        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </motion.span>
    </button>
  );
}

function Panel({ item }) {
  const panelId = useId();

  return (
    <motion.div
      key={item.id}
      id={panelId}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div
        className="mt-3 rounded-2xl border px-4 py-5 sm:mt-4 sm:px-6 sm:py-6"
        style={{ borderColor: item.accent + "33", backgroundColor: item.tint }}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {item.points.map((p, i) => {
            const PointIcon = ICONS[p.icon] ?? Boxes;
            return (
              <motion.div
                key={p.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
                className="flex items-start gap-2.5"
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white"
                  style={{ color: item.accent }}
                >
                  <PointIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] leading-snug text-slate-700 sm:text-[14px]">
                  {p.text}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default function WhyBBMSection() {
  const [activeId, setActiveId] = useState(whyBBM[0].id);
  const activeItem = whyBBM.find((i) => i.id === activeId);

  return (
    <div className="mt-6 px-4 sm:px-6 lg:mt-14 lg:px-0">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="mx-auto lg:max-w-3xl"
      >
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {whyBBM.map((item) => (
            <HeadingCard
              key={item.id}
              item={item}
              isOpen={activeId === item.id}
              onToggle={() => setActiveId(activeId === item.id ? null : item.id)}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {activeItem && <Panel item={activeItem} />}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}