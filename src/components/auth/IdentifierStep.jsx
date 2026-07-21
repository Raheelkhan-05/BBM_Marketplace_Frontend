// components/auth/IdentifierStep.jsx — replaces PhoneStep.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { identifierType } from "../../utils/validators";

export default function IdentifierStep({ identifier, onSubmit, loading, serverError }) {
  const [mode, setMode] = useState(identifierType(identifier) === "email" ? "email" : "phone");
  const [value, setValue] = useState(identifier || "");
  const [touched, setTouched] = useState(false);

  const type = identifierType(mode === "phone" ? value : value);
  const valid = mode === "phone" ? /^[6-9]\d{9}$/.test(value) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const showError = touched && value.length > 0 && !valid;

  const handleChange = (e) => {
    if (mode === "phone") {
      setValue(e.target.value.replace(/\D/g, "").slice(0, 10));
    } else {
      setValue(e.target.value);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setValue("");
    setTouched(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading) return;
    onSubmit(value);
  };

  return (
    <motion.form
      key="identifier"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="flex flex-col"
    >
      <h1
        className="text-[26px] font-extrabold leading-tight text-slate-900 sm:text-[28px]"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        Log in or create an account
      </h1>
      <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
        One account to buy and sell. We'll send you a one-time code — no password to remember.
      </p>

      <div className="mt-6 inline-flex w-fit rounded-lg bg-slate-100 p-1">
        {[
          { key: "phone", label: "Phone", icon: Phone },
          { key: "email", label: "Email", icon: Mail },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={{
              backgroundColor: mode === key ? "#ffffff" : "transparent",
              color: mode === key ? "#047084" : "#94a3b8",
              boxShadow: mode === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="identifier" className="mt-5 text-[12px] font-bold text-slate-600">
        {mode === "phone" ? "Mobile number" : "Email address"}
      </label>

      {mode === "phone" ? (
        <div
          className="mt-2 flex items-center overflow-hidden rounded-xl border-2 bg-white transition-colors"
          style={{ borderColor: showError ? "#c71f11" : "#e2e8f0" }}
        >
          <span className="flex items-center gap-1.5 border-r border-slate-100 px-3.5 py-3.5 text-[13.5px] font-bold text-slate-500">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            +91
          </span>
          <input
            id="identifier"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            value={value}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="98765 43210"
            className="w-full bg-transparent px-3.5 py-3.5 text-[15px] font-semibold tracking-wide text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
          />
        </div>
      ) : (
        <input
          id="identifier"
          type="email"
          autoComplete="email"
          autoFocus
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="you@company.com"
          className="mt-2 rounded-xl border-2 bg-white px-3.5 py-3.5 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
          style={{ borderColor: showError ? "#c71f11" : "#e2e8f0" }}
        />
      )}

      {showError && (
        <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">
          {mode === "phone" ? "Enter a valid 10-digit mobile number." : "Enter a valid email address."}
        </p>
      )}
      {serverError && (
        <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={!valid || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        {loading ? "Sending code…" : `Send ${mode === "phone" ? "SMS" : "email"} code`}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-400">
        By continuing, you agree to our{" "}
        <a href="/terms" className="font-semibold text-slate-500 underline underline-offset-2">Terms</a>{" "}
        and{" "}
        <a href="/privacy" className="font-semibold text-slate-500 underline underline-offset-2">Privacy Policy</a>.
      </p>
    </motion.form>
  );
}