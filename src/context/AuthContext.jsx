import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchMe } from "../utils/api.js";
import posthog from "../lib/posthog.js";
import { readImpersonation, saveImpersonation, leaveImpersonation } from "../utils/impersonation.js";

const AuthContext = createContext(null);
const DEV_TOKEN_KEY = "bbm_dev_bypass_token";
const AUTH_TOKEN_KEY = "bbm_auth_token";

// (Realtime note from the previous version kept in spirit: every real-time push goes through
// Socket.IO via useSocket(); registerResyncHandler/runResync below is the tab-focus safety net.)

// Reads whichever session token is stored, synchronously, with
// no async work at all. Used as AuthProvider's INITIAL state (see
// useState below) — not inside an effect — so "is this person logged
// in" is known the instant this component first renders, before the
// browser has even painted anything.
//
// An admin "act as user" session (sessionStorage, this tab only) always wins over a stored login.
function readStoredSession() {
  if (typeof window === "undefined") return null;
  const imp = readImpersonation();
  if (imp) return { access_token: imp.token, impersonating: true };
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (authToken) return { access_token: authToken };
  const devToken = localStorage.getItem(DEV_TOKEN_KEY);
  if (devToken) return { access_token: devToken, dev_bypass: true };
  return null;
}

export function AuthProvider({ children }) {
  // Lazy initializer — runs once, synchronously, on first render.
  const [session, setSession] = useState(readStoredSession);
  const [profile, setProfile] = useState(null);
  // { sessionId, targetName, companyName, adminName, reason, expiresAt } while an admin is acting as a user.
  const [impersonation, setImpersonation] = useState(() => readImpersonation()?.meta ?? null);
  const identifiedUserIdRef = useRef(null);

  // Only tracks whether the PROFILE fetch for an already-known session is
  // still in flight. A guest (no stored token) starts with this already false.
  const [profileLoading, setProfileLoading] = useState(!!session);

  // Consumers can register a "catch up" refetch that runs whenever the
  // tab regains focus/visibility, or comes back online.
  const resyncRef = useRef(new Set());

  const registerResyncHandler = useCallback((callback) => {
    resyncRef.current.add(callback);
    return () => resyncRef.current.delete(callback);
  }, []);

  const runResync = useCallback(() => {
    resyncRef.current.forEach((cb) => {
      try { cb(); } catch (e) { console.error("[AuthContext] resync handler threw:", e); }
    });
  }, []);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") runResync();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [runResync]);

  const loadProfile = useCallback(async (token, attempt = 0) => {
    if (!token) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetchMe(token);
      if (res?.success) {
        setProfile({
          ...res.profile,
          seller_status: res.seller_status,
          businessProfile: res.businessProfile,
          shop_slug: res.businessProfile?.shop_slug ?? res.shop_slug ?? null,
          notificationChannel: res.notificationChannel,
          // TEAM: null for a solo company; { id, role, isAdmin, actorId } when the account has a team.
          // For a team member, `profile` above is the COMPANY's profile (same id chat/orders use).
          team: res.team ?? null,
        });
        return;
      }
      // 401 covers an expired session AND a team member who has been removed (TEAM_ACCESS_REMOVED).
      // For an admin session it means the session ended or was revoked: drop it without touching any real login.
      if (res?.status === 401) {
        if (readImpersonation()?.token === token) { leaveImpersonation("/home"); return; }
        await clearSession();
        return;
      }
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        return loadProfile(token, attempt + 1);
      }
      setProfile(null);
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        return loadProfile(token, attempt + 1);
      }
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSession = useCallback(async () => {
    // Inside an admin session, "clear" only ever means leaving that session; the real login is never touched.
    if (readImpersonation()) { leaveImpersonation("/home"); return; }
    posthog?.reset();
    identifiedUserIdRef.current = null;
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut().catch(() => { });
  }, []);

  const signOut = useCallback(async () => {
    if (readImpersonation()) { leaveImpersonation("/home"); return; }
    posthog?.reset();
    identifiedUserIdRef.current = null;
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const setDevSession = useCallback((token) => {
    localStorage.setItem(DEV_TOKEN_KEY, token);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setSession({ access_token: token, dev_bypass: true });
    return loadProfile(token);
  }, [loadProfile]);

  // Call this after OTP verify / onboarding / joining a team. Stores the JWT in real-session
  // storage (not the dev-bypass key) so isLoggedIn flips true and protected
  // routes (like /home) unblock immediately. Resolves once the profile has loaded.
  const setAuthSession = useCallback((token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setSession({ access_token: token });
    return loadProfile(token);
  }, [loadProfile]);

  // Admin "act as user": stores the short-lived admin token in THIS TAB ONLY (sessionStorage).
  // Resolves once the user's profile has loaded, so the caller can navigate without a guest flash.
  const startImpersonation = useCallback((token, meta) => {
    saveImpersonation(token, meta);
    setImpersonation(meta);
    setProfile(null);
    setSession({ access_token: token, impersonating: true });
    return loadProfile(token);
  }, [loadProfile]);

  // The profile is resolved after login and on a restored session. Identifying
  // here attributes all later browser captures and errors without repeating it
  // at individual pages or event call sites.
  // Never during an admin session: the admin's browsing must not be attributed to the user.
  useEffect(() => {
    if (impersonation) return;
    const distinctId = profile?.id ? String(profile.id) : null;

    if (!distinctId) {
      if (identifiedUserIdRef.current) {
        posthog?.reset();
        identifiedUserIdRef.current = null;
      }
      return;
    }

    if (identifiedUserIdRef.current === distinctId) return;

    if (identifiedUserIdRef.current) posthog?.reset();

    posthog?.identify(distinctId, {
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.team?.role ? { role: profile.team.role } : {}),
    });
    identifiedUserIdRef.current = distinctId;
  }, [profile, impersonation]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (session?.access_token) {
        await loadProfile(session.access_token);
      }
      if (mounted) setProfileLoading(false);
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") return;
      if (readImpersonation()) return; // an admin session must never be replaced by a background auth event
      if (newSession?.access_token) {
        localStorage.setItem(AUTH_TOKEN_KEY, newSession.access_token);
        setSession(newSession);
        loadProfile(newSession.access_token);
      } else if (
        !localStorage.getItem(DEV_TOKEN_KEY) &&
        !localStorage.getItem(AUTH_TOKEN_KEY)
      ) {
        setSession(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoggedIn = !!session?.access_token;

  return (
    <AuthContext.Provider
      value={{
        session,
        token: session?.access_token,
        profile,
        initializing: profileLoading,
        isLoggedIn,
        effectiveLoggedIn: isLoggedIn,
        // ADMIN "ACT AS USER"
        isImpersonating: !!impersonation,
        impersonation,
        startImpersonation,
        // TEAM
        isTeamMember: !!profile?.team && !profile.team.isAdmin,
        isSalesperson: profile?.team?.role === "salesperson",
        isTeamAdmin: !profile?.team || !!profile.team.isAdmin,
        signOut,
        clearSession,
        setDevSession,
        setAuthSession,
        registerResyncHandler,
        refreshProfile: () => loadProfile(session?.access_token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}