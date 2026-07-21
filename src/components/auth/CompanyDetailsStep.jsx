// components/auth/CompanyDetailsStep.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, Loader2, X } from "lucide-react";
import { validateGSTIN, isValidPincode } from "../../utils/validators";
import { lookupGstin } from "../../utils/api";

const BUSINESS_TYPES = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "distributor", label: "Distributor" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "retailer", label: "Retailer" },
  { value: "exporter", label: "Exporter" },
  { value: "importer", label: "Importer" },
  { value: "service_provider", label: "Service Provider" },
];
const INDUSTRIES = ["Textiles", "Metals & Alloys", "Chemicals", "Electronics", "Machinery", "Agriculture", "Construction", "Packaging", "Other"];
const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"];
const TURNOVER_BANDS = ["< ₹1Cr", "₹1Cr - ₹10Cr", "₹10Cr - ₹50Cr", "₹50Cr+"];
const GSTIN_ERRORS = { incomplete: "GSTIN should be 15 characters.", format: "That doesn't match a GSTIN's format.", checksum: "Check for a typo — this GSTIN isn't valid." };

export default function CompanyDetailsStep({ token, onSubmit, loading, serverError }) {
  const [gstin, setGstin] = useState("");
  const [gstStage, setGstStage] = useState("idle"); // idle | looking_up | found | error
  const [gstError, setGstError] = useState(null);
  const [gstData, setGstData] = useState(null); // mapped fields from the lookup

  const [displayName, setDisplayName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [industry, setIndustry] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [brandInput, setBrandInput] = useState("");
  const [brands, setBrands] = useState([]);
  const [yearEstablished, setYearEstablished] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [turnover, setTurnover] = useState("");
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState(false);

  const gstCheck = validateGSTIN(gstin);

  const runLookup = async () => {
    if (!gstCheck.valid) return;
    setGstStage("looking_up");
    setGstError(null);
    const res = await lookupGstin(token, gstin.toUpperCase());
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
    gstStage === "found" &&
    displayName.trim().length >= 2 &&
    businessType &&
    industry &&
    categories.length > 0;

  const addTag = (value, setValue, list, setList) => (e) => {
    if (e.key !== "Enter" || !value.trim()) return;
    e.preventDefault();
    setList([...new Set([...list, value.trim()])]);
    setValue("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) return;
    onSubmit({
      gstin: gstin.toUpperCase(),
      displayName: displayName.trim(),
      businessType, industry, categories, productsBrands: brands,
      yearEstablished: yearEstablished ? Number(yearEstablished) : null,
      employeeCount: employeeCount || null,
      annualTurnover: turnover || null,
      website: website.trim(),
    });
  };

  return (
    <motion.form
      key="company"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="flex w-full flex-col"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_4px_10px_-3px_rgba(4,112,132,0.5)]"
        style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
      >
        <Building2 className="h-5 w-5" />
      </span>
      <h1
        className="mt-4 text-[clamp(1.35rem,3.6vw,1.75rem)] font-extrabold leading-[1.15] text-slate-900"
        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
      >
        Tell us about your company
      </h1>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500 sm:text-[13.5px]">
        Enter your GSTIN — we'll pull your registered details automatically.
      </p>

      {/* GSTIN lookup */}
      <div className="mt-5 flex flex-col">
        <label className="text-[12px] font-bold text-slate-600">GSTIN</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <input
              maxLength={15}
              value={gstin}
              onChange={(e) => {
                setGstin(e.target.value.toUpperCase().replace(/\s/g, ""));
                setGstStage("idle");
                setGstData(null);
              }}
              placeholder="22AAAAA0000A1Z5"
              className={`${inputClass(touched && gstin.length === 15 && !gstCheck.valid)} pr-10 uppercase tracking-wide`}
            />
            {gstStage === "found" && (
              <CheckCircle2 className="absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#047084]" />
            )}
          </div>
          <button
            type="button"
            onClick={runLookup}
            disabled={!gstCheck.valid || gstStage === "looking_up"}
            className="shrink-0 rounded-xl px-4 py-3 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#047084" }}
          >
            {gstStage === "looking_up" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </button>
        </div>
        {gstin.length === 15 && !gstCheck.valid && (
          <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">{GSTIN_ERRORS[gstCheck.reason] || GSTIN_ERRORS.format}</p>
        )}
        {gstStage === "error" && <p className="mt-1.5 text-[12px] font-semibold text-[#c71f11]">{gstError}</p>}
      </div>

      {/* Auto-fetched, read-only — nothing here is manually typed */}
      {gstStage === "found" && gstData && (
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 sm:grid-cols-2">
          <ReadOnlyField label="Legal name" value={gstData.legal_name} />
          <ReadOnlyField label="Trade name" value={gstData.trade_name} />
          <ReadOnlyField label="Constitution" value={gstData.constitution} />
          <ReadOnlyField label="Status" value={gstData.gstin_status} />
          <ReadOnlyField label="PAN" value={gstData.pan} />
          <ReadOnlyField label="State" value={gstData.state} />
          <ReadOnlyField label="District" value={gstData.district} />
          <ReadOnlyField label="Pincode" value={gstData.pincode} />
          <ReadOnlyField label="Registered address" value={gstData.registered_address} className="sm:col-span-2" />
        </div>
      )}

      {gstStage === "found" && (
        <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field label="Display name" hint="shown to buyers">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Mehta Steel" className={inputClass(touched && displayName.trim().length < 2)} />
          </Field>

          <Field label="Business type">
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass(touched && !businessType)}>
              <option value="">Select…</option>
              {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Industry">
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass(touched && !industry)}>
              <option value="">Select…</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>

          <Field label="Categories" hint="press Enter" className="sm:col-span-2">
            <TagInput value={categoryInput} onChange={setCategoryInput} tags={categories} setTags={setCategories} onKeyDown={addTag(categoryInput, setCategoryInput, categories, setCategories)} placeholder="e.g. Stainless steel sheets" error={touched && categories.length === 0} />
          </Field>

          <Field label="Products / brands dealt in" hint="press Enter" className="sm:col-span-2">
            <TagInput value={brandInput} onChange={setBrandInput} tags={brands} setTags={setBrands} onKeyDown={addTag(brandInput, setBrandInput, brands, setBrands)} placeholder="e.g. Tata Steel, JSW" />
          </Field>

          <Field label="Year established" hint="optional">
            <input inputMode="numeric" maxLength={4} value={yearEstablished} onChange={(e) => setYearEstablished(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2010" className={inputClass(false)} />
          </Field>

          <Field label="Employees" hint="optional">
            <select value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} className={inputClass(false)}>
              <option value="">Select…</option>
              {EMPLOYEE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>

          <Field label="Annual turnover" hint="private unless enabled">
            <select value={turnover} onChange={(e) => setTurnover(e.target.value)} className={inputClass(false)}>
              <option value="">Prefer not to say</option>
              {TURNOVER_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>

          <Field label="Website" hint="optional">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourcompany.com" className={inputClass(false)} />
          </Field>
        </div>
      )}

      {serverError && <p className="mt-3 text-[12px] font-semibold text-[#c71f11]">{serverError}</p>}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(199,31,17,0.5)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
      >
        {loading ? "Saving…" : "Finish setting up"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </motion.form>
  );
}

function Field({ label, hint, className = "", children }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-[12px] font-bold text-slate-600">
        {label} {hint && <span className="font-medium text-slate-400">({hint})</span>}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReadOnlyField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-700">{value || "—"}</p>
    </div>
  );
}

function inputClass(error) {
  return `w-full min-w-0 rounded-xl border-2 bg-white px-3.5 py-3 text-[14.5px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-none sm:py-3.5 ${error ? "border-[#c71f11]" : "border-slate-200"}`;
}

function TagInput({ value, onChange, tags, setTags, onKeyDown, placeholder, error }) {
  return (
    <div className={`flex flex-wrap gap-1.5 rounded-xl border-2 bg-white px-3 py-2.5 ${error ? "border-[#c71f11]" : "border-slate-200"}`}>
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
          {t}
          <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3 text-slate-400" /></button>
        </span>
      ))}
      <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="min-w-[120px] flex-1 bg-transparent text-[13.5px] font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none" />
    </div>
  );
}