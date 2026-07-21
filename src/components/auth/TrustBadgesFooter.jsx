// components/auth/TrustBadgesFooter.jsx

import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "GST-verified sellers" },
  { icon: Lock, label: "256-bit encrypted" },
  { icon: BadgeCheck, label: "Escrow-backed payments" },
];

export default function TrustBadgesFooter() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2 sm:mt-5 sm:gap-x-5">
      {BADGES.map(({ icon: Icon, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 sm:text-[11.5px]">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#047084]" />
          {label}
        </span>
      ))}
    </div>
  );
}