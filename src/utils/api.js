// utils/api.js

import { supabase } from "./supabaseClient.js";
import { identifierType } from "./validators.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function toE164(phone) {
  return `+91${phone}`;
}

// -> { success, message? }
export async function requestOtp(identifier) {
  const type = identifierType(identifier);

  if (type === "email") {
    const { error } = await supabase.auth.signInWithOtp({ email: identifier.trim() });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  if (type === "phone") {
    // DEV MODE: no real SMS provider wired yet. This hits a backend stub
    // that does not send anything — see phoneDevAuth.controller.js.
    // Swap this back to supabase.auth.signInWithOtp({ phone }) once a
    // real SMS provider (MSG91/Twilio/etc via Supabase) is configured.
    const res = await fetch(`${API_BASE}/auth/phone/dev-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: toE164(identifier) }),
    });
    return res.json();
  }

  return { success: false, message: "Enter a valid phone number or email." };
}

// -> { success, isNewUser, token, message? }
export async function verifyOtp(identifier, otp) {
  const type = identifierType(identifier);
  let token;

  if (type === "email") {
    const { data, error } = await supabase.auth.verifyOtp({
      email: identifier.trim(),
      token: otp,
      type: "email",
    });
    if (error) return { success: false, message: error.message };
    token = data.session?.access_token;
  } else if (type === "phone") {
    // DEV MODE ONLY — accepts any 6-digit code. See backend controller
    // for the guard that refuses to run this in production.
    const res = await fetch(`${API_BASE}/auth/phone/dev-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: toE164(identifier), otp }),
    });
    const data = await res.json();
    if (!data.success) return data;
    token = data.token;
  } else {
    return { success: false, message: "Enter a valid phone number or email." };
  }

  if (!token) return { success: false, message: "No session returned. Try again." };

  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json();
    const isNewUser = !me?.profile?.name;
    return { success: true, isNewUser, token };
  } catch {
    return { success: true, isNewUser: true, token };
  }
}

export async function registerProfile(token, profile) {
  console.log("registerProfile token:", token); // temporary
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  });
  return res.json();
}

export async function submitCompany(token, business) {
  const res = await fetch(`${API_BASE}/auth/company`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(business),
  });
  return res.json();
}

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}