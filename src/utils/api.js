// utils/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export async function requestOtp(identifier) {
  const res = await fetch(`${API_BASE}/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  return res.json();
}

export async function verifyOtp(identifier, otp) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, otp }),
  });
  return res.json();
}

export async function fetchMe(token) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return { ...data, status: res.status, success: res.ok && data?.success !== false };
  } catch (e) {
    return { success: false, status: 0, message: "Network error." };
  }
}

export async function lookupGstin(token, gstin) {
  const res = await fetch(`${API_BASE}/auth/gst-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ gstin }),
  });
  return res.json();
}

export async function completeProfile(token, payload) {
  const res = await fetch(`${API_BASE}/auth/complete-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function requestContactOtp(token, field, value) {
  const res = await fetch(`${API_BASE}/auth/contact/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ field, value }),
  });
  return res.json();
}

export async function verifyContactOtp(token, field, value, otp) {
  const res = await fetch(`${API_BASE}/auth/contact/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ field, value, otp }),
  });
  return res.json();
}

export async function saveProgress(token, payload) {
  const res = await fetch(`${API_BASE}/auth/save-progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}