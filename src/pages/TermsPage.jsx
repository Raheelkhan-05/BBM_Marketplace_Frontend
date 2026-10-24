// pages/TermsPage.jsx
import { FileText } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function TermsPage() {
    return <LegalDocument {...PUBLIC_PAGES.terms} icon={FileText} />;
}