// pages/ServicesPage.jsx
import { Briefcase } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function ServicesPage() {
    return <LegalDocument {...PUBLIC_PAGES.services} icon={Briefcase} />;
}