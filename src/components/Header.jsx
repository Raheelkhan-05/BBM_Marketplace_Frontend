// src/components/Header.jsx
//
// One header for guests and signed-in users:
//   lg+      logo | search (grows) | Deliver to | GST | cart | profile / Sign in
//   < lg     row 1: logo (full width, nothing in front of it), cart, profile  ·  row 2: search  ·  row 3: Deliver to + GST
//   + the category filter row (ActiveFilterBar):
//        < lg   category rail (chips, subcategory row once a category is picked) + a button for the searchable sheet.
//               After you scroll down it shrinks to ONE compact line (current filter + clear button), and expands
//               again when you are back near the top.
//        lg+    "Filter: Category: X" chip while a category is selected (the sidebar on the Home page is the picker)
// Search is ONE instance, repositioned with CSS order, so there is no duplicate autocomplete/animation.
// Sticky; publishes its live height as --bbm-header-h (the sidebar and the feed's sticky offset use it).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LogOut, Mail, Phone, Store, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useHomeFilters } from "../context/HomeFiltersContext.jsx";
import SmartLink from "./SmartLink.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import MarketplaceSearchBar from "./MarketplaceSearchBar";
import DeliverToBar from "./shipping/DeliverToBar.jsx";
import HomeCartButton from "./home/HomeCartButton.jsx";
import CategoryRail from "./home/CategoryRail.jsx";
import CategorySheet from "./home/CategorySheet.jsx";
import useCategoryTree from "../hooks/useCategoryTree.js";
import { filterLabel } from "../hooks/useCategories.js";

const C = { ink: "#141B22", muted: "#667077", hair: "rgba(11,17,22,0.09)", green: "#22A06B", greenInk: "#12794A", accent: "#0765CD", orange: "#D8420F" };
const EASE = [0.16, 1, 0.3, 1];

// Collapse the rail once the page has scrolled past `enter` px; expand again only below `leave` px.
// The gap between the two avoids flicker: shrinking the sticky header changes the layout height.
const COMPACT_ENTER_PX = 72;
const COMPACT_LEAVE_PX = 16;

function useScrolledPast(enter = COMPACT_ENTER_PX, leave = COMPACT_LEAVE_PX) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setPast((prev) => (prev ? y > leave : y > enter));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enter, leave]);
  return past;
}

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

// Phones / tablets (< lg): the category rail + the searchable sheet. Rendered only on Home-type routes, so the
// category tree is fetched only where it is used. Follows the seller / brand scope the page registered.
// Collapses to a single compact line while the page is scrolled down.
function MobileCategoryRail() {
  const {
    activeCategory, activeSubcategory, setCategoryFilter, viewScope, shopName,
  } = useHomeFilters();

  const shopSlug = viewScope?.shopSlug || null;
  const brandName = viewScope?.brandName || null;
  const tree = useCategoryTree({ shopSlug, brandName });
  const compact = useScrolledPast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const pickFromSheet = (cat, sub) => { setCategoryFilter(cat, sub); setSheetOpen(false); };

  const scopeName = brandName || shopName || formatShopName(shopSlug);
  const scope = scopeName && viewScope
    ? {
      shopSlug, brandName, kind: brandName ? "brand" : "shop", name: scopeName,
      onClear: () => { viewScope.clear?.(); setSheetOpen(false); },
    }
    : null;

  const categories = tree.categories || [];

  return (
    <div className="lg:hidden">
      <CategoryRail
        categories={categories}
        loading={!!tree.loading}
        activeCategoryId={activeCategory?.id ?? null}
        activeSubcategoryId={activeSubcategory?.id ?? null}
        compact={compact}
        onSelect={setCategoryFilter}
        onBrowse={openSheet}
      />
      <CategorySheet
        open={sheetOpen}
        onClose={closeSheet}
        categories={categories}
        loading={!!tree.loading}
        error={tree.error}
        onRetry={tree.retry}
        activeCategory={activeCategory}
        activeSubcategory={activeSubcategory}
        scope={scope}
        onSelect={pickFromSheet}
      />
    </div>
  );
}

// "What is filtered" chip (category, or category › subcategory). The chip's X removes the most specific
// level first (subcategory -> back to the whole category); "Clear" removes everything.
function ActiveFilterChip({ category, subcategory, onRemoveLast, onClear, className = "" }) {
  return (
    <AnimatePresence initial={false}>
      {category && (
        <motion.div
          key="filters"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className={`overflow-hidden ${className}`}
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

// The header's category filter row.
//   Home-type routes:  < lg -> category rail (+ sheet, compact on scroll);  lg+ -> active filter chip (the sidebar is the picker)
//   other routes:      active filter chip at every size while a category is selected
function ActiveFilterBar({ showRail, category, subcategory, onRemoveLast, onClear }) {
  return (
    <>
      {showRail && <MobileCategoryRail />}
      <ActiveFilterChip
        className={showRail ? "hidden lg:block" : ""}
        category={category}
        subcategory={subcategory}
        onRemoveLast={onRemoveLast}
        onClear={onClear}
      />
    </>
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
    activeCategory, activeSubcategory, setCategoryFilter, includeGst, setIncludeGst,
  } = useHomeFilters();

  const headerRef = useRef(null);
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

  const clearCategory = useCallback(() => setCategoryFilter(null, null), [setCategoryFilter]);
  const clearSubcategory = useCallback(() => setCategoryFilter(activeCategory, null), [setCategoryFilter, activeCategory]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-[14px] lg:border-b"
      style={{ borderColor: "#E4E9EC", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0 md:gap-y-2 px-3 pb-2 pt-2 sm:px-4 lg:flex-nowrap lg:gap-4 lg:px-6">
        <SmartLink to="/" aria-label="BBM home" className="flex shrink-0 items-center">
          <span
            className="whitespace-nowrap text-[22px] ps-1 font-extrabold leading-none"
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
        showRail={isHomePage}
        category={activeCategory}
        subcategory={activeSubcategory}
        onRemoveLast={activeSubcategory ? clearSubcategory : clearCategory}
        onClear={clearCategory}
      />
    </header>
  );
}