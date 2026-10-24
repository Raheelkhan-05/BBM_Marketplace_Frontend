// pages/RefundPolicyPage.jsx
import { RotateCcw } from "lucide-react";
import LegalDocument from "../components/LegalDocument.jsx";
import { PUBLIC_PAGES } from "../data/publicPages.js";

export default function RefundPolicyPage() {
    return <LegalDocument {...PUBLIC_PAGES.refund} icon={RotateCcw} />;
}