// AdPlacementPreview.jsx — shows the seller WHERE an ad lands on the Home page and what it will look like.
//   placementLabel(p)     one clear name + one clear "how many" line per placement
//   <PlacementMap>        small page wireframe with the placement highlighted
//   <AdPlacementPreview>  phone-style Home page: your real creative, wireframe placeholders around it
//
// The five placements and how each one is drawn:
//   Banner  home_hero   ROTATING CAROUSEL, up to 3 advertisers, one banner visible at a time (dots + "Ad 1 of 3")
//   Banner  home_duo    2 banners per row  (yours + a dashed "Another advertiser" slot)
//   Banner  home_strip  3 banners per row  (yours + two dashed slots)
//   Product "Deal of the Day"   N PAID SEATS (N = the placement's lanes, e.g. 6). Top shelf on Home. Every paid card is
//                               highlighted (orange border + "Deal of the Day" badge). All N seats are drawn: yours + N-1 others.
//   Product "Sponsored product" UNLIMITED: any number of sellers, so no seat count is shown anywhere. Sponsored cards lead the Featured picks shelf, highest
//                               bid (extra rupees per hour) first. `rank` (from the quote) places your card among the others.
// Banners are rendered by the real Home component (AdBannerBlock in preview mode); product cards mirror HomeShelves.
// Placeholders are wireframe lines and crossed boxes, never skeleton blobs: nothing here looks like it is loading.
import { Package, Flame } from "lucide-react";
import AdBannerBlock, { PER_ROW } from "../../home/AdBannerBlock.jsx";
import { SHAPE_BY_KEY } from "../../home/bannerShapes.js";
import { resizedImageUrl } from "../../../utils/imageUrl";
import "./ad-preview.css";

export const lanesOf = (p) => Math.max(1, Number(p?.lanes) || 1);

// "deal" = limited paid seats in the top shelf. "featured" = open, bid-ordered sponsored cards.
export function productMode(p) {
    if (p?.kind !== "product") return null;
    const id = `${p.key || ""} ${p.name || ""}`.toLowerCase();
    return id.includes("deal") ? "deal" : "featured";
}

const hiOf = (p) => {
    if (p?.key === "home_hero") return "hero";
    if (p?.key === "home_duo") return "duo";
    if (p?.key === "home_strip") return "strip";
    const m = productMode(p);
    if (m === "deal") return "deal";
    if (m === "featured") return "shelf";
    return "hero";
};

export function placementLabel(p) {
    const hi = hiOf(p);
    const n = lanesOf(p);
    if (hi === "hero") return { kind: "Banner", name: "Home hero banner", count: `Rotating carousel: up to ${Math.max(n, 3)} advertisers, 1 banner shown at a time`, exclusive: false };
    if (hi === "duo") return { kind: "Banner", name: "Home spotlight pair", count: "2 banners per row", exclusive: false };
    if (hi === "strip") return { kind: "Banner", name: "Home square tiles", count: "3 banners per row", exclusive: false };
    if (hi === "deal") return { kind: "Product", name: p?.name || "Deal of the Day", count: `${n} paid seat${n > 1 ? "s" : ""} in the top shelf`, exclusive: false };
    return { kind: "Product", name: p?.name || "Sponsored product", count: p?.biddable ? "Open to all sellers · highest bid shown first" : "Open to all sellers", exclusive: false };
}

export function placementPosition(p) {
    const hi = hiOf(p);
    const n = lanesOf(p);
    if (hi === "hero") return { title: "Top of the Home page", where: `The first thing every buyer sees, above all products. Up to ${Math.max(n, 3)} advertisers rotate here automatically; buyers see one banner at a time.` };
    if (hi === "duo") return { title: "Spotlight, after the first products", where: "Two banners sit side by side in one row, after buyers scroll past the first few rows of products. You get one of the two." };
    if (hi === "strip") return { title: "Square tiles, further down", where: "Three square banners sit side by side in one row, after the second batch of products. You get one of the three." };
    if (hi === "deal") return { title: "Deal of the Day, the top shelf on Home", where: `The shelf placed where most buyers look. There are ${n} paid seat${n > 1 ? "s" : ""}: every paid card gets an orange border and a “Deal of the Day” badge, and organic deals fill the rest of the shelf.` };
    return { title: "Featured picks shelf", where: `Any number of sellers can book this. Sponsored cards lead the shelf with a “Sponsored” label, then organic picks follow.${p?.biddable ? " Cards are ordered by bid: the seller who pays the most extra per hour is shown first." : ""}` };
}

/* ---------------- wireframe map ---------------- */
const MAP = [
    { k: "head", h: 9 }, { k: "hero", h: 28, t: "Hero carousel" }, { k: "deal", h: 22, t: "Deal of the Day" }, { k: "shelf", h: 18, t: "Featured picks" },
    { k: "rows", h: 22 }, { k: "duo", h: 22, t: "Spotlight pair" }, { k: "rows", h: 18 }, { k: "strip", h: 14, t: "Square tiles" },
];

