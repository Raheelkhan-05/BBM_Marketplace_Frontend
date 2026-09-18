// pages/AuthPage.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Loader2, Mail, Phone, CheckCircle2, Pencil,
  Building2, Handshake, ArrowLeft, User,
} from "lucide-react";

import SmartLink from "../components/SmartLink.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  requestOtp, verifyOtp, completeProfile,
  requestContactOtp, verifyContactOtp, lookupGstin,
  fetchMe, saveProgress,
} from "../utils/api.js";

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const STEPS = ["identifier", "otp", "onboarding", "done"];

function detectChannel(raw) {
  if (!raw) return null;
  if (PHONE_RE.test(raw)) return "phone";
  if (EMAIL_RE.test(raw)) return "email";
  return null;
}
function detectMode(raw) {
  if (!raw) return null;
  return /[a-zA-Z@]/.test(raw) ? "email" : "phone";
}
function normalizePhonePaste(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(0, 10);
}
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
function isValidGstinShape(v) {
  return v.length === 15 && GSTIN_FORMAT.test(v);
}

// ---------------------------------------------------------------------------
// Shared design tokens — restyled to match the marketing-page look: ink
// black headings/buttons, muted slate copy, a single teal accent (from the
// logo) reserved for focus states / links, generous letter-spacing on all
// caps labels.
// ---------------------------------------------------------------------------
const FONT = "'Amazon Ember', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const INK = "#0B1116";
const BRAND = "#047084";
const BRAND_SOFT = "rgba(4,112,132,0.07)";

function inputClass(error) {
  return `w-full min-w-0 rounded-2xl border bg-white px-4 py-3 text-[15px] font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-300 transition-[border-color,box-shadow] focus:outline-none focus:ring-[3px] ${error
    ? "border-[#c71f11] focus:ring-[#c71f11]/10"
    : "border-slate-200 focus:border-slate-400 focus:ring-slate-400/10"
    }`;
}

function PrimaryButton({ children, loading, loadingText, className = "", ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#12181d] px-5 text-[15px] font-bold tracking-wide text-white transition-[background-color,opacity,transform] duration-150 hover:bg-[#0B1116] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15.5px] ${className}`}
      {...rest}
    >
      {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />{loadingText || "Please wait…"}</>) : children}
    </motion.button>
  );
}

