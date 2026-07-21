// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchMe } from "../utils/api.js";

const AuthContext = createContext(null);
const DEV_TOKEN_KEY = "bbm_dev_bypass_token";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(async () => {
    localStorage.removeItem(DEV_TOKEN_KEY);
    setSession(null);
    setProfile(null);
    // Also tell Supabase's own client its session is dead, so it stops
    // trying to recover/refresh it on every visibility change.
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const loadProfile = useCallback(async (token) => {
    if (!token) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetchMe(token);
      if (res?.success) {
        setProfile(res.profile);
        return;
      }
      if (res?.success) {
        setProfile(res.profile);
        return;
      }
      if (res?.status === 401) {
        await clearSession();
      } else {
        setProfile(null);
      }
      // fetchMe() doesn't currently expose HTTP status, so treat any
      // !success as "this token is dead" and clear it — see fetchMe fix below.
      await clearSession();
    } catch {
      // Network error etc. — don't nuke the session for a transient failure.
      setProfile(null);
    }
  }, [clearSession]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1. Check for a persisted dev-bypass token FIRST — this is
      // synchronous-ish (localStorage) and must resolve before we ever
      // decide "not logged in", or a refresh momentarily looks logged-out.
      const devToken = localStorage.getItem(DEV_TOKEN_KEY);

      // 2. Check the real Supabase session in parallel.
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session?.access_token) {
        // Real session wins if both somehow exist.
        setSession(data.session);
        await loadProfile(data.session.access_token);
      } else if (devToken) {
        setSession({ access_token: devToken, dev_bypass: true });
        await loadProfile(devToken);
      } else {
        setSession(null);
      }

      if (mounted) setInitializing(false);
    }

    init();

    // Only react to REAL auth changes here — dev-bypass session updates
    // go through setDevSession() directly, not through Supabase's listener.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Ignore the initial firing — init() above already handled first load,
      // and reacting here too is what causes the false->true->false flicker.
      if (event === "INITIAL_SESSION") return;

      if (newSession?.access_token) {
        setSession(newSession);
        loadProfile(newSession.access_token);
      } else if (!localStorage.getItem(DEV_TOKEN_KEY)) {
        // Only clear if there's no dev-bypass token backing us up.
        setSession(null);
        clearSession();
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(DEV_TOKEN_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const setDevSession = useCallback((token) => {
    localStorage.setItem(DEV_TOKEN_KEY, token);
    setSession({ access_token: token, dev_bypass: true });
    loadProfile(token);
  }, [loadProfile]);

  const isLoggedIn = !!session?.access_token;

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        initializing,
        isLoggedIn,
        signOut,
        setDevSession,
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