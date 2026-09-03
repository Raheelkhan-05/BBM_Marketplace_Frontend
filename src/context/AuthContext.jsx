import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../utils/supabaseClient.js";
import { fetchMe } from "../utils/api.js";

const AuthContext = createContext(null);
const DEV_TOKEN_KEY = "bbm_dev_bypass_token";
const AUTH_TOKEN_KEY = "bbm_auth_token";

// Every event that can arrive on a user's own realtime channel. Adding a
// new one here (and to the .on(...) chain in openChannel) is the ONLY
// thing a new feature should ever need to do — nobody should open their
// own supabase.channel() for a per-user topic again. That's what caused
// the double-notification bug: a second channel subscribed to the same
// topic + event as this one, so every broadcast fired twice.
const EVENTS = ["new_notification", "submissions_changed", "orders_changed"];

const RESUBSCRIBE_BASE_DELAY_MS = 1500;
const RESUBSCRIBE_MAX_DELAY_MS = 15000;

// Reads whichever session token is in localStorage, synchronously, with
// no async work at all. Used as AuthProvider's INITIAL state (see
// useState below) — not inside an effect — so "is this person logged
// in" is known the instant this component first renders, before the
// browser has even painted anything. This is what removes the
// spinner-while-we-check-auth gap: there's nothing to wait for, because
// a value already sitting in localStorage doesn't need a network round
// trip to read.
function readStoredSession() {
  if (typeof window === "undefined") return null;
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

  // Renamed in spirit (kept as `initializing` for anything already
  // reading it) — this now ONLY tracks whether the PROFILE fetch for an
  // already-known session is still in flight. It never gates whether we
  // know if someone is logged in, since that's resolved synchronously
  // above. A guest (no stored token) starts with this already false —
  // there is nothing to wait for.
  const [profileLoading, setProfileLoading] = useState(!!session);

  // Single shared realtime channel per user. Multiple components want
  // events off the SAME `user-<token>` topic (bell, quick-manage
  // listings, orders, etc). Everyone registers a callback here instead
  // of opening their own channel — see EVENTS comment above.
  const channelRef = useRef(null);
  const listenersRef = useRef(Object.fromEntries(EVENTS.map((e) => [e, new Set()])));

  // Consumers can also register a "catch up" refetch that runs whenever
  // the channel comes back after being dropped, or the tab regains focus.
  // Broadcasts are fire-and-forget over a websocket: they WILL occasionally
  // be missed (backgrounded tab, laptop sleep, brief network loss). Push
  // gives the instant feel; this is the safety net that guarantees the UI
  // is never more than a reconnect/focus away from correct.
  const resyncRef = useRef(new Set());

  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const chanTokenRef = useRef(null);

  const subscribeUserEvent = useCallback((event, callback) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = new Set();
    listenersRef.current[event].add(callback);
    return () => listenersRef.current[event]?.delete(callback);
  }, []);

  const registerResyncHandler = useCallback((callback) => {
    resyncRef.current.add(callback);
    return () => resyncRef.current.delete(callback);
  }, []);

  const runResync = useCallback(() => {
    resyncRef.current.forEach((cb) => {
      try { cb(); } catch (e) { console.error("[AuthContext] resync handler threw:", e); }
    });
  }, []);

  const scheduleResubscribe = useCallback((chanToken) => {
    if (retryTimerRef.current) return; // already scheduled
    const attempt = retryAttemptRef.current + 1;
    retryAttemptRef.current = attempt;
    const delay = Math.min(RESUBSCRIBE_BASE_DELAY_MS * 2 ** (attempt - 1), RESUBSCRIBE_MAX_DELAY_MS);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (chanTokenRef.current !== chanToken) return; // profile/channel changed meanwhile, abandon
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      // eslint-disable-next-line no-use-before-define
      channelRef.current = openChannel(chanToken);
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openChannel = useCallback((chanToken) => {
    const channel = supabase
      .channel(`user-${chanToken}`)
      .on("broadcast", { event: "new_notification" }, ({ payload }) => {
        listenersRef.current.new_notification.forEach((cb) => cb(payload));
      })
      .on("broadcast", { event: "submissions_changed" }, ({ payload }) => {
        listenersRef.current.submissions_changed.forEach((cb) => cb(payload));
      })
      .on("broadcast", { event: "orders_changed" }, ({ payload }) => {
        listenersRef.current.orders_changed.forEach((cb) => cb(payload));
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          const wasRecovering = retryAttemptRef.current > 0;
          retryAttemptRef.current = 0;
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          // We just (re)connected after having been down — catch up on
          // anything broadcast while we were disconnected.
          if (wasRecovering) runResync();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (err) console.error(`[AuthContext] realtime channel ${status}:`, err.message || err);
          if (channelRef.current === channel && chanTokenRef.current === chanToken) {
            scheduleResubscribe(chanToken);
          }
        }
      });
    return channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runResync, scheduleResubscribe]);

  useEffect(() => {
    const chanToken = profile?.notificationChannel;

    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    retryAttemptRef.current = 0;
    chanTokenRef.current = chanToken || null;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!chanToken) return;

    channelRef.current = openChannel(chanToken);

    return () => {
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

  }, [profile?.notificationChannel, openChannel]);

  // Treat "tab became visible/focused again" the same as a reconnect —
  // background tabs are the most common way a websocket quietly dies
  // without any of our error handlers ever firing.
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

    // The token (if any) was already read synchronously into `session`
    // by readStoredSession() above, before this component's first
    // render — so there's no "figuring out if you're logged in" step
    // left here. The only genuinely async part is fetching the PROFILE
    // for an existing session, which route guards no longer block on.
    async function init() {
      if (session?.access_token) {
        await loadProfile(session.access_token);
      }
      if (mounted) setProfileLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoggedIn = !!session?.access_token;

  return (
    <AuthContext.Provider
      value={{
        session,
        token: session?.access_token,
        profile,
        // Kept under the same name so nothing else calling useAuth()
        // needs to change — but it now only reflects "is the profile
        // for an already-known session still loading", never "do we
        // know yet whether this person is logged in at all".
        initializing: profileLoading,
        isLoggedIn,
        signOut,
        clearSession,
        setDevSession,
        setAuthSession,
        subscribeUserEvent,
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