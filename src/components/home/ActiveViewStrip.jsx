// components/home/ActiveViewStrip.jsx
//
// Compact "you are viewing X" strip for the feed's sticky block.
//
//   [logo] [BRAND · 128 products / Name (truncates)  ›]   [share] | [x]
//
// - The left block is a Link to `changeTo` (tap to pick another brand/seller).
// - `image` + `imageLoading`: while the logo URL is still being resolved a
//   shimmer is shown (never the fallback icon), so there is no icon→logo swap.
//   The fallback icon only appears when there is truly no logo (or it fails).
// - The <img> fades in over the shimmer once decoded.
// - `shareUrl`: native share sheet (navigator.share), copy fallback.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Store, Tag, X, Share2, Check, ChevronRight } from "lucide-react";
import { resizedImageUrl } from "../../utils/imageUrl";

const INK = "#0B1116";
const MUTED = "#667077";
const EASE = [0.16, 1, 0.3, 1];

const VARIANTS = {
    brand: { accent: "#D8420F", Icon: Tag },
    seller: { accent: "#0F63B5", Icon: Store },
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* fall through */ }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

async function shareLink({ url, title, text }) {
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return "shared";
        } catch (e) {
            if (e?.name === "AbortError") return "cancelled";
        }
    }
    return (await copyText(url)) ? "copied" : "failed";
}

// Logo tile. Same width (240) as the Brands page so the browser cache is reused.
function LogoTile({ accent, Icon, image, loading, onOpen }) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => { setFailed(false); setLoaded(false); }, [image]);

    useEffect(() => {
        const el = imgRef.current;
        if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
    }, [image]);

    const box = "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg";

    if (loading) {
        return (
            <span aria-hidden className={`${box} animate-pulse motion-reduce:animate-none`}
                style={{ background: `color-mix(in srgb, ${accent} 12%, #fff)` }} />
        );
    }

    if (image && !failed) {
        const Wrapper = onOpen ? "button" : "span";
        const interactive = onOpen
            ? { type: "button", onClick: onOpen, "aria-label": "View logo full screen", title: "View logo" }
            : { "aria-hidden": true };
        return (
            <Wrapper
                {...interactive}
                className={`${box} relative border bg-white p-0.5 ${onOpen ? `cursor-zoom-in transition active:scale-95 ${FOCUS}` : ""}`}
                style={{ borderColor: `color-mix(in srgb, ${accent} 22%, #fff)`, "--tw-ring-color": accent }}
            >
                {!loaded && (
                    <span className="absolute inset-0 animate-pulse motion-reduce:animate-none"
                        style={{ background: `color-mix(in srgb, ${accent} 8%, #fff)` }} />
                )}
                <img
                    ref={imgRef}
                    src={resizedImageUrl(image, { width: 240 })}
                    alt=""
                    referrerPolicy="no-referrer"
                    decoding="async"
                    fetchpriority="high"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={`relative h-full w-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
                />
            </Wrapper>
        );
    }

    return (
        <span aria-hidden className={`${box} text-white`}
            style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))` }}>
            <Icon className="h-4 w-4" strokeWidth={2.3} />
        </span>
    );
}

export default function ActiveViewStrip({
    variant = "brand",   // "brand" | "seller"
    label,               // "Brand", "Seller", "Your shop"
    name,
    meta = null,         // e.g. "128 products"
    image = null,
    imageLoading = false,
    onImageOpen,
    shareUrl = null,
    shareTitle,
    shareText,
    onShared,            // (result) => void
    changeTo,            // route to pick another one (left block becomes a link)
    onClear,
    clearLabel = "Clear",
}) {
    const reduce = useReducedMotion();
    const { accent, Icon } = VARIANTS[variant] || VARIANTS.brand;

    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef(null);
    useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

    const handleShare = async () => {
        if (!shareUrl) return;
        const result = await shareLink({ url: shareUrl, title: shareTitle || name, text: shareText });
        onShared?.(result);
        if (result === "copied") {
            setCopied(true);
            clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setCopied(false), 1600);
        }
    };

    const identity = (
        <div className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-1 truncate text-[9.5px] font-extrabold uppercase leading-none tracking-[0.12em]" style={{ color: accent }}>
                <span>{label}</span>
                {/* {meta && (
                    <>
                        <span aria-hidden style={{ color: MUTED }}>·</span>
                        <span className="truncate normal-case tracking-wide" style={{ color: MUTED }}>{meta}</span>
                    </>
                )} */}
            </p>
            <p className="mt-0.5 flex items-center gap-0.5 leading-tight">
                <span className="truncate text-[14px] font-extrabold capitalize tracking-wide" style={{ color: INK }}>{name}</span>
                {changeTo && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" style={{ color: accent }} strokeWidth={2.6} />}
            </p>
        </div>
    );

    const iconBtn = `flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-95 hover:bg-black/[0.06] ${FOCUS}`;

    return (
        <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="my-1 flex items-center gap-1 rounded-xl border py-1 pl-1.5 pr-1"
            style={{
                background: `color-mix(in srgb, ${accent} 6%, #fff)`,
                borderColor: `color-mix(in srgb, ${accent} 22%, #fff)`,
            }}
        >
            <LogoTile accent={accent} Icon={Icon} image={image} loading={imageLoading} onOpen={onImageOpen} />

            {changeTo ? (
                <Link
                    to={changeTo}
                    aria-label={`Change ${label.toLowerCase()}: currently ${name}`}
                    className={`flex min-w-0 flex-1 items-center rounded-lg py-0.5 pl-1 ${FOCUS}`}
                    style={{ "--tw-ring-color": accent }}
                >
                    {identity}
                </Link>
            ) : (
                <div className="flex min-w-0 flex-1 items-center py-0.5 pl-1">{identity}</div>
            )}

            {shareUrl && (
                <button
                    type="button"
                    onClick={handleShare}
                    aria-label={copied ? "Link copied" : `Share ${name}`}
                    title={copied ? "Link copied" : "Share"}
                    className={iconBtn}
                    style={{ "--tw-ring-color": accent }}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={copied ? "check" : "share"}
                            initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={reduce ? undefined : { scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="flex"
                        >
                            {copied
                                ? <Check className="h-4 w-4" style={{ color: "#12794A" }} strokeWidth={2.8} />
                                : <Share2 className="h-4 w-4" style={{ color: accent }} strokeWidth={2.4} />}
                        </motion.span>
                    </AnimatePresence>
                </button>
            )}

            <span aria-hidden className="h-4 w-px shrink-0" style={{ background: `color-mix(in srgb, ${accent} 25%, #fff)` }} />

            <button type="button" onClick={onClear} aria-label={clearLabel} className={iconBtn} style={{ "--tw-ring-color": accent }}>
                <X className="h-4 w-4" style={{ color: accent }} strokeWidth={2.5} />
            </button>
        </motion.div>
    );
}