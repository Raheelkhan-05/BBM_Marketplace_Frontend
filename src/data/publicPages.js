// src/data/publicPages.js
// One definition per public page. Used by:
//   - the React pages (TermsPage, PrivacyPage, RefundPolicyPage, ContactPage,
//     ServicesPage, PricingPage) through <LegalDocument {...page} />
//   - scripts/prerender-public.mjs, which writes real HTML for crawlers and
//     bank / payment-gateway reviewers.
//
// Plain JS, no React imports (it is loaded in Node by the prerender script).
// Do NOT import this file from Layout/Footer: it pulls in the large Terms data.
// The footer uses FOOTER_LINKS from ../config/company.js instead.

import TERMS_CONTENT from "./termsData.js";
import PRIVACY_CONTENT from "./privacyPolicyData.js";
import {
    COMPANY,
    COMMISSION_SCHEDULE,
    REFUND_INITIATION_DAYS,
    addressOneLine,
} from "../config/company.js";
import { normalizeLegalContent, lines } from "../lib/legalContent.js";

const NEW_PAGE_UPDATED = "October 24, 2026";

/* ------------------------------------------------------------------ */
/* Terms                                                               */
/* ------------------------------------------------------------------ */

const PARTICIPANT_PLACEHOLDER = /^\[PARTICIPANT \/ LEGAL ENTITY NAME\]/;
const PARTICIPANT_TEXT =
    "The business entity that registers for an Account on the Platform and accepts this Agreement electronically, whose legal name, registered address, PAN and GSTIN are those provided and verified at registration (hereinafter referred to as the \u201cParticipant\u201d, which expression shall, unless repugnant to the context, include its successors, legal representatives and permitted assigns).";

const COMMERCIAL_TERMS_DEFINITION = {
    t: "\u201CCommercial Terms\u201D means the fees, commissions and charges published from time to time on the Pricing & Fees page of the Platform, and any written quotation, proposal or service agreement accepted by a Participant, in each case as amended from time to time in accordance with this Agreement.",
    k: "body",
};

// Inserted right after the "Company" / "Marketplace" definition, so it sits in
// alphabetical order inside 2.1 Definitions (before "Fees").
const termsSource = TERMS_CONTENT.flatMap((item) => {
    const fixed = PARTICIPANT_PLACEHOLDER.test(item.t)
        ? { ...item, t: PARTICIPANT_TEXT }
        : item;
    return /^\u201CCompany\u201D or /.test(item.t)
        ? [fixed, COMMERCIAL_TERMS_DEFINITION]
        : [fixed];
});

if (!termsSource.includes(COMMERCIAL_TERMS_DEFINITION)) {
    console.warn("publicPages: could not find the Company definition; Commercial Terms was not inserted");
}

const termsContent = normalizeLegalContent(termsSource, {
    renameH1: {
        "BY AND BETWEEN": "1. PARTIES",
        "DEFINITIONS AND INTERPRETATION": "2. DEFINITIONS AND INTERPRETATION",
    },
    missingH1: {
        3: "3. PARTICIPANT REGISTRATION, ACCOUNTS AND ACCESS",
    },
});

/* ------------------------------------------------------------------ */
/* Privacy (fills the Grievance Officer placeholder block)             */
/* ------------------------------------------------------------------ */

const go = COMPANY.grievanceOfficer;
const grievanceBlock = lines(
    `Grievance Officer: ${[go.name, go.designation].filter(Boolean).join(", ") ||
    `${COMPANY.legalName} \u2013 Grievance Cell`
    }`,
    `Address: ${COMPANY.legalName}, ${addressOneLine()}`,
    `Email: ${go.email || COMPANY.email}`,
    `Phone: ${go.phone || COMPANY.phoneDisplay}`,
    go.hours && `Hours: ${go.hours}`
);

const privacyContent = PRIVACY_CONTENT.map((item) =>
    /^Grievance Officer: \[NAME AND DESIGNATION\]/.test(item.t) ? { ...item, t: grievanceBlock } : item
);

/* ------------------------------------------------------------------ */
/* Refund & Cancellation Policy                                        */
/* ------------------------------------------------------------------ */

