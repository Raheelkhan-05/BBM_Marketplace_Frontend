// src/pages/SalesOrderBookPage.jsx: /sales/order-book  (the salesperson's own orders + "Punch order")
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { salesOrderBook } from "../utils/orderBookApi.js";
import OrderBookList from "../components/orderBook/OrderBookList.jsx";
import OrderBookSheet from "../components/orderBook/OrderBookSheet.jsx";

const plural = (n) => `${n} product${n === 1 ? "" : "s"}`;

// One short sentence about what happened to the customer's BBM prices, appended to the "Order punched" message.
function pricingNote(cp) {
    if (!cp) return "";
    if (cp.status === "done") {
        const a = cp.applied?.length || 0;
        if (a > 0) return ` BBM price set for ${cp.buyerName || "the customer"} on ${plural(a)}.`;
        if (cp.skipped?.length) return " Some BBM prices couldn't be set. Check the Customers page.";
        return "";
    }
    if (cp.status === "not_on_bbm") return " Prices saved for this GST number. They apply when the customer joins BBM.";
    if (cp.status === "failed") return " The BBM prices couldn't be set. Set them from the Customers page.";
    return "";
}

export default function SalesOrderBookPage() {
    const { token } = useAuth();
    const { say } = useOutletContext();
    const nav = useNavigate();
    const [sp, setSp] = useSearchParams();
    const [creating, setCreating] = useState(false);

    useEffect(() => { if (sp.get("new") === "1") { setCreating(true); setSp({}, { replace: true }); } }, [sp, setSp]);

    return (
        <div className="gd">
            <OrderBookList mode="sales" api={salesOrderBook} token={token} base="/sales/order-book"
                title="Order Book" subtitle="Orders you punch for your customers. Your team processes and ships them."
                action={<button type="button" className="st-btn pri" onClick={() => setCreating(true)}><Plus size={16} />Punch order</button>} />
            {creating && (
                <OrderBookSheet token={token} onClose={() => setCreating(false)}
                    onCreated={(o, cp) => { setCreating(false); say(`Order ${o.orderNo} punched.${pricingNote(cp)}`); nav(`/sales/order-book/${o.id}`); }} />
            )}
        </div>
    );
}