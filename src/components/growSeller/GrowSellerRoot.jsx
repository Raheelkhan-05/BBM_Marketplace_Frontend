// src/components/growSeller/GrowSellerRoot.jsx
// Mounts the app contexts the GROW seller shell needs (they normally live inside <Layout />).
import { NotificationsProvider } from "../../context/NotificationsContext.jsx";
import { ListingsProvider } from "../../context/ListingsContext.jsx";
import GrowSellerLayout from "./GrowSellerLayout.jsx";

export default function GrowSellerRoot() {
    return (
        <NotificationsProvider>
            <ListingsProvider>
                <GrowSellerLayout />
            </ListingsProvider>
        </NotificationsProvider>
    );
}