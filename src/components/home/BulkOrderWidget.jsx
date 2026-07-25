// src/components/home/BulkOrderWidget.jsx

import { useState } from "react";
import { Plus, Trash2, ShoppingCart, CheckCircle, FileSpreadsheet } from "lucide-react";

export default function BulkOrderWidget() {
  const [rows, setRows] = useState([
    { id: 1, sku: "SKF-6205-2RSH", name: "SKF Deep Groove Bearing 6205", qty: 100, price: 128 },
    { id: 2, sku: "SHL-RIM-15W40", name: "Shell Rimula R4 X 15W-40 Drum", qty: 2, price: 37380 },
    { id: 3, sku: "VCI-ROL-120GSM", name: "VCI Anti-Rust Paper Roll", qty: 10, price: 1180 },
  ]);

  const [added, setAdded] = useState(false);

  const addRow = () => {
    setRows([
      ...rows,
      { id: Date.now(), sku: "", name: "", qty: 1, price: 0 },
    ]);
  };

  const removeRow = (id) => {
    if (rows.length === 1) return;
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    setRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        if (field === "sku") {
          let name = r.name;
          let price = r.price;
          const uSku = value.toUpperCase();
          if (uSku.includes("6205") || uSku.includes("BEARING")) {
            name = "SKF Deep Groove Bearing 6205";
            price = 128;
          } else if (uSku.includes("SHELL") || uSku.includes("OIL")) {
            name = "Shell Rimula R4 X 15W-40 Drum";
            price = 37380;
          } else if (uSku.includes("VCI")) {
            name = "VCI Anti-Rust Paper Roll";
            price = 1180;
          } else if (uSku.includes("NTN")) {
            name = "NTN Tapered Roller Bearing 32211";
            price = 315;
          }
          return { ...r, sku: value, name, price };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const totalEstimate = rows.reduce(
    (sum, r) => sum + (Number(r.price) || 0) * (Number(r.qty) || 0),
    0
  );

  const handleAddToCart = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="amz-card p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#005b6d]/10 text-[#005b6d]">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Multi-SKU Rapid Order Desk
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Paste part numbers or SKUs directly to calculate volume estimates & checkout in bulk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Row
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[550px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-2.5 px-3">Part # / SKU</th>
              <th className="py-2.5 px-3">Item Description</th>
              <th className="py-2.5 px-3 w-28">Quantity</th>
              <th className="py-2.5 px-3 text-right">Est. Unit Price</th>
              <th className="py-2.5 px-3 text-right">Subtotal</th>
              <th className="py-2.5 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const subtotal = (Number(row.price) || 0) * (Number(row.qty) || 0);
              return (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      placeholder="e.g. SKF-6205"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, "sku", e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-xs font-mono font-semibold uppercase text-slate-800 focus:border-[#005b6d] focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-700">
                    <input
                      type="text"
                      placeholder="Auto-matched product description"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, "name", e.target.value)}
                      className="w-full bg-transparent px-1 py-1 text-xs text-slate-700 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="1"
                      value={row.qty}
                      onChange={(e) => updateRow(row.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 focus:border-[#005b6d] focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-600">
                    ₹{Number(row.price).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 px-3 text-right font-extrabold tabular-nums text-slate-900">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer totals & actions */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-500 font-medium">
          Total SKUs: <span className="font-bold text-slate-800">{rows.length}</span> &middot; GST Extra as applicable
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-semibold block">Est. Bulk Total</span>
            <span className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
              ₹{totalEstimate.toLocaleString("en-IN")}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-extrabold text-white transition-all shadow-md ${
              added
                ? "bg-emerald-600 shadow-emerald-600/20"
                : "bg-[#c83c23] hover:bg-[#a92f19] shadow-rose-600/20"
            }`}
          >
            {added ? (
              <>
                <CheckCircle className="h-4 w-4" /> Added to Cart
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> Add All to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
