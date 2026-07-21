// components/auth/OtpStep.jsx

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { formatPhoneForDisplay, identifierType } from "../../utils/validators";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpStep({ phone, onVerify, onResend, onEditNumber, loading, serverError }) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const code = digits.join("");

  const attemptSubmit = (finalCode) => {
    if (finalCode.length === OTP_LENGTH && !loading) onVerify(finalCode);
  };

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
    if (digit && i === OTP_LENGTH - 1) attemptSubmit(next.join(""));
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputsRef.current[lastIndex]?.focus();
    if (pasted.length === OTP_LENGTH) attemptSubmit(pasted);
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;
    setDigits(Array(OTP_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
    setSecondsLeft(RESEND_SECONDS);
    onResend();
  };

  return (
    <motion.div
      key="otp"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col"
    >
      <h1
        className="text-[26px] font-extrabold leading-tight text-slate-900 sm:text-[28px]"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        Enter the code
      </h1>

    <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
        Sent to {identifierType(phone) === "email" ? phone : `+91 ${formatPhoneForDisplay(phone)}`}.{" "}
        <button type="button" onClick={onEditNumber} className="inline-flex items-center gap-1 font-bold text-[#047084] hover:underline">
            <Pencil className="h-3 w-3" />
            Edit
        </button>
    </p>

      <div className="mt-7 flex justify-between gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className="h-12 w-full max-w-[46px] rounded-xl border-2 text-center text-[19px] font-extrabold text-slate-800 transition-colors focus:outline-none sm:h-14"
            style={{ borderColor: serverError ? "#c71f11" : d ? "#7fb3bd" : "#e2e8f0" }}
          />
        ))}
      </div>
      {serverError && (
        <p className="mt-2.5 text-[12px] font-semibold text-[#c71f11]">{serverError}</p>
      )}

      <button
        type="button"
        onClick={() => attemptSubmit(code)}
        disabled={code.length !== OTP_LENGTH || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        {loading ? "Verifying…" : "Verify & continue"}
      </button>

      <p className="mt-4 text-center text-[12.5px] font-medium text-slate-400">
        {secondsLeft > 0 ? (
          <>Resend code in {secondsLeft}s</>
        ) : (
          <button type="button" onClick={handleResend} className="font-bold text-[#047084] hover:underline">
            Resend code
          </button>
        )}
      </p>
    </motion.div>
  );
}