const refundTimelineSentence = REFUND_INITIATION_DAYS
    ? `We initiate an approved refund within ${REFUND_INITIATION_DAYS} Business Days of approval. `
    : "We initiate approved refunds at the earliest practicable time after approval. ";

const supportEmail = COMPANY.email;

const refundContent = [
    { t: "1. SCOPE OF THIS POLICY", k: "h1" },
    { t: `This Refund and Cancellation Policy applies to Orders and Transactions made through the ${COMPANY.brand} B2B marketplace platform (the \u201cPlatform\u201d) operated by ${COMPANY.legalName} (\u201c${COMPANY.brand}\u201d, \u201cwe\u201d, \u201cus\u201d). It should be read together with the B2B Marketplace Participant Agreement (the \u201cAgreement\u201d) and the Privacy Policy. Capitalised terms not defined here have the meaning given in the Agreement.`, k: "body" },
    { t: "The Platform is for registered businesses only. The contract of sale for Products is between the Buyer and the Seller. We provide the Platform, receive and hold advance payments for the limited purpose of administering the Transaction, and release, refund or adjust those funds as described below and in Section 7 of the Agreement.", k: "body" },

    { t: "2. CANCELLATION OF ORDERS", k: "h1" },
    { t: "2.1 Cancellation by the Buyer", k: "h2" },
    { t: "A Buyer may request cancellation of an Order before it is fulfilled, through the Platform. Cancellation is subject to the applicable Transaction terms, the Seller\u2019s acceptance where required, and any cancellation charges or deductions stated in those terms. Once Products have been dispatched, cancellation is treated as a return request under Section 4.", k: "body" },
    { t: "2.2 Cancellation by the Seller", k: "h2" },
    { t: "A Seller may not reject or cancel an accepted Order contrary to the agreed Transaction terms. If a Seller cannot fulfil an accepted Order (for example, due to shortage or unavailability), the Seller must inform the Buyer and us promptly, and the refund process in Section 3 applies.", k: "body" },
    { t: "2.3 Cancellation by BBM", k: "h2" },
    { t: "We may cancel or suspend an Order where required by Applicable Law, where we reasonably suspect fraud or unauthorised activity, where a payment fails or is reversed, or where the Seller fails to dispatch or deliver within the committed timeline. Where we cancel an advance-paid Order, the Buyer\u2019s advance payment is refunded under Section 3.", k: "body" },

    { t: "3. WHEN A REFUND IS ISSUED", k: "h1" },
    { t: "For an advance-paid Transaction, the Buyer\u2019s payment is held until the Transaction is completed. A refund of the advance payment (in full or in part, as applicable) is issued where:", k: "body" },
    { t: "(a) the Order is cancelled before dispatch and the cancellation is accepted or required under the Transaction terms;", k: "body" },
    { t: "(b) the Seller fails to dispatch or deliver the confirmed quantity within the committed timeline, or within the one (1) extension the Seller may request through the Platform before that timeline expires;", k: "body" },
    { t: "(c) a Buyer dispute is raised in time and upheld, for example for short supply, damaged, incorrect, counterfeit or non-conforming Products;", k: "body" },
    { t: "(d) a payment is duplicated, charged in excess, or received but not applied to a valid Order; or", k: "body" },
    { t: "(e) a refund is otherwise required by the Agreement or Applicable Law.", k: "body" },
    { t: "Where the Buyer and Seller mutually agree to cancel, the refund or adjustment follows their agreed terms, the Agreement and Applicable Law.", k: "body" },

    { t: "4. RETURNS, REPLACEMENTS AND PRODUCT CLAIMS", k: "h1" },
    { t: "4.1 The Buyer must inspect Products on receipt and promptly report any shortage, visible damage, incorrect Product or other discrepancy, with supporting evidence such as photographs, the invoice and delivery records.", k: "body" },
    { t: "4.2 Returns, replacements and refunds for Products are governed by the applicable Transaction terms, the agreed commercial terms between Buyer and Seller, and the Agreement. Unless agreed otherwise, the Seller bears the cost of returning and replacing Products that are defective, damaged, incorrect, counterfeit, short-supplied or otherwise non-conforming.", k: "body" },
    { t: "4.3 Time limit to dispute an advance-paid Transaction: once a Seller marks a Transaction as delivered on the Platform, the Buyer has one (1) Business Day to raise a dispute. If no dispute is raised in that time, the amount becomes eligible for automatic release to the Seller. A dispute raised in time places the amount on hold until it is resolved. Please raise issues as soon as you receive the Products.", k: "body" },
    { t: "4.4 Where a replacement is agreed instead of a refund, we may continue to hold the relevant amount until the replacement is completed.", k: "body" },

    { t: "5. HOW TO RAISE A CANCELLATION, REFUND OR DISPUTE REQUEST", k: "h1" },
    { t: "5.1 Raise the request through the dispute or support option for the Order on the Platform, or write to us at the contact details in Section 9. Please include your registered business name, the Order or Transaction reference, the reason, and supporting documents.", k: "body" },
    { t: "5.2 We may ask both parties for additional information or evidence and may review Platform Records, payment records and delivery records. Based on that review we make an administrative decision to release, hold, refund or adjust the amount. This decision does not affect any other legal right a party has against the other under the Transaction terms or Applicable Law.", k: "body" },

    { t: "6. REFUND METHOD AND TIMELINE", k: "h1" },
    { t: `6.1 Approved refunds are made to the original payment source or to the account or payment method we determine, subject to the payment process and Applicable Law. ${refundTimelineSentence}After initiation, the time taken for the amount to reach your account depends on your bank or payment provider.`, k: "body" },
    { t: "6.2 If a payment was debited but the Order was not confirmed, the amount is normally reversed automatically by the bank or payment provider. If you do not receive it, contact us with the payment reference so we can investigate.", k: "body" },
    { t: "6.3 Where a refund is made after an amount has already been settled to a Seller, we recover that amount from the Seller as described in the Agreement. This does not delay the Buyer\u2019s refund where it has been approved.", k: "body" },

    { t: "7. AMOUNTS THAT ARE NOT REFUNDED OR MAY BE DEDUCTED", k: "h1" },
    { t: "7.1 Cancellation charges, costs or deductions that are stated in the applicable Transaction terms may be adjusted from the amount refunded.", k: "body" },
    { t: "7.2 Fees and commissions already properly charged to a Participant for a completed Transaction are not refunded, except where the Transaction is cancelled or reversed.", k: "body" },
    { t: "7.3 Prepaid Wallet amounts are internal ledger entries used to record commissions, Fees and adjustments under Section 7 of the Agreement. Questions about Wallet entries, or any discrepancy, can be raised with us and are reviewed under the Agreement and Applicable Law.", k: "body" },

    { t: "8. CHARGEBACKS AND FRAUD", k: "h1" },
    { t: "Where a payment is charged back, reversed, or suspected to be fraudulent or unauthorised, we may hold, reverse or adjust the related Transaction and settlement while we investigate, as set out in the Agreement. Please contact us before raising a chargeback with your bank so we can help resolve the issue quickly.", k: "body" },

    { t: "9. CONTACT", k: "h1" },
    {
        t: lines(
            `${COMPANY.legalName}`,
            addressOneLine(),
            `Email: ${supportEmail}`,
            `Phone: ${COMPANY.phoneDisplay}`,
            COMPANY.supportHours && `Support hours: ${COMPANY.supportHours}`
        ), k: "body"
    },

    { t: "10. CHANGES AND GOVERNING LAW", k: "h1" },
    { t: "We may update this Policy from time to time; the version published on this page applies from its \u201cLast updated\u201d date. This Policy is governed by the laws of India and, subject to the dispute resolution provisions of the Agreement, the courts at Rajkot, Gujarat have jurisdiction.", k: "body" },
];

