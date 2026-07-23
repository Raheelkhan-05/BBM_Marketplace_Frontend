import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2, ShieldCheck, MapPin, Calendar, Users, Globe, FileText,
  MessageCircle, Award, Building2,
} from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube } from "react-icons/fa";
import { fetchShopBySlug } from "../utils/api.js";

const CAT_LABELS = { office: "Office", factory: "Factory", warehouse: "Warehouse", team: "Team", product: "Products" };

export default function ShopPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchShopBySlug(slug).then((res) => {
      if (res?.success) setData(res);
      else setNotFound(true);
    });
  }, [slug]);

  if (notFound) return <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
    <p className="text-[16px] font-bold text-slate-700">This shop isn't available.</p>
    <p className="mt-1 text-[13px] text-slate-400">It may still be under review or doesn't exist.</p>
  </div>;

  if (!data) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#047084]" /></div>;

  const { seller, photos, certifications } = data;
  const primary = seller.primary_color || "#047084";
  const secondary = seller.secondary_color || "#d2462b";

  return (
    <div style={{ "--shop-primary": primary, "--shop-secondary": secondary }}>
      {/* Hero */}
      <div className="relative h-44 w-full overflow-hidden sm:h-64" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
        {seller.banner_url && <img src={seller.banner_url} alt="" className="h-full w-full object-cover opacity-90" />}
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-col items-start gap-4 sm:-mt-14 sm:flex-row sm:items-end">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg sm:h-28 sm:w-28">
            {seller.logo_url ? <img src={seller.logo_url} alt="" className="h-full w-full object-cover" /> : (
              <div className="flex h-full w-full items-center justify-center" style={{ background: primary }}>
                <Building2 className="h-8 w-8 text-white/80" />
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-extrabold text-slate-900 sm:text-[26px]">{seller.display_name}</h1>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: primary }}>
                <ShieldCheck className="h-3 w-3" /> GST Verified
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{seller.city}, {seller.state}</span>
              {seller.year_established && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Est. {seller.year_established}</span>}
              {seller.employee_range && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{seller.employee_range} employees</span>}
            </p>
          </div>

          {seller.whatsapp_number && (
            <a href={`https://wa.me/91${seller.whatsapp_number}`} target="_blank" rel="noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-lg"
              style={{ background: secondary }}>
              <MessageCircle className="h-4 w-4" /> Contact Seller
            </a>
          )}
        </div>

        {/* Categories & products */}
        {(seller.categories?.length > 0 || seller.products_brands?.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {[...(seller.categories || []), ...(seller.products_brands || [])].map((t) => (
              <span key={t} className="rounded-full px-3 py-1 text-[11.5px] font-bold" style={{ background: `${primary}14`, color: primary }}>{t}</span>
            ))}
          </div>
        )}

        {/* Description */}
        {seller.description && (
          <div className="mt-7 rounded-xl border border-slate-100 bg-white p-5">
            <h2 className="text-[15px] font-extrabold text-slate-900">About {seller.display_name}</h2>
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{seller.description}</p>
            {seller.brochure_url && (
              <a href={seller.brochure_url} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: primary }}>
                <FileText className="h-4 w-4" /> Download Company Brochure
              </a>
            )}
          </div>
        )}

        {/* Certifications */}
        {certifications?.length > 0 && (
          <div className="mt-5">
            <h2 className="text-[14px] font-extrabold text-slate-900">Certifications & Credentials</h2>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {certifications.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <Award className="h-4 w-4" style={{ color: primary }} />
                  <span className="text-[12.5px] font-bold text-slate-700">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {photos?.length > 0 && (
          <div className="mt-7">
            <h2 className="text-[14px] font-extrabold text-slate-900">Gallery</h2>
            {Object.entries(CAT_LABELS).map(([cat, label]) => {
              const imgs = photos.filter((p) => p.category === cat);
              if (!imgs.length) return null;
              return (
                <div key={cat} className="mt-3">
                  <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                    {imgs.map((p, i) => (
                      <motion.img key={i} src={p.url} alt="" whileHover={{ scale: 1.03 }}
                        className="h-28 w-28 shrink-0 rounded-lg object-cover sm:h-36 sm:w-36" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Social + website */}
        <div className="mt-8 mb-14 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
          {seller.website && <ShopSocialLink href={seller.website} icon={Globe} />}
          {seller.linkedin_url && <ShopSocialLink href={seller.linkedin_url} icon={FaLinkedin} />}
          {seller.facebook_url && <ShopSocialLink href={seller.facebook_url} icon={FaFacebook} />}
          {seller.instagram_url && <ShopSocialLink href={seller.instagram_url} icon={FaInstagram} />}
          {seller.youtube_url && <ShopSocialLink href={seller.youtube_url} icon={FaYoutube} />}
        </div>
      </div>
    </div>
  );
}

function ShopSocialLink({ href, icon: Icon }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#047084] hover:text-[#047084]">
      <Icon className="h-4 w-4" />
    </a>
  );
}