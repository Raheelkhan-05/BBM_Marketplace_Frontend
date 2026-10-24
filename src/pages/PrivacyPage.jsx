// pages/PrivacyPage.jsx
import { ShieldCheck } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function PrivacyPage() {
    return <LegalDocument {...PUBLIC_PAGES.privacy} icon={ShieldCheck} />;
}