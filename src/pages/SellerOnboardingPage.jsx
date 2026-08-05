import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Upload, X, Plus,
  Building2, Phone, MapPin, ShieldCheck, Settings2, Palette, ClipboardCheck, Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchSellerOnboarding, saveSellerProgress, submitSellerOnboarding, uploadSellerFile,
  requestSellerWhatsappOtp, verifySellerWhatsappOtp,
} from "../utils/api.js";
import { lookupPincode } from "../utils/pincode.js";
import { extractColorsFromImage } from "../utils/colorExtract.js";
import { STEPS, BUSINESS_TYPES, EMPLOYEE_RANGES, WEEKDAYS, COUNTRIES, guessBusinessType, searchCountries } from "../components/seller/fieldConfigs.js";
import { FONT_BODY } from "./ui.jsx";

const STEP_ICONS = [Building2, Phone, MapPin, ShieldCheck, Settings2, Palette, ClipboardCheck];

export default function SellerOnboardingPage() {
  const { token, profile } = useAuth();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    country: "India", primary_color: "#047084", secondary_color: "#d2462b",
    dispatch_same_as_registered: true, export_countries: [], working_days: [], holidays: [],
  });
  const [gstData, setGstData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetchSellerOnboarding(token);
      if (res?.success) {
        setGstData(res.business);
        const seller = res.seller || {};
        setForm((f) => ({
          ...f,
          contact_person: res.profile?.name || "",
          whatsapp_number: res.profile?.phone || "",
          whatsapp_verified: !!res.profile?.phone_verified,
          original_verified_number: res.profile?.phone_verified ? res.profile.phone : null,
          address: res.business?.registered_address || "",
          pincode: res.business?.pincode || "",
          city: res.business?.district || "",
          state: res.business?.state || "",
          pan: res.business?.pan || "",
          display_name: res.business?.trade_name || res.business?.legal_name || "",
          business_type: guessBusinessType(res.business?.nature_of_business),
          ...seller,
        }));
        if (seller.status === "pending_review" || seller.status === "approved") {
          navigate("/seller/status", { replace: true });
        }
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const persist = async (extra = {}) => {
    setSaving(true);
    try {
      const res = await saveSellerProgress(token, { ...form, ...extra, onboarding_step: STEPS[stepIndex].key });
      if (res?.success) setForm((f) => ({ ...f, ...res.seller }));
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    setError(null);
    const missing = requiredMissing(STEPS[stepIndex].key, form);
    if (missing.length) return setError(`Please fill: ${missing.join(", ")}`);
    await persist();
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitSellerOnboarding(token, form);
      if (!res?.success) return setError(res?.message || "Couldn't submit. Please check required fields.");
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#047084]" /></div>;
  }
  if (submitted) return <SubmittedScreen />;

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-3xl min-h-screen px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[clamp(1.5rem,3.5vw,1.9rem)] font-bold text-slate-900" style={{ fontFamily: FONT_BODY }}>
        Set up your seller shop
      </h1>
      <p className="mt-1.5 text-[13.5px] font-medium text-slate-500">
        Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex].title}
      </p>

      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#047084]/10">
        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#0a95ab,#047084)" }}
          animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
      </div>

      <div className="mt-6 rounded-2xl border border-[#047084]/12 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(4,55,64,0.25)] sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={STEPS[stepIndex].key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <StepBody stepKey={STEPS[stepIndex].key} form={form} update={update} gstData={gstData} token={token} />
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-[12.5px] font-semibold text-[#c71f11]">{error}</p>}

        <div className="mt-7 flex items-center justify-between gap-3">
          <button type="button" onClick={goBack} disabled={stepIndex === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {stepIndex < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(199,31,17,0.55)]"
              style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(199,31,17,0.55)]"
              style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit for review <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function requiredMissing(stepKey, f) {
  const REQ = {
    basics: ["display_name", "business_type", "year_established"],
    contact: ["contact_person", "whatsapp_number"],
    address: ["address", "pincode", "city", "state"],
    identity: ["logo_url"],
  }[stepKey] || [];
  const missing = REQ.filter((k) => {
    const v = f[k];
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  }).map((k) => k.replace(/_/g, " "));
  if (stepKey === "contact" && !f.whatsapp_verified) missing.push("WhatsApp number verification");
  return missing;
}

/* ---------- Step bodies ---------- */
function StepBody(props) {
  const { stepKey } = props;
  if (stepKey === "basics") return <BasicsStep {...props} />;
  if (stepKey === "contact") return <ContactStep {...props} />;
  if (stepKey === "address") return <AddressStep {...props} />;
  if (stepKey === "credentials") return <CredentialsStep {...props} />;
  if (stepKey === "operations") return <OperationsStep {...props} />;
  if (stepKey === "identity") return <IdentityStep {...props} />;
  if (stepKey === "review") return <ReviewStep {...props} />;
  return null;
}

function BasicsStep({ form, update, gstData }) {
  return (
    <div className="flex flex-col gap-4">
      {gstData?.legal_name && <ReadOnlyPill label="Company (from GST)" value={gstData.trade_name || gstData.legal_name} verified />}
      <TextField label="Display name" hint="shown to buyers" value={form.display_name} onChange={(v) => update("display_name", v)} />
      <SelectField label="Business type" value={form.business_type} onChange={(v) => update("business_type", v)} options={BUSINESS_TYPES} />
      <p className="-mt-2 text-[11.5px] font-medium text-slate-400">Guessed from your GST registration — change it if it's not quite right.</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Year established" value={form.year_established} onChange={(v) => update("year_established", v)} />
        <SelectField label="Employees" value={form.employee_range} onChange={(v) => update("employee_range", v)} options={EMPLOYEE_RANGES} optional />
      </div>
      <TextField label="Annual turnover" optional value={form.annual_turnover} onChange={(v) => update("annual_turnover", v)} />
    </div>
  );
}

function ContactStep({ form, update, token }) {
  const [changingNumber, setChangingNumber] = useState(false);
  const [draftNumber, setDraftNumber] = useState(form.whatsapp_number || "");
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const isLocked = form.whatsapp_verified && !changingNumber;

  const startChange = () => {
    setDraftNumber(form.whatsapp_number || "");
    setChangingNumber(true);
    setOtpStage(false);
    setOtpError(null);
  };
  const cancelChange = () => {
    setChangingNumber(false);
    setOtpStage(false);
    setOtp(["", "", "", "", "", ""]);
    setOtpError(null);
  };

  const sendOtp = async () => {
    if (draftNumber.length !== 10) return;
    // Same number as the one already verified — skip OTP entirely.
    if (draftNumber === form.original_verified_number) {
      update("whatsapp_number", draftNumber);
      update("whatsapp_verified", true);
      setChangingNumber(false);
      return;
    }
    setSending(true); setOtpError(null);
    const res = await requestSellerWhatsappOtp(token, draftNumber);
    setSending(false);
    if (res?.success) { setOtpStage(true); setResendIn(30); setTimeout(() => otpRefs.current[0]?.focus(), 50); }
    else setOtpError(res?.message || "Couldn't send OTP.");
  };

  const handleOtpChange = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = d; setOtp(next);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const verify = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;
    setVerifying(true); setOtpError(null);
    const res = await verifySellerWhatsappOtp(token, draftNumber, code);
    setVerifying(false);
    if (res?.success) {
      update("whatsapp_number", draftNumber);
      update("whatsapp_verified", true);
      update("original_verified_number", draftNumber);
      setOtpStage(false); setChangingNumber(false); setOtp(["", "", "", "", "", ""]);
    } else {
      setOtpError(res?.message || "Incorrect or expired OTP.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <TextField label="Contact person" value={form.contact_person} onChange={(v) => update("contact_person", v)} />

      <div className="flex flex-col gap-2">
        <Label>WhatsApp number</Label>

        {isLocked ? (
          <div className="flex items-center justify-between rounded-xl border-2 border-[#047084]/25 bg-gradient-to-br from-[#047084]/[0.06] to-[#7fb3bd]/[0.08] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#047084] text-white shadow-[0_4px_12px_-2px_rgba(4,112,132,0.5)]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[14px] font-extrabold tracking-wide text-slate-800">+91 {form.whatsapp_number}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#047084]">Verified</p>
              </div>
            </div>
            <button type="button" onClick={startChange} className="text-[12px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-[#047084]">
              Change number?
            </button>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-slate-200 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-500">+91</span>
              <input
                value={draftNumber}
                onChange={(e) => { setDraftNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setOtpStage(false); setOtpError(null); }}
                inputMode="numeric" placeholder="10-digit number"
                className="flex-1 rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-[14px] font-bold tracking-wide text-slate-800 focus:border-[#047084] focus:outline-none focus:ring-4 focus:ring-[#047084]/10"
              />
              {changingNumber && (
                <button type="button" onClick={cancelChange} className="rounded-lg px-2 py-2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!otpStage ? (
                <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button type="button" onClick={sendOtp} disabled={sending || draftNumber.length !== 10}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(4,112,132,0.6)] disabled:opacity-35"
                    style={{ background: "linear-gradient(135deg, #0a95ab, #047084)" }}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="verify" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3.5">
                  <p className="text-[12px] font-semibold text-slate-500">Enter the 6-digit code sent to +91 {draftNumber}</p>
                  <div className="mt-2 flex justify-between gap-1.5 sm:gap-2">
                    {otp.map((d, i) => (
                      <input key={i} ref={(el) => (otpRefs.current[i] = el)} value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        inputMode="numeric" maxLength={1}
                        className="h-11 w-full max-w-[42px] rounded-lg border-2 border-slate-200 text-center text-[17px] font-extrabold text-slate-800 focus:border-[#047084] focus:outline-none focus:ring-4 focus:ring-[#047084]/10" />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button type="button" onClick={sendOtp} disabled={resendIn > 0}
                      className="text-[12px] font-bold text-[#047084] disabled:text-slate-300">
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                    </button>
                    <button type="button" onClick={verify} disabled={verifying || otp.join("").length !== 6}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(199,31,17,0.55)] disabled:opacity-35"
                      style={{ background: "linear-gradient(135deg, #d2462b, #c71f11)" }}>
                      {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {otpError && <p className="mt-2 text-[12px] font-semibold text-[#c71f11]">{otpError}</p>}
          </div>
        )}
      </div>

      <TextField label="Website" optional value={form.website} onChange={(v) => update("website", v)} placeholder="https://" />
    </div>
  );
}

function AddressStep({ form, update, gstData }) {
  const [looking, setLooking] = useState(false);
  const different = !form.dispatch_same_as_registered;

  const toggleDifferent = (val) => {
    update("dispatch_same_as_registered", !val);
    if (val) {
      // opening the custom-address form — start blank, don't inherit GST values
      update("address", "");
      update("pincode", "");
      update("city", "");
      update("state", "");
    } else if (gstData) {
      // switching back to "same as GST" — restore GST address
      update("address", gstData.registered_address || "");
      update("pincode", gstData.pincode || "");
      update("city", gstData.district || "");
      update("state", gstData.state || "");
    }
  };

  const handlePincode = async (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    update("pincode", digits);
    if (digits.length === 6) {
      setLooking(true);
      const res = await lookupPincode(digits);
      if (res) { update("city", res.city); update("state", res.state); }
      setLooking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Registered address (from GST)</p>
        <div className="rounded-xl border border-[#7fb3bd]/40 bg-[#047084]/[0.04] p-3.5 text-[13px] font-semibold text-slate-700">
          {gstData?.registered_address || "—"}
          {gstData?.pincode && <span className="block text-slate-500">{gstData.district}, {gstData.state} — {gstData.pincode}</span>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600">
        <input type="checkbox" checked={different} onChange={(e) => toggleDifferent(e.target.checked)} className="h-4 w-4 rounded accent-[#047084]" />
        My dispatch/shipping address is different from my GST address
      </label>

      {different && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-3.5">
          <TextAreaField label="Dispatch address" value={form.address} onChange={(v) => update("address", v)} />
          <TextField label="PIN code" value={form.pincode} onChange={handlePincode} inputMode="numeric"
            trailing={looking ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="City" value={form.city} onChange={(v) => update("city", v)} />
            <TextField label="State" value={form.state} onChange={(v) => update("state", v)} />
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialsStep({ form, update, gstData }) {
  return (
    <div className="flex flex-col gap-5">
      <GstReferencePanel gstData={gstData} />
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Your business credentials</p>
        <div className="flex flex-col gap-4">
          <TextField label="PAN" optional value={form.pan} onChange={(v) => update("pan", v.toUpperCase())} />
          <TextField label="IEC code" optional value={form.iec_code} onChange={(v) => update("iec_code", v)} />
          <TextField label="MSME / Udyam number" optional value={form.udyam_number} onChange={(v) => update("udyam_number", v)} />
          <TextField label="CIN" optional value={form.cin} onChange={(v) => update("cin", v)} />
        </div>
      </div>
    </div>
  );
}

function OperationsStep({ form, update }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label optional>Export countries</Label>
        <CountryMultiSelect value={form.export_countries} onChange={(v) => update("export_countries", v)} />
      </div>

      <div>
        <Label>Working days</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const active = (form.working_days || []).includes(d);
            return (
              <button key={d} type="button"
                onClick={() => update("working_days", active ? form.working_days.filter((x) => x !== d) : [...(form.working_days || []), d])}
                className="rounded-lg border-2 px-3 py-1.5 text-[12.5px] font-bold"
                style={{ borderColor: active ? "#047084" : "#e5e9ea", color: active ? "#047084" : "#64748b", background: active ? "#04708410" : "white" }}>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Order acceptance starts" value={form.order_acceptance_start} onChange={(v) => update("order_acceptance_start", v)} optional />
        <TimeField label="Order acceptance ends" value={form.order_acceptance_end} onChange={(v) => update("order_acceptance_end", v)} optional />
      </div>

      <HolidaysField value={form.holidays} onChange={(v) => update("holidays", v)} />
    </div>
  );
}

function IdentityStep({ form, update, token }) {
  const [extracting, setExtracting] = useState(false);
  const handleLogo = async (url) => {
    update("logo_url", url);
    setExtracting(true);
    try {
      const { primary, secondary, accent } = await extractColorsFromImage(url);
      update("primary_color", primary);
      update("secondary_color", secondary);
      update("accent_color", accent);
    } catch { /* keep defaults */ }
    setExtracting(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <FileField label="Company logo" value={form.logo_url} onUploaded={handleLogo} token={token} folder="logo" accept="image/*" />
      <p className="-mt-3 text-[11.5px] font-medium text-slate-400">We'll automatically pick your shop's colors from your logo. You can add a banner, description and more from your dashboard once your shop is live.</p>

      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Shop preview</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex h-16 items-center justify-center" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}50, ${form.secondary_color}50,${form.secondary_color})` }}>
            {extracting && <Loader2 className="h-4 w-4 animate-spin text-white/80" />}
          </div>
          <div className="flex items-center gap-2 bg-white p-3">
            {form.logo_url ? (
              <img src={form.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-extrabold" style={{ background: form.primary_color }}>
                {(form.display_name || "S")[0]}
              </span>
            )}
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">{form.display_name || "Your Shop Name"}</p>
              <button className="mt-0.5 rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: form.secondary_color }}>Contact Supplier</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ form }) {
  const sections = [
    {
      title: "Business Basics",
      rows: [
        ["Display name", form.display_name],
        ["Business type", form.business_type],
        ["Year established", form.year_established],
        ["Employees", form.employee_range],
        ["Annual turnover", form.annual_turnover],
      ],
    },
    {
      title: "Contact",
      rows: [
        ["Contact person", form.contact_person],
        ["WhatsApp", form.whatsapp_verified ? `+91 ${form.whatsapp_number} — verified` : form.whatsapp_number],
        ["Website", form.website],
      ],
    },
    {
      title: "Address",
      rows: [
        ["Dispatch address", form.dispatch_same_as_registered ? "Same as GST registered address" : `${form.address}, ${form.city}, ${form.state} ${form.pincode}`],
      ],
    },
    {
      title: "Credentials",
      rows: [
        ["PAN", form.pan], ["IEC code", form.iec_code], ["Udyam number", form.udyam_number], ["CIN", form.cin],
      ],
    },
    {
      title: "Operations",
      rows: [
        ["Export countries", (form.export_countries || []).join(", ")],
        ["Working days", (form.working_days || []).join(", ")],
        ["Order hours", form.order_acceptance_start && form.order_acceptance_end ? `${form.order_acceptance_start} – ${form.order_acceptance_end}` : ""],
        ["Holidays", (form.holidays || []).length ? `${form.holidays.length} date(s) marked` : ""],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] font-medium text-slate-600">Review your details below. Once submitted, our team typically reviews within 24–48 hours.</p>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        {form.logo_url ? (
          <img src={form.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg text-white font-extrabold" style={{ background: form.primary_color }}>
            {(form.display_name || "S")[0]}
          </span>
        )}
        <div>
          <p className="text-[15px] font-extrabold text-slate-900">{form.display_name || "Your Shop Name"}</p>
          <div className="mt-1 flex gap-1">
            {[form.primary_color, form.secondary_color, form.accent_color].filter(Boolean).map((c) => (
              <span key={c} className="h-4 w-4 rounded-full border border-white shadow" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {sections.map((s) => {
        const rows = s.rows.filter(([, v]) => v);
        if (!rows.length) return null;
        return (
          <div key={s.title}>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#047084]">{s.title}</p>
            <div className="rounded-xl border border-slate-100">
              {rows.map(([label, value], i) => (
                <div key={label} className={`flex justify-between gap-3 px-3.5 py-2 text-[13px] ${i !== rows.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="max-w-[60%] text-right font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmittedScreen() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-[20px] font-extrabold text-slate-900">Submitted for review</h2>
      <p className="mt-2 text-[13.5px] font-medium text-slate-500">
        We're verifying your details. You'll be notified as soon as your shop is approved and live to buyers.
      </p>
    </div>
  );
}

/* ---------- Reusable field primitives ---------- */
function fieldWrap(error) {
  return `w-full rounded-md border-2 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:border-[#047084] focus:outline-none focus:ring-4 focus:ring-[#047084]/10 ${error ? "border-[#c71f11]" : "border-slate-200"}`;
}
function Label({ children, optional }) {
  return <label className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{children} {optional && <span className="normal-case font-medium text-slate-400">(optional)</span>}</label>;
}
function TextField({ label, value = "", onChange, optional, placeholder, inputMode, trailing }) {
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <div className="relative">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className={fieldWrap()} />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}
function NumberField({ label, value, onChange }) {
  return <TextField label={label} value={value ?? ""} onChange={(v) => onChange(v.replace(/\D/g, ""))} inputMode="numeric" />;
}
function TimeField({ label, value = "", onChange, optional }) {
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} className={fieldWrap()} />
    </div>
  );
}
function TextAreaField({ label, value = "", onChange, rows = 3, optional }) {
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={fieldWrap()} />
    </div>
  );
}
function SelectField({ label, value, onChange, options, optional }) {
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={fieldWrap()}>
        <option value="" disabled>Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function ReadOnlyPill({ label, value, verified }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5 rounded-md border-2 border-[#7fb3bd]/50 bg-[#047084]/[0.05] px-3.5 py-2.5 text-[14px] font-semibold text-slate-700">
        {value}
        {verified && <CheckCircle2 className="ml-auto h-4 w-4 text-[#047084]" />}
      </div>
    </div>
  );
}
function FileField({ label, value, onUploaded, token, folder, accept, bucket = "seller-assets" }) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadSellerFile(token, file, folder, bucket);
    if (res?.success) onUploaded(res.url);
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300"><ImageIcon className="h-5 w-5" /></span>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-bold text-slate-600">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {value ? "Replace" : "Upload"}
        </button>
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      </div>
    </div>
  );
}
function CountryMultiSelect({ value = [], onChange }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // const matches = COUNTRIES.filter((c) => c.toLowerCase().includes(q.toLowerCase()) && !value.includes(c)).slice(0, 8);
  const matches = searchCountries(q, value);
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className={fieldWrap() + " flex flex-wrap items-center gap-1.5 py-2"}>
        {value.map((c) => (
          <span key={c} className="flex items-center gap-1 rounded-full bg-[#047084]/10 px-2.5 py-1 text-[12px] font-bold text-[#047084]">
            {c} <button type="button" onClick={() => onChange(value.filter((t) => t !== c))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search countries…" className="min-w-[100px] flex-1 bg-transparent text-[13px] font-medium focus:outline-none" />
      </div>
      {open && q && matches.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((c) => (
            <button key={c} type="button" onMouseDown={() => { onChange([...value, c]); setQ(""); }}
              className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-[#047084]/5">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function HolidaysField({ value = [], onChange }) {
  const [date, setDate] = useState("");
  const add = () => { if (date && !value.includes(date)) { onChange([...value, date].sort()); setDate(""); } };
  return (
    <div className="flex flex-col gap-1.5">
      <Label optional>Holidays / shop closed dates</Label>
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldWrap() + " flex-1"} />
        <button type="button" onClick={add} className="rounded-lg border border-slate-200 px-3 py-2.5 text-[12.5px] font-bold text-[#047084]"><Plus className="h-4 w-4" /></button>
      </div>
      {value.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {value.map((d) => (
            <span key={d} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-600">
              {d} <button type="button" onClick={() => onChange(value.filter((x) => x !== d))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
function GstReferencePanel({ gstData }) {
  if (!gstData) return null;
  const rows = [
    ["Legal name", gstData.legal_name], ["Trade name", gstData.trade_name], ["GSTIN status", gstData.gstin_status],
    ["Constitution", gstData.constitution], ["Taxpayer type", gstData.taxpayer_type],
    ["GST registration date", gstData.gst_registration_date], ["Registered address", gstData.registered_address],
    ["District", gstData.district], ["Pincode", gstData.pincode], ["State", gstData.state], ["PAN (GST record)", gstData.pan],
    ["Nature of business", Array.isArray(gstData.nature_of_business) ? gstData.nature_of_business.join(", ") : gstData.nature_of_business],
  ].filter(([, v]) => v);
  return (
    <div className="rounded-xl border border-[#7fb3bd]/40 bg-[#047084]/[0.04] p-4">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-[#047084]" />
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#047084]">GST registered details (reference only)</p>
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-[#047084]/10 py-1.5 text-[12px]">
            <span className="font-semibold text-slate-500">{label}</span>
            <span className="max-w-[60%] text-right font-bold text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}