// src/pages/SalesOrderBookPage.jsx: /sales/order-book  (the salesperson's own orders + "Punch order")
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { salesOrderBook } from "../utils/orderBookApi.js";
import OrderBookList from "../components/orderBook/OrderBookList.jsx";
import OrderBookSheet from "../components/orderBook/OrderBookSheet.jsx";

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
                    onCreated={(o) => { setCreating(false); say(`Order ${o.orderNo} punched.`); nav(`/sales/order-book/${o.id}`); }} />
            )}
        </div>
    );
}