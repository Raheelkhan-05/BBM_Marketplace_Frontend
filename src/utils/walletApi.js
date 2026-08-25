// utils/walletApi.js — drop updateWalletSettings, everything else unchanged
import { apiGet, apiPost } from "./api.js";

export async function fetchWalletStatus(token) { return apiGet("/seller/wallet", token); }
export async function fetchWalletTransactions(token) { return apiGet("/seller/wallet/transactions", token); }
export async function submitWalletPayment(token, { amount, utr, screenshotUrl }) {
    return apiPost("/seller/wallet/payments", token, { amount, utr, screenshotUrl });
}
export async function fetchWalletPayments(token) { return apiGet("/seller/wallet/payments", token); }