/* ------------------------------------------------------------------ */
/* Contact Us                                                          */
/* ------------------------------------------------------------------ */

const go2 = COMPANY.grievanceOfficer;

const contactContent = [
    { t: "REGISTERED OFFICE", k: "h1" },
    {
        t: lines(
            COMPANY.legalName,
            ...COMPANY.addressLines,
            `CIN: ${COMPANY.cin}`,
            COMPANY.gstin && `GSTIN: ${COMPANY.gstin}`
        ), k: "body"
    },

    { t: "GET IN TOUCH", k: "h1" },
    {
        t: lines(
            `Email: ${COMPANY.email}`,
            `Phone: ${COMPANY.phoneDisplay}`,
            COMPANY.supportHours && `Support hours: ${COMPANY.supportHours}`
        ), k: "body"
    },
    { t: "We respond to business enquiries, onboarding questions, and partnership requests sent to the email address above.", k: "body" },

    { t: "PAYMENTS, REFUNDS AND SETTLEMENT SUPPORT", k: "h1" },
    { t: `For questions about a payment, refund, cancellation, dispute or settlement, email ${COMPANY.email} with your registered business name and the Order or Transaction reference. Our Refund & Cancellation Policy explains how these requests are handled.`, k: "body" },

    { t: "GRIEVANCE OFFICER", k: "h1" },
    {
        t: lines(
            `Grievance Officer: ${[go2.name, go2.designation].filter(Boolean).join(", ") || `${COMPANY.legalName} \u2013 Grievance Cell`}`,
            `Email: ${go2.email || COMPANY.email}`,
            `Phone: ${go2.phone || COMPANY.phoneDisplay}`,
            go2.hours && `Hours: ${go2.hours}`
        ), k: "body"
    },
    { t: "Complaints about the processing of personal data or any other grievance can be sent to the Grievance Officer. We acknowledge and address grievances within the time prescribed under Applicable Law.", k: "body" },
];

