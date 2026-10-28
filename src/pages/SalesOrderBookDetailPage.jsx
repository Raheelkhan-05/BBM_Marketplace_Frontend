// src/pages/SalesOrderBookDetailPage.jsx: /sales/order-book/:id  (read-only, live)
import { useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { salesOrderBook } from "../utils/orderBookApi.js";
import OrderBookDetail from "../components/orderBook/OrderBookDetail.jsx";

export default function SalesOrderBookDetailPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const { say } = useOutletContext();
    return (
        <div className="gd">
            <OrderBookDetail mode="sales" id={id} api={salesOrderBook} token={token} say={say} backTo="/sales/order-book" backLabel="Order Book" />
        </div>
    );
}