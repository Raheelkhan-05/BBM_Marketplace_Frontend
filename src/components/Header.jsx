// src/components/Header.jsx
//
// One header for guests and signed-in users:
//   lg+      logo | search (grows) | Deliver to | GST | cart | profile / Sign in
//   < lg     row 1: menu, logo, cart, profile  ·  row 2: search  ·  row 3: Deliver to + GST
//   + an "active filter" chip row (any size) while a category is selected.
// Search is ONE instance, repositioned with CSS order, so there is no duplicate autocomplete/animation.
// Sticky; publishes its live height as --bbm-header-h (the sidebar and the feed's sticky offset use it).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LogOut, Mail, Menu, Phone, Store, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useHomeFilters } from "../context/HomeFiltersContext.jsx";
import SmartLink from "./SmartLink.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar";
import DeliverToBar from "./shipping/DeliverToBar.jsx";
import HomeCartButton from "./home/HomeCartButton.jsx";
import { CategoryList } from "./home/CategorySidebar.jsx";
import { shortLabel, filterLabel } from "../hooks/useCategories.js";

const C = { ink: "#141B22", muted: "#667077", hair: "rgba(11,17,22,0.09)", green: "#22A06B", greenInk: "#12794A", accent: "#0765CD", orange: "#D8420F" };
const EASE = [0.16, 1, 0.3, 1];

