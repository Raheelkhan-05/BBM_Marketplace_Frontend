// pages/PricingPage.jsx
import { IndianRupee } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function PricingPage() {
    return <LegalDocument {...PUBLIC_PAGES.pricing} icon={IndianRupee} />;
}