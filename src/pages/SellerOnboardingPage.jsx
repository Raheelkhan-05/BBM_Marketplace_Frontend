import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Upload, X, Plus,
  Building2, Phone, MapPin, Image as ImageIcon, ShieldCheck, Camera,
  Award, Settings2, Share2, Palette, ClipboardCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchSellerOnboarding, saveSellerProgress, submitSellerOnboarding, uploadSellerFile,
} from "../utils/api.js";
import { lookupPincode } from "../utils/pincode.js";
import { STEPS, BUSINESS_TYPES, INDUSTRIES, EMPLOYEE_RANGES, DESIGNATIONS } from "../components/seller/fieldConfigs.js";

const STEP_ICONS = [Building2, Phone, MapPin, ImageIcon, Camera, ShieldCheck, Award, Settings2, Share2, Palette, ClipboardCheck];

export default function SellerOnboardingPage() {
  const { token, profile } = useAuth();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    country: "India", primary_color: "#047084", secondary_color: "#d2462b",
    categories: [], products_brands: [], export_countries: [], industries_served: [],
  });
  const [gstData, setGstData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [certifications, setCertifications] = useState([]);
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
        setPhotos(res.photos || []);
        setCertifications(res.certifications || []);
        setForm((f) => ({
          ...f,
          contact_person: res.profile?.name || "",
          address: res.business?.registered_address || "",
          pincode: res.business?.pincode || "",
          city: res.business?.district || "",
          state: res.business?.state || "",
          pan: res.business?.pan || "",
          display_name: res.business?.trade_name || res.business?.legal_name || "",
          ...(res.seller || {}),
        }));
        if (res.seller?.status === "pending_review" || res.seller?.status === "approved") {
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
  if (submitted) return <SubmittedScreen shopSlug={form.shop_slug} />;

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[clamp(1.5rem,3.5vw,1.9rem)] font-semibold text-slate-900" style={{ fontFamily: "'Fraunces', serif" }}>
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
            <StepBody
              stepKey={STEPS[stepIndex].key} form={form} update={update} gstData={gstData}
              photos={photos} setPhotos={setPhotos} certifications={certifications} setCertifications={setCertifications}
              token={token}
            />
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
    basics: ["display_name", "business_type", "industry", "categories", "products_brands", "year_established"],
    contact: ["contact_person", "designation", "whatsapp_number"],
    address: ["address", "pincode", "city", "state"],
    profile: ["logo_url", "banner_url", "description", "brochure_url"],
  }[stepKey] || [];
  return REQ.filter((k) => {
    const v = f[k];
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  }).map((k) => k.replace(/_/g, " "));
}

/* ---------- Step bodies ---------- */
function StepBody(props) {
  const { stepKey } = props;
  if (stepKey === "basics") return <BasicsStep {...props} />;
  if (stepKey === "contact") return <ContactStep {...props} />;
  if (stepKey === "address") return <AddressStep {...props} />;
  if (stepKey === "profile") return <ProfileStep {...props} />;
  if (stepKey === "photos") return <PhotosStep {...props} />;
  if (stepKey === "credentials") return <CredentialsStep {...props} />;
  if (stepKey === "certifications") return <CertificationsStep {...props} />;
  if (stepKey === "operations") return <OperationsStep {...props} />;
  if (stepKey === "digital") return <DigitalStep {...props} />;
  if (stepKey === "branding") return <BrandingStep {...props} />;
  if (stepKey === "review") return <ReviewStep {...props} />;
  return null;
}

function BasicsStep({ form, update, gstData }) {
  return (
    <div className="flex flex-col gap-4">
      {gstData?.legal_name && (
        <ReadOnlyPill label="Company (from GST)" value={gstData.trade_name || gstData.legal_name} />
      )}
      <TextField label="Display name" hint="shown to buyers" value={form.display_name} onChange={(v) => update("display_name", v)} />
      <SelectField label="Business type" value={form.business_type} onChange={(v) => update("business_type", v)} options={BUSINESS_TYPES} />
      <SelectField label="Industry" value={form.industry} onChange={(v) => update("industry", v)} options={INDUSTRIES} />
      <TagField label="Categories" value={form.categories} onChange={(v) => update("categories", v)} placeholder="e.g. Steel Pipes, Fasteners" />
      <TagField label="Products / Brands dealt in" value={form.products_brands} onChange={(v) => update("products_brands", v)} placeholder="e.g. Tata Steel, JSW" />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Year established" value={form.year_established} onChange={(v) => update("year_established", v)} />
        <SelectField label="Employees" value={form.employee_range} onChange={(v) => update("employee_range", v)} options={EMPLOYEE_RANGES} optional />
      </div>
      <div className="flex flex-col gap-1.5">
        <TextField label="Annual turnover" optional value={form.annual_turnover} onChange={(v) => update("annual_turnover", v)} />
        <label className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
          <input type="checkbox" checked={!!form.show_turnover_publicly} onChange={(e) => update("show_turnover_publicly", e.target.checked)} className="h-4 w-4 rounded accent-[#047084]" />
          Show turnover publicly on my shop page
        </label>
      </div>
    </div>
  );
}

