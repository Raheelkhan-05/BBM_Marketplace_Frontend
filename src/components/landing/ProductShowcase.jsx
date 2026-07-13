import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { showcaseProducts } from "../../../data/content";

export default function ProductShowcase() {
  const [active, setActive] = useState(0);

  const handleDrag = (_, info) => {
    if (info.offset.x < -60 && active < showcaseProducts.length - 1) {
      setActive((a) => a + 1);
    } else if (info.offset.x > 60 && active > 0) {
      setActive((a) => a - 1);
    }
  };

  return (
    <div className="mt-6">
      {/* Mobile: single-image swipeable carousel, mirrors reference screen */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-100 to-slate-50 lg:hidden">
        <motion.div
          className="flex"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDrag}
          animate={{ x: `-${active * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {showcaseProducts.map((p) => (
            <div key={p.id} className="w-full shrink-0 px-6 py-10">
              <img
                src={p.src}
                alt={p.alt}
                className="mx-auto h-56 w-full max-w-sm object-contain drop-shadow-xl"
                draggable={false}
              />
            </div>
          ))}
        </motion.div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {showcaseProducts.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: static showcase grid */}
      <div className="hidden lg:grid lg:grid-cols-4 lg:gap-5">
        {showcaseProducts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            whileHover={{ y: -6 }}
            className="flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-b from-slate-100 to-slate-50 p-6"
          >
            <img
              src={p.src}
              alt={p.alt}
              className="h-full w-full object-contain drop-shadow-lg"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}