export function PlacementMap({ placement, small = false }) {
    const hi = hiOf(placement);
    const shared = !placementLabel(placement).exclusive;
    return (
        <div className={`pv-map${small ? " small" : ""}`} role="img" aria-label={`Wireframe of the Home page. Your ad: ${placementPosition(placement).title}`}>
            {MAP.map((b, i) => {
                const on = b.k === hi;
                return (
                    <div key={i} className={`pv-map-b ${b.k}${on ? " on" : ""}`} style={{ height: b.h }}>
                        {b.k === "rows" ? <><i /><i /><i /></> : on ? <span>Your ad{shared ? " (shared)" : ""}</span> : b.t ? <em>{b.t}</em> : null}
                    </div>
                );
            })}
        </div>
    );
}

/* ---------------- wireframe placeholders (lines and crossed boxes, no skeleton blobs) ---------------- */
const Ln = ({ w = "100%", style }) => <span className="pv-ln" style={{ width: w, ...style }} />;
const Ph = ({ w = "100%", h, ratio, r = 8, style }) => <span className="pv-ph" style={{ width: w, height: h, aspectRatio: ratio, borderRadius: r, ...style }} />;
const Pill = ({ w = "100%", h = 22 }) => <span className="pv-pill" style={{ width: w, height: h, borderRadius: h / 2 }} />;

function Rows({ n = 2 }) {
    return (
        <div className="pv-grid">
            {Array.from({ length: n * 2 }).map((_, i) => (
                <div key={i} className="pv-gcard"><Ph ratio="1" r={10} /><Ln w="80%" /><Ln w="40%" /></div>
            ))}
        </div>
    );
}

// An ordinary (organic) product card, drawn as a wireframe.
const DummyCard = () => <div className="pv-card dummy" aria-hidden="true"><Ph ratio="1" /><Ln w="80%" /><Ln w="55%" /><Ln w="35%" /></div>;

function ShelfDummy({ title, count = 3 }) {
    return (
        <div className="pv-shelf">
            <p className="pv-shelf-h">{title}</p>
            <div className="pv-cards">{Array.from({ length: count }).map((_, i) => <DummyCard key={i} />)}</div>
        </div>
    );
}

function Gap({ text }) {
    return <div className="pv-gap"><i /><span>{text}</span><i /></div>;
}

function Slot({ label, children }) {
    return <div className="pv-slot"><span className="pv-slot-tag">{label}</span>{children}</div>;
}

function BannerEmpty({ placement }) {
    const key = placement.aspectKeys?.[0];
    const ratio = Math.min(SHAPE_BY_KEY[key]?.ratio || 16 / 9, 2);
    const cells = PER_ROW[placement.key] || 1;
    const isHero = placement.key === "home_hero";
    const dots = Math.max(lanesOf(placement), 3);
    return (
        <>
            <div className="pv-empty-row">
                <div className="pv-empty" style={{ aspectRatio: String(ratio) }}><span>{cells > 1 ? "Your banner" : "Upload your banner and it appears here"}</span></div>
                {Array.from({ length: cells - 1 }).map((_, i) => <div key={i} className="pv-empty ghost" style={{ aspectRatio: String(ratio) }}><span>Another advertiser</span></div>)}
            </div>
            {isHero && (
                <>
                    <div className="pv-dots" aria-hidden="true">{Array.from({ length: dots }).map((_, i) => <i key={i} className={i === 0 ? "on" : ""} />)}</div>
                    <p className="pv-dots-note">Ad 1 of {dots} · rotates automatically</p>
                </>
            )}
        </>
    );
}

function priceOf(picked) {
    const basis = Number(picked.masterPackSize) >= 1 ? "master pack" : "pack";
    return Number(picked.price) > 0 ? <>₹{Number(picked.price).toLocaleString("en-IN")}<small> / {basis} incl. GST</small></> : null;
}

/* The seller's own product card. Same size in both shelves; the Deal of the Day one is highlighted (mirrors HomeShelves). */
function ProductCard({ picked, deal = false }) {
    if (!picked) return <div className="pv-card empty"><Package size={20} aria-hidden="true" /><span>Pick a product to see your card</span></div>;
    const price = priceOf(picked);
    return (
        <div className={`pv-card real${deal ? " deal" : ""}`}>
            <div className="pv-card-img">
                {picked.image ? <img src={resizedImageUrl(picked.image, { width: 300 })} alt="" referrerPolicy="no-referrer" /> : <Package size={22} aria-hidden="true" />}
                {deal
                    ? <b className="deal"><Flame size={9} aria-hidden="true" /> Deal of the Day</b>
                    : <b>Sponsored</b>}
            </div>
            <p className="pv-card-n">{picked.name}</p>
            {picked.brandName ? <p className="pv-card-b">{picked.brandName}</p> : null}
            {deal ? <p className="pv-card-s">Sponsored</p> : null}
            {price ? <p className="pv-card-p">{price}</p> : null}
        </div>
    );
}

function GhostCard({ deal = false, label = "Another seller" }) {
    return <div className={`pv-card ghostc${deal ? " deal" : ""}`} aria-hidden="true"><span>{label}</span></div>;
}

