// src/pages/GrowOrderBookPage.jsx: /grow/order-book  (every order punched by the company's salespeople)
import { useAuth } from "../context/AuthContext.jsx";
import { teamOrderBook } from "../utils/orderBookApi.js";
import OrderBookList from "../components/orderBook/OrderBookList.jsx";

export default function GrowOrderBookPage() {
    const { token } = useAuth();
    return (
        <div className="v">
            <OrderBookList mode="team" api={teamOrderBook} token={token} base="/grow/order-book"
                title="Order Book" subtitle="Orders your salespeople punch for customers. Process, ship and complete them here." />
        </div>
    );
}