/* ------------------------------------------------------------------ */
/* Services (business model, aligned to MCC 7399)                      */
/* EDIT these descriptions so they match what BBM actually offers.     */
/* ------------------------------------------------------------------ */

const servicesContent = [
    { t: `ABOUT ${COMPANY.legalName.toUpperCase()}`, k: "h1" },
    { t: `${COMPANY.legalName} (\u201c${COMPANY.brand}\u201d) is a business-to-business company based in Rajkot, Gujarat, India. We work with manufacturers, brand owners, distributors, traders and exporters on sourcing, brand building, cross-border trade and distribution. Our services are for registered businesses only and are not offered to individual consumers.`, k: "body" },

    { t: "1. STRATEGIC SOURCING", k: "h1" },
    { t: "We help businesses identify, evaluate and engage suppliers and manufacturers for the products they need: supplier discovery, specification and quotation comparison, sample coordination and commercial negotiation support.", k: "body" },

    { t: "2. BRAND MARKETING", k: "h1" },
    { t: "We plan and execute marketing for brands and products in B2B channels: positioning, brand collateral, catalogues, trade and digital promotion, and distributor or retailer outreach.", k: "body" },

    { t: "3. EXPORT AND IMPORT MANAGEMENT", k: "h1" },
    { t: "We support businesses that buy from or sell to overseas markets with buyer and supplier identification, documentation coordination, and liaison with freight, customs and logistics partners.", k: "body" },

    { t: "4. DISTRIBUTION AGENCY SERVICES", k: "h1" },
    { t: "We act as a distribution agent for brands that want market access: onboarding distributors and dealers, coordinating orders and supply, and tracking performance in assigned territories.", k: "body" },

    { t: "5. PRIVATE LABEL EXECUTION", k: "h1" },
    { t: "We help businesses launch products under their own brand: manufacturer matching, specification and packaging coordination, quality checkpoints, and production and delivery follow-up.", k: "body" },

    { t: "6. BBM B2B MARKETPLACE", k: "h1" },
    { t: `The ${COMPANY.brand} marketplace at ${COMPANY.siteUrl} is a technology platform where verified businesses list, quote, buy and sell products. Orders, quotations, purchase orders and sales orders are recorded on the platform. For advance-paid orders, payments are processed through our payment partners and released to the seller after delivery, as described in our Terms & Conditions and Refund & Cancellation Policy.`, k: "body" },

    { t: "HOW AN ENGAGEMENT WORKS", k: "h1" },
    { t: "Step 1 \u2013 Consultation: you tell us your requirement and we confirm whether and how we can help.", k: "body" },
    { t: "Step 2 \u2013 Proposal and quotation: we send a written proposal with the scope, deliverables and fees.", k: "body" },
    { t: "Step 3 \u2013 Agreement: work starts and any payment is collected only after you accept and the sign the service agreement.", k: "body" },
    { t: "Step 4 \u2013 Delivery and invoicing: we deliver in line with the agreed scope and issue a GST-compliant tax invoice.", k: "body" },

    { t: "PRICING AND TERMS", k: "h1" },
    { t: "Our fee structure, marketplace commission, wallet and settlement terms are published on the Pricing & Fees page. Service terms are in our Terms & Conditions.", k: "body" },
];

