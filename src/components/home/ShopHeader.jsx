// components/home/ShopHeader.jsx
//
//   <ShopHeader />      – fetches the shop and renders it (HomePage)
//   <ShopHeaderView />  – pure presentation (also the live preview in GrowStorePage)
//
// Templates, each with its OWN accent treatment AND its own background art:
//   letterhead = Classic  -> soft corner glow + loose flowing lines (art: ArtLight)
//   solid      = Bold     -> aurora glow + sweeping ribbon + scattered specks (art: ArtBold)
//   cover      = Photo    -> layered waves + offset sun, only when no cover photo (art: ArtWaves)
//   compact    = Compact  -> one faint corner glow (pure CSS)
// Size comes from the header's own width (ResizeObserver -> data-w = s | m | l).
// Every rule is scoped to .sh-wrap and its specificity is raised in code (see CSS below),
// so global stylesheets such as .gsl cannot override it.
//
// TUNING: font sizes / icon sizes / chip heights live in "TYPE SCALE";
//         background-art strength lives in "BACKGROUND ART". Edit the numbers there only.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BadgeCheck, Check, ChevronDown, MapPin, Share2, X } from "lucide-react";
import { fetchShopInfo } from "../../utils/api";
import { resizedImageUrl } from "../../utils/imageUrl";
import { sanitizeTheme } from "../../utils/storeTheme.js";

