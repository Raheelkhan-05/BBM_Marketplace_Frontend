// src/components/orders/DeliveryAddressCard.jsx
//
// "Delivery address" card for the order detail pages (buyer: SaveOrderDetailPage, seller: GrowOrderDetailPage).
//   - Address: ALWAYS read from the order's own saved copy (orders.shipping_address_snapshot), i.e. the address as it
//     was when THIS order was placed. Editing or deleting an address later never changes an existing order.
//   - Transport: shows what the buyer and seller have agreed (or are discussing) for this order, taken from the
//     OrderTransportPanel data passed in as `transport`. An agreement reused from an earlier order says so.
//     A new agreement only ever applies to the current open order and to future orders, never to past ones.
// variant="save" -> Save UI classes (sh-card / sh-ctl), variant="grow" -> Grow UI classes (card / ctl).
import { MapPin, Phone, Truck, Check, Clock } from "lucide-react";
import { routeOptionSummary, routeTransportModeLabel } from "../../../shared/routeTransportFields.js";
import { toTitleCase } from "../growSeller/sellerHelpers.js";
import "./delivery-address.css";

const text = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const pick = (o, keys) => { for (const k of keys) { const v = text(o?.[k]); if (v) return v; } return ""; };

// Works with whatever keys the saved address uses (the order only stores a copy of the buyer's address).
export function addressParts(snapshot, order) {
    const a = snapshot && typeof snapshot === "object" ? snapshot : {};
    const street = [
        pick(a, ["address_line1", "address_line_1", "line1", "address1", "address", "street"]),
        pick(a, ["address_line2", "address_line_2", "line2", "address2", "landmark", "area"]),
    ].filter(Boolean);
    const city = pick(a, ["city", "district"]);
    const state = pick(a, ["state"]);
    return {
        name: pick(a, ["contact_name", "name", "full_name"]) || text(order?.buyer_contact_name),
        phone: pick(a, ["contact_phone", "phone", "mobile"]) || text(order?.buyer_contact_phone),
        label: pick(a, ["label", "address_label", "title"]),
        street,
        cityLine: [toTitleCase(city), toTitleCase(state)].filter(Boolean).join(", "),
        pincode: pick(a, ["pincode", "pin_code", "postal_code", "zip"]),
    };
}

function TransportLine({ order, transport, viewer }) {
    const isBuyer = viewer === "buyer";
    const other = isBuyer ? (transport?.sellerName || "the seller") : "the buyer";
    const route = transport?.route;
    const routeText = route?.originCity && route?.destCity ? `${toTitleCase(route.originCity)} → ${toTitleCase(route.destCity)}` : "this route";

    // 1) Agreed (from the panel data, or straight from the order if the panel hasn't loaded / isn't shown)
    const agreed = transport?.agreed || (order?.transport_mode
        ? { mode: order.transport_mode, fields: order.transport_fields || {}, summary: routeOptionSummary(order.transport_mode, order.transport_fields || {}) }
        : null);
    if (agreed) {
        const label = routeTransportModeLabel(agreed.mode);
        const saved = transport?.agreedVia === "saved";
        return (
            <div className="da-tr ok">
                <p className="da-k"><Check size={13} strokeWidth={3} />Agreed transport</p>
                <p className="da-v">{agreed.summary}{agreed.summary !== label && <small> · {label}</small>}</p>
                <p className="da-n">
                    {saved
                        ? `Already agreed by you and ${other} for ${routeText}, so it was applied to this order automatically.`
                        : `Agreed by you and ${other} for this order. It will be used automatically for future orders on ${routeText}.`}
                </p>
            </div>
        );
    }

    // 2) A suggestion is waiting for a reply
    const active = transport?.active;
    if (active) {
        const mine = active.proposed_by_role === viewer;
        return (
            <div className="da-tr wait">
                <p className="da-k"><Clock size={13} />{mine ? `Waiting for ${other} to reply` : `${isBuyer ? "The seller" : "The buyer"} suggested`}</p>
                <p className="da-v">{routeOptionSummary(active.mode, active.fields || {})}</p>
                {!mine && <p className="da-n">Reply in the Delivery transport card on this page.</p>}
            </div>
        );
    }

    // 3) Nothing agreed yet (only meaningful once the panel has loaded and the order is still open)
    if (transport?.phase === "open") {
        return (
            <div className="da-tr">
                <p className="da-k"><Truck size={13} />Transport</p>
                <p className="da-n">No transport agreed yet. This is optional, and once agreed it is remembered for future orders on {routeText}.</p>
            </div>
        );
    }
    return null;
}

export default function DeliveryAddressCard({ order, viewer, transport = null, variant = "save" }) {
    if (!order) return null;
    const p = addressParts(order.shipping_address_snapshot, order);
    const hasAddress = p.name || p.street.length || p.cityLine || p.pincode;
    const cls = variant === "grow" ? { card: "card", title: "ctl" } : { card: "sh-card", title: "sh-ctl" };

    return (
        <section className={`${cls.card} da`}>
            <div className={cls.title}>Delivery address</div>
            {hasAddress ? (
                <address className="da-ad">
                    <span className="da-pin"><MapPin size={16} /></span>
                    <div>
                        {p.name && <b>{p.name}</b>}
                        {p.label && <span className="da-lb">{p.label}</span>}
                        {p.street.map((l, i) => <p key={i}>{l}</p>)}
                        {(p.cityLine || p.pincode) && <p>{[p.cityLine, p.pincode].filter(Boolean).join(" - ")}</p>}
                        {p.phone && <p className="da-ph"><Phone size={12} />{p.phone}</p>}
                    </div>
                </address>
            ) : (
                <p className="da-n">No delivery address was saved with this order.</p>
            )}
            <TransportLine order={order} transport={transport} viewer={viewer} />
        </section>
    );
}