// components/orders/TransportInfoCard.jsx — NEW
//
// Renders whatever transport info exists on an order — used on both
// OrderDetailPage.jsx (buyer) and SellerOrderDetailPage.jsx (seller).
// Handles three states:
//   1. Nothing yet, buyer had no preference  -> renders nothing
//   2. Buyer requested a method, not yet confirmed -> shows the request
//   3. Seller has confirmed -> shows the confirmed method + details
import { Truck, Clock3, FileText } from "lucide-react";
import { getTransportOption, transportLabel } from "../../shared/transportOptions.js";

const C = { ink: "#0B1116", muted: "#667077", secondary: "#006F83", hair: "rgba(11,17,22,0.09)", warn: "#a16207", warnBg: "#FDF3D8" };

export default function TransportInfoCard({ order }) {
    const { buyer_transport_mode: buyerMode, transport_mode: confirmedMode, transport_fields: fields, transport_notes: notes, transport_proof_url: proofUrl, transport_confirmed_at: confirmedAt } = order || {};

    if (!buyerMode && !confirmedMode) return null;

    if (!confirmedMode) {
        return (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: C.hair }}>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "#4A535B" }}>Transport</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.warnBg }}>
                    <Clock3 className="h-3.5 w-3.5 shrink-0" style={{ color: C.warn }} />
                    <p className="text-[12.5px] font-semibold" style={{ color: C.warn }}>
                        Requested: <b>{transportLabel(buyerMode)}</b> — awaiting seller confirmation.
                    </p>
                </div>
            </div>
        );
    }

    const schema = getTransportOption(confirmedMode);
    const isImage = proofUrl && /\.(png|jpe?g|webp|gif)$/i.test(proofUrl);

    return (
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: C.hair }}>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "#4A535B" }}>Transport</p>

            <p className="mt-2.5 flex items-center gap-1.5 text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>
                <Truck className="h-4 w-4" style={{ color: C.secondary }} /> {transportLabel(confirmedMode)}
            </p>

            {schema && fields && (
                <div className="mt-2 flex flex-col gap-1">
                    {schema.fields.filter((f) => fields[f.key]).map((f) => (
                        <div key={f.key} className="flex items-start justify-between gap-3 text-[12.5px]">
                            <span className="font-semibold" style={{ color: C.muted }}>{f.label}</span>
                            <span className="text-right font-bold" style={{ color: C.ink }}>{fields[f.key]}</span>
                        </div>
                    ))}
                </div>
            )}

            {notes && <p className="mt-2 text-[12px] font-medium italic leading-relaxed" style={{ color: C.muted }}>"{notes}"</p>}

            {proofUrl && (
                <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: C.secondary }}>
                    <FileText className="h-3.5 w-3.5" /> {isImage ? "View proof image" : "View proof file"}
                </a>
            )}

            {buyerMode && (
                <p className="mt-2.5 text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                    Buyer requested this method{confirmedAt ? ` · confirmed ${new Date(confirmedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}.
                </p>
            )}
        </div>
    );
}