const RAW_CSS = `
/* =====================================================================
   TYPE SCALE – tweak here. Small width (s) is the default; m and l below
   override only the groups that grow with width.
   ===================================================================== */
.sh-wrap{
  /* Group 1: identity */
  --fs-name:18px;        /* shop name (Classic / Bold / Photo) */
  --fs-tagline:15px;     /* tagline under the name */
  --fs-meta:12.5px;      /* "Verified seller" + location text */
  --ic-meta:14px;        /* verified badge icon + map pin icon */

  /* Group 2: pills and chips */
  --fs-badge:11.5px;     /* "Verified seller" pill in Bold / Photo */
  --h-badge:22px;        /* height of that pill */
  --fs-chip: 12px;      /* highlight chips on the banner */
  --h-chip: 24px;         /* chip height in Bold / Photo */
  --ic-chip: 15px;        /* tick icon in chips */

  /* Group 3: "About this store" panel */
  --fs-toggle:14px;      /* "About this store" / "Hide details" */
  --fs-about:16px;     /* about paragraph */
  --fs-points:16px;      /* key points list */
  --fs-tagitem:13px;     /* tags (What we sell, Highlights) */
  --fs-label:14px;       /* small uppercase section labels */

  /* Group 4: compact template */
  --fs-cname:15px;       /* shop name in the compact row */
  --fs-csub:12px;        /* location · tagline line */
  --ic-cname:14px;       /* verified icon next to compact name */

  /* Group 5: misc */
  --fs-base:16px;        /* fallback size for the whole header */
  --fs-toast:15px;       /* "Link copied" toast */
}
.sh-wrap[data-w="m"]{--fs-name:26px;--fs-tagline:18.5px;--fs-cname:19px}
.sh-wrap[data-w="l"]{--fs-name:31px;--fs-tagline:19.5px;--fs-cname:20px}

/* =====================================================================
   BACKGROUND ART – overall strength per template.
   1 = as designed, 0.5 = half as visible, 0 = hidden.
   The art is also masked so it fades out behind the text on its own.
   ===================================================================== */
.sh-wrap{
  --art-light:0.5;         /* Classic: glow + flowing lines */
  --art-dark:0.8;          /* Bold: aurora + ribbon + specks */
  --art-waves:1;         /* Photo (no cover image): waves + sun */
  --art-compact:0.7;       /* Compact: corner glow */
}

/* ===================== layout tokens ===================== */
.sh-wrap{display:block;width:100%;min-width:0;font-family:inherit;
  --ink:#0B1116;--body:#34414A;--mute:#5B6770;--hair:rgba(11,17,22,.1);
  --pad:16px;--gap:12px;--logo:52px;--btn:34px;--cover:104px}
.sh-wrap[data-w="m"]{--pad:20px;--gap:14px;--logo:60px;--cover:132px}
.sh-wrap[data-w="l"]{--pad:28px;--gap:16px;--logo:72px;--btn:36px;--cover:176px}
.sh-wrap *,.sh-wrap *::before,.sh-wrap *::after{box-sizing:border-box}

/* display/position/size are forced so page-level rules on <header> (flex, grid, sticky, fixed height...) can't re-lay out the template */
.sh-wrap .sh{display:block;position:relative;float:none;top:auto;left:auto;right:auto;bottom:auto;
  width:100%;max-width:100%;height:auto;min-height:0;margin:0;
  overflow:hidden;isolation:isolate;border-radius:18px;text-align:left;
  font-family:inherit;font-size:var(--fs-base);line-height:1.4;letter-spacing:normal;text-transform:none;
  animation:sh-in .45s cubic-bezier(.16,1,.3,1) both}
.sh-wrap .sh h2,.sh-wrap .sh p,.sh-wrap .sh ul,.sh-wrap .sh li{padding:0;list-style:none;font-family:inherit;text-transform:none}
@keyframes sh-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes sh-drift{from{transform:translate(0,0)}to{transform:translate(-8px,6px)}}
@keyframes sh-pop{from{opacity:0;transform:translateY(-50%) scale(.96)}to{opacity:1;transform:translateY(-50%) scale(1)}}

/* surfaces */
.sh-wrap .sh-light{background:#fff;color:var(--ink);border:1px solid var(--hair);
  box-shadow:0 1px 2px rgba(11,17,22,.04),0 16px 32px -26px rgba(11,17,22,.35)}
.sh-wrap .sh-dark{color:#fff;
  background:radial-gradient(60% 110% at 100% 0%,rgba(255,255,255,.08) 0%,rgba(255,255,255,0) 60%),
             linear-gradient(135deg,var(--a-hi) 0%,var(--a-lo) 100%);
  box-shadow:0 20px 40px -26px var(--a-lo)}
.sh-wrap .sh-dark::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}

/* background art (decorative only, always behind content) */
.sh-wrap .sh-art{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
.sh-wrap .sh-art.l{color:var(--a);opacity:var(--art-light)}
.sh-wrap .sh-art.d{color:#fff;opacity:var(--art-dark)}
.sh-wrap .sh-art.w{color:#fff;opacity:var(--art-waves)}
.sh-wrap .sh-art .a1{animation:sh-drift 22s ease-in-out infinite alternate}
.sh-wrap .sh-art .a2{animation:sh-drift 30s ease-in-out infinite alternate-reverse}
.sh-wrap .sh-in{display:block;position:relative;z-index:2;width:100%;padding:var(--pad)}

/* identity */
.sh-wrap .sh-id{display:flex;align-items:flex-start;gap:var(--gap)}
.sh-wrap .sh-txt{min-width:0;flex:1;padding-top:2px}
.sh-wrap .sh-logo{flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;
  width:var(--logo);height:var(--logo);border-radius:calc(var(--logo) * .27);background:#fff;color:var(--a);
  font-size:calc(var(--logo) * .4);font-weight:800;line-height:1;
  box-shadow:0 8px 18px -10px rgba(0,0,0,.4),0 0 0 1px rgba(11,17,22,.08)}
.sh-wrap .sh-logo img{display:block;width:100%;height:100%;object-fit:contain;padding:0px;border-radius:0}
.sh-wrap .sh-light .sh-logo.empty{background:var(--tint2)}
.sh-wrap .sh-name{font-size:var(--fs-name);line-height:1.15;font-weight:800;letter-spacing:-.02em;text-wrap:balance;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.sh-wrap .sh-light .sh-name{color:var(--ink)}
.sh-wrap .sh-dark .sh-name{color:#fff}
.sh-wrap .sh-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:7px;font-size:var(--fs-meta);font-weight:600;line-height:1.2}
.sh-wrap .sh-ver{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:var(--fs-meta);font-weight:700}
.sh-wrap .sh-ver svg{width:var(--ic-meta);height:var(--ic-meta);flex:none}
.sh-wrap .sh-loc{display:inline-flex;align-items:center;gap:5px;min-width:0}
.sh-wrap .sh-loc svg{width:var(--ic-meta);height:var(--ic-meta);flex:none}
.sh-wrap .sh-loc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-wrap .sh-light .sh-loc{color:var(--mute)}
.sh-wrap .sh-dark .sh-loc{color:rgba(255,255,255,.9)}
.sh-wrap .sh-classic .sh-ver{color:var(--a-ink)}
.sh-wrap .sh-classic .sh-ver svg{color:var(--a)}
.sh-wrap .sh-bold .sh-ver{height:var(--h-badge);padding:0 12px 0 8px;border-radius:999px;font-size:var(--fs-badge);color:#fff;
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3)}
.sh-wrap .sh-photo .sh-ver{height:var(--h-badge);padding:0 12px 0 8px;border-radius:999px;font-size:var(--fs-badge);color:#fff;background:var(--a-lo)}

/* actions */
.sh-wrap .sh-acts{position:relative;display:flex;align-items:center;gap:8px;flex:none}
.sh-wrap .sh-btn{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;
  flex:none;width:var(--btn);height:var(--btn);min-width:0;min-height:0;padding:0;margin:0;border-radius:50%;
  border:1px solid transparent;box-shadow:none;font:inherit;line-height:1;letter-spacing:0;text-transform:none;
  cursor:pointer;transition:background .2s,color .2s,transform .15s}
.sh-wrap .sh-btn:active{transform:scale(.92)}
.sh-wrap .sh-btn:focus-visible,.sh-wrap .sh-tog:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.sh-wrap .sh-btn svg{width:16px;height:16px;flex:none}
.sh-wrap .sh-glass{background:rgba(8,12,16,.42);color:#fff;border-color:rgba(255,255,255,.28);
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.sh-wrap .sh-glass:hover{background:rgba(8,12,16,.6)}
.sh-wrap .sh-pale{background:#fff;color:var(--mute);border-color:var(--hair)}
.sh-wrap .sh-pale:hover{background:#F3F5F6;color:var(--ink)}
.sh-wrap .sh-pale svg{transition:transform .3s}
.sh-wrap .sh-pale[aria-expanded="true"] svg{transform:rotate(180deg)}
.sh-wrap .sh-toast{position:absolute;right:calc(100% + 8px);top:50%;z-index:10;transform:translateY(-50%);
  white-space:nowrap;pointer-events:none;padding:7px 12px;border-radius:10px;background:#0B1116;color:#fff;
  font-size:var(--fs-toast);font-weight:700;line-height:1;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);animation:sh-pop .2s ease-out both}

/* tagline */
.sh-wrap .sh-tagline{margin-top:var(--gap);max-width:62ch;font-size:var(--fs-tagline);line-height:1.5;font-weight:500;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.sh-wrap .sh-light .sh-tagline{color:var(--body)}
.sh-wrap .sh-dark .sh-tagline{color:rgba(255,255,255,.94)}
.sh-wrap .sh-classic .sh-tagline{padding-left:12px;border-left:3px solid var(--a)}

/* highlights */
.sh-wrap .sh-hl{display:flex;flex-wrap:wrap;margin-top:var(--gap)}
.sh-wrap .sh-h{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;font-size:var(--fs-chip);font-weight:600;line-height:1.2}
.sh-wrap .sh-h svg{width:var(--ic-chip);height:var(--ic-chip);flex:none;stroke-width:3}
.sh-wrap .sh-h span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-wrap .sh-h i{flex:none;width:8px;height:8px;border-radius:50%;background:var(--a)}
.sh-wrap .sh-classic .sh-hl{gap:8px 18px;padding-top:var(--gap);border-top:1px solid var(--hair)}
.sh-wrap .sh-classic .sh-h{color:var(--body)}
.sh-wrap .sh-classic .sh-h svg{color:var(--a)}
.sh-wrap .sh-bold .sh-hl{gap:8px}
.sh-wrap .sh-bold .sh-h{height:var(--h-chip);padding:0 14px 0 12px;border-radius:999px;color:#fff;
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.26)}
.sh-wrap .sh-photo .sh-hl{gap:8px}
.sh-wrap .sh-photo .sh-h{height:var(--h-chip);padding:0 14px 0 12px;border-radius:8px;color:var(--a-ink);
  background:#fff;border:1.5px solid var(--edge)}

/* details */
.sh-wrap .sh-det{margin-top:var(--gap);border-top:1px solid var(--hair)}
.sh-wrap .sh-dark .sh-det{border-top-color:rgba(255,255,255,.2)}
.sh-wrap .sh-tog{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  width:100%;min-height:48px;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;color:inherit;
  font:inherit;font-size:var(--fs-toggle);font-weight:700;letter-spacing:normal;text-transform:none;text-align:left;cursor:pointer}
.sh-wrap .sh-light .sh-tog{color:var(--a-ink)}
.sh-wrap .sh-tgi{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;flex:none}
.sh-wrap .sh-light .sh-tgi{background:var(--tint)}
.sh-wrap .sh-dark .sh-tgi{background:rgba(255,255,255,.16)}
.sh-wrap .sh-tgi svg{width:15px;height:15px;transition:transform .3s}
.sh-wrap .sh-tog[aria-expanded="true"] .sh-tgi svg{transform:rotate(180deg)}
.sh-wrap .sh-pw{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s cubic-bezier(.16,1,.3,1)}
.sh-wrap .sh-pw.open{grid-template-rows:1fr}
.sh-wrap .sh-pn{overflow:hidden;min-height:0}
.sh-wrap .sh-pb{display:grid;gap:18px;padding:4px 0 6px}
.sh-wrap .sh-about{font-size:var(--fs-about);line-height:1.65;font-weight:500;white-space:pre-line;overflow-wrap:anywhere}
.sh-wrap .sh-light .sh-about,.sh-wrap .sh-light .sh-pts li{color:var(--body)}
.sh-wrap .sh-dark .sh-about,.sh-wrap .sh-dark .sh-pts li{color:rgba(255,255,255,.93)}
.sh-wrap .sh-pg{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.sh-wrap[data-w="m"] .sh-pg.two,.sh-wrap[data-w="l"] .sh-pg.two{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 32px}
.sh-wrap .sh-lbl{margin-bottom:10px;font-size:var(--fs-label);font-weight:800;line-height:1;letter-spacing:.12em;text-transform:uppercase}
.sh-wrap .sh-light .sh-lbl{color:var(--mute)}
.sh-wrap .sh-dark .sh-lbl{color:rgba(255,255,255,.72)}
.sh-wrap .sh-tags{display:flex;flex-wrap:wrap;gap:6px}
.sh-wrap .sh-t{padding:5px 10px;border-radius:8px;font-size:var(--fs-tagitem);font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.sh-wrap .sh-light .sh-t{background:var(--tint);border:1px solid var(--edge);color:var(--ink)}
.sh-wrap .sh-dark .sh-t{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);color:#fff}
.sh-wrap .sh-pts{display:grid;gap:10px}
.sh-wrap .sh-pts li{position:relative;padding-left:18px;font-size:var(--fs-points);line-height:1.5;font-weight:500;overflow-wrap:anywhere}
.sh-wrap .sh-pts li::before{content:"";position:absolute;left:1px;top:.55em;width:6px;height:6px;border-radius:2px;
  transform:rotate(45deg);background:var(--a)}
.sh-wrap .sh-dark .sh-pts li::before{background:rgba(255,255,255,.9)}

/* photo */
.sh-wrap .sh-cover{display:block;position:relative;overflow:hidden;flex:none;width:100%;
  height:var(--cover);min-height:var(--cover);max-height:var(--cover);
  background:linear-gradient(135deg,var(--a-hi),var(--a-lo))}
.sh-wrap .sh-cover::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
  background:linear-gradient(180deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,0) 48%,rgba(0,0,0,.32) 100%)}
.sh-wrap .sh-cphoto{position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border-radius:0;object-fit:cover}
.sh-wrap .sh-cover .sh-acts{position:absolute;top:12px;right:var(--pad);z-index:3}
.sh-wrap .sh-photo .sh-in{padding-top:0}
.sh-wrap .sh-photo .sh-logo{position:relative;z-index:3;margin-top:calc(var(--logo) / -2);border:3px solid #fff}
.sh-wrap .sh-photo .sh-txt{padding-top:12px}

/* compact */
.sh-wrap .sh-compact{--btn:34px;--logo:44px;background:var(--tint);border:1px solid var(--edge);color:var(--ink)}
.sh-wrap .sh-compact::before{content:"";position:absolute;right:-36px;top:-52px;width:170px;height:150px;border-radius:50%;
  pointer-events:none;z-index:0;opacity:calc(.16 * var(--art-compact));
  background:radial-gradient(closest-side,var(--a) 0%,transparent 100%)}
.sh-wrap[data-w="l"] .sh-compact{--btn:36px;--logo:48px}
.sh-wrap .sh-compact .sh-logo.empty{background:var(--a);color:#fff}
.sh-wrap .sh-crow{position:relative;z-index:2;display:flex;align-items:center;gap:12px;padding:10px}
.sh-wrap .sh-cmid{min-width:0;flex:1}
.sh-wrap .sh-cname{display:flex;align-items:center;gap:5px;font-size:var(--fs-cname);font-weight:800;line-height:1.2;letter-spacing:-.01em;color:var(--ink)}
.sh-wrap .sh-cname span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-wrap .sh-cname svg{width:var(--ic-cname);height:var(--ic-cname);flex:none;color:var(--a)}
.sh-wrap .sh-csub{margin-top:2px;font-size:var(--fs-csub);font-weight:500;line-height:1.3;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-wrap .sh-cpanel{position:relative;z-index:2}
.sh-wrap .sh-compact .sh-pb{padding:14px var(--pad) var(--pad);border-top:1px solid var(--edge)}

@media (prefers-reduced-motion:reduce){
  .sh-wrap .sh,.sh-wrap .sh *{animation:none!important;transition:none!important}
}
`;
// ".sh-wrap" -> ".sh-wrap.sh-wrap": raises specificity so global/page stylesheets can't override these rules.
const CSS = RAW_CSS.replace(/\.sh-wrap/g, ".sh-wrap.sh-wrap");