/* ------------------------------------------------------------------ */
/* Pricing & Fees                                                      */
/* ------------------------------------------------------------------ */

const commissionSection = COMMISSION_SCHEDULE.length
    ? [
        { t: "COMMISSION SCHEDULE", k: "h1" },
        { t: COMMISSION_SCHEDULE.map((r) => `${r.category}: ${r.commission}`).join("\n"), k: "body" },
    ]
    : [];

const pricingContent = [
    { t: "1. HOW WE CHARGE", k: "h1" },
    { t: `${COMPANY.legalName} charges for (a) use of the ${COMPANY.brand} B2B marketplace, through a commission on Transactions, and (b) business services such as strategic sourcing, brand marketing, export/import management, distribution agency services and private label execution, through quoted service fees. All amounts are in Indian Rupees (INR) and are exclusive of GST and other applicable taxes unless stated otherwise.`, k: "body" },
    { t: "Fees are made known to you before you are onboarded for a service and before any payout is processed. Browsing the platform does not incur any charge.", k: "body" },

    { t: "2. MARKETPLACE COMMISSION", k: "h1" },
    { t: "A commission applies to each Transaction. It may be a fixed amount or a percentage of the Transaction Value, depending on the product or category, and is shown to the Seller before listing and before an Order is confirmed. The commission for a Transaction is calculated on the Transaction Value recorded on the Platform and is deducted from the Seller\u2019s Wallet as described below.", k: "body" },

    ...commissionSection,

    { t: "3. SELLER WALLET AND PREPAID COMMISSION", k: "h1" },
    { t: "Each Participant has a Wallet, an internal ledger on the Platform used to record commissions, Fees, refunds, penalties and adjustments. Where required, a Seller keeps a prepaid balance in the Wallet to cover commissions. Commission is deducted from the Wallet when the relevant Transaction occurs. If the balance is insufficient, the shortfall is recorded as an amount due and further Transactions may be restricted until it is paid. The Wallet is not a bank account or deposit account.", k: "body" },

    { t: "4. PAYMENT PROCESSING CHARGES", k: "h1" },
    { t: "Payment gateway, payment processing and ordinary bank charges for receiving advance payments on the Platform are borne by us, unless the commercial terms for a particular Transaction state otherwise.", k: "body" },

    { t: "5. PAYOUTS AND SETTLEMENT", k: "h1" },
    { t: "For advance-paid Transactions the Buyer\u2019s payment is held until delivery. After the Seller marks the Transaction as delivered, the Buyer has one (1) Business Day to raise a dispute. If there is none, the amount, less the commission, Fees and any refunds, deductions or adjustments properly due, is released to the Seller automatically. A dispute places the amount on hold until it is resolved. The time for funds to reach the Seller\u2019s bank account after release depends on the banking channel. Credit sales between Buyer and Seller are paid directly between them and are not held or settled by us.", k: "body" },

    { t: "6. BUSINESS SERVICES: CONSULTATION AND SERVICE FEES", k: "h1" },
    { t: "Fees for sourcing, marketing, export/import, distribution and private label services depend on scope, volume and duration. We share a written proposal stating the scope, the fee (fixed, retainer, per-project or commission-based), payment milestones and applicable taxes. No work starts and no payment is collected before you accept it.", k: "body" },

    { t: "7. TAXES", k: "h1" },
    { t: "GST and other statutory taxes are charged on our fees and commissions at the applicable rate, and a tax invoice is issued. Sellers are responsible for the taxes on the sale of their products.", k: "body" },

    { t: "8. CHANGES TO FEES", k: "h1" },
    { t: "We may revise our fees, commissions and charges from time to time. Changes are communicated through the Platform or your registered contact details and apply from the date stated. Fees agreed in a written service agreement apply as stated in that document.", k: "body" },

    { t: "9. QUESTIONS", k: "h1" },
    { t: lines(`Email: ${COMPANY.email}`, `Phone: ${COMPANY.phoneDisplay}`), k: "body" },
];

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const PUBLIC_PAGES = {
    terms: {
        path: "/terms",
        title: "B2B Marketplace Participant Agreement",
        metaTitle: `Terms & Conditions | ${COMPANY.brand}`,
        metaDescription: `Terms and Conditions (B2B Marketplace Participant Agreement) for the ${COMPANY.brand} platform operated by ${COMPANY.legalName}.`,
        intro: `These Terms govern registration and use of the ${COMPANY.brand} Platform, and the purchase and sale of Products through it. By creating an account or using the Platform, you agree to be bound by this Agreement.`,
        lastUpdated: "September 18, 2026",
        disclaimer: "This page contains the current version of the Agreement. It is accepted electronically when a business registers on the Platform. Earlier versions accepted by a Participant continue to apply as recorded on the Platform.",
        preserveLineBreaks: true,
        content: termsContent,
    },
    privacy: {
        path: "/privacy-policy",
        title: "Privacy Policy",
        metaTitle: `Privacy Policy | ${COMPANY.brand}`,
        metaDescription: `How ${COMPANY.legalName} collects, uses, shares and protects personal data on the ${COMPANY.brand} platform.`,
        intro: `This Policy explains how ${COMPANY.brand} collects, uses, discloses and protects your Personal Data in connection with the Platform. By registering for or continuing to use the Platform, you agree to the practices described here.`,
        lastUpdated: "September 18, 2026",
        disclaimer: "This page is a plain rendering of our Privacy Policy for reference. In case of any discrepancy between this page and the version filed or executed for regulatory purposes, the latter shall prevail.",
        preserveLineBreaks: true,
        content: privacyContent,
    },
    refund: {
        path: "/refund-policy",
        title: "Refund & Cancellation Policy",
        metaTitle: `Refund & Cancellation Policy | ${COMPANY.brand}`,
        metaDescription: `Cancellation, return and refund rules for orders placed on the ${COMPANY.brand} B2B marketplace, including advance payments and disputes.`,
        intro: "How cancellations, returns, refunds and disputes work for Orders placed through the Platform, including advance payments held until delivery.",
        lastUpdated: NEW_PAGE_UPDATED,
        disclaimer: "This Policy forms part of the B2B Marketplace Participant Agreement. If anything here conflicts with the Agreement, the Agreement prevails.",
        preserveLineBreaks: true,
        content: refundContent,
    },
    contact: {
        path: "/contact",
        title: "Contact Us",
        metaTitle: `Contact Us | ${COMPANY.brand}`,
        metaDescription: `Contact ${COMPANY.legalName}: registered office address, email and phone.`,
        intro: `Registered office, email and phone for ${COMPANY.legalName}.`,
        lastUpdated: NEW_PAGE_UPDATED,
        disclaimer: "Please use only the contact details published on this page. We will never ask you to share an OTP, password or card PIN.",
        preserveLineBreaks: true,
        content: contactContent,
    },
    services: {
        path: "/services",
        title: "Our Services",
        metaTitle: `Our Services | ${COMPANY.brand}`,
        metaDescription: `${COMPANY.legalName} offers B2B strategic sourcing, brand marketing, export/import management, distribution agency services and private label execution, plus the ${COMPANY.brand} B2B marketplace.`,
        intro: "B2B services for brands, manufacturers, distributors and exporters: sourcing, marketing, cross-border trade, distribution and private label.",
        lastUpdated: NEW_PAGE_UPDATED,
        disclaimer: "Services are provided to registered businesses under a written service agreement. Descriptions on this page are a summary and do not form a contract.",
        preserveLineBreaks: true,
        content: servicesContent,
    },
    pricing: {
        path: "/pricing",
        title: "Pricing & Fees",
        metaTitle: `Pricing & Fees | ${COMPANY.brand}`,
        metaDescription: `Commission, wallet, payout and service-fee terms for the ${COMPANY.brand} B2B marketplace and business services.`,
        intro: "What we charge, when we charge it, and how payouts are calculated. All amounts are in INR and exclusive of GST unless stated.",
        lastUpdated: NEW_PAGE_UPDATED,
        disclaimer: "Fees shown here are the published terms. A written service agreement accepted by you for a specific engagement applies as stated in that document.",
        preserveLineBreaks: true,
        content: pricingContent,
    },
};

export const PUBLIC_PAGE_LIST = Object.values(PUBLIC_PAGES);