//Header.jsx

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight, User, LogOut, ChevronDown, Store, ShieldCheck, Clock3, ListChecks, Home } from "lucide-react";
import { TAGLINE } from "../../data/content";
import { useAuth } from "../context/AuthContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import SmartLink from "./SmartLink.jsx";

const NAV_LINKS = [
  { label: "Listing", href: "/admin/listings" },
  { label: "Nav2", href: "#nav2" },
  { label: "Nav3", href: "#nav3" },
  { label: "Nav4", href: "#nav4" },
];

// Shared style tokens so desktop/mobile nav never drift apart again.
const NAV_LINK_DESKTOP =
  "group relative py-1 text-[13.5px] font-semibold tracking-wide text-slate-600 transition-colors hover:text-[#047084]";
const DROPDOWN_ITEM =
  "flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50";

// Single consistent row style for every mobile menu item — nav links, account
// actions, and admin links all render the same way now. Icons are optional;
// omit the `icon` prop for plain nav links.
const MOBILE_ROW =
  "flex min-h-[46px] items-center gap-3 rounded-lg px-3 text-[14.5px] font-semibold text-slate-700 transition-colors active:bg-slate-100";

// Resolves the single seller-related menu entry based on onboarding/review status.
// Returns null once there's nothing meaningful left to prompt — an approved
// seller with a live shop should only ever see "My Shop", never any trace
// of "start selling" language, and there's no separate entry to hide since
// the label itself fully replaces the CTA at that point.
function getSellerMenuItem(profile) {
  const status = profile?.seller_status;

  if (status === "approved") {
    return { label: "My Shop", href: `/shop/${profile.shop_slug}`, icon: Store, key: "approved" };
  }
  if (status === "draft" || status === "rejected") {
    return { label: "Finish Seller Setup", href: "/seller/onboarding", icon: Clock3, key: "draft" };
  }
  if (status === "pending_review") {
    return { label: "Seller Status", href: "/seller/status", icon: Clock3, key: "pending" };
  }
  // No seller_status at all → they've never started onboarding.
  return { label: "Start Selling", href: "/seller/onboarding", icon: Store, key: "new" };
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(49);
  const { isLoggedIn, profile, signOut } = useAuth();

  const headerRef = useRef(null);
  const accountRef = useRef(null);

  // Measure the real header height instead of hardcoding it, so the mobile
  // panel never misaligns if the header's height ever changes.
  useEffect(() => {
    if (!headerRef.current) return;
    const update = () => setHeaderHeight(headerRef.current.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Close the desktop account dropdown on outside click or Escape — it had
  // no way to dismiss itself other than picking a menu item.
  useEffect(() => {
    if (!accountOpen) return;
    function onClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Close mobile menu on Escape too.
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const displayName = profile?.name?.trim().split(" ")[0] || "Account";
  const sellerItem = getSellerMenuItem(profile);
  const SellerIcon = sellerItem.icon;
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <header ref={headerRef} className="relative z-50 bg-white/60 backdrop-blur-md shadow-[0_4px_20px_-2px_rgba(15,23,42,0.08)] transition-all duration-300">
        <div className="relative mx-auto flex h-12 max-w-7xl items-center justify-between px-5 lg:px-8">
          <SmartLink to="/" className="flex items-center gap-2 shrink-0">
            <img src="/Logo.png" alt="BBM" className="h-7 w-auto object-contain" />
            <h1
              className="text-[17px] font-extrabold tracking-tight text-slate-900"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              BBM
            </h1>
          </SmartLink>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 md:flex items-center gap-9">
            {NAV_LINKS.map((item) => (
              <a key={item.label} href={item.href} className={NAV_LINK_DESKTOP}>
                {item.label}
                <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full bg-[#d2462b] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <NotificationBell />
                <div className="relative hidden md:block" ref={accountRef}>
                  <button
                    onClick={() => setAccountOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-700 transition hover:border-[#7fb3bd]"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                      style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
                    >
                      <User className="h-3.5 w-3.5" />
                    </span>
                    {displayName}
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl"
                      >
                        <SmartLink to="/home" onClick={() => setAccountOpen(false)} className={DROPDOWN_ITEM}>
                          Marketplace
                        </SmartLink>

                        <SmartLink
                          to={sellerItem.href}
                          onClick={() => setAccountOpen(false)}
                          className={DROPDOWN_ITEM}
                        >
                          <SellerIcon className="h-3.5 w-3.5 text-[#047084]" />
                          {sellerItem.label}
                        </SmartLink>

                        {isAdmin && (
                          <>
                            <div className="my-1 border-t border-slate-100" />
                            <SmartLink to="/admin/sellers" onClick={() => setAccountOpen(false)} className={DROPDOWN_ITEM}>
                              <ShieldCheck className="h-3.5 w-3.5 text-[#047084]" />
                              Admin Panel
                            </SmartLink>
                            <SmartLink to="/admin/catalog" onClick={() => setAccountOpen(false)} className={DROPDOWN_ITEM}>
                              <ListChecks className="h-3.5 w-3.5 text-[#047084]" />
                              Catalog
                            </SmartLink>
                            <SmartLink to="/admin/admins" onClick={() => setAccountOpen(false)} className={DROPDOWN_ITEM}>
                              <ShieldCheck className="h-3.5 w-3.5 text-[#047084]" />
                              Manage Admins
                            </SmartLink>
                          </>
                        )}

                        <div className="my-1 border-t border-slate-100" />
                        <button
                          onClick={() => { setAccountOpen(false); signOut(); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] font-semibold text-[#c71f11] hover:bg-slate-50"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <SmartLink
                to="/login"
                className="hidden items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_16px_-4px_rgba(199,31,17,0.45)] transition-transform duration-200 hover:-translate-y-0.5 md:inline-flex"
                style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
              >
                Sign In
                <ArrowUpRight className="h-3.5 w-3.5" />
              </SmartLink>
            )}

            <button
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="rounded-lg border border-slate-200 bg-white/70 p-1.5 text-slate-700 transition hover:border-[#7fb3bd] hover:text-[#047084] md:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ top: headerHeight }}
              className="fixed left-0 right-0 z-50 max-h-[calc(100dvh-var(--h))] overflow-y-auto border-b border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl md:hidden"
            >
              <div className="mx-auto max-w-7xl px-5 py-4">
                {/* Identity strip — mirrors the desktop avatar button so mobile
                      users get the same "signed in as" context before diving into links. */}
                {isLoggedIn && (
                  <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: "linear-gradient(135deg, #047084 0%, #7fb3bd 100%)" }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-slate-800">{displayName}</p>
                      {isAdmin && <p className="text-[11px] font-semibold text-[#047084]">Admin</p>}
                    </div>
                  </div>
                )}

                <nav className="flex flex-col gap-0.5">
                  {NAV_LINKS.map((item) => (
                    <a key={item.label} href={item.href} onClick={() => setOpen(false)} className={MOBILE_ROW}>
                      {item.label}
                    </a>
                  ))}

                  {isLoggedIn && (
                    <>
                      <div className="my-2 border-t border-slate-100" />

                      <SmartLink to="/home" onClick={() => setOpen(false)} className={MOBILE_ROW}>
                        <Home className="h-4 w-4 text-slate-400" />
                        Marketplace
                      </SmartLink>

                      <SmartLink to={sellerItem.href} onClick={() => setOpen(false)} className={`${MOBILE_ROW} text-[#047084]`}>
                        <SellerIcon className="h-4 w-4 text-[#047084]" />
                        {sellerItem.label}
                      </SmartLink>

                      {isAdmin && (
                        <>
                          <p className="mb-1 mt-3 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admin</p>
                          <SmartLink to="/admin/sellers" onClick={() => setOpen(false)} className={MOBILE_ROW}>
                            <ShieldCheck className="h-4 w-4 text-slate-400" />
                            Admin Panel
                          </SmartLink>
                          <SmartLink to="/admin/catalog" onClick={() => setOpen(false)} className={MOBILE_ROW}>
                            <ListChecks className="h-4 w-4 text-slate-400" />
                            Catalog
                          </SmartLink>
                          <SmartLink to="/admin/admins" onClick={() => setOpen(false)} className={MOBILE_ROW}>
                            <ShieldCheck className="h-4 w-4 text-slate-400" />
                            Manage Admins
                          </SmartLink>
                        </>
                      )}

                      <div className="my-2 border-t border-slate-100" />
                      <button
                        onClick={() => { setOpen(false); signOut(); }}
                        className={`${MOBILE_ROW} justify-start text-[#c71f11]`}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </>
                  )}

                  {!isLoggedIn && (
                    <SmartLink
                      to="/login"
                      onClick={() => setOpen(false)}
                      className="mt-3 flex min-h-[46px] items-center justify-center gap-1.5 rounded-lg px-4 text-center text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(199,31,17,0.4)]"
                      style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}
                    >
                      Sign In
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </SmartLink>
                  )}

                  <p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs font-medium text-slate-400">
                    {TAGLINE}
                  </p>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}