/* ---------- helpers ---------- */

const rgb = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// p = share of `h`, the rest is `o`
const mix = (h, o, p) => {
    const a = rgb(h), b = rgb(o);
    return "#" + a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, "0")).join("");
};
const colorVars = (a) => ({
    "--a": a,
    "--a-hi": mix(a, "#000000", 0.82),
    "--a-lo": mix(a, "#000000", 0.5),
    "--a-ink": mix(a, "#000000", 0.72),
    "--tint": mix(a, "#ffffff", 0.07),
    "--tint2": mix(a, "#ffffff", 0.14),
    "--edge": mix(a, "#ffffff", 0.28),
});

function useBand(ref) {
    const [band, setBand] = useState("s");
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const calc = (w) => (w >= 760 ? "l" : w >= 480 ? "m" : "s");
        setBand(calc(el.getBoundingClientRect().width));
        if (typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver(([e]) => setBand(calc(e.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return band;
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch { return false; }
}

function useShare(shop) {
    const [status, setStatus] = useState(null); // null | "copied" | "failed"
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const slug = shop?.shop_slug;
    const flash = (v) => {
        setStatus(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus(null), 1800);
    };
    const run = async () => {
        if (!slug) return;
        const url = `${window.location.origin}/seller/${encodeURIComponent(slug)}`;
        const name = shop.display_name || "this store";
        if (typeof navigator !== "undefined" && navigator.share) {
            try { await navigator.share({ title: name, text: `Browse ${name} on BBM`, url }); return; }
            catch (e) { if (e?.name === "AbortError") return; }
        }
        flash((await copyText(url)) ? "copied" : "failed");
    };
    return { status, run, enabled: !!slug };
}

const placeOf = (shop) => [shop?.city, shop?.state].filter(Boolean).join(", ");

// Image with a safety net: resized URL -> original URL -> `fallback`.
export function SmartImg({ src, width, fallback = null, ...rest }) {
    const [stage, setStage] = useState(0);
    useEffect(() => { setStage(0); }, [src]);
    if (!src) return fallback;
    let resized = "";
    try { resized = resizedImageUrl(src, { width }) || ""; } catch { resized = ""; }
    const tries = resized && resized !== src ? [resized, src] : [src];
    if (stage >= tries.length) return fallback;
    return <img key={tries[stage]} src={tries[stage]} referrerPolicy="no-referrer" onError={() => setStage((s) => s + 1)} {...rest} />;
}

/* ---------- pieces ---------- */

function Logo({ shop }) {
    const initials = (shop?.display_name || "S")
        .trim()
        .split(/\s+/)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "S";

    return (
        <span className={`sh-logo${shop?.logo_url ? "" : " empty"}`}>
            <SmartImg
                src={shop?.logo_url}
                width={200}
                alt=""
                fallback={<b>{initials}</b>}
            />
        </span>
    );
}

/* ---------- background art ----------
   All three are anchored to the right edge ("xMaxYMid slice") and masked so they fade out
   before the text column. Shapes are deliberately irregular: no matching radii, no even spacing. */

// Classic: a soft glow bleeding in from the top-right corner plus loose, hand-drawn style lines.
function ArtLight({ uid }) {
    const glow = `g${uid}`, fade = `f${uid}`, mask = `m${uid}`;
    return (
        <svg className="sh-art l" viewBox="0 0 480 240" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
            <defs>
                <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={fade} x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0" stopColor="#fff" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="0.78" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="240">
                    <rect width="480" height="240" fill={`url(#${fade})`} />
                </mask>
            </defs>
            <g mask={`url(#${mask})`}>
                <ellipse cx="452" cy="6" rx="210" ry="118" fill={`url(#${glow})`} />
                <ellipse cx="338" cy="252" rx="128" ry="64" fill={`url(#${glow})`} opacity="0.45" />
                <g className="a1" fill="none" stroke="currentColor" strokeLinecap="round">
                    <path d="M236 252 C 300 176, 352 214, 410 128 S 468 44, 500 12" strokeWidth="1.3" strokeOpacity="0.16" />
                    <path d="M284 258 C 340 196, 384 236, 440 160 S 486 92, 510 70" strokeWidth="0.9" strokeOpacity="0.11" />
                    <path d="M318 262 C 372 214, 408 244, 462 196 S 494 150, 512 138" strokeWidth="0.8" strokeOpacity="0.08" />
                </g>
                <g className="a2" fill="currentColor">
                    <circle cx="372" cy="58" r="1.8" opacity="0.3" />
                    <circle cx="398" cy="94" r="1.2" opacity="0.26" />
                    <circle cx="436" cy="70" r="2.2" opacity="0.2" />
                    <circle cx="352" cy="132" r="1.1" opacity="0.2" />
                    <circle cx="462" cy="118" r="1.5" opacity="0.24" />
                    <path d="M424 188 c 10 -14 30 -10 32 6 c 2 14 -18 22 -30 14 c -6 -4 -6 -14 -2 -20 z" opacity="0.06" />
                </g>
            </g>
        </svg>
    );
}

// Bold: aurora glows, one sweeping translucent ribbon and a few scattered specks over the dark gradient.
function ArtBold({ uid }) {
    const glow = `g${uid}`, rib = `r${uid}`, fade = `f${uid}`, mask = `m${uid}`;
    return (
        <svg className="sh-art d" viewBox="0 0 480 240" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
            <defs>
                <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={rib} x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.55" stopColor="#fff" stopOpacity="0.09" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id={fade} x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0" stopColor="#fff" />
                    <stop offset="0.45" stopColor="#fff" stopOpacity="0.7" />
                    <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="240">
                    <rect width="480" height="240" fill={`url(#${fade})`} />
                </mask>
            </defs>
            <g mask={`url(#${mask})`}>
                <ellipse cx="410" cy="34" rx="170" ry="96" fill={`url(#${glow})`} />
                <ellipse cx="478" cy="214" rx="116" ry="84" fill={`url(#${glow})`} opacity="0.55" />
                <g className="a1">
                    <path d="M176 246 C 254 206, 294 128, 376 116 C 438 106, 470 64, 484 -4 L 484 246 Z" fill={`url(#${rib})`} />
                    <path d="M176 246 C 254 206, 294 128, 376 116 C 438 106, 470 64, 484 -4" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="1.1" strokeLinecap="round" />
                    <path d="M214 250 C 288 218, 330 160, 404 150 C 450 144, 478 112, 488 76" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="0.9" strokeLinecap="round" />
                </g>
                <g className="a2" fill="#fff">
                    <circle cx="352" cy="40" r="2" opacity="0.3" />
                    <circle cx="384" cy="72" r="1.1" opacity="0.34" />
                    <circle cx="426" cy="30" r="1.5" opacity="0.26" />
                    <circle cx="448" cy="86" r="2.4" opacity="0.18" />
                    <circle cx="332" cy="98" r="1" opacity="0.26" />
                    <circle cx="470" cy="152" r="1.4" opacity="0.24" />
                    <circle cx="404" cy="176" r="1.8" opacity="0.14" />
                </g>
                <path d="M 330 28 a 38 38 0 0 1 52 -14" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.1" strokeLinecap="round" />
            </g>
        </svg>
    );
}

// Photo (only when no cover image is set): layered waves with an off-centre sun, like a horizon.
function ArtWaves() {
    return (
        <svg className="sh-art w" viewBox="0 0 480 240" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
            <circle cx="338" cy="74" r="24" fill="#fff" opacity="0.13" />
            <circle cx="338" cy="74" r="42" fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="1" />
            <g className="a1">
                <path d="M0 164 C 62 136, 124 186, 204 160 S 342 116, 402 148 S 468 168, 480 158 L 480 240 L 0 240 Z" fill="#fff" opacity="0.08" />
            </g>
            <path d="M0 198 C 82 176, 152 214, 242 194 S 382 162, 480 188 L 480 240 L 0 240 Z" fill="#fff" opacity="0.09" />
            <path d="M0 224 C 104 208, 204 236, 304 220 S 444 208, 480 222 L 480 240 L 0 240 Z" fill="#fff" opacity="0.11" />
        </svg>
    );
}

function Acts({ share, onClose, tone, extra = null }) {
    if (!share.enabled && !onClose && !extra) return null;
    const cls = tone === "glass" ? "sh-glass" : "sh-pale";
    return (
        <div className="sh-acts">
            {share.status && (
                <span className="sh-toast" role="status">{share.status === "copied" ? "Link copied" : "Couldn’t copy link"}</span>
            )}
            {extra}
            {share.enabled && (
                <button type="button" className={`sh-btn ${cls}`} onClick={share.run} aria-label="Share this store" title="Share">
                    {share.status === "copied" ? <Check strokeWidth={2.6} /> : <Share2 strokeWidth={2.3} />}
                </button>
            )}
            {onClose && (
                <button type="button" className={`sh-btn ${cls}`} onClick={onClose} aria-label="Close store view" title="Close store">
                    <X strokeWidth={2.4} />
                </button>
            )}
        </div>
    );
}

function Meta({ shop, verified }) {
    const place = placeOf(shop);
    if (!place && !verified) return null;
    return (
        <div className="sh-meta">
            {verified && <span className="sh-ver"><BadgeCheck strokeWidth={2.4} />Verified seller</span>}
            {place && <span className="sh-loc"><MapPin strokeWidth={2.2} /><span>{place}</span></span>}
        </div>
    );
}

function Highlights({ items, dot = false }) {
    if (!items.length) return null;
    return (
        <ul className="sh-hl">
            {items.map((t) => (
                <li key={t} className="sh-h">{dot ? <i /> : <Check strokeWidth={3} />}<span>{t}</span></li>
            ))}
        </ul>
    );
}

function Tags({ items }) {
    return <div className="sh-tags">{items.map((t) => <span key={t} className="sh-t">{t}</span>)}</div>;
}

function Block({ label, children }) {
    return <div><p className="sh-lbl">{label}</p>{children}</div>;
}

function Panel({ id, open, theme, withHighlights = false }) {
    const hl = withHighlights ? theme.highlights : [];
    const blocks = (hl.length ? 1 : 0) + (theme.sells.length ? 1 : 0) + (theme.points.length ? 1 : 0);
    return (
        <div id={id} className={`sh-pw${open ? " open" : ""}`}>
            <div className="sh-pn" aria-hidden={!open}>
                <div className="sh-pb">
                    {theme.about && <p className="sh-about">{theme.about}</p>}
                    {blocks > 0 && (
                        <div className={`sh-pg${blocks > 1 ? " two" : ""}`}>
                            {hl.length > 0 && <Block label="Highlights"><Tags items={hl} /></Block>}
                            {theme.sells.length > 0 && <Block label="What we sell"><Tags items={theme.sells} /></Block>}
                            {theme.points.length > 0 && (
                                <Block label="Key points">
                                    <ul className="sh-pts">{theme.points.map((t) => <li key={t}>{t}</li>)}</ul>
                                </Block>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Details({ c }) {
    const { open, setOpen, panelId, theme, hasPanel } = c;
    if (!hasPanel) return null;
    return (
        <div className="sh-det">
            <button type="button" className="sh-tog" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
                <span>{open ? "Hide details" : "About this store"}</span>
                <span className="sh-tgi"><ChevronDown strokeWidth={2.5} /></span>
            </button>
            <Panel id={panelId} open={open} theme={theme} />
        </div>
    );
}

function Identity({ c, tone }) {
    return (
        <div className="sh-id">
            <Logo shop={c.shop} />
            <div className="sh-txt">
                <h2 className="sh-name">{c.shop.display_name}</h2>
                <Meta shop={c.shop} verified={c.verified} />
            </div>
            {tone && <Acts tone={tone} share={c.share} onClose={c.onClose} />}
        </div>
    );
}

/* ---------- templates ---------- */

function Classic({ c }) {
    return (
        <header className="sh sh-light sh-classic">
            <ArtLight uid={c.uid} />
            <div className="sh-in">
                <Identity c={c} tone="pale" />
                {c.theme.tagline && <p className="sh-tagline py-5 my-5">{c.theme.tagline}</p>}
                <Highlights items={c.theme.highlights} />
                <Details c={c} />
            </div>
        </header>
    );
}

function Bold({ c }) {
    return (
        <header className="sh sh-dark sh-bold">
            <ArtBold uid={c.uid} />
            <div className="sh-in">
                <Identity c={c} tone="glass" />
                {c.theme.tagline && <p className="sh-tagline">{c.theme.tagline}</p>}
                <Highlights items={c.theme.highlights} />
                <Details c={c} />
            </div>
        </header>
    );
}

function Photo({ c }) {
    return (
        <header className="sh sh-light sh-photo">
            <div className="sh-cover">
                {c.theme.coverUrl
                    ? <SmartImg src={c.theme.coverUrl} width={1400} alt="" className="sh-cphoto" fallback={<ArtWaves />} />
                    : <ArtWaves />}
                <Acts tone="glass" share={c.share} onClose={c.onClose} />
            </div>
            <div className="sh-in">
                <Identity c={c} />
                {c.theme.tagline && <p className="sh-tagline">{c.theme.tagline}</p>}
                <Highlights items={c.theme.highlights} dot />
                <Details c={c} />
            </div>
        </header>
    );
}

function Compact({ c }) {
    const { shop, theme, verified, share, onClose, open, setOpen, panelId } = c;
    const sub = [placeOf(shop), theme.tagline].filter(Boolean).join(" · ");
    const hasAny = !!(theme.about || theme.sells.length || theme.points.length || theme.highlights.length);
    const toggle = hasAny ? (
        <button type="button" className="sh-btn sh-pale" aria-expanded={open} aria-controls={panelId}
            aria-label="Store details" title="Store details" onClick={() => setOpen((o) => !o)}>
            <ChevronDown strokeWidth={2.5} />
        </button>
    ) : null;
    return (
        <header className="sh sh-compact">
            <div className="sh-crow">
                <Logo shop={shop} />
                <div className="sh-cmid">
                    <h2 className="sh-cname">
                        <span>{shop.display_name}</span>
                        {verified && <BadgeCheck strokeWidth={2.4} aria-label="Verified seller" />}
                    </h2>
                    {sub && <p className="sh-csub">{sub}</p>}
                </div>
                <Acts tone="pale" share={share} onClose={onClose} extra={toggle} />
            </div>
            {hasAny && <div className="sh-cpanel"><Panel id={panelId} open={open} theme={theme} withHighlights /></div>}
        </header>
    );
}

/* ---------- public components ---------- */

export function ShopHeaderView({ shop, onClose, defaultOpen = false }) {
    const s = shop || {};
    const theme = sanitizeTheme(s.store_theme);
    const wrapRef = useRef(null);
    const band = useBand(wrapRef);
    const share = useShare(s);
    const [open, setOpen] = useState(defaultOpen);
    const uid = useId().replace(/:/g, "");
    const verified = s.status === "approved" || s.is_verified === true;
    const hasPanel = !!(theme.about || theme.sells.length || theme.points.length);
    const view = { ...s, display_name: s.display_name || "Your shop" };
    const c = { shop: view, theme, verified, share, onClose, open, setOpen, hasPanel, panelId: `${uid}-panel`, uid };

    let body;
    if (theme.template === "solid") body = <Bold c={c} />;
    else if (theme.template === "cover") body = <Photo c={c} />;
    else if (theme.template === "compact") body = <Compact c={c} />;
    else body = <Classic c={c} />;

    return (
        <div ref={wrapRef} className="sh-wrap" data-w={band} style={colorVars(theme.accent)}>
            <style>{CSS}</style>
            {body}
        </div>
    );
}

function HeaderSkeleton() {
    return <div className="h-[132px] animate-pulse rounded-[18px]" style={{ background: "rgba(11,17,22,0.05)" }} aria-hidden />;
}

export default function ShopHeader({ shopSlug, onClear, onLoaded, showClose = true }) {
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopSlug) return undefined;
        const c = new AbortController();
        setLoading(true);
        setShop(null);
        fetchShopInfo(shopSlug, c.signal)
            .then((r) => {
                if (c.signal.aborted) return;
                if (r?.success && r.shop) { setShop(r.shop); onLoaded?.(r.shop.display_name || null); }
            })
            .catch(() => { /* falls back to slug below */ })
            .finally(() => { if (!c.signal.aborted) setLoading(false); });
        return () => c.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopSlug]);

    if (loading) return <div className="mb-3 mt-1"><HeaderSkeleton /></div>;
    const view = shop || { display_name: shopSlug, shop_slug: shopSlug };
    return (
        <div className="mb-3 mt-1">
            <ShopHeaderView shop={view} onClose={showClose ? onClear : undefined} />
        </div>
    );
}