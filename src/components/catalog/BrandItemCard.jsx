import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { C, EASE } from "./tokens";

export default function BrandItemCard({ item, idx, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(idx * 0.02, 0.24), ease: EASE }}
            whileTap={{ scale: 0.97 }}
            className="flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition-shadow duration-150 hover:shadow-[0_8px_24px_-10px_rgba(11,17,22,0.18)]"
            style={{ borderColor: C.hair }}
        >
            <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden" style={{ background: "#f3f4f6" }}>
                {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" draggable={false} />
                ) : (
                    <span className="text-[11px] font-bold" style={{ color: C.muted }}>No image</span>
                )}
            </span>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
                {item.brand_name && (
                    <p className="truncate text-[9.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: C.secondary }}>
                        {item.brand_name}
                    </p>
                )}
                <p className="line-clamp-2 text-[12px] font-bold leading-tight" style={{ color: C.ink }}>{item.name}</p>
                <div className="mt-auto flex items-center justify-between pt-1">
                    {item.lowest_price != null ? (
                        <span className="text-[12.5px] font-extrabold" style={{ color: C.primary }}>From ₹{item.lowest_price}</span>
                    ) : (
                        <span className="text-[11px] font-semibold" style={{ color: C.muted }}>No sellers yet</span>
                    )}
                    {item.seller_count > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: C.muted }}>
                            <Users className="h-2.5 w-2.5" /> {item.seller_count}
                        </span>
                    )}
                </div>
            </div>
        </motion.button>
    );
}