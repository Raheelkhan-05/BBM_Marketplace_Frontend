// src/components/home/SupplierCompareModal.jsx

import { X, ShieldCheck, Check, Star, ArrowRight } from "lucide-react";
import { supplierComparisonMatrix, recommendedSuppliers } from "../../../data/homeData";

export default function SupplierCompareModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-[#fdfeff] shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#006f83]/30 text-[#38BDF8] border border-[#006f83]/40">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Verified B2B Supplier Comparison Matrix
              </h3>
              <p className="text-xs text-slate-300">
                Direct benchmark of ISO audits, lead times, Net credit terms & batch test report compliance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-x-auto max-h-[80vh] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-4 bg-slate-50 w-1/4 font-extrabold text-slate-700 text-sm">
                  Evaluation Criteria
                </th>
                {recommendedSuppliers.map((s) => (
                  <th key={s.id} className="py-3 px-4 bg-white w-1/4 align-top">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-900 line-clamp-1">{s.name}</span>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-0.5">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {s.rating} ({s.reviews})
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{s.location}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplierComparisonMatrix.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-700 bg-slate-50">
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1 text-[#006f83] font-semibold">
                      <Check className="h-3.5 w-3.5 text-[#006f83] shrink-0" /> {row.supplierA}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {row.supplierB}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" /> {row.supplierC}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Action Row */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            {recommendedSuppliers.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="text-xs font-bold text-slate-800 block truncate mb-2">{s.name}</span>
                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-[#d2462b] hover:bg-[#b53820] py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Request Supplier RFQ <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
