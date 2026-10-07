// pages/AuthPage.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  ArrowRight, Loader2, Mail, Phone, CheckCircle2, Pencil, RotateCw,
  Building2, User, Check, Lock, Zap, ShieldCheck, Tag, Send,
  FileText, Truck, ArrowUpRight,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { AUTH_THEME_CSS, AuthHeader, useAuthTheme } from "../components/authTheme.jsx";
import SmartLink from "../components/SmartLink.jsx";
import {
  requestOtp, verifyOtp, completeProfile,
  requestContactOtp, verifyContactOtp, lookupGstin,
  fetchMe, saveProgress,
} from "../utils/api.js";

/* ---------------------------------------------------------------------------
 * Constants & pure helpers (unchanged logic)
 * ------------------------------------------------------------------------- */
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// Where to send the person after login/onboarding. Whoever sends someone to
// /login passes `state: { from }` (a string like "/home/?shop=abc", or a
// react-router location object). It's also mirrored into sessionStorage so a
// page refresh mid-OTP / an abandoned-then-resumed onboarding still returns
// them to the exact URL (path + query string) they started from.
const REDIRECT_KEY = "bbm_post_login_redirect";

function toInternalPath(raw) {
  let path = null;
  if (typeof raw === "string") path = raw;
  else if (raw && typeof raw === "object" && raw.pathname) {
    path = `${raw.pathname}${raw.search || ""}${raw.hash || ""}`;
  }
  if (!path) return null;
  // Internal paths only (blocks "//evil.com" and "https://..." open redirects),
  // and never bounce back onto the login page itself.
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) return null;
  return path;
}

function resolveRedirect(locationState) {
  const fromState = toInternalPath(locationState?.from);
  if (fromState) {
    try { sessionStorage.setItem(REDIRECT_KEY, fromState); } catch { /* private mode */ }
    return fromState;
  }
  try {
    const stored = toInternalPath(sessionStorage.getItem(REDIRECT_KEY));
    if (stored) return stored;
  } catch { /* private mode */ }
  return "/home";
}

function clearStoredRedirect() {
  try { sessionStorage.removeItem(REDIRECT_KEY); } catch { /* private mode */ }
}

function detectChannel(raw) {
  if (!raw) return null;
  if (PHONE_RE.test(raw)) return "phone";
  if (EMAIL_RE.test(raw)) return "email";
  return null;
}
function detectMode(raw) {
  if (!raw) return null;
  return /[a-zA-Z@]/.test(raw) ? "email" : "phone";
}
function normalizePhonePaste(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(0, 10);
}
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
function isValidGstinShape(v) {
  return v.length === 15 && GSTIN_FORMAT.test(v);
}

function maskIdentifier(v) {
  if (EMAIL_RE.test(v)) return v.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
  const d = v.replace(/\D/g, "").slice(-10);
  return `+91 ${d.replace(/^(\d{2})\d{6}/, "$1XXXXXX")}`;
}

/* ---------------------------------------------------------------------------
 * Static marketing content
 * ------------------------------------------------------------------------- */
// Logo files live in /public/brands/<slug>.jpg (see the extraction script).
// If a file is missing the tile falls back to the brand name as text.
const BRAND_NAMES = [
  "3M", "Aditya", "Asian Paints", "Bosch", "Castrol", "Ft Paint", "Mercedes",
  "Mobil", "Nerolac", "Oneida", "Securust", "Shaktiman", "Shell", "Sk Zic",
  "Skf", "Timken", "Unity", "Zerust", "ZXL",
];
const BRANDS = BRAND_NAMES.map((name) => ({
  name,
  src: `/brands/${name.toLowerCase().replace(/\s+/g, "-")}.jpg`,
}));
const RAIL_A = BRANDS.filter((_, i) => i % 2 === 0);
const RAIL_B = BRANDS.filter((_, i) => i % 2 === 1);

const BENEFITS = {
  buy: {
    heading: "Save Money. Save Time.",
    accent: "var(--or)", accentText: "var(--ot)",
    items: [
      ["Competitive B2B prices", "Compare quotes and quantity-slab pricing side by side."],
      ["More suppliers to choose from", "Reach GST-verified sellers across India."],
      ["More brands & alternatives", "Castrol, Shell, Bosch, SKF, Timken and more."],
      ["Faster product discovery", "Search any product, brand or category in one place."],
      ["Better sourcing options", "Pick the pack size, MOQ and delivery terms that fit you."],
      ["Access to new suppliers", "Post a request and let suppliers quote on it."],
      ["Simplified procurement", "Order, track and receive in one flow."],
      ["Multiple requirements, one platform", "Lubricants, bearings, appliances, packaging and more."],
    ],
  },
  sell: {
    heading: "More buyers. More business.",
    accent: "var(--bl)", accentText: "var(--bt)",
    items: [
      ["Get new customers", "Be found by relevant B2B buyers beyond your network."],
      ["Increase sales", "Turn enquiries into orders with fast quotes."],
      ["Expand into new markets", "Choose the states you want to deliver to."],
      ["Reduce customer acquisition effort", "Add a product once. Share price and specs instantly."],
      ["Showcase your complete product range", "One catalogue for every SKU, pack and price."],
      ["Build long-term B2B relationships", "Buyer-wise pricing and credit terms for repeat business."],
      ["Grow without opening new branches", "A digital sales channel around your existing business."],
    ],
  },
};

const STEPS_CONTENT = [
  { n: 1, accent: "var(--ot)", title: "Sign in with an OTP", body: "Use your mobile number or email. We send a one-time code, nothing else to set up." },
  { n: 2, accent: "var(--bt)", title: "Verify your business", body: "Confirm mobile, email and GST number. Your registration details are filled in for you." },
  { n: 3, accent: "var(--gt)", title: "List, quote, trade", body: "Add products, answer live enquiries, and confirm, dispatch and deliver orders in one place." },
];

const FEATURES = [
  { Icon: Tag, accent: "var(--or)", title: "Price once, sell smart", body: "Buyer-wise prices, quantity slabs and a price validity you control. Update the base price once." },
  { Icon: Send, accent: "var(--bl)", title: "Quote in a tap", body: "Live requests for quotation land with a timestamp. Reply with a price, delivery time and validity in seconds." },
  { Icon: FileText, accent: "var(--gr)", title: "Your terms, your rules", body: "Set returns, warranty, credit terms and the states you deliver to, product by product." },
  { Icon: Truck, accent: "var(--go)", ink: "#06161C", title: "Orders in one flow", body: "Confirm, dispatch, deliver. Track every order and see exactly what you will receive." },
];

const FAQS = [
  [
    "What do I need to sign up?",
    "Just your mobile number or email to sign in. To start selling you will verify your mobile number, email address and GST number.",
  ],
  [
    "When am I charged?",
    "Fees are charged only when an order is generated. Transaction fees start as low as 0.25%, with optional promotion on top if you choose it.",
  ],
  [
    "How does OTP sign-in work?",
    "Enter your mobile number or email and we send a 6-digit code. Type it in and you are signed in. There is no password to create or forget.",
  ],
  [
    "Can I buy and sell on the same account?",
    "Yes. Post what you need and get quotes from suppliers, or quote on live enquiries from other buyers, all from one place.",
  ],
  [
    "Can I control who sees my prices?",
    "Yes. Choose full visibility or selected buyers only, and set buyer-specific prices while keeping one central catalogue.",
  ],
];