function formatShopName(slug) {
  if (!slug) return "";
  return slug.replace(/-\d+$/, "").split("-").filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Adjust the field names here if your profile object uses different ones.
function accountInfo(profile, user) {
  const email = profile?.email || user?.email || "";
  const phone =
    profile?.phone || profile?.mobile || profile?.phone_number ||
    profile?.contact_number || profile?.contact || user?.phone || "";
  const shop =
    profile?.shop_name || profile?.business_name || profile?.display_name ||
    formatShopName(profile?.shop_slug) || "";
  return { email: String(email).trim(), phone: String(phone).trim(), shop: String(shop).trim() };
}

function GstToggle({ includeGst, onChange, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={includeGst}
      aria-label={`GST ${includeGst ? "included" : "excluded"}`}
      onClick={() => onChange(!includeGst)}
      className={`group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full ${className}`}
    >
      <span
        className="w-[88px] shrink-0 whitespace-nowrap text-right text-[11.5px] font-bold leading-none tracking-wide"
      >
        {includeGst ? "With GST" : "Without GST"}
      </span>
      <span
        className="relative flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200"
        style={{ backgroundColor: includeGst ? C.green : "#D9DEE2" }}
      >
        <span
          className="h-3 w-3 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
          style={{ transform: includeGst ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

function InfoRow({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.muted }} strokeWidth={2.1} />
      <div className="min-w-0">
        <p className="text-[9.5px] font-extrabold uppercase leading-none tracking-[0.12em]" style={{ color: C.muted }}>{label}</p>
        <p className="mt-1 break-words text-[13.5px] font-bold leading-snug tracking-wide" style={{ color: C.ink }}>{value}</p>
      </div>
    </div>
  );
}

function ProfileMenu({ info, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hasAny = !!(info.email || info.phone || info.shop);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border bg-white transition hover:bg-black/[0.04] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F63B5]/50"
        style={{ borderColor: "#D9D3C9", color: C.ink }}
      >
        <User className="h-5 w-5" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border bg-white p-2 shadow-[0_18px_40px_-14px_rgba(8,34,43,0.35)]"
            style={{ borderColor: C.hair }}
          >
            <div className="pb-1 pt-1.5">
              {info.email && <InfoRow Icon={Mail} label="Email" value={info.email} />}
              {info.phone && <InfoRow Icon={Phone} label="Contact" value={info.phone} />}
              {info.shop && <InfoRow Icon={Store} label="Shop" value={info.shop} />}
              {!hasAny && (
                <p className="px-3 py-2 text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>Signed in</p>
              )}
            </div>
            <div className="mx-1 my-1 h-px" style={{ background: C.hair }} />
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[#B3261E] transition-colors hover:bg-[#FDECEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B3261E]/40"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.3} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryDrawer({ open, activeCategory, activeSubcategory, scope, onSelect, onClear, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            className="fixed inset-0 z-[9994] bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
            data-lenis-prevent
            className="fixed inset-y-0 left-0 z-[9995] flex w-[min(320px,86vw)] flex-col bg-white shadow-2xl"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ duration: 0.26, ease: EASE }}
          >
            <div className="flex items-center justify-between px-4 pb-2" style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
              <h2 className="text-[16px] font-extrabold tracking-wide" style={{ color: C.ink }}>Categories</h2>
              <button
                type="button" onClick={onClose} aria-label="Close categories"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/[0.05]"
              >
                <X className="h-5 w-5" style={{ color: C.ink }} />
              </button>
            </div>

            {activeCategory && (
              <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#EAF2FD" }}>
                <span className="min-w-0 truncate text-[12.5px] font-bold tracking-wide" style={{ color: C.accent }}>
                  Filtered: {filterLabel(activeCategory, activeSubcategory)}
                </span>
                <button
                  type="button"
                  onClick={onClear}
                  className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-extrabold tracking-wide active:scale-95"
                  style={{ color: C.accent }}
                >
                  Clear
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-8">
              <CategoryList
                activeCategoryId={activeCategory?.id}
                activeSubcategoryId={activeSubcategory?.id}
                onSelect={onSelect}
                scope={scope}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}


// Always-visible "what is filtered" row (category, or category › subcategory). Lives in the sticky
// header, so it never scrolls away. The chip's X removes the most specific level first
// (subcategory -> back to the whole category); "Clear" removes everything.
function ActiveFilterBar({ category, subcategory, onRemoveLast, onClear }) {
  return (
    <AnimatePresence initial={false}>
      {category && (
        <motion.div
          key="filters"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 pb-2 sm:px-4 lg:px-6">
            <span className="shrink-0 text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Filter
            </span>
            <button
              type="button"
              onClick={onRemoveLast}
              aria-label={subcategory ? `Remove subcategory filter ${subcategory.name}` : `Remove category filter ${category.name}`}
              className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-[12.5px] font-bold tracking-wide transition active:scale-[0.98] hover:bg-[#DDEAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0765CD]/50"
              style={{ background: "#EAF2FD", borderColor: "#C9DDF7", color: C.accent }}
            >
              <span className="truncate">Category: {filterLabel(category, subcategory)}</span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                <X className="h-3 w-3" strokeWidth={3} />
              </span>
            </button>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-[12px] font-extrabold tracking-wide underline-offset-2 hover:underline"
              style={{ color: C.muted }}
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


export default function Header() {
  const location = useLocation();

  const pathname = location.pathname;

  const isHomePage =
    pathname === "/home" ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/seller/");

  const navigate = useNavigate();
  const { effectiveLoggedIn, profile, user, signOut } = useAuth();
  const {
    query, setQuery, shopName, feedActive,
    activeCategory, activeSubcategory, setCategoryFilter, viewScope, includeGst, setIncludeGst,
  } = useHomeFilters();

  const headerRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const info = accountInfo(profile, user);

  // Publish live height for the sidebar / feed sticky offsets.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () =>
      document.documentElement.style.setProperty("--bbm-header-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--bbm-header-h");
    };
  }, []);

  // Go to the feed once (not on every keystroke) when results aren't on screen.
  const redirectedRef = useRef(false);
  useEffect(() => { if (feedActive) redirectedRef.current = false; }, [feedActive]);
  const ensureFeed = useCallback(() => {
    if (feedActive || redirectedRef.current) return;
    redirectedRef.current = true;
    navigate("/home");
  }, [feedActive, navigate]);

  const handleChange = (v) => {
    setQuery(v);
    if (v.trim()) ensureFeed();
  };
  const handleSubmit = (trimmed) => { setQuery(trimmed); ensureFeed(); };
  const handleSuggestionSelect = (s) => {
    if (s.level === "brandFamily") {
      navigate(`/brand-family/${encodeURIComponent(s.name)}`);
      return;
    }
    setQuery(s.name);
    ensureFeed();
  };

  const pickCategory = (cat, sub = null) => {
    setCategoryFilter(cat, sub);
    ensureFeed();
    setDrawerOpen(false);
  };
  const clearCategory = useCallback(() => { setCategoryFilter(null, null); setDrawerOpen(false); }, [setCategoryFilter]);
  const clearSubcategory = useCallback(() => setCategoryFilter(activeCategory, null), [setCategoryFilter, activeCategory]);

  // When a seller / brand page is open, the drawer lists only what that seller / brand sells.
  const scopeActive = !!(viewScope?.shopSlug || viewScope?.brandName);
  const drawerScope = scopeActive
    ? {
      shopSlug: viewScope.shopSlug,
      brandName: viewScope.brandName,
      kind: viewScope.brandName ? "brand" : "shop",
      name: viewScope.brandName || shopName || formatShopName(viewScope.shopSlug),
      onClear: () => { viewScope.clear?.(); setDrawerOpen(false); },
    }
    : null;

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-[14px]"
        style={{ borderColor: "#E4E9EC", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 md:gap-y-2 px-3 pb-2 pt-2 sm:px-4 lg:flex-nowrap lg:gap-4 lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={activeCategory ? `Open categories, filtered by ${activeCategory.name}` : "Open categories"}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05] active:scale-95 lg:hidden"
          >
            <Menu className="h-5 w-5" style={{ color: C.ink }} strokeWidth={2.2} />
            {activeCategory && (
              <span
                aria-hidden
                className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white"
                style={{ background: C.orange }}
              />
            )}
          </button>

          <SmartLink to="/" aria-label="BBM home" className="flex shrink-0 items-center">
            <span
              className="whitespace-nowrap text-[21px] font-extrabold lowercase leading-none lg:text-[22px]"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#092747" }}
            >
              bbm.business
            </span>
          </SmartLink>

          {/* The single search instance: own row on phones, inline from md up. */}
          {isHomePage && (
            <div className="order-10 w-full basis-full min-w-0 md:order-none md:w-auto md:basis-0 md:flex-1 lg:max-w-[960px]">
              <MarketplaceSearchBar
                flush
                value={query}
                onChange={handleChange}
                onSubmit={handleSubmit}
                onSuggestionSelect={handleSuggestionSelect}
                placeholder={shopName ? `Search in ${shopName}…` : undefined}
                clearOnSubmit={false}
                suggestionsDirection="down"
              />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 lg:ml-auto lg:gap-4">
            {isHomePage && (
              <>
                <div className="hidden lg:block">
                  <DeliverToBar />
                </div>
                <GstToggle
                  includeGst={includeGst}
                  onChange={setIncludeGst}
                  className="hidden lg:inline-flex"
                />
              </>
            )}
            <HomeCartButton />
            {effectiveLoggedIn ? (
              <ProfileMenu info={info} onSignOut={signOut} />
            ) : (
              <SmartLink
                to="/login"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#0F63B5] bg-[#0F63B5] px-4 text-[13px] font-extrabold text-white transition hover:brightness-105 active:scale-[.985] sm:px-5"
              >
                Sign In <ArrowUpRight className="h-3.5 w-3.5" />
              </SmartLink>
            )}
          </div>

          {/* Below lg: Deliver to + GST under the search. */}
          {isHomePage && (
            <div className="order-20 flex w-full basis-full items-center justify-between gap-3 lg:hidden">
              <div className="min-w-0">
                <DeliverToBar />
              </div>
              <GstToggle
                includeGst={includeGst}
                onChange={setIncludeGst}
              />
            </div>
          )}
        </div>

        <ActiveFilterBar
          category={activeCategory}
          subcategory={activeSubcategory}
          onRemoveLast={activeSubcategory ? clearSubcategory : clearCategory}
          onClear={clearCategory}
        />
      </header>

      <CategoryDrawer
        open={drawerOpen}
        activeCategory={activeCategory}
        activeSubcategory={activeSubcategory}
        scope={drawerScope}
        onSelect={pickCategory}
        onClear={clearCategory}
        onClose={closeDrawer}
      />
    </>
  );
}