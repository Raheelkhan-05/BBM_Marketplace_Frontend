// src/components/team/chat/ParticipantsSheet.jsx
// Who is in this enquiry chat. The salesperson and admins can add teammates and remove people; anyone can leave.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, UserPlus } from "lucide-react";
import { fetchChatCandidates, addChatParticipant, removeChatParticipant } from "../../../utils/salesChatApi.js";
import { Avatar } from "./ChatBits.jsx";

const ROLE = { salesperson: "Salesperson", admin: "Admin", member: "Team member" };

export default function ParticipantsSheet({ token, threadId, people, meId, canManage, z = 1300, onClose, onChanged }) {
    const [cands, setCands] = useState(null);
    const [busy, setBusy] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!canManage) return undefined;
        let live = true;
        fetchChatCandidates(token, threadId).then((r) => { if (live) setCands(r.success ? r.candidates : []); });
        return () => { live = false; };
    }, [token, threadId, canManage, people.length]);

    useEffect(() => {
        const k = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", k);
        return () => document.removeEventListener("keydown", k);
    }, [onClose]);

    const add = async (c) => {
        setBusy(c.userId); setErr("");
        const r = await addChatParticipant(token, threadId, c.userId);
        setBusy("");
        if (!r.success) return setErr(r.message || "Couldn't add this person.");
        onChanged(r.participants);
    };
    const remove = async (p) => {
        setBusy(p.userId); setErr("");
        const r = await removeChatParticipant(token, threadId, p.userId);
        setBusy("");
        if (!r.success) return setErr(r.message || "Couldn't remove this person.");
        onChanged(r.participants);
        if (p.userId === meId) onClose();
    };

    return createPortal(
        <div className="st-ov" style={{ zIndex: z }} data-lenis-prevent onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="st-sheet" role="dialog" aria-modal="true" aria-label="People in this chat">
                <div className="st-sh-h">
                    <div><h2>People in this chat</h2><p>Everyone here sees the messages and gets a WhatsApp reminder if they miss one.</p></div>
                    <button type="button" className="st-ib" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="st-sh-b">
                    <ul className="sc-ppl">
                        {people.map((p) => (
                            <li key={p.userId}>
                                <Avatar name={p.name} id={p.userId} size={34} />
                                <span className="sc-ppl-t"><b>{p.name}{p.userId === meId ? " (you)" : ""}</b><small>{p.isOwner ? "Owner" : ROLE[p.role]}</small></span>
                                {p.role !== "salesperson" && (canManage || p.userId === meId) && (
                                    <button type="button" className="st-lnk" disabled={busy === p.userId} onClick={() => remove(p)}>
                                        {busy === p.userId ? "…" : p.userId === meId ? "Leave" : "Remove"}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    {canManage && (
                        <>
                            <p className="st-sec">Add a teammate</p>
                            {cands === null ? <div className="st-sk" />
                                : cands.length === 0 ? <p className="st-hint">Everyone on your team is already in this chat.</p>
                                    : (
                                        <ul className="sc-ppl">
                                            {cands.map((c) => (
                                                <li key={c.userId}>
                                                    <Avatar name={c.name} id={c.userId} size={34} />
                                                    <span className="sc-ppl-t"><b>{c.name}</b><small>{c.isOwner ? "Owner" : ROLE[c.role]}</small></span>
                                                    <button type="button" className="st-btn" disabled={busy === c.userId} onClick={() => add(c)}>
                                                        {busy === c.userId ? <Loader2 size={14} className="st-spin" /> : <UserPlus size={14} />}Add
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                        </>
                    )}
                    {err && <p className="st-err" role="alert" style={{ marginTop: 10 }}>{err}</p>}
                </div>
            </div>
        </div>,
        document.body,
    );
}