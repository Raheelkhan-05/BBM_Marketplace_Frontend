// privacyPolicyData.js
// Structured content for the Privacy Policy page.
// k: h1 = major section heading, h2 = numbered sub-heading, body = paragraph text
//
// NOTE TO THE BUSINESS OWNER (delete this comment block before publishing):
// - Replace every [BRACKETED PLACEHOLDER] below with real information.
// - This draft assumes BBM (Brand Brigade Marketing Private Limited) is a
//   "Data Fiduciary" under India's Digital Personal Data Protection Act, 2023
//   (DPDPA), and also references the IT Act 2000 and the SPDI Rules, 2011,
//   which remain relevant until fully superseded by DPDPA rules/notifications.
// - You must appoint and name a real Grievance Officer (mandatory under the
//   IT Rules and expected under DPDPA). If you qualify as a "Significant
//   Data Fiduciary" you will also need a registered Data Protection Officer
//   and periodic data protection impact assessments/audits — this draft
//   flags that but does not decide it for you.
// - Have this reviewed by a qualified Indian lawyer before publishing.

const PRIVACY_CONTENT = [

    { "t": "PRIVACY POLICY", "k": "h1" },
    { "t": "This Privacy Policy (\u201cPolicy\u201d) describes how Brand Brigade Marketing Private Limited, a company incorporated under the Companies Act, 2013, bearing CIN U74999GJ2017PTC097922, having its registered office at Shivshakti Auto Maninagar, Green Land Kuvada Road, Rajkot, Gujarat, India \u2013 360003 (\u201cBBM\u201d, \u201cMarketplace\u201d, \u201cCompany\u201d, \u201cwe\u201d, \u201cus\u201d or \u201cour\u201d), collects, uses, processes, discloses, stores, retains and protects information relating to identifiable individuals (\u201cPersonal Data\u201d) in connection with the Platform.", "k": "body" },
    { "t": "This Policy should be read together with the B2B Marketplace Participant Agreement and any applicable Policies referenced therein. Capitalised terms used but not defined in this Policy shall have the meaning given to them in the Participant Agreement.", "k": "body" },
    { "t": "By registering for, accessing, or continuing to use the Platform, you acknowledge that you have read and understood this Policy and consent to the collection, use, disclosure, storage and processing of Personal Data as described herein, in accordance with the Digital Personal Data Protection Act, 2023 (\u201cDPDPA\u201d), the Information Technology Act, 2000 and rules made thereunder (including the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011) (\u201cSPDI Rules\u201d), and other Applicable Law.", "k": "body" },
    { "t": "Where you provide Personal Data of another individual (such as an employee, representative, director, authorised signatory, or contact person of your organisation) for the purposes of registration or use of the Platform, you represent and warrant that you have obtained the necessary consent, notice or authority required under Applicable Law to share such Personal Data with us for the purposes described in this Policy.", "k": "body" },

    { "t": "1. SCOPE AND APPLICATION", "k": "h1" },
    { "t": "1.1 What This Policy Covers", "k": "h2" },
    { "t": "1.1.1 This Policy applies to Personal Data collected through the Platform, including our website, mobile applications, APIs, dashboards, customer support channels, and any other digital or offline channel through which we collect Personal Data in connection with the Marketplace Services.", "k": "body" },
    { "t": "1.1.2 This Policy applies to Participants (Buyers and Sellers), their authorised representatives, employees and contact persons, prospective Participants, and visitors to the Platform (collectively, \u201cyou\u201d).", "k": "body" },
    { "t": "1.1.3 This Policy does not apply to information processed by a Participant on its own systems, in its own capacity as a data fiduciary in respect of its own customers, suppliers or employees, other than to the extent such information is submitted to or processed through the Platform.", "k": "body" },
    { "t": "1.2 Third-Party Sites and Services", "k": "h2" },
    { "t": "1.2.1 The Platform may contain links to third-party websites, applications or services, including payment gateways, logistics providers and other integrated services. This Policy does not apply to the privacy practices of such third parties, and we encourage you to review their privacy policies separately.", "k": "body" },
    { "t": "1.3 Our Role", "k": "h2" },
    { "t": "1.3.1 In relation to Personal Data that you provide to us for your own registration, verification and use of the Platform, we act as a \u201cData Fiduciary\u201d under the DPDPA.", "k": "body" },
    { "t": "1.3.2 In relation to certain Personal Data that a Participant submits about another individual (for example, a Buyer's delivery contact, or a Seller's authorised signatory) solely for the purpose of enabling a Transaction between Participants, we act as an intermediary/processor facilitating the exchange of that information between the relevant Participants, without independently determining the purpose of collection of such information.", "k": "body" },

    { "t": "2. INFORMATION WE COLLECT", "k": "h1" },
    { "t": "2.1 Information You Provide to Us Directly", "k": "h2" },
    { "t": "2.1.1 Registration and Account Information: name of the entity, business/trade name, constitution (company, LLP, partnership, sole proprietorship, etc.), registered and business address, PAN, GSTIN, name, designation, email address, and mobile number of the authorised representative, and Account credentials.", "k": "body" },
    { "t": "2.1.2 Verification and KYC/KYB Information: documents and details submitted for onboarding and verification, including incorporation or registration certificates, identity and address proof of authorised signatories, GSTIN verification data, and any other document reasonably required to verify a Participant's identity, business, or authority.", "k": "body" },
    { "t": "2.1.3 Financial and Payment Information: bank account details, UPI or other payment instrument details, Wallet and Settlement information, credit or deferred-payment terms, and transaction-related financial records, to the extent submitted through the Platform.", "k": "body" },
    { "t": "2.1.4 Transaction Information: Orders, Purchase Orders, Sales Orders, Quotations, invoices, delivery and Transportation details, dispute and claim records, and communications relating to Transactions conducted through the Platform.", "k": "body" },
    { "t": "2.1.5 Support and Communications: information you provide when contacting customer support, raising a complaint or dispute, or otherwise communicating with us through the Platform, email, telephone, or other channels.", "k": "body" },
    { "t": "2.2 Information Collected Automatically", "k": "h2" },
    { "t": "2.2.1 When you access or use the Platform, we may automatically collect device information (device type, operating system, browser type and version), IP address, approximate location derived from IP address, log data (access times, pages viewed, referring/exit pages), and usage data relating to your interaction with the Platform.", "k": "body" },
    { "t": "2.2.2 We may use cookies, web beacons, SDKs, and similar tracking technologies to collect such information, as described further in the section on Cookies and Tracking Technologies below.", "k": "body" },
    { "t": "2.3 Information We Receive from Third Parties", "k": "h2" },
    { "t": "2.3.1 We may receive information about you from third parties, including GSTIN verification services and other governmental or authorised databases, banks and payment service providers, logistics and transportation partners, and other Participants with whom you transact on the Platform.", "k": "body" },
    { "t": "2.3.2 We may combine information received from third parties with information we already hold about you for the purposes described in this Policy.", "k": "body" },
    { "t": "2.4 Sensitive Personal Data or Information", "k": "h2" },
    { "t": "2.4.1 Some of the information described above, such as bank account details, payment instrument information, and financial information, may constitute \u201cSensitive Personal Data or Information\u201d under the SPDI Rules. We collect such information only to the extent reasonably necessary to provide the Marketplace Services, and process it with the additional safeguards described in this Policy.", "k": "body" },
    { "t": "2.4.2 We do not knowingly collect health data, biometric data, genetic data, or other special categories of sensitive personal data through the Platform, and such information should not be submitted to us unless expressly and specifically requested for a stated purpose.", "k": "body" },
    { "t": "2.5 Consequences of Not Providing Information", "k": "h2" },
    { "t": "2.5.1 Certain information, such as GSTIN, contact details, and bank account information, is necessary for registration, verification, and use of core Marketplace Services. If you do not provide such information, we may be unable to complete your registration, process your Transactions, or release Settlement amounts to you.", "k": "body" },

    { "t": "3. HOW WE USE PERSONAL DATA", "k": "h1" },
    { "t": "3.1 We collect, use and process Personal Data for the following purposes:", "k": "body" },
    { "t": "(a) creating, verifying, activating and administering your Account and Platform registration, including GSTIN, KYC and KYB verification;", "k": "body" },
    { "t": "(b) enabling and facilitating Transactions between Buyers and Sellers, including Orders, Quotations, Purchase Orders, Sales Orders, invoicing, and delivery coordination;", "k": "body" },
    { "t": "(c) processing payments, operating the Wallet, calculating Fees and commissions, and administering Settlement, refunds, adjustments and recoveries;", "k": "body" },
    { "t": "(d) providing customer and Participant support, and facilitating communication, dispute assistance and resolution between Buyers and Sellers;", "k": "body" },
    { "t": "(e) verifying identity and preventing, detecting and investigating fraud, unauthorised activity, security incidents, and violations of the Participant Agreement or Applicable Law;", "k": "body" },
    { "t": "(f) complying with Applicable Law, including tax, accounting, KYC/anti-money-laundering, and regulatory reporting obligations, and responding to lawful requests from governmental or regulatory authorities;", "k": "body" },
    { "t": "(g) sending Account-related, Transaction-related, Settlement-related, and security-related communications and notifications;", "k": "body" },
    { "t": "(h) maintaining, securing, operating, testing, and improving the Platform and Marketplace Services, including analytics performed on an aggregated or de-identified basis where reasonably possible;", "k": "body" },
    { "t": "(i) enforcing the Participant Agreement, applicable Policies, and this Policy, and establishing, exercising or defending legal claims; and", "k": "body" },
    { "t": "(j) with your consent, sending promotional or marketing communications about Platform features, offers, or services that may be relevant to your business.", "k": "body" },
    { "t": "3.2 We do not use Personal Data for any purpose that is incompatible with the purpose for which it was collected, except where required or permitted under Applicable Law, or where you have provided separate consent for such use.", "k": "body" },

    { "t": "4. LAWFUL BASIS FOR PROCESSING", "k": "h1" },
    { "t": "4.1 We process your Personal Data on one or more of the following lawful bases, as applicable: (a) your consent, given at the time of registration or subsequently; (b) performance of the Participant Agreement, including facilitating Transactions to which you are a party; (c) compliance with a legal obligation to which we are subject, including tax, accounting and regulatory record-keeping obligations; and (d) certain \u201clegitimate uses\u201d recognised under the DPDPA, such as for the purpose for which you have voluntarily provided your Personal Data and have not indicated that you do not consent to its use, or for preventing fraud and ensuring safety and security of the Platform.", "k": "body" },
    { "t": "4.2 Where our processing is based on your consent, you have the right to withdraw such consent at any time, without affecting the lawfulness of processing carried out before such withdrawal. Withdrawal of consent for processing that is necessary to provide core Marketplace Services may result in our inability to continue providing those services to you, and may lead to suspension or closure of your Account in accordance with the Participant Agreement.", "k": "body" },

    { "t": "5. HOW WE SHARE AND DISCLOSE PERSONAL DATA", "k": "h1" },
    { "t": "5.1 With Other Participants", "k": "h2" },
    { "t": "5.1.1 We share information reasonably necessary for a Transaction between the relevant Buyer and Seller, including business name, GSTIN, contact details, Order and delivery information, invoicing details, and Transaction status, so that the Parties can perform their respective obligations.", "k": "body" },
    { "t": "5.2 With Service Providers", "k": "h2" },
    { "t": "5.2.1 We share Personal Data with third-party service providers who perform functions on our behalf, including payment gateways, payment processors and banks; logistics, courier and transportation partners; cloud hosting, data storage and IT infrastructure providers; GSTIN and KYC/KYB verification service providers; customer support and communication tool providers; and professional advisers such as auditors, accountants and legal counsel.", "k": "body" },
    { "t": "5.2.2 We require such service providers to process Personal Data only for the specified purpose, under contractual confidentiality and data protection obligations consistent with this Policy and Applicable Law.", "k": "body" },
    { "t": "5.3 Legal and Regulatory Disclosures", "k": "h2" },
    { "t": "5.3.1 We may disclose Personal Data where required to comply with Applicable Law, a court order, or a lawful request from a governmental, regulatory, tax, judicial, or law-enforcement authority, or where we reasonably believe disclosure is necessary to protect our rights, property, or safety, or that of our Participants or the public.", "k": "body" },
    { "t": "5.4 Business Transfers", "k": "h2" },
    { "t": "5.4.1 We may disclose or transfer Personal Data in connection with a merger, acquisition, corporate reorganisation, financing, or sale of all or substantially all of our business or assets, subject to the recipient agreeing to handle Personal Data consistent with this Policy and Applicable Law.", "k": "body" },
    { "t": "5.5 With Your Consent", "k": "h2" },
    { "t": "5.5.1 We may share Personal Data with other third parties where you have given specific consent for such sharing.", "k": "body" },
    { "t": "5.6 No Sale of Personal Data", "k": "h2" },
    { "t": "5.6.1 We do not sell, rent, or trade Personal Data to unrelated third parties for their own independent marketing purposes in exchange for monetary consideration.", "k": "body" },

    { "t": "6. COOKIES AND TRACKING TECHNOLOGIES", "k": "h1" },
    { "t": "6.1 We use cookies and similar technologies for purposes including: (a) essential/strictly necessary cookies required for the Platform to function, such as Account authentication and security; (b) functional cookies that remember your preferences and settings; (c) analytics cookies that help us understand how the Platform is used so that we can improve it; and (d) where applicable, cookies used for measuring the performance of promotional communications.", "k": "body" },
    { "t": "6.2 Where required under Applicable Law, we will present a cookie consent mechanism through the Platform allowing you to accept or reject non-essential cookies. You may also control cookies through your browser settings; disabling certain cookies may affect the functionality of the Platform.", "k": "body" },
    { "t": "6.3 We may use third-party analytics providers who place their own cookies subject to their own privacy policies. We do not control the practices of such third parties beyond the scope of our contractual arrangements with them.", "k": "body" },

    { "t": "7. DATA STORAGE, SECURITY AND RETENTION", "k": "h1" },
    { "t": "7.1 Security Measures", "k": "h2" },
    { "t": "7.1.1 We implement reasonable security practices and procedures, including administrative, technical, and physical safeguards, that are commensurate with the sensitivity of the Personal Data we process, consistent with the SPDI Rules and applicable industry standards. These may include encryption of data in transit, access controls, authentication mechanisms, network security measures, and periodic security reviews.", "k": "body" },
    { "t": "7.1.2 No method of transmission or electronic storage is completely secure. While we take reasonable steps to protect Personal Data, we cannot guarantee absolute security, and you are responsible for maintaining the confidentiality of your Account credentials as further described in the Participant Agreement.", "k": "body" },
    { "t": "7.2 Data Retention", "k": "h2" },
    { "t": "7.2.1 We retain Personal Data for as long as reasonably necessary to fulfil the purposes described in this Policy, including for as long as your Account remains active, and thereafter for such additional period as is necessary to comply with our legal, tax, accounting, or regulatory retention obligations, resolve disputes, enforce our agreements, and protect our legitimate legal interests.", "k": "body" },
    { "t": "7.2.2 Where Personal Data is no longer necessary for these purposes and we are not required to retain it under Applicable Law, we will take reasonable steps to delete, anonymise, or securely dispose of such Personal Data.", "k": "body" },
    { "t": "7.3 Location of Storage", "k": "h2" },
    { "t": "7.3.1 Personal Data collected through the Platform is primarily stored on servers located in India. Certain service providers engaged by us may process or store data on infrastructure located outside India, subject to the safeguards described in the section on cross-border transfer below.", "k": "body" },

    { "t": "8. CROSS-BORDER TRANSFER OF PERSONAL DATA", "k": "h1" },
    { "t": "8.1 We may transfer, store, or process Personal Data outside India where reasonably necessary for the purposes described in this Policy, including where our service providers operate infrastructure outside India.", "k": "body" },
    { "t": "8.2 Any such transfer shall be made in accordance with the DPDPA and any rules, notifications or restrictions issued by the Central Government from time to time (including any list of countries or territories to which transfer is restricted), and subject to contractual or other safeguards reasonably designed to protect the confidentiality and security of the Personal Data transferred.", "k": "body" },

    { "t": "9. YOUR RIGHTS AS A DATA PRINCIPAL", "k": "h1" },
    { "t": "9.1 Subject to Applicable Law and the exceptions recognised under the DPDPA, you have the following rights in relation to your Personal Data:", "k": "body" },
    { "t": "(a) Right to Access Information: to obtain a summary of the Personal Data we hold about you and the processing activities undertaken in relation to it, including the identities of other data fiduciaries and data processors with whom your Personal Data has been shared, and a description of the Personal Data so shared;", "k": "body" },
    { "t": "(b) Right to Correction and Updating: to request correction of inaccurate or misleading Personal Data, completion of incomplete Personal Data, and updating of Personal Data;", "k": "body" },
    { "t": "(c) Right to Erasure: to request erasure of Personal Data that is no longer necessary for the purpose for which it was collected, subject to our right and obligation to retain such data where required for legal, regulatory, tax, or accounting purposes, or for the establishment, exercise or defence of legal claims;", "k": "body" },
    { "t": "(d) Right to Grievance Redressal: to have any grievance concerning the processing of your Personal Data addressed by us within a reasonable time, as further described in the Grievance Officer section below;", "k": "body" },
    { "t": "(e) Right to Nominate: to nominate another individual to exercise your rights under the DPDPA in the event of your death or incapacity, in the manner prescribed under Applicable Law; and", "k": "body" },
    { "t": "(f) Right to Withdraw Consent: to withdraw consent previously given for processing based on consent, as described in the section on Lawful Basis for Processing above.", "k": "body" },
    { "t": "9.2 You may exercise these rights by submitting a request through the contact details specified in the Grievance Officer / Contact Us sections of this Policy. We may require you to verify your identity before acting on such a request, and we will respond within the time period prescribed under Applicable Law, or otherwise within a reasonable period.", "k": "body" },
    { "t": "9.3 These rights are subject to the exceptions and restrictions recognised under the DPDPA and other Applicable Law, including where processing is necessary for compliance with a legal obligation, for the performance of a contract, for research, archiving or statistical purposes, or for the prevention, detection, investigation or prosecution of offences.", "k": "body" },

    { "t": "10. CHILDREN'S PRIVACY", "k": "h1" },
    { "t": "10.1 The Platform is a business-to-business marketplace intended for use by legally competent adults acting on behalf of registered businesses or legal entities, and is not directed at or intended for use by children.", "k": "body" },
    { "t": "10.2 We do not knowingly collect Personal Data from individuals below the age recognised as the age of majority under Applicable Law. If we become aware that we have inadvertently collected Personal Data from a child without appropriate consent, we will take reasonable steps to delete such information.", "k": "body" },

    { "t": "11. DATA BREACH NOTIFICATION", "k": "h1" },
    { "t": "11.1 In the event of a personal data breach that affects your Personal Data, we will take reasonable steps to contain and remediate the breach, and will notify the Data Protection Board of India and affected Participants in the manner and within the timelines prescribed under the DPDPA and rules made thereunder.", "k": "body" },
    { "t": "11.2 Any such notification will describe, to the extent reasonably known to us at the time, the nature of the breach, the Personal Data affected, and the measures taken or recommended to mitigate the risk arising from the breach.", "k": "body" },

    { "t": "12. THIRD-PARTY WEBSITES AND SERVICES", "k": "h1" },
    { "t": "12.1 The Platform may contain links to, or integrations with, third-party websites, applications or services that are not owned or controlled by us, including payment gateways and logistics partners. This Policy does not apply to information collected by such third parties, and we encourage you to review their respective privacy policies.", "k": "body" },
    { "t": "12.2 We are not responsible for the privacy practices or content of any third-party website or service linked to or integrated with the Platform.", "k": "body" },

    { "t": "13. MARKETING COMMUNICATIONS AND OPT-OUT", "k": "h1" },
    { "t": "13.1 We may send you promotional or marketing communications relating to the Platform and Marketplace Services, where you have consented to receive such communications or where otherwise permitted under Applicable Law.", "k": "body" },
    { "t": "13.2 You may opt out of promotional communications at any time by using the unsubscribe mechanism provided in such communications, updating your Account preferences, or contacting us through the channels described below.", "k": "body" },
    { "t": "13.3 Opting out of promotional communications shall not affect our ability to send you transactional, Account-related, Settlement-related, security-related, or other communications necessary for the operation of the Platform and performance of the Participant Agreement.", "k": "body" },

    { "t": "14. GRIEVANCE OFFICER AND DATA PROTECTION CONTACT", "k": "h1" },
    { "t": "14.1 In accordance with the Information Technology Act, 2000, the SPDI Rules, and the DPDPA, we have designated the following Grievance Officer to address grievances relating to the processing of Personal Data:", "k": "body" },
    { "t": "Grievance Officer: [NAME AND DESIGNATION]\nAddress: Brand Brigade Marketing Private Limited, Shivshakti Auto Maninagar, Green Land Kuvada Road, Rajkot, Gujarat, India \u2013 360003\nEmail: [GRIEVANCE OFFICER EMAIL ADDRESS]\nPhone: [GRIEVANCE OFFICER CONTACT NUMBER]\nHours: [DAYS AND HOURS OF AVAILABILITY]", "k": "body" },
    { "t": "14.2 The Grievance Officer shall acknowledge receipt of a grievance and shall endeavour to redress it within the time period prescribed under Applicable Law from the date of receipt.", "k": "body" },
    { "t": "14.3 If we are, or become, required under the DPDPA to appoint a Data Protection Officer (including on account of being classified as a Significant Data Fiduciary), the contact details of such Data Protection Officer will be published here and made available on the Platform.", "k": "body" },

    { "t": "15. RETENTION OF PLATFORM RECORDS", "k": "h1" },
    { "t": "15.1 In addition to Personal Data described above, we maintain Platform Records relating to Accounts, Products, Orders, Transactions, communications, payments, Settlements, disputes, and other Platform activities, as described in the Participant Agreement.", "k": "body" },
    { "t": "15.2 Such Platform Records may include Personal Data and are retained, used and disclosed in accordance with this Policy and the applicable provisions of the Participant Agreement relating to Platform Records.", "k": "body" },

    { "t": "16. CHANGES TO THIS PRIVACY POLICY", "k": "h1" },
    { "t": "16.1 We may amend, update, or replace this Policy from time to time to reflect changes in our data practices, the Platform, Marketplace Services, or Applicable Law.", "k": "body" },
    { "t": "16.2 Where a change is material, we will provide notice through the Platform, your registered email address, or your registered mobile number, prior to the change taking effect, to the extent required under Applicable Law.", "k": "body" },
    { "t": "16.3 Your continued use of the Platform after the effective date of an updated Policy shall constitute your acknowledgement of the updated Policy, except where Applicable Law requires your affirmative consent to the change, in which case we will seek such consent through the prescribed mechanism.", "k": "body" },
    { "t": "16.4 We encourage you to review this Policy periodically to stay informed about how we collect, use, and protect your Personal Data.", "k": "body" },

    { "t": "17. GOVERNING LAW AND JURISDICTION", "k": "h1" },
    { "t": "17.1 This Policy shall be governed by and construed in accordance with the laws of India, including the DPDPA, the Information Technology Act, 2000, and rules made thereunder.", "k": "body" },
    { "t": "17.2 Subject to the dispute resolution provisions of the Participant Agreement, courts and competent authorities at Rajkot, Gujarat, India shall have exclusive jurisdiction over disputes arising out of or in connection with this Policy, to the extent permitted under Applicable Law.", "k": "body" },
    { "t": "17.3 Nothing in this Policy restricts the jurisdiction of the Data Protection Board of India or any other competent regulatory, governmental or judicial authority under Applicable Law.", "k": "body" },

    { "t": "18. CONTACT US", "k": "h1" },
    { "t": "18.1 If you have questions, comments, or requests regarding this Policy or our data practices, you may contact us at:", "k": "body" },
    { "t": "Brand Brigade Marketing Private Limited\nShivshakti Auto Maninagar, Green Land Kuvada Road, Rajkot, Gujarat, India \u2013 360003\nEmail: communication@bbmpvtltd.com\nPhone: +919537284774", "k": "body" },
    { "t": "This page is a plain rendering of our Privacy Policy for reference. In case of any discrepancy between this page and the version filed or executed for regulatory purposes, the latter shall prevail.", "k": "body" },

];

export default PRIVACY_CONTENT;