// components/home/StartSellingBanner.jsx
import { motion } from "framer-motion";
import { Store, ArrowRight, Clock3, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function StartSellingBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const status = profile?.seller_status; // undefined/null | "draft" | "pending_review" | "approved" | "rejected"

  if (status === "approved") return null; // already a seller — no banner

  const CONFIG = {
    draft: {
      icon: Clock3,
      title: "Finish setting up your shop",
      sub: "You're a few steps away from going live to buyers.",
      cta: "Continue setup",
    },
    pending_review: {
      icon: Clock3,
      title: "Your shop is under review",
      sub: "Our team is verifying your details — usually within 24-48 hours.",
      cta: "View status",
    },
    rejected: {
      icon: Clock3,
      title: "Action needed on your shop details",
      sub: "A few details need updating before we can approve your shop.",
      cta: "Review & resubmit",
    },
  };
  const c = CONFIG[status] || {
    icon: Store,
    title: "Start selling on BBM",
    sub: "Set up your seller shop and reach verified buyers across the marketplace.",
    cta: "Start selling",
  };
  const Icon = c.icon;

  return (
    <motion.button
      onClick={() => navigate("/seller/onboarding")}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.4 }}
      className="mt-4 flex w-full items-center gap-3.5 overflow-hidden rounded-xl border px-4 py-4 text-left sm:px-5"
      style={{
        borderColor: "rgba(210,70,43,0.18)",
        background: "linear-gradient(120deg, rgba(210,70,43,0.08) 0%, rgba(210,70,43,0.02) 50%, #ffffff 100%)",
        boxShadow: "0 1px 2px rgba(210,70,43,0.06), 0 10px 24px -14px rgba(210,70,43,0.3)",
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight text-slate-900 sm:text-[15px]">{c.title}</p>
        <p className="mt-0.5 text-[12px] font-medium leading-tight text-slate-500 sm:text-[12.5px]">{c.sub}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-white sm:flex"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
        {c.cta} <ArrowRight className="h-3.5 w-3.5" />
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#d2462b] sm:hidden" />
    </motion.button>
  );
}