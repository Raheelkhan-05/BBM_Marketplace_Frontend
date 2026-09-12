// utils/orderPdf.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { transportLabel } from "../../shared/transportOptions.js";

// ---- design tokens, matching PurchaseOrderDocument.jsx ----
const INK = [11, 17, 22];
const MUTED = [102, 112, 119];
const ACCENT = [11, 114, 133]; // #0B7285
const HAIR = [225, 229, 230];
const PANEL = [250, 251, 251];

// Same rate used in PurchaseOrderDocument.jsx — see the comment there for
// why this is a back-calculated breakup of the existing total rather than
// an added charge.
const GST_PERCENT = 18;

function fmtDate(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function deliveryDateLabel(order) {
    const min = fmtDate(order.estimated_delivery_date);
    if (!min) return "Pending confirmation";
    const max = fmtDate(order.estimated_delivery_date_max);
    if (max && max !== min) return `${min} - ${max}`;
    return min;
}
function inr(n) {
    return (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function gstBreakup(totalInclGst) {
    const taxable = round2(totalInclGst / (1 + GST_PERCENT / 100));
    const gstAmount = round2(totalInclGst - taxable);
    const half = round2(gstAmount / 2);
    return { taxable, cgst: half, sgst: round2(gstAmount - half), igst: gstAmount };
}

// Mirrors the exact same logic OrderDetailPage.jsx already uses to label
// pack / master-pack quantities, so the PDF matches the on-screen bill
// instead of falling back to raw base-unit counts.
function saleUnitLabelFromBasis(basis) {
    if (basis === "per_master_pack") return "Master Pack";
    if (basis === "per_pack") return "Pack";
    return null;
}
function itemQtyText(item) {
    const label = saleUnitLabelFromBasis(item.purchase_basis);
    const saleQty = Number(item.pack_quantity_snapshot) || 0;
    const baseQty = Number(item.quantity) || 0;
    if (label && saleQty > 0) {
        return `${saleQty} ${label}${saleQty === 1 ? "" : "s"} (${baseQty} ${item.unit || ""})`.trim();
    }
    return `${baseQty} ${item.unit || ""}`.trim();
}

function transportText(order) {
    if (order.transport_mode) return transportLabel(order.transport_mode);
    if (order.buyer_transport_mode) return `${transportLabel(order.buyer_transport_mode)} (requested by buyer)`;
    return "To be decided by seller";
}

export async function generateOrderPdf(order, { vendor } = {}) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const addr = order.shipping_address_snapshot || {};
    const items = order.items || [];
    const isSample = order.order_type === "sample";

    const vendorInfo = order.seller || vendor || null;
    const vendorName = vendorInfo?.display_name || "Your Shop";
    const vendorLocation = [vendorInfo?.city, vendorInfo?.state].filter(Boolean).join(", ");

    const sellerState = vendorInfo?.state || null;
    const buyerState = addr.state || null;
    const isIntraState = !!(sellerState && buyerState && sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase());
    const gst = gstBreakup(Number(order.total_amount) || 0);

    // ---- Header band ----
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, pageWidth, 64, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(18);
    doc.text("PURCHASE ORDER", margin, 38);

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.text(`Order No.: ${order.order_number || "-"}`, pageWidth - margin, 26, { align: "right" });
    doc.text(`Date: ${fmtDate(order.created_at) || "-"}`, pageWidth - margin, 40, { align: "right" });
    doc.text(`Delivery: ${deliveryDateLabel(order)}`, pageWidth - margin, 54, { align: "right" });

    // ---- Transport strip ----
    let y = 86;
    doc.setFillColor(...PANEL);
    doc.roundedRect(margin, y - 14, pageWidth - margin * 2, 22, 4, 4, "F");
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    doc.text(`Transport: ${transportText(order)}`, margin + 10, y + 1);

    // ---- Vendor / Deliver-to panels ----
    y += 34;
    const colW = (pageWidth - margin * 2 - 16) / 2;
    doc.setDrawColor(...HAIR);
    doc.roundedRect(margin, y, colW, 78, 4, 4, "S");
    doc.roundedRect(margin + colW + 16, y, colW, 78, 4, 4, "S");

    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text("VENDOR (SELLER)", margin + 10, y + 16);
    doc.text("DELIVER TO", margin + colW + 26, y + 16);

    doc.setTextColor(...INK);
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text(vendorName, margin + 10, y + 32);
    doc.text(addr.contact_name || order.buyer_contact_name || "-", margin + colW + 26, y + 32);
    doc.setFont(undefined, "normal");

    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    if (vendorLocation) doc.text(vendorLocation, margin + 10, y + 46);

    const deliverLines = doc.splitTextToSize(
        `${order.buyer_business_name ? order.buyer_business_name + (order.buyer_gstin ? " · " + order.buyer_gstin : "") + "\n" : ""}${addr.address_line1 || ""}${addr.address_line2 ? ", " + addr.address_line2 : ""}, ${addr.city || ""}, ${addr.state || ""} - ${addr.pincode || ""}`,
        colW - 20
    );
    doc.text(deliverLines, margin + colW + 26, y + 46);

    // ---- Items table ----
    const tableStartY = y + 96;
    autoTable(doc, {
        startY: tableStartY,
        head: [["Sr", "Description of Goods", "Qty", "Rate", "Amount"]],
        body: items.map((it, i) => [
            i + 1,
            `${it.product_name_snapshot || ""}${it.brand_name_snapshot ? " (" + it.brand_name_snapshot + ")" : ""}`,
            itemQtyText(it),
            `Rs. ${inr(it.unit_price)}`,
            `Rs. ${inr(it.line_total)}`,
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 7, textColor: INK, lineColor: HAIR, lineWidth: 0.5 },
        headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [250, 251, 251] },
        columnStyles: {
            0: { cellWidth: 26 },
            2: { cellWidth: 130 },
            3: { halign: "right", cellWidth: 80 },
            4: { halign: "right", cellWidth: 90 },
        },
    });

    // ---- Totals box ----
    const finalY = doc.lastAutoTable.finalY + 20;
    const boxW = 230;
    const boxX = pageWidth - margin - boxW;
    const gstLines = isSample ? 0 : (isIntraState ? 2 : 1);
    const boxH = isSample ? 34 : 30 + gstLines * 16 + 34;

    doc.setDrawColor(...HAIR);
    doc.roundedRect(boxX, finalY, boxW, boxH, 4, 4, "S");

    let ty = finalY + 20;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);

    function row(label, value, opts = {}) {
        doc.setFont(undefined, opts.bold ? "bold" : "normal");
        doc.setTextColor(...(opts.color || MUTED));
        doc.text(label, boxX + 12, ty);
        doc.text(value, boxX + boxW - 12, ty, { align: "right" });
        ty += 16;
    }

    if (isSample) {
        row("Total", `Rs. ${inr(order.total_amount)}`, { bold: true, color: INK });
    } else {
        row("Taxable Value", `Rs. ${inr(gst.taxable)}`);
        if (isIntraState) {
            row(`CGST (${GST_PERCENT / 2}%)`, `Rs. ${inr(gst.cgst)}`);
            row(`SGST (${GST_PERCENT / 2}%)`, `Rs. ${inr(gst.sgst)}`);
        } else {
            row(`IGST (${GST_PERCENT}%)`, `Rs. ${inr(gst.igst)}`);
        }
        doc.setDrawColor(...HAIR);
        doc.line(boxX + 12, ty - 6, boxX + boxW - 12, ty - 6);
        ty += 4;
        doc.setFontSize(11);
        row("Total Payable", `Rs. ${inr(order.total_amount)}`, { bold: true, color: ACCENT });
    }

    // ---- Footer note ----
    let footerY = finalY + boxH + 24;
    doc.setFont(undefined, "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    if (!isSample) {
        doc.text(`GST shown is a breakup of the total at the standard ${GST_PERCENT}% rate, for invoicing reference.`, margin, footerY);
        footerY += 14;
    }

    if (order.buyer_notes) {
        doc.setFont(undefined, "bold");
        doc.setTextColor(...INK);
        doc.text("Notes:", margin, footerY);
        doc.setFont(undefined, "normal");
        doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(order.buyer_notes, pageWidth - margin * 2), margin, footerY + 14);
    }

    doc.save(`${order.order_number || "order"}.pdf`);
}