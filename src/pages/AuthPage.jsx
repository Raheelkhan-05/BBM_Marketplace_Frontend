// pages/AuthPage.jsx

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

import TrustPanel from "../components/auth/TrustPanel.jsx";
import TrustBadgesFooter from "../components/auth/TrustBadgesFooter.jsx";
import IdentifierStep from "../components/auth/IdentifierStep.jsx";
import OtpStep from "../components/auth/OtpStep.jsx";
import RoleStep from "../components/auth/RoleStep.jsx";
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

const STEP_ORDER = ["identifier", "otp", "role", "contact", "company", "done"];

export default function AuthPage() {
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState(null);
  const [wantsSeller, setWantsSeller] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setDevSession } = useAuth();

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
      if (identifierType(identifier) === "phone") setDevSession(res.token); // dev bypass isn't a real Supabase session
      setStep(res.isNewUser ? "role" : "done");
    });

  const handleResend = () => {
    requestOtp(identifier);
  };

  const handleRoleSubmit = (choice) => {
    setWantsSeller(choice !== "buyer");
    setStep("contact");
  };

  const handleContactSubmit = (contact) =>
    withLoading(async () => {
      const res = await registerProfile(token, { ...contact, roles: wantsSeller ? ["buyer", "seller"] : ["buyer"] });
      if (!res.success) return setError(res.message || "Couldn't save your details. Try again.");
      setStep("company");
    });

  const handleCompanySubmit = (company) =>
    withLoading(async () => {
      const res = await submitCompany(token, { ...company, wantsSeller });
      if (!res.success) return setError(res.message || "Couldn't save your company details. Try again.");
      setStep("done");
    });

  const visibleDots = STEP_ORDER.filter((s) => s !== "done");
  const currentIndex = visibleDots.indexOf(step);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-white pb-10"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(4,112,132,0.09) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(199,31,17,0.09) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(4,112,132,0.1) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">

        <div className="grid w-full max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:h-[660px]">
          <TrustPanel />

          <div className="flex flex-col">
            <div className="flex flex-1 flex-col justify-center overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_28px_70px_-24px_rgba(4,112,132,0.28)]">
              <div
                className="h-[5px] w-full shrink-0"
                style={{ background: "linear-gradient(90deg, #047084 0%, #7fb3bd 45%, #d2462b 100%)" }}
              />

              <div className="px-6 py-8 sm:px-9 sm:py-9 lg:px-11">
                <SmartLink to="/" className="mb-6 inline-flex items-center gap-2 self-start lg:hidden">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-extrabold text-slate-900">BBM</span>
                </SmartLink>

                {step !== "done" && (
                  <div className="mb-2 flex items-center gap-1.5">
                    {visibleDots.map((s, i) => (
                      <span
                        key={s}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: i === currentIndex ? 20 : 6,
                          backgroundColor: i <= currentIndex ? "#d2462b" : "#e2e8f0",
                        }}
                      />
                    ))}
                  </div>
                )}

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
                  {step === "role" && (
                    <RoleStep key="role" onSubmit={handleRoleSubmit} loading={loading} />
                  )}
                  {step === "contact" && (
                    <ContactDetailsStep
                      key="contact"
                      wantsSeller={wantsSeller}
                      onSubmit={handleContactSubmit}
                      loading={loading}
                      serverError={error}
                    />
                  )}
                  {step === "company" && (
                    <CompanyDetailsStep
                      key="company"
                      wantsSeller={wantsSeller}
                      onSubmit={handleCompanySubmit}
                      loading={loading}
                      serverError={error}
                    />
                  )}
                  {step === "done" && <DoneStep key="done" />}
                </AnimatePresence>
              </div>
            </div>

            <TrustBadgesFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

function DoneStep() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-center py-6 text-center"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(4,112,132,0.5)]"
        style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
      >
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1
        className="mt-5 text-[24px] font-extrabold text-slate-900"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        You're in
      </h1>
      <p className="mt-1.5 max-w-xs text-[13.5px] font-medium text-slate-500">
        Your account is ready. Start sourcing right away, or open your shop
        whenever you're ready to sell.
      </p>
      <SmartLink
        to="/home"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-transform duration-200 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        Go to marketplace
      </SmartLink>
    </motion.div>
  );
}