function FAQItem({ question, answer, isOpen, onClick, reduceMotion }) {
  return (
    <div className={`faq-item${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="faq-trigger"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span>{question}</span>

        <motion.span
          className="faq-icon"
          animate={reduceMotion ? {} : { rotate: isOpen ? 45 : 0 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
          aria-hidden="true"
        >
          +
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="faq-answer"
            initial={
              reduceMotion
                ? { height: "auto", opacity: 1 }
                : { height: 0, opacity: 0 }
            }
            animate={{
              height: "auto",
              opacity: 1,
            }}
            exit={
              reduceMotion
                ? { height: 0, opacity: 0 }
                : { height: 0, opacity: 0 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                  height: {
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  opacity: {
                    duration: 0.2,
                    ease: "easeOut",
                  },
                }
            }
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Page-specific styles (shared tokens/header/buttons come from authTheme.jsx)
 * ------------------------------------------------------------------------- */
const PAGE_CSS = `
@keyframes bbm-sl{to{transform:translateX(-100%)}}
@keyframes bbm-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.ba .hero{padding:44px 0 36px}
.ba .hero .w{display:grid;gap:40px;grid-template-columns:1.05fr .95fr;align-items:center}
@media(max-width:900px){.ba .hero .w{grid-template-columns:1fr}}
.ba .hero .w>*{min-width:0}
.ba .ey{font-size:.8rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--tt);margin-bottom:14px}
.ba h1{font:900 clamp(2.7rem,9vw,4.8rem)/1.02 var(--f);letter-spacing:-.035em}
.ba h1 em{font-style:normal;color:var(--yt)}
.ba .tag{margin:18px 0 26px;font:700 1.25rem var(--f);color:var(--mute);letter-spacing:.01em}
.ba .tag i{font-style:normal;color:var(--ink)}

/* login card */
.ba .lc{background:var(--s);border:1px solid var(--line);border-radius:28px;padding:22px;box-shadow:0 30px 70px -34px #000,0 0 0 1px color-mix(in srgb,var(--bl) 12%,transparent);max-width:520px;position:relative}
.ba .lc label.l{display:block;font-weight:800;margin-bottom:10px}
.ba .inp{display:flex;align-items:center;gap:10px;border:1.5px solid var(--line);border-radius:18px;background:var(--s2);padding:0 16px;color:var(--mute);transition:border-color .2s,box-shadow .2s}
.ba .inp:focus-within{border-color:var(--bl);box-shadow:0 0 0 5px color-mix(in srgb,var(--bl) 22%,transparent)}
.ba .inp.er{border-color:var(--red)}
.ba .inp .pre{display:flex;align-items:center;gap:6px;flex:none;font-weight:800;color:var(--mute)}
.ba .inp input{flex:1;min-width:0;height:58px;border:0;outline:0;background:none;font:600 1.05rem var(--f);color:var(--ink)}
.ba .inp input::placeholder{color:var(--mute);opacity:.8;font-weight:500}
.ba .inp input:disabled{opacity:.6}
.ba .dt{min-height:1.5em;margin:8px 2px 14px;font-size:.88rem;font-weight:700;color:var(--mute);display:flex;gap:6px;align-items:center}
.ba .dt.ok{color:var(--gt)}
.ba .dt.er{color:var(--red)}
.ba .fi{margin-top:14px;font-size:.85rem;color:var(--mute);text-align:center}
.ba .fi a{color:var(--ink);font-weight:700}
.ba .tr{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:16px;font-size:.84rem;font-weight:700;color:var(--mute);justify-content:center}
.ba .tr span{display:flex;align-items:center;gap:6px}
.ba .tr .ic{width:16px;height:16px;color:var(--gt)}
.ba .lc h2{font:900 1.6rem/1.15 var(--f);letter-spacing:-.02em}
.ba .lc p.s{color:var(--mute);margin-top:6px}
.ba .lc p.s b{color:var(--ink)}
.ba .lnk{background:none;border:0;color:var(--bt);font:700 .92rem var(--f);padding:10px 4px;text-decoration:underline}
.ba .lnk:disabled,.ba .lnk.dis{color:var(--mute);text-decoration:none;cursor:default;opacity:.9}
.ba .lnk.dis{display:inline-block}

/* otp boxes */
.ba .ow{position:relative}
.ba .otp{display:flex;gap:8px;margin:18px 0 6px}
.ba .otp input{flex:1;min-width:0;height:60px;text-align:center;font:900 1.5rem var(--f);border:1.5px solid var(--line);border-radius:16px;background:var(--s2);color:var(--ink);outline:0;padding:0;transition:border-color .2s,box-shadow .2s}
.ba .otp input:focus{border-color:var(--bl);box-shadow:0 0 0 4px color-mix(in srgb,var(--bl) 22%,transparent)}
.ba .otp input.on{border-color:color-mix(in srgb,var(--bl) 55%,var(--line))}
.ba .otp input.bad{border-color:var(--red)}
.ba .otp input:disabled{opacity:.6}
.ba .otp.sm{margin:10px 0 4px;max-width:340px;gap:6px}
.ba .otp.sm input{height:52px;font-size:1.3rem;border-radius:14px}
.ba .vo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:16px;background:color-mix(in srgb,var(--s) 62%,transparent);pointer-events:none}
.ba .vp{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:var(--ink);color:var(--bg);font-weight:800;font-size:.85rem}
.ba .nt{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:.84rem;font-weight:800;color:var(--gt)}
.ba .rw{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:0 4px;margin-top:10px;color:var(--mute);font-size:.85rem}

/* stats + peek */
.ba .stt{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.ba .stt div{flex:1;min-width:96px;padding:12px 14px;border:1px solid var(--line);border-radius:18px;background:var(--s)}
.ba .stt b{display:block;font:900 1.5rem/1.1 var(--f)}
.ba .stt span{font-size:.8rem;font-weight:700;color:var(--mute)}
.ba .peek{position:relative;display:grid;gap:14px;max-width:440px;justify-self:center;width:100%}
.ba .pk{background:var(--s);border:1px solid var(--line);border-radius:22px;padding:16px;box-shadow:0 24px 50px -30px #000}
.ba .pk:nth-child(1){transform:rotate(-1.4deg)}
.ba .pk:nth-child(2){transform:rotate(1.2deg);margin-left:22px}
.ba .pk:nth-child(3){transform:rotate(-.8deg);margin-right:22px}
.ba .pk small{display:block;color:var(--mute);font-weight:700;font-size:.8rem}
.ba .pk b{font-weight:800}
.ba .pk .r{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.ba .pk .q{color:var(--tt);font-weight:800}
.ba .pl{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-weight:800;font-size:.8rem;background:var(--go);color:#06161C;white-space:nowrap}
.ba .pl.g{background:color-mix(in srgb,var(--gr) 22%,var(--s));color:var(--gt)}
.ba .pl.b{background:color-mix(in srgb,var(--bl) 22%,var(--s));color:var(--bt)}
.ba .pl .ic{width:14px;height:14px}

/* brand wall */
.ba .bw{padding:36px 0 28px;overflow:hidden}
.ba .bw p{font-size:.8rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin-bottom:16px}
.ba .rail{display:flex;overflow:hidden;margin-bottom:12px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.ba .track{display:flex;gap:12px;padding-right:12px;flex:none;animation:bbm-sl 50s linear infinite}
.ba .rail.rev .track{animation-direction:reverse;animation-duration:60s}
.ba .rail:hover .track{animation-play-state:paused}
.ba .tile{flex:none;width:150px;height:92px;background:#fff;border-radius:16px;display:grid;place-items:center;padding:12px;box-shadow:0 10px 24px -14px #000}
.ba .tile img{max-width:112px;max-height:56px;object-fit:contain}
.ba .tile .tn{font:800 1rem/1.2 var(--f);color:#06161C;text-align:center}

/* sections */
.ba .sec{padding:60px 0}
.ba .sec.tight{padding-top:20px}
.ba .sec h2{font:900 clamp(1.9rem,5vw,3rem)/1.08 var(--f);letter-spacing:-.03em}
.ba .sec .lead{color:var(--mute);margin-top:12px;max-width:52ch;font-size:1.08rem}
.ba .seg{display:inline-flex;background:var(--s2);border:1px solid var(--line);border-radius:999px;padding:5px;margin:24px 0 22px;max-width:100%}
.ba .seg button{border:0;background:none;min-height:46px;padding:0 26px;border-radius:999px;font:800 1rem var(--f);color:var(--mute);transition:background .2s,color .2s}
@media(max-width:420px){.ba .seg button{padding:0 16px;font-size:.92rem}}
.ba .seg button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
.ba .bh{font:900 clamp(1.5rem,4vw,2.2rem)/1.1 var(--f);letter-spacing:-.025em;margin-bottom:18px}
.ba .bn{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(max-width:700px){.ba .bn{grid-template-columns:1fr}}
.ba .bi{display:flex;gap:14px;padding:16px;border:1px solid var(--line);border-radius:20px;background:var(--s)}
.ba .bi i{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-style:normal;background:color-mix(in srgb,var(--a) 20%,var(--s2));color:var(--at)}
.ba .bi b{display:block;font-weight:800;line-height:1.25}
.ba .bi span{color:var(--mute);font-size:.92rem;line-height:1.4;display:block;margin-top:2px}
.ba .hw{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
@media(max-width:760px){.ba .hw{grid-template-columns:1fr}}
.ba .st{padding:22px;border-radius:24px;border:1px solid var(--line);background:var(--s)}
.ba .st em{font:900 3rem/1 var(--f);font-style:normal;color:var(--a);opacity:.9}
.ba .st b{display:block;font:800 1.25rem var(--f);margin:10px 0 6px}
.ba .st span{color:var(--mute);font-size:.95rem;display:block}
.ba .ft{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px}
@media(max-width:700px){.ba .ft{grid-template-columns:1fr}}
.ba .fc{padding:22px;border-radius:24px;border:1px solid var(--line);background:linear-gradient(160deg,color-mix(in srgb,var(--a) 14%,var(--s)),var(--s) 60%)}
.ba .fc .pi{width:48px;height:48px;border-radius:15px;background:var(--a);color:var(--c,#fff);display:grid;place-items:center;margin-bottom:14px}
.ba .fc b{display:block;font:800 1.2rem var(--f);margin-bottom:6px}
.ba .fc span{color:var(--mute);display:block}
.ba .fq details{border:1px solid var(--line);border-radius:18px;background:var(--s);margin-top:10px}
.ba .fq summary{list-style:none;cursor:pointer;padding:18px;font-weight:800;display:flex;justify-content:space-between;gap:12px;align-items:center}
.ba .fq summary::-webkit-details-marker{display:none}
.ba .fq summary::after{content:"+";font-size:1.5rem;font-weight:500;color:var(--tt);transition:transform .2s;flex:none}
.ba .fq details[open] summary::after{transform:rotate(45deg)}
.ba .fq p{padding:0 18px 18px;color:var(--mute)}
.ba .cta{padding:70px 0 80px;text-align:center}
.ba .cta .box{padding:44px 24px;border-radius:32px;border:1px solid var(--line);background:radial-gradient(500px 240px at 15% 100%,color-mix(in srgb,var(--gr) 26%,transparent),transparent 70%),radial-gradient(500px 240px at 85% 100%,color-mix(in srgb,var(--go) 20%,transparent),transparent 70%),var(--s)}
.ba .cta h2{font:900 clamp(2rem,6vw,3.4rem)/1.05 var(--f);letter-spacing:-.03em;max-width:16ch;margin:0 auto}
.ba .cta p{color:var(--mute);margin:14px auto 26px;max-width:44ch}
.ba .cta .bt{padding:0 34px;min-height:56px}
.ba footer{border-top:1px solid var(--line);padding:26px 0 40px;color:var(--mute);font-size:.9rem}
.ba footer .w{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
.ba footer a{color:var(--ink);font-weight:700}
.ba footer b{color:var(--ink)}
.ba .boot{min-height:50vh;display:grid;place-items:center;color:var(--mute)}

/* onboarding */
.ba .ob{display:block;max-width:620px;margin:0 auto;padding:32px 20px 64px}
.ba .oc{background:var(--s);border:1px solid var(--line);border-radius:28px;padding:24px;box-shadow:0 30px 70px -34px #000,0 0 0 1px color-mix(in srgb,var(--bl) 12%,transparent)}
.ba .oh{display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:22px}
.ba .oh .pi{width:56px;height:56px;border-radius:18px;background:var(--go);color:#06161C;display:grid;place-items:center;margin-bottom:14px}
.ba .oh h2{font:900 1.7rem/1.1 var(--f);letter-spacing:-.025em}
.ba .oh p{color:var(--mute);margin-top:6px;font-size:.95rem}
.ba .wb{margin-bottom:18px;padding:12px 14px;border-radius:16px;background:var(--s2);border:1px solid var(--line);text-align:center;font-weight:800;font-size:.9rem}
.ba .fm{display:flex;flex-direction:column;gap:18px}
.ba .sc{scroll-margin-top:96px}
.ba .fd{display:flex;flex-direction:column;min-width:0}
.ba .fl{font-weight:800;font-size:.92rem;margin-bottom:8px;display:block}
.ba .fh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.ba .fh .fl{margin:0;min-width:0;overflow-wrap:anywhere}
.ba .fh .lnk{padding:0;display:inline-flex;align-items:center;gap:4px;font-size:.88rem;flex:none}
.ba .fr{display:flex;gap:10px;align-items:stretch}
.ba .fx{flex:1;min-width:0;width:100%;height:56px;border:1.5px solid var(--line);border-radius:18px;background:var(--s2);padding:0 16px;font:600 1.02rem var(--f);color:var(--ink);outline:0;transition:border-color .2s,box-shadow .2s}
.ba .fx::placeholder{color:var(--mute);opacity:.8;font-weight:500}
.ba .fx:focus{border-color:var(--bl);box-shadow:0 0 0 5px color-mix(in srgb,var(--bl) 22%,transparent)}
.ba .fx.er{border-color:var(--red)}
.ba .fx:disabled{opacity:.6}
.ba .fx.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding-right:46px}
.ba .rel{position:relative;flex:1;min-width:0}
.ba .rel .ic{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--gt)}
.ba .vbn{flex:none;min-width:92px;padding:0 20px;border-radius:18px;border:1.5px solid var(--line);background:var(--s2);font:800 .95rem var(--f);display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--ink);transition:border-color .2s,opacity .2s}
.ba .vbn:hover:not(:disabled){border-color:var(--bl)}
.ba .vbn:disabled{opacity:.5;cursor:not-allowed}
.ba .em{margin-top:8px;font-size:.85rem;font-weight:700;color:var(--red)}
.ba .hint{margin-bottom:2px;font-size:.88rem;font-weight:600;color:var(--mute)}
.ba .vf{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 14px;border:1.5px solid color-mix(in srgb,var(--gr) 45%,var(--line));border-radius:18px;background:color-mix(in srgb,var(--gr) 10%,var(--s2))}
.ba .vf .ic{color:var(--gt)}
.ba .vf .v{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.ba .vf .pl{margin-left:auto}
.ba .gd{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;padding:16px;border:1px solid var(--line);border-radius:20px;background:var(--s2);overflow:hidden}

.ba .fq .faq-item {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--s);
  margin-top: 10px;
  overflow: hidden;
}

.ba .fq .faq-trigger {
  width: 100%;
  border: 0;
  background: none;
  color: var(--ink);
  cursor: pointer;

  padding: 18px;

  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  font: 800 1rem var(--f);
  text-align: left;
}

.ba .fq .faq-trigger:hover {
  background: color-mix(in srgb, var(--s2) 45%, transparent);
}

.ba .fq .faq-trigger:focus-visible {
  outline: 2px solid var(--bl);
  outline-offset: -2px;
}

.ba .fq .faq-icon {
  flex: none;
  width: 24px;
  height: 24px;

  display: grid;
  place-items: center;

  color: var(--tt);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1;

  transform-origin: center;
}

.ba .fq .faq-answer {
  overflow: hidden;
}

.ba .fq .faq-answer p {
  padding: 0 18px 18px;
  color: var(--mute);
  margin: 0;
  line-height: 1.5;
}

@media(max-width:560px){.ba .gd{grid-template-columns:1fr}}
.ba .gd small{display:block;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.ba .gd b{display:block;margin-top:2px;font-weight:700;font-size:.95rem;overflow-wrap:anywhere}
.ba .gd .wide{grid-column:1/-1}
.ba .ofoot{margin-top:24px}

@media(max-width:380px){.ba .otp{gap:6px}.ba .lc{padding:18px}.ba .oc{padding:18px}}
@media(max-width:560px){.ba .hero{padding-top:28px}.ba .sec{padding:44px 0}.ba .ob{padding:20px 14px 48px}}
@media(prefers-reduced-motion:reduce){.ba .track{animation:none}.ba .rail{overflow-x:auto;-webkit-mask-image:none;mask-image:none}.ba .track+.track{display:none}}
`;

/* ---------------------------------------------------------------------------
 * Small presentational pieces
 * ------------------------------------------------------------------------- */
function BrandTile({ brand }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="tile">
      {failed
        ? <span className="tn">{brand.name}</span>
        : <img src={brand.src} alt={`${brand.name} logo`} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}

function Rail({ items, reverse }) {
  // Each track repeats the list twice so it stays wider than ultra-wide
  // screens; two identical tracks then loop seamlessly.
  const doubled = [...items, ...items];
  return (
    <div className={`rail${reverse ? " rev" : ""}`}>
      {[0, 1].map((k) => (
        <div className="track" key={k} aria-hidden={k ? "true" : undefined}>
          {doubled.map((b, i) => <BrandTile key={`${b.name}-${i}`} brand={b} />)}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * OTP boxes — logic unchanged. `onChange` is new and optional: it lets the
 * parent enable a "Verify" button; auto-submit on the 6th digit still works.
 * ------------------------------------------------------------------------- */
function OtpBoxes({ length = OTP_LENGTH, onComplete, onChange, error, disabled, resetKey = 0, small = false }) {
  const [digits, setDigits] = useState(Array(length).fill(""));
  const inputsRef = useRef([]);

  const commit = (next) => {
    setDigits(next);
    onChange?.(next.join(""));
  };

  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  // Wipe the boxes whenever an error appears or the parent bumps resetKey.
  useEffect(() => {
    if (!error && !resetKey) return;
    setDigits(Array(length).fill(""));
    onChange?.("");
    inputsRef.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, resetKey, length]);

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    commit(next);
    if (digit && i < length - 1) inputsRef.current[i + 1]?.focus();
    if (digit && i === length - 1 && next.every(Boolean)) onComplete?.(next.join(""));
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    commit(next);
    inputsRef.current[Math.min(pasted.length, length) - 1]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div>
      <div className="ow">
        <div className={`otp${small ? " sm" : ""}`} role="group" aria-label={`${length}-digit code`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="text" inputMode="numeric" maxLength={1}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              value={d} disabled={disabled}
              className={error ? "bad" : d ? "on" : ""}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
            />
          ))}
        </div>
        {disabled && !error && (
          <motion.div className="vo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="vp"><Loader2 className="ic sm spin" />Verifying…</span>
          </motion.div>
        )}
      </div>
      {error && <p className="dt er" role="alert" style={{ marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Login card — step 1: identifier
 * ------------------------------------------------------------------------- */
function IdentifierCard({ initialValue, onSubmit, onClearError, loading, serverError }) {
  const [value, setValue] = useState(initialValue || "");
  const [touched, setTouched] = useState(false);
  const inFlight = useRef(false);
  const inputRef = useRef(null);

  const mode = detectMode(value);
  const channel = detectChannel(value);
  const valid = channel !== null;
  const showError = touched && value.length > 0 && !valid;

  // Only auto-focus on larger screens so the mobile keyboard doesn't cover
  // the hero the moment the page opens.
  useEffect(() => {
    if (window.matchMedia?.("(min-width: 900px)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value;
    const nextMode = detectMode(raw);
    setValue(nextMode === "phone" ? raw.replace(/\D/g, "").slice(0, 10) : raw);
    if (serverError) onClearError?.();
  };
  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (detectMode(text) === "phone") {
      e.preventDefault();
      setValue(normalizePhonePaste(text));
      if (serverError) onClearError?.();
    }
  };

  const fireSubmit = () => {
    if (!valid || loading || inFlight.current) return;
    inFlight.current = true;
    Promise.resolve(onSubmit(value)).finally(() => (inFlight.current = false));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading) return;
    fireSubmit();
  };

  let hint = null;
  let tone = "";
  if (serverError) { hint = serverError; tone = "er"; }
  else if (valid) { hint = channel === "phone" ? "Mobile number looks good" : "Email looks good"; tone = "ok"; }
  else if (showError) {
    hint = mode === "phone" ? "Enter a valid 10-digit mobile number." : "Enter a valid email address.";
    tone = "er";
  } else if (value) {
    hint = mode === "email" ? "Keep typing your email address" : value.length > 3 ? "Enter a 10-digit mobile number" : null;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label className="l" htmlFor="bbm-identifier">Mobile number or email</label>
      <div className={`inp${tone === "er" ? " er" : ""}`}>
        {mode === null && <User className="ic" />}
        {mode === "phone" && (<span className="pre"><Phone className="ic sm" />+91</span>)}
        {mode === "email" && <Mail className="ic" />}
        <input
          id="bbm-identifier" ref={inputRef} type="text" autoComplete="username"
          disabled={loading} value={value}
          onChange={handleChange} onPaste={handlePaste} onBlur={() => setTouched(true)}
          placeholder="98765 43210 or you@company.com"
        />
      </div>

      <div className={`dt ${tone}`} role="status" aria-live="polite">
        {tone === "ok" && <Check className="ic sm" />}
        {hint}
      </div>

      <button type="submit" className="bt go blk" disabled={!valid || loading}>
        {loading ? (<><Loader2 className="ic spin" />Sending OTP…</>) : (<>Send OTP<ArrowRight className="ic" /></>)}
      </button>

      <p className="fi">
        By continuing, you agree to our <span className="sm:hidden"><br /></span> <a href="/terms">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.
      </p>
      <div className="tr">
        <span><Lock className="ic" />No password needed</span>
        <span><Zap className="ic" />Takes 30 seconds</span>
        <span><ShieldCheck className="ic" />GST-verified sellers</span>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------
 * Login card — step 2: OTP
 * ------------------------------------------------------------------------- */
function OtpCard({ identifier, onVerify, onResend, onEdit, loading, serverError }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [justResent, setJustResent] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [code, setCode] = useState("");
  const channel = detectChannel(identifier);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // The countdown only restarts on a confirmed success; the button is
  // disabled with a spinner while in flight so it can't be double-tapped.
  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setJustResent(false);
    try {
      const ok = await onResend();
      if (ok !== false) {
        setSecondsLeft(RESEND_SECONDS);
        setJustResent(true);
        setResetKey((k) => k + 1);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <h2>Enter the code</h2>
      <p className="s">
        {channel === "email" ? "We sent a 6-digit code to " : "We sent a 6-digit code by SMS to "}
        <b style={{ overflowWrap: "anywhere" }}>{maskIdentifier(identifier)}</b>
      </p>

      <OtpBoxes
        onComplete={(c) => !loading && onVerify(c)}
        onChange={setCode}
        error={serverError} disabled={loading} resetKey={resetKey}
      />

      {channel && justResent && secondsLeft > 0 && (
        <motion.p className="nt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {channel === "phone" ? <Phone className="ic sm" /> : <Mail className="ic sm" />}
          {channel === "phone" ? `A new code has been sent to +91 ${identifier}.` : `A new code is on its way to ${identifier}.`}
        </motion.p>
      )}

      <button
        type="button" className="bt go blk" style={{ marginTop: 14 }}
        disabled={code.length < OTP_LENGTH || loading}
        onClick={() => !loading && code.length === OTP_LENGTH && onVerify(code)}
      >
        {loading ? (<><Loader2 className="ic spin" />Verifying…</>) : (<>Verify and continue<ArrowRight className="ic" /></>)}
      </button>

      <div className="rw">
        {secondsLeft > 0 ? (
          <span className="lnk dis">Resend in {secondsLeft}s</span>
        ) : (
          <button type="button" className="lnk" onClick={handleResend} disabled={resending || loading}>
            {resending ? "Resending…" : (<><RotateCw className="ic sm" style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Resend code</>)}
          </button>
        )}
        <span aria-hidden="true">·</span>
        <button type="button" className="lnk" onClick={onEdit} disabled={loading}>Change</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Landing (hero + marketing sections)
 * ------------------------------------------------------------------------- */
function Landing({
  step, identifier, loading, redirecting, serverError,
  onIdentifierSubmit, onClearError, onOtpVerify, onResend, onEditIdentifier, onSignInClick,
}) {
  const [side, setSide] = useState("buy");
  const b = BENEFITS[side];
  const [openIndex, setOpenIndex] = useState(null);
  const reduceMotion = useReducedMotion();

  return (
    <main>
      <section className="hero">
        <div className="w">
          <div>
            <p className="ey">Trusted B2B marketplace</p>
            <h1>Find Supply.<br /><em>Build Demand.</em></h1>
            <p className="tag">People. <i>Product.</i> Partnership.</p>

            <div className="lc">
              <AnimatePresence mode="wait" initial={false}>
                {step === "otp" ? (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <OtpCard
                      identifier={identifier} onVerify={onOtpVerify} onResend={onResend}
                      onEdit={onEditIdentifier} loading={loading || redirecting} serverError={serverError}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="identifier"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <IdentifierCard
                      initialValue={identifier} onSubmit={onIdentifierSubmit}
                      onClearError={onClearError} loading={loading} serverError={serverError}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="stt">
              <div><b>23</b><span>brands already listed</span></div>
              <div><b>50+</b><span>products live</span></div>
              <div><b>0.25%</b><span>fees from, only on orders</span></div>
            </div>
          </div>

          <div className="peek" aria-label="A peek inside BBM">
            <div className="pk">
              <small>New enquiry · 5h ago</small>
              <b>Shell Rimula R4 X 15W-40</b>
              <div className="r"><span className="q">20 Packs × 5 L</span><span className="pl"><Send className="ic" />Submit quote</span></div>
            </div>
            <div className="pk">
              <small>Quote accepted</small>
              <b>Rust Preventive Oil · ₹590/Kg</b>
              <div className="r"><span className="q">New order ₹10,000</span><span className="pl g"><Check className="ic" />Confirmed</span></div>
            </div>
            <div className="pk">
              <small>Order shipped · Rajkot, Gujarat</small>
              <b>Castrol Magnatec 5w-30 · 14 L</b>
              <div className="r"><span className="q">You'll receive ₹10,290</span><span className="pl b"><Truck className="ic" />On the way</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bw">
        <div className="w"><p>Brands already on BBM</p></div>
        <Rail items={RAIL_A} />
        <Rail items={RAIL_B} reverse />
      </section>

      <section className="sec" id="why">
        <div className="w">
          <h2>Whether you buy or sell, BBM works harder for you.</h2>
          <p className="lead">One marketplace for people, products and partnerships. Pick your side and see what you get.</p>
          <div className="seg" role="group" aria-label="Choose your side">
            <button type="button" aria-pressed={side === "buy"} onClick={() => setSide("buy")}>I want to buy</button>
            <button type="button" aria-pressed={side === "sell"} onClick={() => setSide("sell")}>I want to sell</button>
          </div>
          <div className="bh">{b.heading}</div>
          <div className="bn">
            {b.items.map(([title, desc]) => (
              <div className="bi" key={`${side}-${title}`} style={{ "--a": b.accent, "--at": b.accentText }}>
                <i><Check className="ic" /></i>
                <div><b>{title}</b><span>{desc}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec tight">
        <div className="w">
          <h2>Up and running in three steps.</h2>
          <p className="lead">No passwords to remember. No paperwork to chase.</p>
          <div className="hw">
            {STEPS_CONTENT.map((s) => (
              <div className="st" key={s.n} style={{ "--a": s.accent }}>
                <em>{s.n}</em><b>{s.title}</b><span>{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec tight">
        <div className="w">
          <h2>Built for how B2B really sells.</h2>
          <div className="ft">
            {FEATURES.map(({ Icon, accent, ink, title, body }) => (
              <div className="fc" key={title} style={{ "--a": accent, ...(ink ? { "--c": ink } : {}) }}>
                <div className="pi"><Icon className="ic" /></div>
                <b>{title}</b><span>{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec tight fq">
        <div className="w" style={{ maxWidth: 760 }}>
          <h2>Questions, answered.</h2>

          <div className="faq-list">
            {FAQS.map(([question, answer], index) => (
              <FAQItem
                key={question}
                question={question}
                answer={answer}
                isOpen={openIndex === index}
                reduceMotion={reduceMotion}
                onClick={() =>
                  setOpenIndex((current) =>
                    current === index ? null : index
                  )
                }
              />
            ))}
          </div>
        </div>
      </section>


      <section className="cta">
        <div className="w">
          <div className="box">
            <h2>Your next customer is already looking.</h2>
            <p>Sign in with an OTP and be ready to trade in minutes.</p>
            <button type="button" className="bt go" onClick={onSignInClick}>
              Sign in to BBM <ArrowRight className="ic" />
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="w">
          <span><b>BBM</b> · People • Product • Partnership</span>
          <span>By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</span>
        </div>
      </footer>
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */
export default function AuthPage() {
  const [step, setStep] = useState("identifier");
  const [token, setToken] = useState(null);
  const [loginType, setLoginType] = useState(null);

  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  // True from the moment an existing, fully set-up user is verified until
  // the navigation to their destination happens, so the OTP card stays in
  // its "Verifying…" state instead of flickering back to an editable form.
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(null);
  const { setAuthSession, refreshProfile, profile, session, needsOnboarding, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNewUser, setIsNewUser] = useState(null); // eslint-disable-line no-unused-vars
  const rootRef = useRef(null);
  const { theme, toggleTheme } = useAuthTheme();

  // Set while a fresh OTP login is being processed. During that window the
  // auth context publishes a session BEFORE the profile has loaded, which
  // made `needsOnboarding` briefly true for everyone — so the resume effect
  // below must stay out of the way and let the server's `isNewUser` answer
  // from verifyOtp decide where to go.
  const loginFlowRef = useRef(false);

  // Resolved once on mount: the full URL the person came from (path + query).
  const [redirectTo] = useState(() => resolveRedirect(location.state));

  const finishAndRedirect = useCallback(() => {
    clearStoredRedirect();
    navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  // Resume an abandoned onboarding: the page was opened with an existing
  // session (e.g. user verified OTP, then closed the tab before submitting
  // GSTIN/company info), so jump straight to that step.
  useEffect(() => {
    if (initializing) return;
    if (loginFlowRef.current) return;
    if (step !== "identifier") return;
    if (!session?.access_token || !profile) return;
    if (needsOnboarding) {
      setToken(session.access_token);
      setLoginType(profile.email ? "email" : "phone");
      setStep("onboarding");
    }
  }, [initializing, needsOnboarding, session, profile, step]);

  // Avoid flashing the "enter phone/email" screen while we're still
  // figuring out whether this session needs resuming.
  const resolvingResume = initializing && !!session?.access_token && step === "identifier";

  const handleBack = () => {
    if (step === "identifier") {
      // React Router v6 stamps history.state.idx = 0 on the entry point of
      // the app's history stack — if that's us, navigate(-1) would leave
      // the app entirely instead of going back to a real previous page.
      if (window.history.state?.idx === 0) navigate("/");
      else navigate(-1);
    } else if (step === "otp") {
      setError(null);
      setStep("identifier");
    }
    // no back action from "onboarding" — user is already authenticated
  };

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
      setLoginType(res.channel || detectChannel(value));
      setStep("otp");
    });

  const handleOtpVerify = (code) =>
    withLoading(async () => {
      // Block the resume effect for the whole login — see loginFlowRef.
      loginFlowRef.current = true;
      try {
        const res = await verifyOtp(identifier, code);
        if (!res.success) {
          loginFlowRef.current = false;
          return setError(res.message || "That code didn't match. Check and try again.");
        }
        setToken(res.token);
        // Session must be set in the { access_token } shape AuthContext
        // expects, or isLoggedIn (and every protected route) stays false.
        await setAuthSession?.(res.token);
        setIsNewUser(res.isNewUser);

        // `isNewUser` comes straight from the server (onboarding_step !==
        // "done"), so it is the single source of truth here.
        if (res.isNewUser) {
          setStep("onboarding");
          loginFlowRef.current = false;
        } else {
          // Fully set-up user: never show the onboarding screen at all.
          // Keep loginFlowRef true; we're leaving this page.
          setRedirecting(true);
          finishAndRedirect();
        }
      } catch (e) {
        loginFlowRef.current = false;
        setRedirecting(false);
        setError("Something went wrong. Please try again.");
      }
    });

  // Goes through withLoading (so the error renders in the OTP card) and
  // returns whether it actually succeeded so the card only resets its
  // countdown on success.
  const handleResend = () =>
    withLoading(async () => {
      const res = await requestOtp(identifier);
      if (!res.success) {
        setError(res.message || "Couldn't resend the code. Try again.");
        return false;
      }
      return true;
    });

  const handleOnboardingSubmit = (payload) =>
    withLoading(async () => {
      const res = await completeProfile(token, payload);
      if (!res.success) return setError(res.message || "Couldn't save your details. Try again.");
      await refreshProfile?.();
      finishAndRedirect();
    });

  const focusSignIn = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      rootRef.current?.querySelector(".lc input:not(:disabled)")?.focus({ preventScroll: true });
    }, 450);
  };

  const onboarding = step === "onboarding";

  return (
    <div className="ba" data-theme={theme} ref={rootRef}>
      <style>{AUTH_THEME_CSS + PAGE_CSS}</style>

      <AuthHeader
        theme={theme} onToggleTheme={toggleTheme}
        onBack={onboarding ? undefined : handleBack}
        actions={!onboarding && (
          // <button type="button" className="bt go" onClick={focusSignIn}>Sign in</button>
          <SmartLink
            to="/login"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#FFD60A] bg-[#FFD60A] px-5 text-[13px] font-extrabold text-[#06161C] transition hover:brightness-105 active:scale-[.985]"
          >
            Sign In <ArrowUpRight className="h-3.5 w-3.5" />
          </SmartLink>
        )}
      />

      <AnimatePresence mode="wait" initial={false}>
        {resolvingResume ? (
          <motion.div key="boot" className="boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="ic spin" />
          </motion.div>
        ) : onboarding ? (
          <OnboardingPanel
            key="onboarding" token={token} loginType={loginType} profile={profile}
            onSubmit={handleOnboardingSubmit} loading={loading} serverError={error}
          />
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Landing
              step={step} identifier={identifier} loading={loading} redirecting={redirecting} serverError={error}
              onIdentifierSubmit={handleIdentifierSubmit}
              onClearError={() => setError(null)}
              onOtpVerify={handleOtpVerify}
              onResend={handleResend}
              onEditIdentifier={() => { setError(null); setStep("identifier"); }}
              onSignInClick={focusSignIn}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Onboarding — contact verification field (logic unchanged)
 * ------------------------------------------------------------------------- */
function AltContactVerify({ token, field, label, placeholder, inputMode, formatValue, validate, prefillVerifiedValue, onVerified, showRequiredError }) {
  const [value, setValue] = useState(prefillVerifiedValue || "");
  // idle | sending | otp | verified
  const [stage, setStage] = useState(prefillVerifiedValue ? "verified" : "idle");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (prefillVerifiedValue) {
      setValue(prefillVerifiedValue);
      setStage("verified");
      onVerified?.(true, prefillVerifiedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillVerifiedValue]);

  // Resend countdown — only ticks while the OTP boxes are on screen.
  useEffect(() => {
    if (stage !== "otp" || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, secondsLeft]);

  const valid = validate(value);
  const isPhoneField = field === "phone";

  const otpLabel = isPhoneField ? `Enter the OTP sent to +91 ${value}` : `Enter the OTP sent to ${value}`;
  const otpHint = isPhoneField ? "We've sent a 6-digit code by SMS." : "Check your inbox (and spam folder) for a 6-digit code.";

  const sendCode = async () => {
    if (!valid) return;
    setError(null);
    setNotice(null);
    setStage("sending");
    let res;
    try {
      res = await requestContactOtp(token, field, value);
    } catch {
      res = { success: false };
    }
    if (!res?.success) {
      setError(res?.message || "Couldn't send the code.");
      setStage("idle");
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
    setStage("otp");
  };

  // SMS / email never arrived — request a fresh code without leaving the
  // OTP step. The countdown restarts only if the request worked.
  const resendCode = async () => {
    if (secondsLeft > 0 || resending || verifying) return;
    setError(null);
    setNotice(null);
    setResending(true);
    let res;
    try {
      res = await requestContactOtp(token, field, value);
    } catch {
      res = { success: false };
    }
    setResending(false);
    if (!res?.success) {
      setError(res?.message || "Couldn't resend the code. Try again.");
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
    setResetKey((k) => k + 1);
    setNotice(isPhoneField ? `A new code has been sent to +91 ${value}.` : `A new code is on its way to ${value}.`);
  };

  // Wrong number / email typo — go back to the input with the value intact.
  const editValue = () => {
    setError(null);
    setNotice(null);
    setSecondsLeft(0);
    setStage("idle");
  };

  const confirmCode = async (otp) => {
    if (verifying) return;
    setError(null);
    setNotice(null);
    setVerifying(true);
    let res;
    try {
      res = await verifyContactOtp(token, field, value, otp);
    } catch {
      res = { success: false };
    }
    if (!res?.success) {
      setError(res?.message || "That code didn't match. Check and try again.");
      setStage("otp");
      setVerifying(false);
      return;
    }
    setVerifying(false);
    setStage("verified");
    onVerified?.(true, value);
  };

  if (stage === "verified") {
    return (
      <div className="fd">
        <span className="fl">{label}</span>
        <div className="vf">
          <CheckCircle2 className="ic" />
          <span className="v">{formatValue(value)}</span>
          <span className="pl g">Verified</span>
        </div>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <div className="fd">
        <div className="fh">
          <span className="fl">{otpLabel}</span>
          <button type="button" className="lnk" onClick={editValue} disabled={verifying}>
            <Pencil className="ic sm" />Edit
          </button>
        </div>
        <p className="hint">{otpHint}</p>
        <OtpBoxes small length={OTP_LENGTH} onComplete={confirmCode} error={error} disabled={verifying} resetKey={resetKey} />
        <div className="rw" style={{ justifyContent: "flex-start", marginTop: 4 }}>
          {secondsLeft > 0 ? (
            <span className="lnk dis" style={{ paddingLeft: 0 }}>Didn't get it? Resend in {secondsLeft}s</span>
          ) : (
            <button type="button" className="lnk" style={{ paddingLeft: 0 }} onClick={resendCode} disabled={resending || verifying}>
              {resending ? "Resending…" : (<><RotateCw className="ic sm" style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Resend code</>)}
            </button>
          )}
        </div>
        {notice && (
          <motion.p className="nt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {isPhoneField ? <Phone className="ic sm" /> : <Mail className="ic sm" />}
            {notice}
          </motion.p>
        )}
      </div>
    );
  }

  const inputId = `bbm-contact-${field}`;
  return (
    <div className="fd">
      <label className="fl" htmlFor={inputId}>{label}</label>
      <div className="fr">
        <input
          id={inputId} inputMode={inputMode} value={value}
          onChange={(e) => { setValue(e.target.value); setStage("idle"); onVerified?.(false, ""); }}
          placeholder={placeholder} disabled={stage === "sending"}
          className={`fx${showRequiredError ? " er" : ""}`}
        />
        <button type="button" className="vbn" onClick={sendCode} disabled={!valid || stage === "sending"}>
          {stage === "sending" ? <Loader2 className="ic spin" /> : "Verify"}
        </button>
      </div>
      {showRequiredError && <p className="em">Verify your {label.toLowerCase()} to continue.</p>}
      {error && <p className="em">{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Onboarding (logic unchanged)
 * ------------------------------------------------------------------------- */
function OnboardingPanel({ token, loginType, profile, onSubmit, loading, serverError }) {
  const [name, setName] = useState(profile?.name || "");

  const [resumed, setResumed] = useState(
    !!(profile?.name || (profile?.phone_verified && loginType !== "phone"))
  );
  const [phoneVerified, setPhoneVerified] = useState(loginType === "phone" || !!profile?.phone_verified);
  const [verifiedPhoneValue, setVerifiedPhoneValue] = useState(profile?.phone_verified ? profile.phone : null);

  const [gstin, setGstin] = useState("");
  const [gstStage, setGstStage] = useState("idle");
  const [gstError, setGstError] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [displayName, setDisplayName] = useState("");

  const [dispatchSame] = useState(true);
  const [dispatchAddress] = useState("");
  const [dispatchPincode] = useState("");
  const [dispatchState] = useState("");

  const [touched, setTouched] = useState(false);

  // Refs so an incomplete-submit click can scroll straight to the first
  // thing still missing, instead of leaving the person to hunt for it.
  const nameRef = useRef(null);
  const phoneSectionRef = useRef(null);
  const gstinRef = useRef(null);
  const displayNameRef = useRef(null);
  const dispatchRef = useRef(null);

  const [emailVerified, setEmailVerified] = useState(loginType === "email" || !!profile?.email_verified);
  const [verifiedEmailValue, setVerifiedEmailValue] = useState(profile?.email_verified ? profile.email : null);
  const emailSectionRef = useRef(null);

  // Resume any progress from a previous, abandoned onboarding attempt.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) return;
      const res = await fetchMe(token);
      if (!mounted || !res?.success) return;
      const p = res.profile;
      if (p.name) setName(p.name);
      if (p.phone_verified && p.phone) {
        setVerifiedPhoneValue(p.phone);
        setPhoneVerified(true);
      }
      if (p.email_verified && p.email) {
        setVerifiedEmailValue(p.email);
        setEmailVerified(true);
      }
      if (p.name || (p.phone_verified && loginType !== "phone")) setResumed(true);
    })();
    return () => { mounted = false; };
  }, [token, loginType]);

  // Autosave name so a second abandoned session still resumes.
  const saveName = () => { if (name.trim().length >= 2 && token) saveProgress(token, { name }); };

  const runLookup = async () => {
    if (!isValidGstinShape(gstin)) return;
    setGstStage("looking_up");
    setGstError(null);
    const res = await lookupGstin(token, gstin);
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

  const nameOk = name.trim().length >= 2;
  const gstinOk = gstStage === "found";
  const displayNameOk = displayName.trim().length >= 2;
  const dispatchOk = dispatchSame || (dispatchAddress.trim() && dispatchPincode.trim().length === 6 && dispatchState.trim());

  const canSubmit = nameOk && phoneVerified && (loginType !== "phone" || emailVerified) && gstinOk && displayNameOk && dispatchOk;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) {
      const firstBad = [
        { ok: nameOk, ref: nameRef },
        { ok: phoneVerified, ref: phoneSectionRef },
        { ok: loginType !== "phone" || emailVerified, ref: emailSectionRef },
        { ok: gstinOk, ref: gstinRef },
        { ok: displayNameOk, ref: displayNameRef },
        { ok: dispatchOk, ref: dispatchRef },
      ].find((f) => !f.ok);
      firstBad?.ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit({
      name: name.trim(),
      gstin,
      displayName: displayName.trim(),
      dispatchSameAsRegistered: dispatchSame,
      dispatchAddress: dispatchSame ? undefined : dispatchAddress.trim(),
      dispatchPincode: dispatchSame ? undefined : dispatchPincode.trim(),
      dispatchState: dispatchSame ? undefined : dispatchState.trim(),
    });
  };

  return (
    <motion.form
      className="ob" noValidate onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22 }}
    >
      <div className="oc">
        <div className="oh">
          <span className="pi"><Building2 className="ic" style={{ width: 26, height: 26 }} /></span>
          <h2>Set up your account</h2>
          <p>Verify your details to start trading on BBM.</p>
        </div>

        {resumed && (
          <motion.p className="wb" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Welcome back — we picked up where you left off.
          </motion.p>
        )}

        <div className="fm">
          <div ref={nameRef} className="fd sc">
            <label className="fl" htmlFor="bbm-name">Full name</label>
            <input
              id="bbm-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
              placeholder="e.g. Rohan Mehta" autoComplete="name"
              className={`fx${touched && !nameOk ? " er" : ""}`}
            />
            {touched && !nameOk && <p className="em">Enter your full name.</p>}
          </div>

          <div ref={phoneSectionRef} className="sc">
            <AltContactVerify
              token={token} field="phone" label="Mobile number" placeholder="98765 43210" inputMode="numeric"
              formatValue={(v) => `+91 ${v}`} validate={(v) => PHONE_RE.test(v)}
              prefillVerifiedValue={verifiedPhoneValue}
              onVerified={(ok) => setPhoneVerified(ok)}
              showRequiredError={touched && !phoneVerified}
            />
          </div>

          {loginType === "phone" && (
            <div ref={emailSectionRef} className="sc">
              <AltContactVerify
                token={token} field="email" label="Email" placeholder="you@company.com" inputMode="email"
                formatValue={(v) => v} validate={(v) => EMAIL_RE.test(v)}
                prefillVerifiedValue={verifiedEmailValue}
                onVerified={(ok) => setEmailVerified(ok)}
                showRequiredError={touched && !emailVerified}
              />
            </div>
          )}

          <div ref={gstinRef} className="fd sc">
            <label className="fl" htmlFor="bbm-gstin">GSTIN</label>
            <div className="fr">
              <div className="rel">
                <input
                  id="bbm-gstin" maxLength={15} value={gstin} autoCapitalize="characters" spellCheck={false}
                  onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s/g, "")); setGstStage("idle"); setGstData(null); }}
                  placeholder="22AAAAA0000A1Z5"
                  className={`fx mono${(touched && !gstinOk) || (gstin.length === 15 && !isValidGstinShape(gstin)) ? " er" : ""}`}
                />
                {gstStage === "found" && <CheckCircle2 className="ic" />}
              </div>
              <button type="button" className="vbn" onClick={runLookup} disabled={!isValidGstinShape(gstin) || gstStage === "looking_up"}>
                {gstStage === "looking_up" ? <Loader2 className="ic spin" /> : "Verify"}
              </button>
            </div>
            {gstin.length === 15 && !isValidGstinShape(gstin) && <p className="em">That doesn't match a GSTIN's format.</p>}
            {gstStage === "error" && <p className="em">{gstError}</p>}
            {touched && !gstinOk && gstStage !== "error" && gstin.length !== 15 && (
              <p className="em">Enter and verify your GSTIN to continue.</p>
            )}
          </div>

          <AnimatePresence>
            {gstStage === "found" && gstData && (
              <motion.div
                className="gd"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              >
                <ReadOnlyField label="Legal name" value={gstData.legal_name} />
                <ReadOnlyField label="Trade name" value={gstData.trade_name} />
                <ReadOnlyField label="Status" value={gstData.gstin_status} />
                <ReadOnlyField label="PAN" value={gstData.pan} />
                <ReadOnlyField label="State" value={gstData.state} />
                <ReadOnlyField label="District" value={gstData.district} />
                <ReadOnlyField label="Pincode" value={gstData.pincode} />
                <ReadOnlyField label="Registered address" value={gstData.registered_address} className="wide" />
              </motion.div>
            )}
          </AnimatePresence>

          {serverError && <p className="em" style={{ marginTop: 0 }}>{serverError}</p>}
        </div>

        <div className="ofoot">
          <button type="submit" className="bt go blk" disabled={loading}>
            {loading ? (<><Loader2 className="ic spin" />Saving…</>) : (<>Finish setting up<ArrowRight className="ic" /></>)}
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function ReadOnlyField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <small>{label}</small>
      <b>{value || "—"}</b>
    </div>
  );
}