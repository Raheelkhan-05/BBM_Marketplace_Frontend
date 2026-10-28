// src/pages/GrowOrderBookDetailPage.jsx: /grow/order-book/:id  (process -> ship -> complete)
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGrowSeller } from "../context/GrowSellerContext.js";
import { teamOrderBook } from "../utils/orderBookApi.js";
import OrderBookDetail from "../components/orderBook/OrderBookDetail.jsx";

export default function GrowOrderBookDetailPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const { say } = useGrowSeller();
    return (
        <div className="v">
            <OrderBookDetail mode="team" id={id} api={teamOrderBook} token={token} say={say} backTo="/grow/order-book" backLabel="Order Book" />
        </div>
    );
}