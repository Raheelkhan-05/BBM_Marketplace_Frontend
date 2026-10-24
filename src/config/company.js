// src/config/company.js
// Single source of truth for the company details shown on every public page
// (footer, Contact Us, Refund Policy, Privacy grievance block, prerendered HTML).
//
// IMPORTANT: Jio Pay / HDFC compare these against your incorporation documents.
// The address, legal name, CIN and GSTIN here must match the MCA / GST records
// character for character.
//
// Empty strings / null / [] mean "not set yet": the pages simply leave that
// line out instead of showing a placeholder. Fill them in as you confirm them.
//
// This file must stay plain JS with no imports from React, because the
// prerender script (scripts/prerender-public.mjs) loads it in Node.

import { MARKETING_SERVICES } from "../shared/marketingServices.js";

export const COMPANY = {
    legalName: "Brand Brigade Marketing Private Limited",
    brand: "BBM",
    siteUrl: "https://www.bbm.business",
    cin: "U74999GJ2017PTC097922",
    gstin: "24AAHCB3512C1ZD", // e.g. "24ABCDE1234F1Z5" - add your real GSTIN
    addressLines: [
        "Shivshakti Auto Maninagar, Green Land Kuvada Road",
        "Rajkot, Gujarat, India \u2013 360003",
    ],
    email: "communication@bbmpvtltd.com",
    phone: "+919537284774",
    phoneDisplay: "+91 95372 84774",
    supportHours: "", // e.g. "Monday to Saturday, 10:00 AM to 7:00 PM IST"
    // A named Grievance Officer is expected under the IT Rules / DPDPA.
    grievanceOfficer: {
        name: "Jay Hadvani",
        designation: "Director and Grievance Officer",
        email: "jay@bbmpvtltd.com",
        phone: "+91 84870 47774",
        hours: "Monday to Saturday, 9:00 AM to 6:00 PM IST",
    },
};

// Number of Business Days within which an approved refund is initiated.
// Leave null to publish the policy without a hard number.
export const REFUND_INITIATION_DAYS = null;

// Public rate card shown on /pricing. Generated from shared/marketingServices.js,
// so a repricing there updates this page automatically. Do not hand-edit.
export const COMMISSION_SCHEDULE = MARKETING_SERVICES.map((s) => ({
    category: s.label,
    commission: `${s.percent}% of Transaction Value${s.required ? " (required, always included)" : " (optional)"}`,
}));

export const SERVICES = [
    { name: "Strategic Sourcing", text: "Supplier discovery, quotation comparison and negotiation support." },
    { name: "Brand Marketing", text: "Positioning, collateral and B2B trade and digital promotion." },
    { name: "Export & Import Management", text: "Buyer and supplier identification, documentation and logistics liaison." },
    { name: "Distribution Agency Services", text: "Distributor onboarding, order coordination and territory tracking." },
    { name: "Private Label Execution", text: "Manufacturer matching, packaging coordination and quality checkpoints." },
    { name: "B2B Marketplace", text: "A platform for verified businesses to list, quote, buy and sell products." },
];

export const FOOTER_LINKS = [
    { to: "/terms", label: "Terms & Conditions" },
    { to: "/privacy-policy", label: "Privacy Policy" },
    { to: "/refund-policy", label: "Refund & Cancellation Policy" },
    { to: "/contact", label: "Contact Us" },
    { to: "/services", label: "Our Services" },
    { to: "/pricing", label: "Pricing & Fees" },
];

export const addressOneLine = () => COMPANY.addressLines.join(", ");