// components/catalog/BuySellChoiceSheet.jsx
//
// Shown the moment someone taps a product tile on /browse. Trading
// apps like Groww make "buy" and "sell" two equally-weighted, equally
// visible actions the instant you tap a holding — that's the model
// here: a brand item on this marketplace can be *bought* (go compare
// listed sellers) or *sold* (list your own price on it), and neither
// should feel like the "hidden" option. Buy keeps the existing
// navigation to the sellers page; Sell opens SellThisItemModal right
// here, so a seller never has to detour through a sellers list to
// list a product they already know.

import { motion } from "framer-motion";
import { X, ShoppingBag, Store, ChevronRight } from "lucide-react";
import { C, EASE } from "./tokens";

function ChoiceButton({ icon: Icon, tone, title, subtitle, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left transition-all duration-150 hover:shadow-[0_10px_24px_-14px_rgba(11,17,22,0.25)] active:scale-[0.98]"
            style={{ borderColor: `${tone}30`, background: `${tone}08` }}
        >
            <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: tone }}
            >
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-extrabold leading-tight" style={{ color: C.ink }}>{title}</p>
                <p className="mt-0.5 text-[12px] font-medium leading-snug" style={{ color: C.muted }}>{subtitle}</p>
            </div>
            <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                style={{ color: tone }}
            />
        </button>
    );
}

export default function BuySellChoiceSheet({ item, onClose, onBuy, onSell }) {
    if (!item) return null;
    const name = item.name || "Product";
    const priceLabel = item.lowest_price != null ? `From ₹${item.lowest_price}` : null;

    return (
        <motion.div
            className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[24px] sm:p-6"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto mb-3 h-1 w-9 rounded-full sm:hidden" style={{ background: C.hair }} />

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {item.brand_name && (
                            <p className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.secondary }}>
                                {item.brand_name}
                            </p>
                        )}
                        <h2 className="mt-0.5 truncate text-[17px] font-extrabold leading-tight" style={{ color: C.ink }}>{name}</h2>
                        {priceLabel && (
                            <p className="mt-1 text-[12px] font-bold" style={{ color: C.primary }}>{priceLabel}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]" aria-label="Close">
                        <X className="h-4 w-4" style={{ color: C.muted }} />
                    </button>
                </div>

                <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.muted }}>
                    What would you like to do?
                </p>

                <div className="mt-2.5 flex flex-col gap-2.5">
                    <ChoiceButton
                        icon={ShoppingBag}
                        tone={C.secondary}
                        title="Buy this product"
                        subtitle="Compare price, MOQ & lead time across listed sellers"
                        onClick={onBuy}
                    />
                    <ChoiceButton
                        icon={Store}
                        tone={C.primary}
                        title="Sell this product"
                        subtitle="Already approved — just add your price to start selling"
                        onClick={onSell}
                    />
                </div>
            </motion.div>
        </motion.div>
    );
}