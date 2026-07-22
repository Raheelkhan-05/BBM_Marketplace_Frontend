// components/auth/IdentifierStep.jsx
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Mail, Phone, CheckCircle2 } from "lucide-react";
import { identifierType } from "../../utils/validators";

function detectMode(raw) {
  if (!raw) return null;
  return /[a-zA-Z@]/.test(raw) ? "email" : "phone";
}

// Strips a pasted "+91 98765 43210" / "91-98765-43210" down to the 10 digits.
function normalizePhonePaste(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(0, 10);
}

export default function IdentifierStep({ identifier, onSubmit, loading, serverError }) {
  const [value, setValue] = useState(identifier || "");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false); // guards against double-submit (dbl-click, StrictMode, fast Enter)

  const mode = detectMode(value);
  const valid = identifierType(value) !== null;
  const showError = touched && value.length > 0 && !valid;
  const describedBy = showError ? "identifier-error" : serverError ? "identifier-server-error" : undefined;

  const handleChange = (e) => {
    const raw = e.target.value;
    const nextMode = detectMode(raw);
    setValue(nextMode === "phone" ? raw.replace(/\D/g, "").slice(0, 10) : raw);
    setSubmitted(false);
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (detectMode(text) === "phone") {
      e.preventDefault();
      setValue(normalizePhonePaste(text));
      setSubmitted(false);
    }
    // email pastes fall through to default paste behavior
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading || inFlight.current) return;
    inFlight.current = true;
    setSubmitted(true);
    Promise.resolve(onSubmit(value)).finally(() => {
      inFlight.current = false;
    });
  };

  return (
    <motion.form
      key="identifier"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col"
    >
      <h1
        className="text-[clamp(1.35rem,3.6vw,1.75rem)] font-extrabold leading-[1.15] text-slate-900"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        Log in or create an account
      </h1>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500 sm:text-[13.5px]">
        One account to buy and sell. We&apos;ll send you a one-time code — no password to remember.
      </p>

      <label htmlFor="identifier" className="mt-6 text-[12px] font-bold text-slate-600">
        Mobile number or email
      </label>

      <div
        className="mt-2 flex w-full items-center overflow-hidden rounded-xl border-2 bg-white transition-colors duration-150 focus-within:ring-4"
        style={{
          borderColor: showError || serverError ? "#c71f11" : "#e2e8f0",
          ...(!showError && !serverError && { "--tw-ring-color": "rgba(199,31,17,0.08)" }),
        }}
      >
        <span className="flex shrink-0 items-center gap-1.5 border-r border-slate-100 px-3 py-3 text-[13.5px] font-bold text-slate-500 sm:px-3.5 sm:py-3.5">
          {mode === null && (
            <>
              <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </>
          )}
          {mode === "phone" && (
            <>
              <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              +91
            </>
          )}
          {mode === "email" && <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
        </span>
        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          disabled={loading}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          placeholder="98765 43210 or you@company.com"
          aria-invalid={showError || !!serverError}
          aria-describedby={describedBy}
          className="w-full min-w-0 bg-transparent px-3 py-3 text-[15px] font-semibold tracking-wide text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none disabled:opacity-60 sm:px-3.5 sm:py-3.5"
        />
      </div>

      <div className="mt-1.5 min-h-[16px]" role="status" aria-live="polite">
        {showError && (
          <p id="identifier-error" className="text-[12px] font-semibold text-[#c71f11]">
            Enter a valid 10-digit mobile number or email address.
          </p>
        )}
        {!showError && serverError && (
          <p id="identifier-server-error" className="text-[12px] font-semibold text-[#c71f11]">
            {serverError}
          </p>
        )}
        {!showError && !serverError && submitted && (
          <p className="flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Sending your code via {mode === "email" ? "email" : "SMS"}…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Code sent via {mode === "email" ? "email" : "SMS"} to{" "}
                {mode === "phone" ? `+91 ${value}` : value}.
              </>
            )}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!valid || loading}
        aria-busy={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending OTP…
          </>
        ) : (
          <>
            Send OTP
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 sm:text-[11.5px]">
        By continuing, you agree to our{" "}
        <a href="/terms" className="font-semibold text-slate-500 underline underline-offset-2">Terms</a>{" "}
        and{" "}
        <a href="/privacy" className="font-semibold text-slate-500 underline underline-offset-2">Privacy Policy</a>.
      </p>
    </motion.form>
  );
}