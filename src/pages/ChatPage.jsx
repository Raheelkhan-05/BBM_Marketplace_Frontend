// pages/ChatPage.jsx
//
// Two-pane on desktop, single-pane router-driven on mobile: /chat shows
// the list, /chat/:conversationId shows the thread. Same shell pattern
// as Layout.jsx — nothing new architecturally.
import { useParams, useNavigate } from "react-router-dom";
import ConversationList from "../components/chat/ConversationList.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import { MessageSquare } from "lucide-react";

const C = { ink: "#0B1116", muted: "#667077", hair: "rgba(11,17,22,0.09)" };

export default function ChatPage() {
    const { conversationId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="mx-auto flex h-[calc(100dvh-56px)] max-w-7xl overflow-hidden sm:h-[calc(100dvh-56px)]">
            <div className={`w-full shrink-0 border-r sm:w-[340px] sm:block ${conversationId ? "hidden" : "block"}`} style={{ borderColor: C.hair }}>
                <ConversationList activeId={conversationId} onSelect={(id) => navigate(`/chat/${id}`)} />
            </div>

            <div className={`min-w-0 flex-1 ${conversationId ? "block" : "hidden sm:block"}`}>
                {conversationId ? (
                    <ChatWindow key={conversationId} conversationId={conversationId} onBack={() => navigate("/chat")} />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <MessageSquare className="h-8 w-8" style={{ color: C.hair }} />
                        <p className="text-[13.5px] font-bold" style={{ color: C.ink }}>Select a conversation</p>
                        <p className="text-[12px] font-medium" style={{ color: C.muted }}>Or start a new one from the list.</p>
                    </div>
                )}
            </div>
        </div>
    );
}