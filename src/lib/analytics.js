// src/lib/analytics.js
import posthog from "posthog-js";

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY;
const PH_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
// Only needed if PH_HOST is a reverse-proxy path like "/ingest" (see vercel.json notes).
const PH_UI_HOST = import.meta.env.VITE_POSTHOG_UI_HOST || undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;
// Same base your api.js uses.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");

export const analyticsEnabled = Boolean(PH_KEY);

let initialized = false;
let clarityLoaded = false;
let fetchPatched = false;
let currentIdentity = null; // { id, traits } remembered so we can identify after consent

// Query params that must never leave the browser.
const SENSITIVE_PARAMS = new Set([
    "token", "access_token", "refresh_token", "id_token", "code", "key", "apikey",
    "secret", "password", "otp", "hash", "securehash", "signature", "sig", "invite",
]);
// Pages whose whole query string is gateway/invite data.
const FULLY_STRIPPED_PATHS = ["/payment/return", "/join-team"];

function scrubUrl(raw) {
    if (typeof raw !== "string" || !raw) return raw;
    try {
        const u = new URL(raw, window.location.origin);
        if (FULLY_STRIPPED_PATHS.some((p) => u.pathname.startsWith(p))) {
            u.search = "";
        } else {
            for (const k of [...u.searchParams.keys()]) {
                if (SENSITIVE_PARAMS.has(k.toLowerCase())) u.searchParams.set(k, "redacted");
            }
        }
        u.hash = ""; // auth redirects can put tokens in the hash
        return u.toString();
    } catch {
        return raw;
    }
}

function appArea(pathname = "") {
    if (pathname.startsWith("/sell")) return "seller";
    if (pathname.startsWith("/buy")) return "buyer";
    if (pathname.startsWith("/sales")) return "sales";
    if (pathname.startsWith("/admin")) return "admin";
    return "marketplace";
}

function beforeSend(event) {
    if (!event) return null;
    const p = (event.properties = event.properties || {});
    for (const k of ["$current_url", "$referrer", "$initial_referrer"]) {
        if (p[k]) p[k] = scrubUrl(p[k]);
    }
    if (event.$set_once) {
        for (const k of ["$initial_current_url", "$initial_referrer"]) {
            if (event.$set_once[k]) event.$set_once[k] = scrubUrl(event.$set_once[k]);
        }
    }
    p.app_area = appArea(window.location.pathname);
    return event;
}

function loadClarity() {
    if (!CLARITY_ID || clarityLoaded || typeof window === "undefined") return;
    clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    if (currentIdentity) window.clarity("identify", currentIdentity.id);
}

function stopClarity() {
    // Tells Clarity to erase its cookies and stop recording for this browser.
    if (clarityLoaded && window.clarity) window.clarity("consent", false);
}

// Adds X-PH-Distinct-Id to calls to YOUR API, so backend events join the same person.
// Only for requests that already carry an Authorization header (they preflight anyway, so no
// extra OPTIONS requests), and only after the user accepted analytics. This one wrapper
// replaces editing every fetch call in utils/api.js, sellerListingApi.js, teamApi.js, etc.
function patchFetchForApi() {
    if (fetchPatched || typeof window === "undefined" || typeof window.fetch !== "function") return;
    fetchPatched = true;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
        try {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : null;
            if (url && url.startsWith(API_BASE)) {
                const id = getAnalyticsDistinctId();
                if (id) {
                    const headers = new Headers(init?.headers || {});
                    if (headers.has("Authorization")) {
                        headers.set("X-PH-Distinct-Id", id);
                        init = { ...(init || {}), headers };
                    }
                }
            }
        } catch { /* never let analytics break a request */ }
        return original(input, init);
    };
}

export function initAnalytics() {
    if (initialized || !analyticsEnabled || typeof window === "undefined") return;
    initialized = true;

    posthog.init(PH_KEY, {
        api_host: PH_HOST,
        ...(PH_UI_HOST ? { ui_host: PH_UI_HOST } : {}),
        opt_out_capturing_by_default: true, // nothing is sent until the user accepts
        respect_dnt: true,
        person_profiles: "identified_only", // anonymous visitors cost less and still merge on login
        capture_pageview: "history_change", // SPA route changes
        capture_pageleave: true, // time on page + scroll depth
        autocapture: {
            dom_event_allowlist: ["click", "submit"], // no change/input events
            capture_copied_text: false,
        },
        // B2B screens show names, addresses and GSTINs inside buttons and cards:
        // keep the click, drop the text of the clicked element.
        mask_all_text: true,
        disable_session_recording: true, // Clarity handles replay
        persistence: "localStorage+cookie",
        before_send: beforeSend,
        loaded: () => {
            if (posthog.get_explicit_consent_status() === "granted") loadClarity();
        },
    });

    patchFetchForApi();
}

// ---- consent -------------------------------------------------------------

export function getConsent() {
    if (!initialized) return "unavailable";
    return posthog.get_explicit_consent_status(); // "pending" | "granted" | "denied"
}

export function grantConsent() {
    if (!initialized) return;
    posthog.opt_in_capturing();
    loadClarity();
    if (currentIdentity) {
        posthog.identify(currentIdentity.id, currentIdentity.traits);
        window.clarity?.("identify", currentIdentity.id);
    }
    posthog.capture("$pageview"); // the page the user is on when they accept
}

export function denyConsent() {
    if (!initialized) return;
    posthog.opt_out_capturing();
    stopClarity();
}

// ---- identity ------------------------------------------------------------

// Pass ONLY the stable user id and non-sensitive traits (role, flags). No email/phone/name.
export function identifyUser(id, traits = {}) {
    if (!id) return;
    currentIdentity = { id: String(id), traits };
    if (!initialized) return;
    if (getConsent() === "granted") {
        posthog.identify(currentIdentity.id, traits);
        window.clarity?.("identify", currentIdentity.id);
    }
}

export function resetUser() {
    currentIdentity = null;
    if (initialized) posthog.reset();
}

// ---- events --------------------------------------------------------------

// Never put passwords, tokens, card data, emails, phone numbers, GSTINs or addresses in props.
export function track(event, props = {}) {
    if (!initialized) return;
    posthog.capture(event, props);
    if (getConsent() === "granted") window.clarity?.("event", event);
}

// Returns null without consent, so the server records the request anonymously.
export function getAnalyticsDistinctId() {
    if (!initialized || getConsent() !== "granted") return null;
    return posthog.get_distinct_id();
}

// Server error codes are logged only when they look like an enum (e.g. "BELOW_MOQ").
// Anything else (raw database text, messages) becomes "UNKNOWN" and never reaches analytics.
export function safeCode(code) {
    return typeof code === "string" && /^[A-Z][A-Z0-9_]{1,39}$/.test(code) ? code : "UNKNOWN";
}