export default function AdPlacementPreview({ placement, creative, shopName, picked, rank = null }) {
    if (!placement) return null;
    const pos = placementPosition(placement);
    const lab = placementLabel(placement);
    const hi = hiOf(placement);
    const lanes = lanesOf(placement);
    const c = creative || {};
    const has = (placement.aspectKeys || []).some((k) => c.images?.[k]);
    const ad = {
        booking_id: "preview",
        shop_name: shopName || "Your shop",
        creative: { images: c.images || {}, alt: c.alt || "", link: { type: c.linkType === "product" ? "brand_item" : "shop" } },
    };
    const perRow = PER_ROW[placement.key] || 1;
    const yourBanner = has
        ? <AdBannerBlock placement={placement.key} ads={[ad]} preview compact priority lanes={Math.max(lanes, 3)} ghosts={Math.max(0, perRow - 1)} />
        : <BannerEmpty placement={placement} />;
    // deal: ALL the paid seats are drawn (yours + the others). featured: open shelf, so a few others stand for "any number".
    const seats = Math.min(lanes, 12); // drawn seats (a very large lane count would not fit a phone)
    const openGhosts = 3;
    const myPos = Math.min(Math.max(Number(rank) || 1, 1), openGhosts + 1); // 1 = first card
    const before = myPos - 1;
    const after = openGhosts - before;

    return (
        <figure className="pv-wrap">
            <figcaption className="pv-cap">
                <b>Live preview · {lab.kind}: {lab.name}</b>
                <span>{pos.title}</span>
                <em className={`pv-share${lab.exclusive ? "" : " on"}`}>{lab.count}</em>
            </figcaption>
            <div className="pv-phone" aria-label="Preview of the BBM Home page on a phone">
                <div className="pv-screen">
                    <div className="pv-top"><Ln w="100%" style={{ height: 6 }} /><Pill h={26} /></div>
                    <div className="pv-chips">{[0, 1, 2, 3, 4].map((i) => <Pill key={i} w={52} />)}</div>

                    {hi === "hero" && <Slot label="Your ad · top of page · rotating carousel">{yourBanner}</Slot>}
                    {hi !== "hero" && <Ph h={84} r={14} />}

                    {hi === "deal" && (
                        <Slot label={`Your ad · Deal of the Day · ${lanes} paid seat${lanes > 1 ? "s" : ""}`}>
                            <div className="pv-dealband">
                                <p className="pv-shelf-h"><Flame size={13} aria-hidden="true" /> Deal of the Day</p>
                                <div className="pv-cards scroll">
                                    <ProductCard picked={picked} deal />
                                    {Array.from({ length: seats - 1 }).map((_, i) => <GhostCard key={i} deal label={`Seat ${i + 2}`} />)}
                                    {[0, 1].map((i) => <DummyCard key={`d${i}`} />)}
                                </div>
                                <div className="pv-seats" role="img" aria-label={`${lanes} paid seats, one of them yours`}>
                                    {Array.from({ length: seats }).map((_, i) => <span key={i} className={i === 0 ? "you" : ""}>{i === 0 ? "You" : i + 1}</span>)}
                                </div>
                            </div>
                            <p className="pv-row-note">{lanes} paid seat{lanes > 1 ? "s" : ""} on this shelf. Yours is one of them and the other seats go to other sellers. Organic deals fill the rest of the shelf.</p>
                        </Slot>
                    )}
                    {hi === "shelf" && (
                        <>
                            <ShelfDummy title="Deal of the Day" />
                            <Slot label="Your ad · Featured picks · open to all sellers">
                                <p className="pv-shelf-h">Featured picks</p>
                                <div className="pv-cards">
                                    {Array.from({ length: before }).map((_, i) => <GhostCard key={`b${i}`} />)}
                                    <ProductCard picked={picked} />
                                    {Array.from({ length: after }).map((_, i) => <GhostCard key={`a${i}`} />)}
                                </div>
                                <p className="pv-row-note">
                                    {placement.biddable
                                        ? (rank ? `At your bid you are #${rank}. Highest bid is first, and any number of sellers can join.` : "Highest bid is shown first; raise your bid to move left. Any number of sellers can join.")
                                        : "Any number of sellers can join; organic picks follow the sponsored cards."}
                                </p>
                            </Slot>
                        </>
                    )}

                    {hi === "hero" && <ShelfDummy title="Deal of the Day" />}
                    {hi === "deal" && <ShelfDummy title="Featured picks" />}

                    {hi === "duo" && <><Gap text="first few product rows" /><Rows n={1} /></>}
                    {hi === "strip" && <><Gap text="first two batches of products" /><Rows n={1} /></>}
                    {hi === "duo" && <Slot label="Your ad · spotlight pair · 2 per row">{yourBanner}</Slot>}
                    {hi === "strip" && <Slot label="Your ad · square tiles · 3 per row">{yourBanner}</Slot>}

                    <Rows n={hi === "shelf" || hi === "deal" ? 2 : 1} />
                </div>
                <i className="pv-fade" aria-hidden="true" />
            </div>
            <p className="pv-note">Phone view. Dashed slots are other advertisers; yours is never stretched to fill the spot. Lines and crossed boxes are placeholder products; buyers see the live catalogue.</p>
        </figure>
    );
}