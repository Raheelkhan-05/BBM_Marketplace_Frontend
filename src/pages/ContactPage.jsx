// pages/ContactPage.jsx
import { Mail } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function ContactPage() {
    return <LegalDocument {...PUBLIC_PAGES.contact} icon={Mail} />;
}