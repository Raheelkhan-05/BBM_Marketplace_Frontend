import { Outlet } from "react-router-dom";
import { NotificationsProvider } from "../../context/NotificationsContext.jsx";
import { CartProvider } from "../../context/CartContext.jsx";
import { ChatProvider } from "../../context/ChatContext.jsx";
import { ListingsProvider } from "../../context/ListingsContext.jsx";
import { HelpRequestProvider } from "../../context/HelpRequestContext.jsx";

// One set of providers for the whole /grow/* tree, so moving between
// /grow, /grow/details and /grow/enquiries never remounts or refetches them.
export default function GrowProviders() {
    return (
        <NotificationsProvider><CartProvider><ChatProvider><ListingsProvider><HelpRequestProvider>
            <Outlet />
        </HelpRequestProvider></ListingsProvider></ChatProvider></CartProvider></NotificationsProvider>
    );
}