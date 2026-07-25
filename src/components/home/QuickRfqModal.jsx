// src/components/home/QuickRfqModal.jsx

import { useState } from "react";
import { X, Upload, FileText, CheckCircle2, ShieldCheck, ArrowRight, HelpCircle } from "lucide-react";

export default function QuickRfqModal({ isOpen, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    productName: "",
    partNumber: "",
    category: "Bearings & Motion Controls",
    quantity: "100",
    unit: "Pcs",
    targetPrice: "",
    deliveryDate: "",
    gstNumber: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0f172a] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#005b6d]/30 text-[#38BDF8] border border-[#005b6d]/40">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">Post Instant B2B RFQ</h3>
              <p className="text-xs text-slate-300">Get bids from ISO & OEM verified manufacturers in ~30 mins</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-lg sm:text-xl font-extrabold text-slate-900">RFQ Published Successfully!</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Your Request for Quotation for <strong className="text-slate-900">{formData.productName || "Industrial Items"}</strong> has been routed to 142 verified suppliers.
            </p>
            <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-md mx-auto text-left text-xs text-slate-600 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">RFQ Reference ID:</span>
                <span className="font-bold text-slate-800">#RFQ-2026-99412</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Est. Initial Quotes:</span>
                <span className="font-bold text-emerald-600">3-5 Bids within 30 mins</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Escrow Guarantee:</span>
                <span className="font-bold text-[#005b6d]">Active</span>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#c83c23] hover:bg-[#a92f19] px-6 py-2.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md"
            >
              Back to Marketplace <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 max-h-[80vh] overflow-y-auto">
            {/* Guarantee Callout */}
            <div className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 border border-sky-200/80 text-xs text-[#005b6d] font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#005b6d]" />
              <span>Free quote matching. Zero obligation. Direct supplier contacts protected under Escrow.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product / Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SKF Bearing 6205-ZZ or Shell Rimula Oil"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Part Number / SKU / Spec (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SKF-6205-2RSH / ISO 46"
                  value={formData.partNumber}
                  onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                >
                  <option>Bearings & Motion Controls</option>
                  <option>Industrial Oils & Lubricants</option>
                  <option>Electrical & Switchgears</option>
                  <option>Hydraulics & Pneumatics</option>
                  <option>Fasteners & Hardware</option>
                  <option>Industrial Packaging & VCI</option>
                  <option>Safety PPE & Tools</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Required <span className="text-rose-500">*</span>
                </label>
                <div className="flex">
                  <input
                    required
                    type="number"
                    placeholder="100"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full rounded-l-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                  />
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-600 focus:outline-none"
                  >
                    <option>Pcs</option>
                    <option>Ltrs</option>
                    <option>Drums</option>
                    <option>Rolls</option>
                    <option>Kgs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Price (₹)</label>
                <input
                  type="text"
                  placeholder="e.g. ₹125"
                  value={formData.targetPrice}
                  onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Required Delivery Date</label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GST Number (For Tax Credit)</label>
                <input
                  type="text"
                  placeholder="27AAAAA0000A1Z5"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
                />
              </div>
            </div>

            {/* Spec Sheet Upload Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Attach Specification Sheet / CAD Drawings
              </label>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-3 hover:border-[#005b6d] hover:bg-sky-50/30 transition-all cursor-pointer">
                <Upload className="h-5 w-5 text-slate-400 mb-1" />
                <p className="text-xs font-bold text-slate-700">Click to upload CAD drawings or RFQ sheet</p>
                <p className="text-[10px] text-slate-400">Max file size 25MB (PDF, PNG, DWG, ZIP)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Additional Procurement Notes</label>
              <textarea
                rows={2}
                placeholder="Mention specific tolerances, brand preferences, packaging requirements..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-[#005b6d] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" /> Need help? Call 1800-B2B-MARKET
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#c83c23] hover:bg-[#a92f19] px-5 py-2 text-xs font-extrabold text-white transition-all shadow-md"
                >
                  Submit RFQ to Suppliers
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
