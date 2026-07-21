// components/auth/ContactDetailsStep.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { requestContactOtp, verifyContactOtp } from "../../utils/api";

// Inline verify widget for whichever contact field ISN'T the login
// identifier. Three states: idle (input + "Verify" button) -> otp (6-digit
// code entry) -> verified (locked, green check). Verification writes
// straight to `profiles` on the backend the moment the code is confirmed,
// so there's nothing left for the parent form to do with this value.
function VerifiableField({ token, field, label, placeholder, inputMode, formatValue, validate }) {
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("idle"); // idle | sending | otp | verifying | verified
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);

  const valid = validate(value);

  const sendCode = async () => {
    if (!valid) return;
    setError(null);
    setStage("sending");
    const res = await requestContactOtp(token, field, value);
    if (!res.success) {
      setError(res.message || "Couldn't send the code.");
      setStage("idle");
      return;
    }
    setStage("otp");
  };

  const confirmCode = async () => {
    if (otp.length !== 6) return;
    setError(null);
    setStage("verifying");
    const res = await verifyContactOtp(token, field, value, otp);
    if (!res.success) {
      setError(res.message || "That code didn't match.");
      setStage("otp");
      return;
    }
    setStage("verified");
  };

  if (stage === "verified") {
    return (
      <div className="flex flex-col">
        <label className="text-[12px] font-bold text-slate-600">{label}</label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-[#7fb3bd] bg-[#047084]/5 px-3.5 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047084]" />
          <span className="truncate text-[14px] font-semibold text-slate-800">{formatValue(value)}</span>
          <span className="ml-auto shrink-0 text-[11px] font-bold text-[#047084]">Verified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <label className="text-[12px] font-bold text-slate-600">
        {label} <span className="font-medium text-slate-400">(optional — verify to add)</span>
      </label>

      {stage !== "otp" && stage !== "verifying" ? (
        <div className="mt-2 flex gap-2">
          <input
            inputMode={inputMode}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={stage === "sending"}
            className="w-full min-w-0 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={!valid || stage === "sending"}
            className="shrink-0 rounded-xl px-4 py-3 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#047084" }}
          >
            {stage === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="w-full min-w-0 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[14.5px] font-semibold tracking-widest text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={confirmCode}
            disabled={otp.length !== 6 || stage === "verifying"}
            className="shrink-0 rounded-xl px-4 py-3 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#047084" }}
          >
            {stage === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">{error}</p>}
    </div>
  );
}

export default function ContactDetailsStep({ token, identifier, loginType, onSubmit, loading, serverError }) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [touched, setTouched] = useState(false);

  // Every account is both buyer and seller now, so contact person +
  // designation are always required (they used to be seller-only).
  const canSubmit = name.trim().length >= 2 && designation.trim().length >= 2;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) return;
    onSubmit({ name: name.trim(), designation: designation.trim() });
  };

  return (
    <motion.form
      key="contact"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="flex w-full flex-col"
    >
      <h1
        className="text-[clamp(1.35rem,3.6vw,1.75rem)] font-extrabold leading-[1.15] text-slate-900"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        Who should we contact?
      </h1>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500 sm:text-[13.5px]">
        This is required — buyers and sellers will both see it on your account.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <Field label="Contact person">
          <input
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rohan Mehta"
            className={inputClass(touched && name.trim().length < 2)}
          />
        </Field>

        <Field label="Designation">
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Sales Manager"
            className={inputClass(touched && designation.trim().length < 2)}
          />
        </Field>

        {/* Whichever of email/phone was used to log in is already verified
            by definition — only show a verify flow for the other one. */}
        {loginType === "phone" && (
          <VerifiableField
            token={token}
            field="email"
            label="Email"
            placeholder="you@company.com"
            inputMode="email"
            formatValue={(v) => v}
            validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
          />
        )}
        {loginType === "email" && (
          <VerifiableField
            token={token}
            field="phone"
            label="WhatsApp / mobile number"
            placeholder="98765 43210"
            inputMode="numeric"
            formatValue={(v) => `+91 ${v}`}
            validate={(v) => /^[6-9]\d{9}$/.test(v)}
          />
        )}
      </div>

      {serverError && <p className="mt-3 text-[12px] font-semibold text-[#c71f11]">{serverError}</p>}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        {loading ? "Saving…" : "Continue"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </motion.form>
  );
}

function Field({ label, className = "", children }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-[12px] font-bold text-slate-600">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function inputClass(error) {
  return `w-full min-w-0 rounded-xl border-2 bg-white px-3.5 py-3 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none sm:py-3.5 ${error ? "border-[#c71f11]" : "border-slate-200"}`;
}