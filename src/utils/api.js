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

export async function fetchSellerOnboarding(token) {
  const res = await fetch(`${API_BASE}/seller/onboarding`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function saveSellerProgress(token, payload) {
  const res = await fetch(`${API_BASE}/seller/onboarding/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function submitSellerOnboarding(token, payload) {
  const res = await fetch(`${API_BASE}/seller/onboarding/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function uploadSellerFile(token, file, folder, bucket = "seller-assets") {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  form.append("bucket", bucket);
  const res = await fetch(`${API_BASE}/seller/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets multipart boundary
    body: form,
  });
  return res.json();
}

export async function adminListSellers(token, status = "pending_review", q = "") {
  const params = new URLSearchParams({ status, ...(q ? { q } : {}) });
  const res = await fetch(`${API_BASE}/admin/sellers?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function adminGetSeller(token, id) {
  const res = await fetch(`${API_BASE}/admin/sellers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function adminUpdateSeller(token, id, payload) {
  const res = await fetch(`${API_BASE}/admin/sellers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}
export async function adminApproveSeller(token, id) {
  const res = await fetch(`${API_BASE}/admin/sellers/${id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function adminRejectSeller(token, id, reason) {
  const res = await fetch(`${API_BASE}/admin/sellers/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
export async function fetchShopBySlug(slug) {
  const res = await fetch(`${API_BASE}/shop/${slug}`);
  return res.json();
}
export async function fetchNotifications(token) {
  const res = await fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function markNotificationRead(token, id) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function adminSearchUsers(token, q) {
  const res = await fetch(`${API_BASE}/admin/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function adminListAdmins(token) {
  // console.log(token);
  const res = await fetch(`${API_BASE}/admin/admins`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function adminPromoteUser(token, userId) {
  const res = await fetch(`${API_BASE}/admin/admins/promote`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId }),
  });
  return res.json();
}
export async function adminDemoteUser(token, userId) {
  const res = await fetch(`${API_BASE}/admin/admins/demote`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId }),
  });
  return res.json();
}