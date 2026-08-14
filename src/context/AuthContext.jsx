import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchMe } from "../utils/api.js";

const AuthContext = createContext(null);
const DEV_TOKEN_KEY = "bbm_dev_bypass_token";
const AUTH_TOKEN_KEY = "bbm_auth_token";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Single shared realtime channel per user. Multiple components want
  // events off the SAME `user-<token>` topic (bell, quick-manage
  // listings, etc). Opening a separate supabase.channel() per component
  // for the same topic breaks the earlier one — so everyone registers a
  // callback here instead of opening their own channel.
  const channelRef = useRef(null);
  const listenersRef = useRef({ new_notification: new Set(), submissions_changed: new Set() });

  const subscribeUserEvent = useCallback((event, callback) => {
    listenersRef.current[event]?.add(callback);
    return () => listenersRef.current[event]?.delete(callback);
  }, []);

  useEffect(() => {
    const chanToken = profile?.notificationChannel;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!chanToken) return;

    const channel = supabase
      .channel(`user-${chanToken}`)
      .on("broadcast", { event: "new_notification" }, ({ payload }) => {
        listenersRef.current.new_notification.forEach((cb) => cb(payload));
      })
      .on("broadcast", { event: "submissions_changed" }, ({ payload }) => {
        listenersRef.current.submissions_changed.forEach((cb) => cb(payload));
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [profile?.notificationChannel]);

  const loadProfile = useCallback(async (token) => {
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
        });
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
    await supabase.auth.signOut().catch(() => { });
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
  }, [loadProfile]);

  const isLoggedIn = !!session?.access_token;

  return (
    <AuthContext.Provider
      value={{
        session,
        token: session?.access_token,
        profile,
        initializing,
        isLoggedIn,
        signOut,
        clearSession,
        setDevSession,
        setAuthSession,
        subscribeUserEvent,
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