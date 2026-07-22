// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchMe } from "../utils/api.js";

const AuthContext = createContext(null);
const DEV_TOKEN_KEY = "bbm_dev_bypass_token";
const AUTH_TOKEN_KEY = "bbm_auth_token"; // separate, real-session storage

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

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
      if (res?.status === 401) {
        await clearSession();
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSession = useCallback(async () => {
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
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

  // Call this after OTP verify / onboarding. Stores the JWT in real-session
  // storage (not the dev-bypass key) so isLoggedIn flips true and protected
  // routes (like /home) unblock immediately.
  const setAuthSession = useCallback((token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setSession({ access_token: token });
    return loadProfile(token);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

async function init() {
  const devToken = localStorage.getItem(DEV_TOKEN_KEY);
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);

  if (authToken) {
    setSession({ access_token: authToken });
    await loadProfile(authToken);
  } else if (devToken) {
    setSession({ access_token: devToken, dev_bypass: true });
    await loadProfile(devToken);
  } else {
    setSession(null);
  }

  if (mounted) setInitializing(false);
}
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") return;
      if (newSession?.access_token) {
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
        clearSession,
        setDevSession,
        setAuthSession,
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