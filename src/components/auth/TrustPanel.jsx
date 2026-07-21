// components/auth/TrustPanel.jsx
//
// The signature element for the auth experience: a live-looking
// verification ledger paired with real marketplace scale — the two
// things an enterprise buyer or GST-registered seller actually wants
// reassurance on before handing over a phone number.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, FileCheck2, ShieldCheck, Sparkles, Quote } from "lucide-react";

const LEDGER_STEPS = [
  { id: "phone", label: "Phone number", icon: Phone },
  { id: "gstin", label: "GSTIN structure", icon: FileCheck2 },
  { id: "compliance", label: "Compliance record", icon: ShieldCheck },
];

const STATS = [
  { value: "12,400+", label: "Verified suppliers" },
  { value: "\u20b9480Cr+", label: "Traded on platform" },
  { value: "28", label: "States covered" },
];

const TESTIMONIALS = [
  { quote: "Cut our procurement time in half \u2014 every supplier here is GST-verified before we even talk.", author: "Priya Nair", role: "Ops Lead, Coastline Textiles" },
  { quote: "Opened a shop with the same login I used to buy raw material. Took ten minutes.", author: "Arvind Rao", role: "Founder, Rao Alloys" },
  { quote: "Escrow payments mean we ship first-time buyers without the usual back-and-forth.", author: "Meera Shah", role: "Sales Head, Vertex Bearings" },
];

const CYCLE_MS = 1800;
const TESTIMONIAL_MS = 4200;

export default function TrustPanel() {
  const [checked, setChecked] = useState(0);
  const [activeQuote, setActiveQuote] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setChecked((prev) => (prev + 1) % (LEDGER_STEPS.length + 1));
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveQuote((prev) => (prev + 1) % TESTIMONIALS.length);
    }, TESTIMONIAL_MS);
    return () => clearInterval(id);
  }, []);

  const testimonial = TESTIMONIALS[activeQuote];

  return (
    <div
      className="relative hidden h-full w-full flex-col overflow-hidden rounded-[28px] px-9 py-8 lg:flex xl:px-11"
      style={{ background: "linear-gradient(160deg, #047084 0%, #035c6c 55%, #023f4b 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(127,179,189,0.35) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(210,70,43,0.18) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-1 flex-col justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            One account, both sides of the deal
          </span>

          <h2
            className="mt-5 max-w-xs text-3xl font-extrabold leading-[1.15] text-white xl:text-[2.1rem]"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            Buy today. List tomorrow. Same login.
          </h2>
          <p className="mt-3 max-w-[19rem] text-[13px] font-medium leading-relaxed text-white/70">
            Every account can source materials and open a storefront \u2014 we just
            verify a bit more once you're ready to sell.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 border-y border-white/10 py-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-[17px] font-extrabold text-white xl:text-[19px]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  {s.value}
                </p>
                <p className="mt-0.5 text-[10.5px] font-medium leading-tight text-white/55">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[92px] rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
          <Quote className="absolute right-4 top-4 h-5 w-5 text-white/15" />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeQuote}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              <p className="pr-6 text-[12.5px] font-medium italic leading-relaxed text-white/85">
                "{testimonial.quote}"
              </p>
              <p className="mt-2 text-[11.5px] font-bold text-white">
                {testimonial.author}
                <span className="ml-1.5 font-medium text-white/50">\u2014 {testimonial.role}</span>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            What we check, in order
          </p>
          <div className="mt-3.5 flex flex-col gap-3">
            {LEDGER_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = i < checked;
              const isActive = i === checked;
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <span
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-500"
                    style={{
                      backgroundColor: isDone ? "#d2462b" : "rgba(255,255,255,0.08)",
                      color: isDone ? "#ffffff" : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0.6, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.7 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.1, repeat: Infinity }}
                          className="absolute inset-0 rounded-full border border-white/40"
                        />
                      )}
                    </AnimatePresence>
                  </span>
                  <span
                    className="text-[12.5px] font-semibold transition-colors duration-500"
                    style={{ color: isDone ? "#ffffff" : "rgba(255,255,255,0.55)" }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}    