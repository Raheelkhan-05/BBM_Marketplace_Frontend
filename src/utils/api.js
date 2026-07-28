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
    console.log("fetch me data : ", data);
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

export async function fetchSellerDashboard(token) {
  const res = await fetch(`${API_BASE}/seller/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function updateSellerProfile(token, payload) {
  const res = await fetch(`${API_BASE}/seller/profile`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  return res.json();
}
export async function updateSellerTheme(token, payload) {
  const res = await fetch(`${API_BASE}/seller/theme`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  return res.json();
}
export async function addSellerPhoto(token, category, url) {
  const res = await fetch(`${API_BASE}/seller/photos`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ category, url }),
  });
  return res.json();
}
export async function deleteSellerPhoto(token, id) {
  const res = await fetch(`${API_BASE}/seller/photos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function addSellerCertification(token, payload) {
  const res = await fetch(`${API_BASE}/seller/certifications`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  return res.json();
}
export async function deleteSellerCertification(token, id) {
  const res = await fetch(`${API_BASE}/seller/certifications/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function fetchSellerProducts(token) {
  const res = await fetch(`${API_BASE}/seller/products`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
export async function createSellerProduct(token, payload) {
  const res = await fetch(`${API_BASE}/seller/products`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  return res.json();
}
export async function updateSellerProduct(token, id, payload) {
  const res = await fetch(`${API_BASE}/seller/products/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  return res.json();
}
export async function deleteSellerProduct(token, id) {
  const res = await fetch(`${API_BASE}/seller/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function searchShops(query, limit = 8) {
  const params = new URLSearchParams({ q: query, limit });
  const res = await fetch(`${API_BASE}/shop/search?${params}`);
  return res.json();
}

async function get(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const res = await fetch(`${API_BASE}${path}?${query}`);
  return res.json();
}

export async function searchCategories(q = "", limit = 20) {
  return get("/search/categories", { q, limit });
}

export async function searchSubcategories(categoryId, q = "", limit = 20) {
  return get("/search/subcategories", { categoryId, q, limit });
}

export async function searchProductsInSubcategory(subcategoryId, q = "", limit = 20) {
  return get("/search/products", { subcategoryId, q, limit });
}

export async function searchBrandsForProduct(productId, q = "", limit = 20) {
  return get("/search/brands", { productId, q, limit });
}

export async function searchSellersForProduct(productId, q = "", limit = 20, brandId) {
  return get("/search/sellers", { productId, brandId, q, limit });
}

// Single convenience call used by useHierarchySearch — avoids branching
// on which of the four functions above to call.
export async function searchHierarchyLevel(level, parentId, q = "", limit = 20, productId) {
  const params = { level, q, limit };
  if (level === "subcategory") params.categoryId = parentId;
  if (level === "product") params.subcategoryId = parentId;
  if (level === "brand") params.productId = parentId;
  if (level === "seller") {
    // parentId here is the brand id; productId comes separately from the
    // hook, since sellers are filtered by product (required) + brand (optional).
    params.productId = productId;
    params.brandId = parentId;
  }
  return get("/search/hierarchy", params);
}

// Cross-level search — searches categories + subcategories + products at
// once. Used as a fallback when a scoped search at the current level is
// empty, so e.g. typing a product name while browsing a different category
// still finds it and can jump straight there.
export async function searchSmart(q, limit = 5) {
  return get("/search/smart", { q, limit });
}

// Last-resort AI classification — called automatically by
// useHierarchySearch once scoped + smart search both come up empty.
export async function resolveWithAI({ query, level, parentId }) {
  const res = await fetch(`${API_BASE}/search/ai-resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, level, parentId }),
  });
  return res.json();
}

// Image search — identifies the product in a photo AND resolves it
// server-side (embedding cascade against existing products/subcategories/
// categories, falling back to AI creation). Returns a ready-to-display
// breadcrumb stack, not just a raw search term.
// imageBase64 has no "data:" prefix (use resizeImageForSearch first).
export async function searchByImage(imageBase64, mimeType) {
  const res = await fetch(`${API_BASE}/search/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  return res.json();
}

export async function fetchImageStatuses(pendingImages) {
  const ids = pendingImages.map((p) => `${p.level}:${p.id}`).join(",");
  return get("/search/image-status", { ids });
}
