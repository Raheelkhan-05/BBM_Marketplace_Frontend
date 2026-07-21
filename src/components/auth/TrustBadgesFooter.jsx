// components/auth/TrustBadgesFooter.jsx

import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "GST-verified sellers" },
  { icon: Lock, label: "256-bit encrypted" },
  { icon: BadgeCheck, label: "Escrow-backed payments" },
];

export default function TrustBadgesFooter() {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {BADGES.map(({ icon: Icon, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
          <Icon className="h-3.5 w-3.5 text-[#047084]" />
          {label}
        </span>
      ))}
    </div>
  );
}