function SecondaryButton({ children, loading, className = "", ...rest }) {
  return (
    <button
      className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold tracking-wide transition-[background-color,opacity] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{ color: BRAND, background: BRAND_SOFT }}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function PanelHeader({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white sm:h-[50px] sm:w-[50px]"
        style={{ background: INK }}
      >
        {icon}
      </span>
      <h1 className="mt-4 text-[24px] font-black leading-[1.08] tracking-tight sm:text-[26px]" style={{ color: INK }}>
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-[330px] text-[13.5px] font-medium leading-relaxed text-slate-500 sm:text-[14px]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Shared centered shell for the OTP / onboarding steps — normal page flow
// with compact, responsive spacing and no fixed/sticky footer.
function AuthShell({ children, footer, wide = false }) {
  return (
    <main className={`mx-auto w-full ${wide ? "max-w-[560px]" : "max-w-[430px]"} px-4 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-10`}>
      {children}
      {footer && <div className="mt-7 sm:mt-8">{footer}</div>}
    </main>
  );
}

export default function AuthPage() {
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState(null);
  const [loginType, setLoginType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setAuthSession, refreshProfile, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNewUser, setIsNewUser] = useState(null);

  const redirectTo = location.state?.from || "/home";

  const handleBack = () => {
    if (step === "identifier") {
      // React Router v6 stamps history.state.idx = 0 on the entry point of
      // the app's history stack — if that's us, navigate(-1) would leave
      // the app entirely (e.g. land on about:blank) instead of going back
      // to a real previous page.
      if (window.history.state?.idx === 0) {
        navigate("/");
      } else {
        navigate(-1);
      }
    } else if (step === "otp") {
      setStep("identifier");
    }
    // no back action from "onboarding" — user is already authenticated
  };

  const withLoading = useCallback(async (fn) => {
    setError(null);
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIdentifierSubmit = (value) =>
    withLoading(async () => {
      const res = await requestOtp(value);
      if (!res.success) return setError(res.message || "Couldn't send the code. Try again.");
      setIdentifier(value);
      setLoginType(res.channel || detectChannel(value));
      setStep("otp");
    });

  const handleOtpVerify = (code) =>
    withLoading(async () => {
      const res = await verifyOtp(identifier, code);
      if (!res.success) return setError(res.message || "That code didn't match. Check and try again.");
      setToken(res.token);
      // This is the fix: session must be set in the { access_token } shape
      // AuthContext expects, or isLoggedIn (and every protected route) stays
      // false even though the user is fully authenticated.
      await setAuthSession?.(res.token);
      setIsNewUser(res.isNewUser);
      // setStep(res.isNewUser ? "onboarding" : "done");
      if (res.isNewUser) {
        setStep("onboarding");
      } else {
        navigate(redirectTo);
      }
    });

  // FIX: this used to be "fire and forget" — requestOtp(identifier) with no
  // await, no loading state, and no error surfaced. If the resend call
  // failed (rate limit, network blip, provider hiccup), the OtpPanel timer
  // still restarted as if it worked, so the user just saw a silently
  // "broken" resend button with no code ever arriving. Now it goes through
  // withLoading (so serverError renders in OtpPanel) and returns whether it
  // actually succeeded so the panel only resets its countdown on success.
  const handleResend = () =>
    withLoading(async () => {
      const res = await requestOtp(identifier);
      if (!res.success) {
        setError(res.message || "Couldn't resend the code. Try again.");
        return false;
      }
      return true;
    });

  const handleOnboardingSubmit = (payload) =>
    withLoading(async () => {
      const res = await completeProfile(token, payload);
      if (!res.success) return setError(res.message || "Couldn't save your details. Try again.");
      await refreshProfile?.();
      // setStep("done");
      navigate(redirectTo);
    });

  return (
    <div className="min-h-screen w-full bg-white" style={{ fontFamily: FONT }}>
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          {step !== "onboarding" ? (
            <motion.button
              type="button"
              onClick={handleBack}
              whileTap={{ scale: 0.9 }}
              aria-label="Go back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </motion.button>
          ) : (
            <div className="h-9 w-9 shrink-0" />
          )}

          <div className="flex shrink-0 items-center">
            <SmartLink to="/" className="flex shrink-0 items-center gap-2">
              <img src="/Logo.png" alt="BBM" className="h-7 w-auto object-contain" />
              <h1
                className="text-[18px] font-extrabold tracking-wide"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: INK }}
              >
                BBM
              </h1>
            </SmartLink>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === "identifier" && (
          <IdentifierPanel key="identifier" onSubmit={handleIdentifierSubmit} loading={loading} serverError={error} />
        )}
        {step === "otp" && (
          <OtpPanel
            key="otp" identifier={identifier} onVerify={handleOtpVerify} onResend={handleResend}
            onEditNumber={() => setStep("identifier")} loading={loading} serverError={error}
          />
        )}
        {step === "onboarding" && (
          <OnboardingPanel
            key="onboarding" token={token} loginType={loginType} profile={profile}
            onSubmit={handleOnboardingSubmit} loading={loading} serverError={error}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value-prop content shown under the identifier form — plain data, kept
// separate from markup so the two columns render identically.
// ---------------------------------------------------------------------------
const BUY_POINTS = ["Competitive B2B prices", "More suppliers to choose from", "More brands & alternatives", "Faster product discovery", "Better sourcing options", "Access to new suppliers", "Simplified procurement", "Multiple requirements, one platform"];
const SELL_POINTS = ["Get new customers", "Increase sales", "Expand into new markets", "Reduce customer acquisition effort", "Showcase your complete product range", "Build long-term B2B relationships", "Grow without opening new branches"];

function ValueColumn({ eyebrow, heading, points }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">{eyebrow}</p>
      <h2 className="mt-2 text-[20px] font-black leading-[1.15] tracking-tight text-slate-900 sm:text-[24px]">
        {heading}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:gap-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[13px] font-medium leading-snug tracking-wide text-slate-500 sm:text-[13.5px]">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: identifier — this is the landing page from the reference screen.
// Same logic/handlers as before; only the markup is new.
// ---------------------------------------------------------------------------
function IdentifierPanel({ onSubmit, loading, serverError }) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [confirmingCall, setConfirmingCall] = useState(false);
  const inFlight = useRef(false);

  const mode = detectMode(value);
  const valid = detectChannel(value) !== null;
  const showError = touched && value.length > 0 && !valid;

  const handleChange = (e) => {
    const raw = e.target.value;
    const nextMode = detectMode(raw);
    setValue(nextMode === "phone" ? raw.replace(/\D/g, "").slice(0, 10) : raw);
    setConfirmingCall(false);
  };
  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (detectMode(text) === "phone") {
      e.preventDefault();
      setValue(normalizePhonePaste(text));
    }
  };

  const fireSubmit = () => {
    if (!valid || loading || inFlight.current) return;
    inFlight.current = true;
    Promise.resolve(onSubmit(value)).finally(() => (inFlight.current = false));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading) return;
    // Phone OTPs are delivered via a call, not silently — confirm with the
    // user before we trigger it, rather than surprising them with a ring.
    if (detectChannel(value) === "phone" && !confirmingCall) {
      setConfirmingCall(true);
      return;
    }
    fireSubmit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
        <div className="max-w-[720px]">
          {/* ---- hero ---- */}
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[11.5px]">
            Trusted B2B Marketplace
          </p>
          <h1 className="mt-3 text-[40px] font-black leading-[1.03] tracking-[-0.030em] text-slate-900 sm:text-[54px] lg:text-[60px]">
            Buy better.<br />Sell further.
          </h1>
          <p className="mt-4 max-w-[410px] text-[17px] font-medium leading-[1.3] text-slate-500 sm:text-[18px] tracking-wide">
            Join thousands of businesses on BBM. Verified. Simple. Built for business.
          </p>

          {/* ---- identifier form ---- */}
          <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-[440px] sm:mt-9">
            <label htmlFor="identifier" className="text-[14px] font-bold tracking-normal text-slate-700">
              Mobile number or email
            </label>

            <div
              className="mt-1 flex min-h-[52px] w-full items-center overflow-hidden rounded-md border bg-white transition-[border-color,box-shadow] duration-150"
              style={{
                borderColor: showError || serverError ? "#c71f11" : focused ? "#94a3b8" : "#e5e9ea",
                boxShadow: focused ? "0 0 0 3px rgba(148,163,184,0.15)" : "none",
              }}
            >
              <span className="flex shrink-0 items-center gap-1.5 pl-4 pr-2.5 text-slate-400">
                {mode === null && <User className="h-4 w-4" />}
                {mode === "phone" && (
                  <>
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-[14px] font-bold tracking-wide text-slate-500">+91</span>
                  </>
                )}
                {mode === "email" && <Mail className="h-4 w-4" />}
              </span>
              <input
                id="identifier" type="text" autoComplete="username" autoFocus disabled={loading}
                value={value} onChange={handleChange} onPaste={handlePaste}
                onFocus={() => setFocused(true)}
                onBlur={() => { setFocused(false); setTouched(true); }}
                placeholder="98765 43210 or you@company.com"
                className="w-full min-w-0 bg-transparent py-3.5 pr-4 text-[15px] font-medium tracking-wide text-slate-800 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="mt-1.5 min-h-[18px]">
              {showError && <p className="text-[12px] font-medium tracking-wide text-[#c71f11]">Enter a valid 10-digit mobile number or email address.</p>}
              {!showError && serverError && <p className="text-[12px] font-medium tracking-wide text-[#c71f11]">{serverError}</p>}
            </div>

            <AnimatePresence mode="wait">
              {confirmingCall && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-0 mb-5 flex items-start gap-3 overflow-hidden"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <Phone className="h-4 w-4 text-slate-700" />
                  </span>
                  <p className="text-[13.5px] font-medium leading-relaxed tracking-wide text-slate-500">
                    <span className="block text-[14px] font-bold tracking-wide text-slate-900">
                      We'll call you at +91 {value}
                    </span>
                    and share a one-time code to verify your number. Please keep your phone nearby.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <PrimaryButton type="submit" disabled={!valid || loading} loading={loading} loadingText="Sending OTP…" className="mt-0">
              {confirmingCall ? (<>Yes, call me<ArrowRight className="h-4 w-4" /></>) : (<>Send OTP<ArrowRight className="h-4 w-4" /></>)}
            </PrimaryButton>

            <p className="mt-3.5 max-w-[390px] text-[11.5px] text-center font-medium leading-relaxed tracking-wide text-slate-400">
              By continuing, you agree to our{" "}
              <a href="/terms" className="font-bold tracking-wide text-slate-500 underline hover:text-slate-800">Terms</a>{" "}
              and{" "}
              <a href="/privacy" className="font-bold tracking-wide text-slate-500 underline hover:text-slate-800">Privacy Policy</a>.
            </p>
          </form>

          {/* ---- value props ---- */}

          <div className="relative mt-11 grid grid-cols-2 gap-1 sm:mt-11 sm:gap-10 lg:gap-16">
            <div className="pr-4 sm:pr-6 lg:pr-8">
              <ValueColumn
                eyebrow="Why buy from BBM"
                heading={<>Save Money.<br />Save Time.</>}
                points={BUY_POINTS}
              />
            </div>

            <div className="pl-4 sm:pl-6 lg:pl-8">
              <ValueColumn
                eyebrow="Why sell on BBM"
                heading={<>More buyers.<br />More business.</>}
                points={SELL_POINTS}
              />
            </div>

            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200" />
          </div>
        </div>
      </main>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: OTP entry
// ---------------------------------------------------------------------------
function OtpBoxes({ length = OTP_LENGTH, onComplete, error, disabled }) {
  const [digits, setDigits] = useState(Array(length).fill(""));
  const inputsRef = useRef([]);

  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < length - 1) inputsRef.current[i + 1]?.focus();
    if (digit && i === length - 1 && next.every(Boolean)) onComplete(next.join(""));
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, length) - 1]?.focus();
    if (pasted.length === length) onComplete(pasted);
  };

  // Clear the boxes whenever a new code is requested (e.g. after Resend),
  // so stale digits from a failed attempt don't linger on screen.
  useEffect(() => {
    if (!disabled) {
      setDigits(Array(length).fill(""));
      inputsRef.current[0]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-[410px]">
        <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
          {digits.map((d, i) => (
            <input
              key={i} ref={(el) => (inputsRef.current[i] = el)} type="text" inputMode="numeric" maxLength={1}
              value={d} disabled={disabled}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className="aspect-square w-full min-w-0 rounded-2xl border text-center text-[19px] font-bold text-slate-800 transition-[border-color,background-color,box-shadow] focus:outline-none focus:ring-[3px] focus:ring-slate-400/10 disabled:opacity-60"
              style={{
                borderColor: error ? "#c71f11" : d ? "#94a3b8" : "#e5e9ea",
                background: d ? "#f8fafc" : "white",
              }}
            />
          ))}
        </div>
        {disabled && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold tracking-wide shadow-sm text-slate-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying…
            </span>
          </motion.div>
        )}
      </div>
      {error && <p className="mt-2.5 text-[12px] font-medium tracking-wide text-[#c71f11]">{error}</p>}
    </div>
  );
}

function OtpPanel({ identifier, onVerify, onResend, onEditNumber, loading, serverError }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [justResent, setJustResent] = useState(false);
  const channel = detectChannel(identifier);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // FIX: previously this just called onResend() and reset the 30s timer
  // unconditionally — even if the resend request actually failed, the
  // button would disappear behind the countdown as if a new code had gone
  // out. Now the countdown only restarts on a confirmed success, and the
  // button is disabled + shows a spinner while the request is in flight so
  // it can't be double-tapped.
  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setJustResent(false);
    try {
      const ok = await onResend();
      if (ok !== false) {
        setSecondsLeft(RESEND_SECONDS);
        setJustResent(true);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <AuthShell>
        <PanelHeader
          icon={channel === "email" ? <Mail className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
          title="Enter the code"
          subtitle={
            <>
              <span className="break-all">Sent to {channel === "email" ? identifier : `+91 ${identifier}`}.</span>{" "}
              <button type="button" onClick={onEditNumber} className="inline-flex items-center gap-1 font-bold tracking-wide" style={{ color: BRAND }}>
                <Pencil className="h-3 w-3" />Edit
              </button>
            </>
          }
        />

        <div className="mt-7 sm:mt-8">
          <OtpBoxes onComplete={(code) => !loading && onVerify(code)} error={serverError} disabled={loading} />
        </div>

        <div className="mt-4 flex flex-col items-center gap-1.5 text-center sm:mt-5">
          <p className="text-[12.5px] font-medium tracking-wide text-slate-400">
            {secondsLeft > 0 ? (
              <>Resend code in {secondsLeft}s</>
            ) : (
              <button
                type="button" onClick={handleResend} disabled={resending}
                className="inline-flex items-center gap-1.5 font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: BRAND }}
              >
                {resending ? (<><Loader2 className="h-3 w-3 animate-spin" />Resending…</>) : "Resend code"}
              </button>
            )}
          </p>
          {channel === "phone" && justResent && secondsLeft === RESEND_SECONDS && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide" style={{ color: BRAND }}
            >
              <Phone className="h-3 w-3" />
              We're calling +91 {identifier} again now.
            </motion.p>
          )}
        </div>
      </AuthShell>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: onboarding
// ---------------------------------------------------------------------------
function AltContactVerify({ token, field, label, placeholder, inputMode, formatValue, validate, required, prefillVerifiedValue, onVerified }) {
  const [value, setValue] = useState(prefillVerifiedValue || "");
  const [stage, setStage] = useState(prefillVerifiedValue ? "verified" : "idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefillVerifiedValue) {
      setValue(prefillVerifiedValue);
      setStage("verified");
      onVerified?.(true, prefillVerifiedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillVerifiedValue]);

  const valid = validate(value);
  const isPhoneField = field === "phone";

  const actuallySendCode = async () => {
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

  const sendCode = async () => {
    if (!valid) return;
    // Phone verification here happens via a call — confirm before dialing
    // rather than surprising the user, same as the login identifier step.
    if (isPhoneField && stage !== "confirm") {
      setStage("confirm");
      return;
    }
    await actuallySendCode();
  };

  const confirmCode = async (otp) => {
    setError(null);
    const res = await verifyContactOtp(token, field, value, otp);
    if (!res.success) {
      setError(res.message || "That code didn't match.");
      setStage("otp");
      return;
    }
    setStage("verified");
    onVerified?.(true, value);
  };

  if (stage === "verified") {
    return (
      <div className="flex flex-col">
        <label className="text-[12.5px] font-bold tracking-tight text-slate-700">{label}</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-700" />
          <span className="truncate text-[14px] font-medium tracking-wide text-slate-800">{formatValue(value)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#12181d] px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white">
            Verified
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <label className="text-[12.5px] font-bold tracking-tight text-slate-700">{label}</label>

      {stage !== "otp" ? (
        <>
          <div className="mt-1.5 flex gap-2">
            <input
              inputMode={inputMode} value={value}
              onChange={(e) => { setValue(e.target.value); setStage("idle"); onVerified?.(false, ""); }}
              placeholder={placeholder} disabled={stage === "sending"}
              className={inputClass(false)}
            />
            <SecondaryButton type="button" onClick={sendCode} disabled={!valid || stage === "sending"} loading={stage === "sending"}>
              {stage === "confirm" ? "Yes, call me" : "Verify"}
            </SecondaryButton>
          </div>

          <AnimatePresence>
            {stage === "confirm" && (
              <motion.p
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-start gap-2 overflow-hidden rounded-2xl bg-slate-50 px-3 py-2.5 text-[12px] font-medium leading-relaxed tracking-wide text-slate-600"
              >
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                You'll receive a call on +91 {value} with your code. Tap "Yes, call me" when ready.
              </motion.p>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="mt-2.5 max-w-[280px]">
          <OtpBoxes length={6} onComplete={confirmCode} error={error} />
        </div>
      )}
      {error && stage !== "otp" && <p className="mt-1.5 text-[12px] font-medium tracking-wide text-[#c71f11]">{error}</p>}
    </div>
  );
}

function OnboardingPanel({ token, loginType, profile, onSubmit, loading, serverError }) {
  const [name, setName] = useState(profile?.name || "");

  const [resumed, setResumed] = useState(
    !!(profile?.name || (profile?.phone_verified && loginType !== "phone"))
  );
  const [phoneVerified, setPhoneVerified] = useState(loginType === "phone" || !!profile?.phone_verified);
  const [verifiedPhoneValue, setVerifiedPhoneValue] = useState(profile?.phone_verified ? profile.phone : null);

  const [gstin, setGstin] = useState("");
  const [gstStage, setGstStage] = useState("idle");
  const [gstError, setGstError] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [displayName, setDisplayName] = useState("");

  const [dispatchSame, setDispatchSame] = useState(true);
  const [dispatchAddress, setDispatchAddress] = useState("");
  const [dispatchPincode, setDispatchPincode] = useState("");
  const [dispatchState, setDispatchState] = useState("");

  const [touched, setTouched] = useState(false);

  // Resume any progress from a previous, abandoned onboarding attempt —
  // the user may have verified their phone or typed their name before
  // closing the tab last time.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) return;
      const res = await fetchMe(token);
      if (!mounted || !res?.success) return;
      const p = res.profile;
      if (p.name) setName(p.name);
      if (p.phone_verified && p.phone) {
        setVerifiedPhoneValue(p.phone);
        setPhoneVerified(true);
      }
      if (p.name || (p.phone_verified && loginType !== "phone")) setResumed(true);
    })();
    return () => { mounted = false; };
  }, [token, loginType]);

  // Autosave name so a second abandoned session still resumes.
  const saveName = () => { if (name.trim().length >= 2 && token) saveProgress(token, { name }); };

  const runLookup = async () => {
    if (!isValidGstinShape(gstin)) return;
    setGstStage("looking_up");
    setGstError(null);
    const res = await lookupGstin(token, gstin);
    if (!res.success) {
      setGstError(res.message || "Couldn't verify this GSTIN.");
      setGstStage("error");
      setGstData(null);
      return;
    }
    setGstData(res.data);
    setDisplayName((prev) => prev || res.data.trade_name || res.data.legal_name);
    setGstStage("found");
  };

  const canSubmit =
    name.trim().length >= 2 &&
    phoneVerified &&
    gstStage === "found" &&
    displayName.trim().length >= 2 &&
    (dispatchSame || (dispatchAddress.trim() && dispatchPincode.trim().length === 6 && dispatchState.trim()));

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) return;
    onSubmit({
      name: name.trim(),
      gstin,
      displayName: displayName.trim(),
      dispatchSameAsRegistered: dispatchSame,
      dispatchAddress: dispatchSame ? undefined : dispatchAddress.trim(),
      dispatchPincode: dispatchSame ? undefined : dispatchPincode.trim(),
      dispatchState: dispatchSame ? undefined : dispatchState.trim(),
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22 }} onSubmit={handleSubmit}
    >
      <AuthShell
        wide
        footer={
          <PrimaryButton type="submit" disabled={!canSubmit || loading} loading={loading} loadingText="Saving…">
            Finish setting up<ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        }
      >
        <PanelHeader
          icon={<Building2 className="h-6 w-6" />}
          title="Set up your account"
          subtitle="A few details, then you're in — buying and selling both use this account."
        />

        {resumed && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-5 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-center text-[12.5px] font-bold tracking-wide text-slate-700"
          >
            Welcome back — we picked up where you left off.
          </motion.p>
        )}

        <div className="mt-7 flex flex-col gap-4 pb-1">
          <div className="flex flex-col">
            <label className="text-[12.5px] font-bold tracking-tight text-slate-700">Full name</label>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
              placeholder="e.g. Rohan Mehta" className={`mt-1.5 ${inputClass(touched && name.trim().length < 2)}`}
            />
          </div>

          {/* Phone is always required and verified, regardless of login channel. */}
          <AltContactVerify
            token={token} field="phone" label="Mobile number" placeholder="98765 43210" inputMode="numeric"
            formatValue={(v) => `+91 ${v}`} validate={(v) => PHONE_RE.test(v)} required
            prefillVerifiedValue={verifiedPhoneValue}
            onVerified={(ok) => setPhoneVerified(ok)}
          />

          {loginType === "phone" && (
            <AltContactVerify
              token={token} field="email" label="Email" placeholder="you@company.com" inputMode="email"
              formatValue={(v) => v} validate={(v) => EMAIL_RE.test(v)}
            />
          )}

          {/* GSTIN lookup */}
          <div className="flex flex-col">
            <label className="text-[12.5px] font-bold tracking-tight text-slate-700">GSTIN</label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <input
                  maxLength={15} value={gstin}
                  onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s/g, "")); setGstStage("idle"); setGstData(null); }}
                  placeholder="22AAAAA0000A1Z5"
                  className={`${inputClass(touched && gstin.length === 15 && !isValidGstinShape(gstin))} pr-10 font-mono uppercase tracking-wide`}
                />
                {gstStage === "found" && <CheckCircle2 className="absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-700" />}
              </div>
              <SecondaryButton type="button" onClick={runLookup} disabled={!isValidGstinShape(gstin) || gstStage === "looking_up"} loading={gstStage === "looking_up"}>
                Verify
              </SecondaryButton>
            </div>
            {gstin.length === 15 && !isValidGstinShape(gstin) && <p className="mt-1.5 text-[12px] font-medium tracking-wide text-[#c71f11]">That doesn't match a GSTIN's format.</p>}
            {gstStage === "error" && <p className="mt-1.5 text-[12px] font-medium tracking-wide text-[#c71f11]">{gstError}</p>}
          </div>

          <AnimatePresence>
            {gstStage === "found" && gstData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 gap-x-5 gap-y-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 sm:grid-cols-2"
              >
                <ReadOnlyField label="Legal name" value={gstData.legal_name} />
                <ReadOnlyField label="Trade name" value={gstData.trade_name} />
                <ReadOnlyField label="Status" value={gstData.gstin_status} />
                <ReadOnlyField label="PAN" value={gstData.pan} />
                <ReadOnlyField label="State" value={gstData.state} />
                <ReadOnlyField label="District" value={gstData.district} />
                <ReadOnlyField label="Pincode" value={gstData.pincode} />
                <ReadOnlyField label="Registered address" value={gstData.registered_address} className="sm:col-span-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {gstStage === "found" && (
            <>
              <div className="flex flex-col">
                <label className="text-[12.5px] font-bold tracking-tight text-slate-700">
                  Display name <span className="font-medium tracking-wide text-slate-400">(shown to buyers)</span>
                </label>
                <input
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Mehta Steel"
                  className={`mt-1.5 ${inputClass(touched && displayName.trim().length < 2)}`}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[12.5px] font-bold tracking-tight text-slate-700">Dispatch address</label>
                <label className="mt-2 flex items-center gap-2 text-[13px] font-medium tracking-wide text-slate-600">
                  <input type="checkbox" checked={dispatchSame} onChange={(e) => setDispatchSame(e.target.checked)} className="h-4 w-4 rounded border-slate-300" style={{ accentColor: INK }} />
                  Same as GST registered address
                </label>

                {!dispatchSame && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      value={dispatchAddress} onChange={(e) => setDispatchAddress(e.target.value)} placeholder="Dispatch address"
                      className={`${inputClass(touched && !dispatchAddress.trim())} sm:col-span-2`}
                    />
                    <input
                      value={dispatchPincode} onChange={(e) => setDispatchPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Pincode"
                      className={inputClass(touched && dispatchPincode.trim().length !== 6)}
                    />
                    <input
                      value={dispatchState} onChange={(e) => setDispatchState(e.target.value)} placeholder="State"
                      className={inputClass(touched && !dispatchState.trim())}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {serverError && <p className="text-[12px] font-medium tracking-wide text-[#c71f11]">{serverError}</p>}
        </div>
      </AuthShell>
    </motion.form>
  );
}

function ReadOnlyField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium tracking-wide text-slate-700">{value || "—"}</p>
    </div>
  );
}