function ContactStep({ form, update }) {
  return (
    <div className="flex flex-col gap-4">
      <TextField label="Contact person" value={form.contact_person} onChange={(v) => update("contact_person", v)} />
      <SelectField label="Designation" value={form.designation} onChange={(v) => update("designation", v)} options={DESIGNATIONS} />
      <TextField label="WhatsApp number" value={form.whatsapp_number} onChange={(v) => update("whatsapp_number", v.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" />
      <TextField label="Website" optional value={form.website} onChange={(v) => update("website", v)} placeholder="https://" />
      <p className="text-[12px] font-medium text-slate-400">Your mobile and email are already verified from sign-up.</p>
    </div>
  );
}


function AddressStep({ form, update }) {
  const [looking, setLooking] = useState(false);
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
      <p className="text-[12px] font-medium text-slate-500">
        This is your shop's operating / dispatch address — shown to buyers and used for shipments. It can differ from your GST registered address, which you can review in the Credentials step.
      </p>
      <TextAreaField label="Detailed address" value={form.address} onChange={(v) => update("address", v)} />
      <TextField label="PIN code" value={form.pincode} onChange={handlePincode} inputMode="numeric" trailing={looking ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="City" value={form.city} onChange={(v) => update("city", v)} />
        <TextField label="State" value={form.state} onChange={(v) => update("state", v)} />
      </div>
      <TextField label="Country" value={form.country || "India"} onChange={(v) => update("country", v)} />
    </div>
  );
}


function ProfileStep({ form, update, token }) {
  return (
    <div className="flex flex-col gap-4">
      <FileField label="Company logo" value={form.logo_url} onUploaded={(url) => update("logo_url", url)} token={token} folder="logo" accept="image/*" />
      <FileField label="Company banner" value={form.banner_url} onUploaded={(url) => update("banner_url", url)} token={token} folder="banner" accept="image/*" />
      <TextAreaField label="Company description" value={form.description} onChange={(v) => update("description", v)} rows={4} />
      <FileField label="Company brochure (PDF)" value={form.brochure_url} onUploaded={(url) => update("brochure_url", url)} token={token} folder="brochure" accept="application/pdf" bucket="seller-documents" />
      <TextField label="Company video" optional value={form.video_url} onChange={(v) => update("video_url", v)} placeholder="YouTube link" />
    </div>
  );
}

function PhotosStep({ photos, setPhotos, token }) {
  const CATS = [
    { key: "office", label: "Office" }, { key: "factory", label: "Factory" },
    { key: "warehouse", label: "Warehouse / Inventory" }, { key: "team", label: "Team" },
    { key: "product", label: "Product Showcase" },
  ];
  const handleUpload = async (cat, file) => {
    const res = await uploadSellerFile(token, file, `photos/${cat}`);
    if (res?.success) setPhotos((p) => [...p, { category: cat, url: res.url, id: crypto.randomUUID() }]);
  };
  return (
    <div className="flex flex-col gap-5">
      {CATS.map((c) => (
        <div key={c.key}>
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.filter((p) => p.category === c.key).map((p) => (
              <div key={p.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((ph) => ph.filter((x) => x.id !== p.id))}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <UploadTile onFile={(f) => handleUpload(c.key, f)} />
          </div>
        </div>
      ))}
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

function CertificationsStep({ certifications, setCertifications, token }) {
  const addRow = () => setCertifications((c) => [...c, { id: crypto.randomUUID(), type: "iso", name: "", issued_by: "", file_url: "" }]);
  const update = (id, key, val) => setCertifications((c) => c.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const removeRow = (id) => setCertifications((c) => c.filter((r) => r.id !== id));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] font-medium text-slate-500">Optional — ISO certificates, industry certifications (CE, BIS, FDA, IATF), or awards build buyer trust.</p>
      {certifications.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex items-center justify-between">
            <select value={row.type} onChange={(e) => update(row.id, "type", e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-[12.5px] font-semibold">
              <option value="iso">ISO</option><option value="industry">Industry Cert</option><option value="award">Award</option>
            </select>
            <button type="button" onClick={() => removeRow(row.id)}><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField label="Name" value={row.name} onChange={(v) => update(row.id, "name", v)} compact />
            <TextField label="Issued by" optional value={row.issued_by} onChange={(v) => update(row.id, "issued_by", v)} compact />
          </div>
          <div className="mt-2.5">
            <FileField label="Certificate file" value={row.file_url} onUploaded={(url) => update(row.id, "file_url", url)} token={token} folder="certs" accept="application/pdf,image/*" bucket="seller-documents" compact />
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-3 text-[13px] font-bold text-[#047084]">
        <Plus className="h-4 w-4" /> Add certification
      </button>
    </div>
  );
}

function OperationsStep({ form, update }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Manufacturing facility</label>
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button key={opt} type="button" onClick={() => update("manufacturing_facility", opt === "Yes")}
              className="rounded-lg border-2 px-4 py-2 text-[13px] font-bold"
              style={{ borderColor: form.manufacturing_facility === (opt === "Yes") ? "#047084" : "#e5e9ea", color: form.manufacturing_facility === (opt === "Yes") ? "#047084" : "#64748b" }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      <TagField label="Export countries" optional value={form.export_countries} onChange={(v) => update("export_countries", v)} placeholder="e.g. UAE, USA" />
      <TagField label="Industries served" optional value={form.industries_served} onChange={(v) => update("industries_served", v)} placeholder="e.g. Automotive, Pharma" />
      <TextField label="Production capacity" optional value={form.production_capacity} onChange={(v) => update("production_capacity", v)} />
    </div>
  );
}

function DigitalStep({ form, update }) {
  return (
    <div className="flex flex-col gap-4">
      <TextField label="LinkedIn" optional value={form.linkedin_url} onChange={(v) => update("linkedin_url", v)} />
      <TextField label="Facebook" optional value={form.facebook_url} onChange={(v) => update("facebook_url", v)} />
      <TextField label="Instagram" optional value={form.instagram_url} onChange={(v) => update("instagram_url", v)} />
      <TextField label="YouTube" optional value={form.youtube_url} onChange={(v) => update("youtube_url", v)} />
    </div>
  );
}

const SWATCHES = ["#047084", "#d2462b", "#7c3aed", "#16a34a", "#c026d3", "#0891b2", "#ea580c", "#1d4ed8"];
function BrandingStep({ form, update }) {
  return (
    <div className="flex flex-col gap-5">
      <ColorField label="Primary color" value={form.primary_color} onChange={(v) => update("primary_color", v)} />
      <ColorField label="Secondary color" value={form.secondary_color} onChange={(v) => update("secondary_color", v)} />
      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Shop preview</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
          <div className="h-16" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }} />
          <div className="flex items-center gap-2 bg-white p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-extrabold" style={{ background: form.primary_color }}>
              {(form.display_name || "S")[0]}
            </span>
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
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] font-medium text-slate-600">Review your details below. Once submitted, our team typically reviews within 24–48 hours.</p>
      {[
        ["Display name", form.display_name], ["Business type", form.business_type], ["Industry", form.industry],
        ["Contact person", form.contact_person], ["Address", `${form.address}, ${form.city}, ${form.state} ${form.pincode}`],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-slate-100 py-2 text-[13px]">
          <span className="font-semibold text-slate-500">{label}</span>
          <span className="max-w-[60%] truncate text-right font-bold text-slate-800">{value || "—"}</span>
        </div>
      ))}
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
function TextField({ label, value = "", onChange, optional, placeholder, inputMode, trailing, compact }) {
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <div className="relative">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
          className={fieldWrap() + (compact ? " py-2 text-[13px]" : "")} />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}
function NumberField({ label, value, onChange }) {
  return <TextField label={label} value={value ?? ""} onChange={(v) => onChange(v.replace(/\D/g, ""))} inputMode="numeric" />;
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
function TagField({ label, value = [], onChange, placeholder, optional }) {
  const [input, setInput] = useState("");
  const add = () => { const v = input.trim(); if (v && !value.includes(v)) onChange([...value, v]); setInput(""); };
  return (
    <div className="flex flex-col gap-1">
      <Label optional={optional}>{label}</Label>
      <div className={fieldWrap() + " flex flex-wrap items-center gap-1.5 py-2"}>
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-[#047084]/10 px-2.5 py-1 text-[12px] font-bold text-[#047084]">
            {tag} <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          onBlur={add} placeholder={placeholder} className="min-w-[100px] flex-1 bg-transparent text-[13px] font-medium focus:outline-none" />
      </div>
    </div>
  );
}
function FileField({ label, value, onUploaded, token, folder, accept, bucket = "seller-assets", compact }) {
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
      {!compact && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        {value ? (
          accept?.startsWith("image") ? (
            <img src={value} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <span className="flex h-12 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-[#047084]"><CheckCircle2 className="h-3.5 w-3.5" />Uploaded</span>
          )
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
function UploadTile({ onFile }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:border-[#7fb3bd] hover:text-[#047084]">
        <Plus className="h-5 w-5" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </>
  );
}
function ColorField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} className="h-8 w-8 rounded-full border-2" style={{ background: c, borderColor: value === c ? "#0f172a" : "transparent" }} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 rounded-full border border-slate-200" />
        <span className="text-[12.5px] font-bold text-slate-500">{value}</span>
      </div>
    </div>
  );
}

function GstReferencePanel({ gstData }) {
  if (!gstData) return null;
  const rows = [
    ["Legal name", gstData.legal_name],
    ["Trade name", gstData.trade_name],
    ["GSTIN status", gstData.gstin_status],
    ["Constitution", gstData.constitution],
    ["Taxpayer type", gstData.taxpayer_type],
    ["GST registration date", gstData.gst_registration_date],
    ["GST last updated", gstData.gst_last_updated],
    ["Registered address", gstData.registered_address],
    ["District", gstData.district],
    ["Pincode", gstData.pincode],
    ["State", gstData.state],
    ["State code", gstData.state_code],
    ["PAN (GST record)", gstData.pan],
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
            <span className="max-w-[60%] truncate text-right font-bold text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}