// utils/validators.js
// Pure, dependency-free validators shared by the auth flow.
// All of these run instantly on the client for immediate feedback;
// the backend re-validates everything (never trust the client).

const GSTIN_CODES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidPhone(phone) {
  // Indian mobile numbers: 10 digits, starts 6-9
  return /^[6-9]\d{9}$/.test(phone);
}

export function isValidEmail(email) {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPincode(pincode) {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

// Step 1: shape check (2-digit state code, PAN, entity code, "Z", checksum)
export function isValidGSTINFormat(gstin) {
  return GSTIN_FORMAT.test(gstin);
}

// Step 2: the real GSTIN checksum (mod-36), same algorithm the GST portal
// uses. Catches typos that a regex alone would let through — this is the
// difference between "looks like a GSTIN" and "is structurally valid".
export function isValidGSTINChecksum(gstin) {
  if (gstin.length !== 15) return false;
  const chars = gstin.split("");
  const checkChar = chars.pop();
  let factor = 2;
  let sum = 0;
  const mod = GSTIN_CODES.length;

  for (let i = chars.length - 1; i >= 0; i--) {
    const codePoint = GSTIN_CODES.indexOf(chars[i]);
    if (codePoint === -1) return false;
    let digit = factor * codePoint;
    digit = Math.floor(digit / mod) + (digit % mod);
    sum += digit;
    factor = factor === 2 ? 1 : 2;
  }

  const checkCodePoint = (mod - (sum % mod)) % mod;
  return GSTIN_CODES[checkCodePoint] === checkChar;
}

// Convenience wrapper used by the UI — returns a reason string so the
// input can show a specific, actionable error instead of a generic one.
export function validateGSTIN(rawValue) {
  const gstin = (rawValue || "").trim().toUpperCase();
  if (!gstin) return { valid: false, reason: null }; // empty, no error shown yet
  if (gstin.length < 15) return { valid: false, reason: "incomplete" };
  if (!isValidGSTINFormat(gstin)) return { valid: false, reason: "format" };
  if (!isValidGSTINChecksum(gstin)) return { valid: false, reason: "checksum" };
  return { valid: true, reason: null, stateCode: gstin.slice(0, 2), pan: gstin.slice(2, 12) };
}

export function formatPhoneForDisplay(phone) {
  if (!phone || phone.length !== 10) return phone;
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

export function identifierType(value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (/^[6-9]\d{9}$/.test(v.replace(/\D/g, "")) && !v.includes("@")) return "phone";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  return null;
}

export function isValidIdentifier(value) {
  return identifierType(value) !== null;
}