// src/pages/SellerDashboardPage.jsx
import { useEffect, useState } from "react";
import {
  Loader2, Store, Eye, Building2, Camera, Package, Palette, AlertCircle, ShieldCheck,
  RefreshCw, CheckCircle2, Smartphone, Monitor,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchSellerDashboard, updateSellerProfile, updateSellerTheme,
  addSellerPhoto, deleteSellerPhoto, uploadSellerFile,
  createSellerProduct, deleteSellerProduct,
} from "../utils/api.js";
import ShopPage from "./ShopPage.jsx";

const TABS = [
  { key: "info", label: "Company Info", icon: Building2 },
  { key: "media", label: "Photos & Certs", icon: Camera },
  { key: "products", label: "Products", icon: Package },
  { key: "branding", label: "Branding", icon: Palette },
];

const GST_FIELD_LABELS = { address: "Registered address", city: "City", state: "State", pincode: "PIN code", pan: "PAN" };

export default function SellerDashboardPage({ slug }) {
  const { token } = useAuth();
  const [view, setView] = useState("manage");
  const [tab, setTab] = useState("info");
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = () => fetchSellerDashboard(token).then((res) => {
    if (res?.success) { setDash(res); setForm(res.seller); }
    setLoading(false);
  });
  useEffect(() => { if (token) load(); }, [token]);

  const update = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const saveInfo = async (fields) => {
    setSaving(true);
    const res = await updateSellerProfile(token, fields);
    if (res?.success) { setSaved(true); await load(); }
    setSaving(false);
  };
  const saveTheme = async (colors) => { const res = await updateSellerTheme(token, colors); if (res?.success) await load(); };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#047084]" /></div>;
  if (!dash) return null;
  const { seller } = dash;

  // Simple completeness score — nudges sellers to fill everything out, common pattern on B2B marketplaces
  const fieldsToCheck = ["logo_url", "banner_url", "description", "website", "video_url"];
  const filled = fieldsToCheck.filter((f) => seller[f]).length;
  const completeness = Math.round(((6 + filled) / (6 + fieldsToCheck.length)) * 100); // base 6 required fields already done to be live

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              {seller.logo_url ? <img src={seller.logo_url} className="h-full w-full object-contain p-0.5" alt="" /> : <Store className="h-4 w-4 text-slate-300" />}
            </div>
            <h1 className="truncate text-[15px] font-extrabold text-slate-900 sm:text-[17px]">{seller.display_name}</h1>
          </div>
          <div className="flex shrink-0 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button onClick={() => setView("manage")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition sm:px-3.5 sm:text-[12.5px]"
              style={{ background: view === "manage" ? "#047084" : "transparent", color: view === "manage" ? "white" : "#64748b" }}>
              <Store className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Manage</span>
            </button>
            <button onClick={() => setView("preview")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition sm:px-3.5 sm:text-[12.5px]"
              style={{ background: view === "preview" ? "#047084" : "transparent", color: view === "preview" ? "white" : "#64748b" }}>
              <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Live Preview</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl pt-4 sm:px-6 sm:pb-16">
        {seller.has_pending_changes && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold text-amber-700 sm:px-4 sm:py-3 sm:text-[12.5px]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            You have changes waiting for admin review. Buyers still see your previously approved shop until they're approved.
          </div>
        )}
        {seller.status === "rejected" && seller.rejection_reason && (
          <div className="mb-4 rounded-xl border border-[#c71f11]/20 bg-[#c71f11]/[0.04] px-3.5 py-2.5 text-[12px] font-semibold text-[#c71f11] sm:px-4 sm:py-3 sm:text-[12.5px]">
            {seller.rejection_reason}
          </div>
        )}

        {view === "preview" ? (
          <div>
            
            <div className="mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all"
              style={{ maxWidth: previewWidth === "mobile" ? "390px" : "100%" }}>
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="ml-2 truncate text-[10.5px] font-medium text-slate-400">bbmpvtltd.com/shop/{seller.shop_slug}</span>
              </div>
              <ShopPage previewData={{ seller: dash.effective, photos: dash.photos, certifications: dash.certifications, products: dash.products }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row">
            {/* Desktop sidebar */}
            <aside className="hidden w-56 shrink-0 lg:block">
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Shop strength</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${completeness}%`, background: "linear-gradient(90deg,#0a95ab,#047084)" }} />
                </div>
                <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{completeness}% complete</p>
              </div>
              <nav className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-100 bg-white p-1.5">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition"
                    style={{ background: tab === t.key ? "#04708414" : "transparent", color: tab === t.key ? "#047084" : "#475569" }}>
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Mobile tab pills */}
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto mx-3 pb-1 lg:hidden">
            {TABS.map((t) => (
                <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold"
                style={{
                    background: tab === t.key ? "#047084" : "#f1f5f9",
                    color: tab === t.key ? "white" : "#64748b",
                }}
                >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
            ))}
            </div>

            <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-4 sm:p-6">
              {tab === "info" && (
                <InfoTab form={form} update={update} onSave={saveInfo} saving={saving} saved={saved} business={dash.business} />
              )}
              {tab === "media" && <MediaTab token={token} dash={dash} onChange={load} />}
              {tab === "products" && <ProductsTab token={token} products={dash.products} onChange={load} />}
              {tab === "branding" && <BrandingTab seller={seller} onSave={saveTheme} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTab({ form, update, onSave, saving, saved, business }) {
  const FIELD_GROUPS = [
    { title: "Basics", fields: ["display_name", "business_type", "industry", "year_established", "employee_range", "annual_turnover"] },
    { title: "Contact", fields: ["contact_person", "designation", "whatsapp_number", "website"] },
    { title: "Dispatch / operating address", fields: ["address", "pincode", "city", "state", "country"] },
    { title: "Business credentials", fields: ["pan", "iec_code", "udyam_number", "cin"] },
    { title: "Operations", fields: ["manufacturing_facility", "production_capacity"] },
    { title: "About", fields: ["description"] },
  ];
  const saveGroup = () => {
    const fields = FIELD_GROUPS.flatMap((g) => g.fields);
    const payload = {};
    fields.forEach((f) => { if (form[f] !== undefined) payload[f] = form[f]; });
    onSave(payload);
  };

  return (
    <div className="flex flex-col gap-7">
      <GstReferencePanel gstData={business ? mapBusinessToDisplay(business) : null} />

      {FIELD_GROUPS.map((g) => (
        <div key={g.title}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{g.title}</h3>
          {g.title === "Dispatch / operating address" && (
            <p className="mb-2 text-[11.5px] font-medium text-slate-400">This is what buyers see and where shipments originate — it can differ from your GST registered address above.</p>
          )}
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f} className={f === "description" ? "sm:col-span-2" : ""}>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{f.replace(/_/g, " ")}</label>
                {f === "description" ? (
                  <textarea value={form[f] || ""} onChange={(e) => update(f, e.target.value)} rows={4}
                    className="mt-1 w-full rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-medium focus:border-[#047084] focus:outline-none" />
                ) : f === "manufacturing_facility" ? (
                  <div className="mt-1 flex gap-2">
                    {["Yes", "No"].map((opt) => (
                      <button key={opt} type="button" onClick={() => update(f, opt === "Yes")}
                        className="rounded-lg border-2 px-4 py-2 text-[13px] font-bold"
                        style={{ borderColor: form[f] === (opt === "Yes") ? "#047084" : "#e5e9ea", color: form[f] === (opt === "Yes") ? "#047084" : "#64748b" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={form[f] || ""} onChange={(e) => update(f, e.target.value)}
                    className="mt-1 w-full rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-semibold focus:border-[#047084] focus:outline-none" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={saveGroup} disabled={saving}
          className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-white" style={{ background: "linear-gradient(135deg,#047084,#0a95ab)" }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-[12.5px] font-semibold text-emerald-600">Saved — sent for admin review.</span>}
      </div>
    </div>
  );
}

// business_profiles row already matches the mapGstResponse() shape from your API layer,
// so this is just a passthrough — kept as a named function in case the raw row and the
// mapped shape ever diverge (e.g. nature_of_business stored differently).
function mapBusinessToDisplay(business) {
  return {
    legal_name: business.legal_name,
    trade_name: business.trade_name,
    gstin_status: business.gstin_status ?? business.status,
    constitution: business.constitution,
    taxpayer_type: business.taxpayer_type,
    gst_registration_date: business.gst_registration_date ?? business.registration_date,
    gst_last_updated: business.gst_last_updated ?? business.last_updated,
    registered_address: business.registered_address ?? business.address,
    district: business.district,
    pincode: business.pincode,
    state: business.state,
    state_code: business.state_code,
    pan: business.pan,
    nature_of_business: business.nature_of_business,
  };
}

function MediaTab({ token, dash, onChange }) {
  const CATS = [
    { key: "office", label: "Office" }, { key: "factory", label: "Factory" },
    { key: "warehouse", label: "Warehouse" }, { key: "team", label: "Team" }, { key: "product", label: "Products" },
  ];
  const handleUpload = async (cat, file) => {
    const up = await uploadSellerFile(token, file, `photos/${cat}`);
    if (up?.success) { await addSellerPhoto(token, cat, up.url); onChange(); }
  };
  const removePhoto = async (id) => { await deleteSellerPhoto(token, id); onChange(); };

  return (
    <div className="flex flex-col gap-6">
      {CATS.map((c) => {
        const imgs = dash.photos.filter((p) => p.category === c.key);
        return (
          <div key={c.key}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {imgs.map((p) => (
                <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                  <img src={p.url} className="h-full w-full object-cover" alt="" />
                  {p.pending && <span className="absolute left-0.5 top-0.5 rounded bg-amber-500 px-1 text-[9px] font-bold text-white">Pending</span>}
                  <button onClick={() => removePhoto(p.id)} className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white text-[10px]">✕</button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:border-[#7fb3bd] hover:text-[#047084]">
                +
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(c.key, f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductsTab({ token, products, onChange }) {
  const [draft, setDraft] = useState({ name: "", price: "", unit: "", image_url: "" });
  const add = async () => { if (!draft.name.trim()) return; await createSellerProduct(token, draft); setDraft({ name: "", price: "", unit: "", image_url: "" }); onChange(); };
  const remove = async (id) => { await deleteSellerProduct(token, id); onChange(); };
  const uploadImage = async (file) => { const up = await uploadSellerFile(token, file, "products"); if (up?.success) setDraft((d) => ({ ...d, image_url: up.url })); };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-dashed border-slate-200 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Add a product</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Product name"
            className="rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-semibold sm:col-span-2" />
          <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Price"
            className="rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-semibold" />
          <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Unit (e.g. kg)"
            className="rounded-md border-2 border-slate-200 px-3 py-2 text-[13px] font-semibold" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 text-slate-300">
            {draft.image_url ? <img src={draft.image_url} className="h-full w-full object-cover" alt="" /> : "img"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
          </label>
          <button onClick={add} className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white" style={{ background: "linear-gradient(135deg,#d2462b,#c71f11)" }}>
            Add product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="relative overflow-hidden rounded-xl border border-slate-100">
            <div className="aspect-square w-full bg-slate-50">{p.image_url && <img src={p.image_url} className="h-full w-full object-cover" alt="" />}</div>
            <div className="p-2">
              <p className="truncate text-[12px] font-bold text-slate-800">{p.name}</p>
              <p className="text-[11px] font-semibold text-slate-400">{p.price}{p.unit ? ` / ${p.unit}` : ""}</p>
            </div>
            <button onClick={() => remove(p.id)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-[11px]">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const SWATCHES = ["#047084", "#d2462b", "#7c3aed", "#16a34a", "#c026d3", "#0891b2", "#ea580c", "#1d4ed8"];
function BrandingTab({ seller, onSave }) {
  const [primary, setPrimary] = useState(seller.primary_color);
  const [secondary, setSecondary] = useState(seller.secondary_color);
  const dirty = primary !== seller.primary_color || secondary !== seller.secondary_color;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-5">
        <p className="text-[12px] font-medium text-slate-500">Theme changes apply instantly — no approval needed.</p>
        {[["Primary color", primary, setPrimary], ["Secondary color", secondary, setSecondary]].map(([label, val, setter]) => (
          <div key={label} className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => setter(c)}
                  className="h-9 w-9 rounded-full border-2 transition-transform active:scale-95"
                  style={{ background: c, borderColor: val === c ? "#0f172a" : "transparent" }} />
              ))}
              <input type="color" value={val} onChange={(e) => setter(e.target.value)} className="h-9 w-9 rounded-full border border-slate-200" />
            </div>
          </div>
        ))}
        <button onClick={() => onSave({ primary_color: primary, secondary_color: secondary })} disabled={!dirty}
          className="w-fit rounded-xl px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#047084,#0a95ab)" }}>
          Update theme
        </button>
      </div>

      {/* Live mini preview so the seller sees the effect before/without leaving the tab */}
      <div className="w-full lg:w-64">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Preview</p>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="h-16" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
          <div className="flex items-center gap-2 bg-white p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-extrabold" style={{ background: primary }}>
              {(seller.display_name || "S")[0]}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-extrabold text-slate-900">{seller.display_name || "Your Shop"}</p>
              <button className="mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: secondary }}>Contact Supplier</button>
            </div>
          </div>
        </div>
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