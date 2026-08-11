// src/components/SellThisItemModal.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Plus, Clock, Lock, X, Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchSellerAccessStatus, createSellerListingForBrand, uploadSellerFile } from "../utils/api";
import { C, EASE } from "./catalog/tokens";

const UNITS = ["Pieces", "Kg", "Grams", "Litres", "Millilitres", "Meters", "Boxes", "Dozen", "Tons", "Pack", "Bundle", "Set", "Units"];

function TextField({ label, value, onChange, placeholder, inputMode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
            <input
                value={value}
                inputMode={inputMode}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border-2 px-3.5 py-2.5 text-[14px] font-semibold focus:outline-none focus:ring-4"
                style={{ borderColor: C.hairSoft, color: C.ink, "--tw-ring-color": `${C.secondary}20` }}
            />
        </div>
    );
}

export default function SellThisItemModal({ brand, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(undefined);
    const [form, setForm] = useState({ price: "", moq: "", unit: "", leadTime: "", image: brand?.image || "" });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) { if (!cancelled) setAccess({ canPublish: false, reason: "NOT_AUTHENTICATED" }); return; }
            const res = await fetchSellerAccessStatus(token);
            if (!cancelled) setAccess(res?.success ? res : { canPublish: false, reason: "NOT_AUTHENTICATED" });
        })();
        return () => { cancelled = true; };
    }, [token]);

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const handleImageFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        setError(null);
        try {
            const res = await uploadSellerFile(token, file, "listings");
            if (!res?.success) throw new Error("Image upload failed.");
            setField("image", res.url);
        } catch (err) {
            setError(err.message || "Image upload failed.");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    const handleSubmit = async () => {
        const missing = [];
        if (!(Number(form.price) > 0)) missing.push("Price");
        if (!(Number(form.moq) > 0)) missing.push("MOQ");
        if (!form.unit) missing.push("Unit");
        if (!form.leadTime.trim()) missing.push("Lead time");
        if (missing.length) return setError(`Please fill: ${missing.join(", ")}`);

        setSubmitting(true);
        setError(null);
        try {
            const res = await createSellerListingForBrand(token, {
                genericProductBrandId: brand.id,
                price: form.price,
                moq: form.moq,
                unit: form.unit,
                leadTime: form.leadTime,
                image: form.image || undefined,
            });
            if (!res?.success) {
                if (["NOT_AUTHENTICATED", "SELLER_NOT_ONBOARDED", "SELLER_NOT_APPROVED"].includes(res?.code)) {
                    setAccess({ canPublish: false, reason: res.code, sellerStatus: res.sellerStatus });
                    return;
                }
                return setError(res?.message || "Couldn't submit. Please check the required fields.");
            }
            setDone(res);
        } finally {
            setSubmitting(false);
        }
    };

    const gateContent = {
        NOT_AUTHENTICATED: { icon: Lock, title: "Sign in to sell this", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        SELLER_NOT_ONBOARDED: { icon: Package, title: "Set up your seller shop first", body: "Listing a product requires an approved seller shop. It only takes a few minutes.", cta: "Set up my shop", action: () => navigate("/seller/onboarding") },
        SELLER_NOT_APPROVED: {
            icon: Clock,
            title: access?.sellerStatus === "pending_review" ? "Your shop is under review" : "Your shop isn't approved yet",
            body: access?.sellerStatus === "pending_review" ? "We're verifying your details. You'll be able to list products once your shop is approved." : "Please check your shop status or contact support.",
            cta: "Check my shop status",
            action: () => navigate("/seller/status"),
        },
    }[access?.reason] || { icon: Lock, title: "Can't list right now", body: "Please try again in a moment.", cta: "Close", action: onClose };

    return (
        <motion.div
            className="fixed inset-0 z-[99] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 sm:rounded-[24px] sm:p-6"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
            >
                {done ? (
                    <div className="flex flex-col items-center py-6 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <CheckCircle2 className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>Submitted for review</h2>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{done.message || "We'll notify you once it's approved."}</p>
                        <button onClick={onClose} className="mt-6 rounded-xl border px-5 py-2.5 text-[13px] font-bold" style={{ borderColor: C.hair, color: C.ink }}>Done</button>
                    </div>
                ) : access === undefined ? (
                    <div className="flex items-center justify-center py-14">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
                    </div>
                ) : !access.canPublish ? (
                    <div className="flex flex-col items-center py-4 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <gateContent.icon className="h-6 w-6" />
                        </span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>{gateContent.title}</h2>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}>
                            {gateContent.cta}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>I want to sell this</p>
                                <h2 className="mt-0.5 truncate text-[17px] font-extrabold" style={{ color: C.ink }}>{brand?.name}</h2>
                            </div>
                            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]">
                                <X className="h-4 w-4" style={{ color: C.muted }} />
                            </button>
                        </div>

                        <p className="mt-3 text-[12.5px] font-medium" style={{ color: C.muted }}>
                            Just add your price and terms — the product listing itself is already approved.
                        </p>

                        <div className="mt-5 flex flex-col gap-4">
                            <TextField label="Price (₹)" value={form.price} onChange={(v) => setField("price", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 450" />
                            <TextField label="MOQ (minimum order quantity)" value={form.moq} onChange={(v) => setField("moq", v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 100" />
                            <div className="flex flex-col gap-1">
                                <label className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Unit</label>
                                <select
                                    value={form.unit}
                                    onChange={(e) => setField("unit", e.target.value)}
                                    className="w-full rounded-lg border-2 px-3.5 py-2.5 text-[14px] font-semibold focus:outline-none focus:ring-4"
                                    style={{ borderColor: C.hairSoft, color: C.ink }}
                                >
                                    <option value="" disabled>Select unit…</option>
                                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <TextField label="Lead time" value={form.leadTime} onChange={(v) => setField("leadTime", v)} placeholder="e.g. 7–10 days" />
                        </div>

                        {error && <p className="mt-4 text-[12px] font-semibold" style={{ color: "#c71f11" }}>{error}</p>}

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-[13.5px] font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit for review <IndianRupee className="h-4 w-4" /></>}
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}