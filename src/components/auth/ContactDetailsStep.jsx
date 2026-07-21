// components/auth/ContactDetailsStep.jsx — replaces ProfileStep.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { isValidEmail } from "../../utils/validators";

export default function ContactDetailsStep({ wantsSeller, onSubmit, loading, serverError }) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [touched, setTouched] = useState(false);

  const nameValid = wantsSeller ? name.trim().length >= 2 : name.trim().length === 0 || name.trim().length >= 2;
  const designationValid = wantsSeller ? designation.trim().length >= 2 : true;
  const emailValid = isValidEmail(email);
  const whatsappValid = whatsapp.length === 0 || /^[6-9]\d{9}$/.test(whatsapp);
  const canSubmit = nameValid && designationValid && emailValid && whatsappValid && (wantsSeller ? name.trim().length >= 2 : true);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) return;
    onSubmit({ name: name.trim(), designation: designation.trim(), email: email.trim(), whatsappNumber: whatsapp });
  };

  return (
    <motion.form key="contact" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} onSubmit={handleSubmit} className="flex flex-col">
      <h1 className="text-[26px] font-extrabold leading-tight text-slate-900 sm:text-[28px]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        Who should we contact?
      </h1>
      <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
        {wantsSeller ? "Required for seller accounts — buyers will see this on your storefront." : "Optional — helps us personalize your account."}
      </p>

      <label htmlFor="name" className="mt-6 text-[12px] font-bold text-slate-600">
        Contact person {wantsSeller ? "" : <span className="font-medium text-slate-400">(optional)</span>}
      </label>
      <input id="name" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rohan Mehta"
        className="mt-2 rounded-xl border-2 bg-white px-3.5 py-3.5 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
        style={{ borderColor: touched && !nameValid ? "#c71f11" : "#e2e8f0" }} />

      {wantsSeller && (
        <>
          <label htmlFor="designation" className="mt-5 text-[12px] font-bold text-slate-600">Designation</label>
          <input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Sales Manager"
            className="mt-2 rounded-xl border-2 bg-white px-3.5 py-3.5 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
            style={{ borderColor: touched && !designationValid ? "#c71f11" : "#e2e8f0" }} />
        </>
      )}

      <label htmlFor="email" className="mt-5 text-[12px] font-bold text-slate-600">
        Email {wantsSeller ? "" : <span className="font-medium text-slate-400">(optional, for invoices)</span>}
      </label>
      <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
        className="mt-2 rounded-xl border-2 bg-white px-3.5 py-3.5 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
        style={{ borderColor: touched && !emailValid ? "#c71f11" : "#e2e8f0" }} />

      <label htmlFor="whatsapp" className="mt-5 text-[12px] font-bold text-slate-600">
        WhatsApp number {wantsSeller ? <span className="font-medium text-slate-400">(preferred)</span> : <span className="font-medium text-slate-400">(optional)</span>}
      </label>
      <input id="whatsapp" inputMode="numeric" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="For click-to-chat with buyers"
        className="mt-2 rounded-xl border-2 bg-white px-3.5 py-3.5 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
        style={{ borderColor: touched && !whatsappValid ? "#c71f11" : "#e2e8f0" }} />

      {serverError && <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">{serverError}</p>}

      <button type="submit" disabled={!canSubmit || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
        {loading ? "Saving…" : "Continue"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </motion.form>
  );
}