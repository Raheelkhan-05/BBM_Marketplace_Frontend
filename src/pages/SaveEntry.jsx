// Gate for /save: visitors see the brochure, logged-in users see their purchase price list.
import { useAuth } from "../context/AuthContext.jsx";
import SavePage from "./SavePage.jsx";
import SaveHomePage from "./SaveHomePage.jsx";
import "../components/save/save-home.css";

export default function SaveEntry() {
    const { isLoggedIn, initializing } = useAuth();
    if (initializing) {
        return (
            <div className="sh-w" aria-busy="true">
                <div className="sh-sk line" style={{ marginTop: 32, width: "50%" }} />
                <div className="sh-sk" style={{ marginTop: 18 }} />
                <div className="sh-sk" style={{ marginTop: 14 }} />
            </div>
        );
    }
    return isLoggedIn ? <SaveHomePage /> : <SavePage />;
}