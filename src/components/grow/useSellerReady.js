// src/components/grow/useSellerReady.js
// Single place that answers "is this person an already-onboarded seller?".
// Uses exactly the same rule as GrowEntry, so the "Start selling" buttons and the /sell gate never disagree.
//
//   ready        - logged in, finished onboarding and the shop is usable
//   initializing - the profile for a stored session is still loading (guests are never "initializing")
import { useAuth } from "../../context/AuthContext.jsx";
import { isSellerReady } from "../growSeller/growSeller.js";

export default function useSellerReady() {
    const { token, isLoggedIn, profile, needsOnboarding, initializing } = useAuth();
    const ready = !initializing && isLoggedIn && !needsOnboarding && isSellerReady(profile, token);
    return { ready, initializing };
}