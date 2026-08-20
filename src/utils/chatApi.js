// utils/chatApi.js
import { API_BASE } from "./api"; // reuse whatever base URL / fetch wrapper you already have

const authed = (token) => ({ Authorization: `Bearer ${token}` });

export async function fetchConversations(token) {
    const res = await fetch(`${API_BASE}/chat/conversations`, { headers: authed(token) });
    return res.json();
}
export async function getOrCreateDirectConversation(token, otherUserId) {
    const res = await fetch(`${API_BASE}/chat/conversations/direct`, {
        method: "POST", headers: { ...authed(token), "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
    });
    return res.json();
}
export async function fetchMessages(token, conversationId, before) {
    const url = new URL(`${API_BASE}/chat/conversations/${conversationId}/messages`);
    if (before) url.searchParams.set("before", before);
    const res = await fetch(url, { headers: authed(token) });
    return res.json();
}
export async function sendChatMessage(token, conversationId, body, attachmentUrl) {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
        method: "POST", headers: { ...authed(token), "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachmentUrl }),
    });
    return res.json();
}
export async function markConversationDelivered(token, conversationId) {
    return fetch(`${API_BASE}/chat/conversations/${conversationId}/delivered`, { method: "POST", headers: authed(token) }).then((r) => r.json());
}
export async function markConversationRead(token, conversationId) {
    return fetch(`${API_BASE}/chat/conversations/${conversationId}/read`, { method: "POST", headers: authed(token) }).then((r) => r.json());
}
export async function searchChatUsers(token, q) {
    const res = await fetch(`${API_BASE}/chat/users/search?q=${encodeURIComponent(q)}`, { headers: authed(token) });
    return res.json();
}

export async function deleteChatMessage(token, conversationId, messageId, scope) {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages/${messageId}`, {
        method: "DELETE", headers: { ...authed(token), "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
    });
    return res.json();
}