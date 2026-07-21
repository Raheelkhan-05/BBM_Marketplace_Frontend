// components/auth/AuthNavHeader.jsx — new
import { CheckCircle2, HelpCircle } from "lucide-react";

export default function AuthNavHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6 lg:px-8">
      <a href="/" className="inline-flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-extrabold text-slate-900">BBM</span>
      </a>

      <nav className="flex items-center gap-5">
        <a href="/marketplace" className="hidden text-[12.5px] font-semibold text-slate-500 hover:text-slate-800 sm:inline">
          Browse marketplace
        </a>
        <a href="/pricing" className="hidden text-[12.5px] font-semibold text-slate-500 hover:text-slate-800 sm:inline">
          Pricing
        </a>
        <a
          href="/support"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-800"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </a>
      </nav>
    </header>
  );
}