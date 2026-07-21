// pages/AuthPage.jsx

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import TrustPanel from "../components/auth/TrustPanel.jsx";
import TrustBadgesFooter from "../components/auth/TrustBadgesFooter.jsx";
import IdentifierStep from "../components/auth/IdentifierStep.jsx";
import OtpStep from "../components/auth/OtpStep.jsx";
import ContactDetailsStep from "../components/auth/ContactDetailsStep.jsx";
import CompanyDetailsStep from "../components/auth/CompanyDetailsStep.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { identifierType } from "../utils/validators.js";
import SmartLink from "../components/SmartLink.jsx";
import {
  requestOtp,
  verifyOtp,
  registerProfile,
  submitCompany,
} from "../utils/api.js";

// "role" is gone — every account is both buyer and seller. The stepper
// only ever applies to a NEW user (an existing user goes straight from
// otp -> done), so it deliberately excludes "identifier" and "otp" too —
// we don't show progress for something we don't know the length of yet.
const STEP_ORDER = ["contact", "company"];
const STEP_LABELS = { contact: "Contact", company: "Company" };

export default function AuthPage() {
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setDevSession, refreshProfile } = useAuth();

  const loginType = identifierType(identifier); // "phone" | "email" | null

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
      setStep("otp");
    });

  const handleOtpVerify = (code) =>
    withLoading(async () => {
      const res = await verifyOtp(identifier, code);
      if (!res.success) return setError(res.message || "That code didn't match. Check and try again.");
      setToken(res.token);
      if (identifierType(identifier) === "phone") {
        setDevSession(res.token); // dev bypass isn't a real Supabase session
      }
      // Existing user -> straight to the app. New user -> onboarding,
      // starting at "contact" (role selection is gone entirely).
      setStep(res.isNewUser ? "contact" : "done");
    });

  const handleResend = () => {
    requestOtp(identifier);
  };

  const handleContactSubmit = (contact) =>
    withLoading(async () => {
      const res = await registerProfile(token, contact);
      if (!res.success) return setError(res.message || "Couldn't save your details. Try again.");
      setStep("company");
    });

  const handleCompanySubmit = (company) =>
    withLoading(async () => {
      const res = await submitCompany(token, company);
      if (!res.success) return setError(res.message || "Couldn't save your company details. Try again.");
      await refreshProfile();
      setStep("done");
    });

  // Only show the progress bar once we know it's a new user going through
  // onboarding — not during identifier/otp, where we don't yet know if
  // there's a multi-step flow ahead at all.
  const showProgress = STEP_ORDER.includes(step);
  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen w-full bg-[#f6f8f8]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(4,112,132,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="pointer-events-none fixed -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(199,31,17,0.08) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none fixed -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(4,112,132,0.1) 0%, transparent 70%)" }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-col items-stretch justify-center px-4 py-24 sm:px-6 sm:py-8 lg:min-h-screen lg:px-8 lg:py-10">
        <div className="grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[1fr_1.05fr] lg:gap-7 xl:grid-cols-[1fr_0.95fr]">
          <div className="hidden lg:block">
            <TrustPanel />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-24px_rgba(4,112,132,0.22)] sm:rounded-[28px]">
              <div
                className="h-1 w-full shrink-0 sm:h-[5px]"
                style={{ background: "linear-gradient(90deg, #047084 0%, #7fb3bd 45%, #d2462b 100%)" }}
              />

              <div className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
                {showProgress && (
                  <div className="mb-5 flex items-center gap-1.5 sm:mb-6">
                    {STEP_ORDER.map((s, i) => (
                      <div key={s} className="flex flex-1 flex-col gap-1.5">
                        <span
                          className="block h-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= currentIndex ? "#d2462b" : "#e6ebeb" }}
                        />
                        <span
                          className="hidden text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 sm:block"
                          style={{ color: i <= currentIndex ? "#0f172a" : "#b6bfbf" }}
                        >
                          {STEP_LABELS[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-center">
                  <AnimatePresence mode="wait">
                    {step === "identifier" && (
                      <IdentifierStep
                        key="identifier"
                        identifier={identifier}
                        onSubmit={handleIdentifierSubmit}
                        loading={loading}
                        serverError={error}
                      />
                    )}
                    {step === "otp" && (
                      <OtpStep
                        key="otp"
                        identifier={identifier}
                        onVerify={handleOtpVerify}
                        onResend={handleResend}
                        onEditNumber={() => setStep("identifier")}
                        loading={loading}
                        serverError={error}
                      />
                    )}
                    {step === "contact" && (
                      <ContactDetailsStep
                        key="contact"
                        token={token}
                        identifier={identifier}
                        loginType={loginType}
                        onSubmit={handleContactSubmit}
                        loading={loading}
                        serverError={error}
                      />
                    )}
                    {step === "company" && (
                      <CompanyDetailsStep
                        key="company"
                        token={token}
                        onSubmit={handleCompanySubmit}
                        loading={loading}
                        serverError={error}
                      />
                    )}
                    {step === "done" && <DoneStep key="done" />}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <TrustBadgesFooter />
          </div>
        </div>
      </main>
    </div>
  );
}

function DoneStep() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-center py-4 text-center sm:py-6"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(4,112,132,0.5)]"
        style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
      >
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1
        className="mt-5 text-[clamp(1.4rem,4vw,1.6rem)] font-extrabold text-slate-900"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        You're in
      </h1>
      <p className="mt-1.5 max-w-xs text-[13.5px] font-medium leading-relaxed text-slate-500">
        Your account is ready. Start sourcing right away, or open your shop
        whenever you're ready to sell.
      </p>
      <SmartLink
        to="/home"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        Go to marketplace
      </SmartLink>
    </motion.div>
  );
}