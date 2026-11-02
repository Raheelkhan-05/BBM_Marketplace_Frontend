// Button + sheet to manage the people who are alerted when a new order is punched.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Truck, X, Trash2, Plus, MessageCircle, Mail } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { teamOrderBook } from "../../utils/orderBookApi.js";

const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D5DCE0", fontSize: 14, boxSizing: "border-box" };

const CSS = `
@keyframes dm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes dm-up { from { transform: translateY(32px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes dm-sh { to { background-position: -200% 0 } }
.dm-shade { animation: dm-fade .2s ease both }
.dm-sheet { animation: dm-up .28s cubic-bezier(.16,1,.3,1) both }
.dm-sk { height: 48px; border-radius: 10px; margin-top: 10px; background: linear-gradient(90deg,#F1F4F5 25%,#E6EBED 50%,#F1F4F5 75%); background-size: 200% 100%; animation: dm-sh 1.2s linear infinite }
@media (min-width: 640px) { .dm-shade { align-items: center !important } .dm-sheet { border-radius: 20px !important } }
@media (prefers-reduced-motion: reduce) { .dm-shade, .dm-sheet, .dm-sk { animation: none } }
`;

export default function DispatcherManager() {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadErr, setLoadErr] = useState("");
    const [max, setMax] = useState(10);
    const [form, setForm] = useState({ name: "", phone: "", email: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const fetched = useRef(false);

    const load = useCallback(async () => {
        setLoadErr("");
        const r = await teamOrderBook.dispatchers.list(token);
        if (r.success) { setItems(r.items || []); setMax(r.max || 10); setLoaded(true); }
        else setLoadErr(r.message || "Couldn't load dispatchers.");
    }, [token]);

    // Load once, the first time the dialog opens.
    useEffect(() => {
        if (!open || !token || fetched.current) return;
        fetched.current = true;
        load();
    }, [open, token, load]);

    // Scroll lock + Escape to close.
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
    }, [open]);

    const add = async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true); setErr("");
        const r = await teamOrderBook.dispatchers.add(token, form);
        setBusy(false);
        if (!r.success) { setErr(r.message || "Couldn't add the dispatcher."); return; }
        setItems((list) => [...list, r.item]);
        setForm({ name: "", phone: "", email: "" });
    };

    const toggle = async (d) => {
        setErr("");
        setItems((list) => list.map((x) => (x.id === d.id ? { ...x, active: !d.active } : x)));   // instant
        const r = await teamOrderBook.dispatchers.update(token, d.id, { active: !d.active });
        if (!r.success) {
            setItems((list) => list.map((x) => (x.id === d.id ? { ...x, active: d.active } : x)));  // roll back
            setErr(r.message || "Couldn't update.");
        }
    };

    const remove = async (d) => {
        if (!window.confirm(`Remove ${d.name}? They will no longer get new order alerts.`)) return;
        setErr("");
        const before = items;
        setItems((list) => list.filter((x) => x.id !== d.id));   // instant
        const r = await teamOrderBook.dispatchers.remove(token, d.id);
        if (!r.success) { setItems(before); setErr(r.message || "Couldn't remove."); }
    };

    const count = loaded ? items.length : 0;

    return (
        <>
            <style>{CSS}</style>
            <button type="button" onClick={() => setOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: "1px solid #D5DCE0", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <Truck size={16} />Dispatchers{count ? ` (${count})` : ""}
            </button>

            {open && createPortal(
                <div className="dm-shade" role="dialog" aria-modal="true" aria-label="Dispatchers" onClick={() => setOpen(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    <div className="dm-sheet" onClick={(e) => e.stopPropagation()}
                        style={{ background: "#fff", width: "100%", maxWidth: 520, maxHeight: "90dvh", overflowY: "auto", overscrollBehavior: "contain", borderRadius: "20px 20px 0 0", padding: 20, color: "#08222B" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <h3 style={{ margin: 0, fontSize: 18 }}>Dispatchers</h3>
                            <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ border: 0, background: "none", cursor: "pointer" }}><X size={20} /></button>
                        </div>

                        {!loaded && !loadErr && (<><div className="dm-sk" /><div className="dm-sk" /></>)}
                        {loadErr && (
                            <p style={{ fontSize: 13, color: "#b91c1c", marginTop: 12 }}>
                                {loadErr} <button type="button" onClick={load} style={{ border: 0, background: "none", color: "#6D3FD1", fontWeight: 700, cursor: "pointer", padding: 0 }}>Try again</button>
                            </p>
                        )}
                        {loaded && items.length === 0 && <p style={{ fontSize: 13, color: "#8A979D", marginTop: 12 }}>No dispatchers yet.</p>}

                        {items.map((d) => (
                            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #EEF1F2", opacity: d.active ? 1 : 0.55, transition: "opacity .2s" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <b style={{ fontSize: 14 }}>{d.name}</b>
                                    <div style={{ fontSize: 12.5, color: "#5B6B72", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                                        {d.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MessageCircle size={13} />+91 {d.phone}</span>}
                                        {d.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, wordBreak: "break-all" }}><Mail size={13} />{d.email}</span>}
                                    </div>
                                </div>
                                <button type="button" onClick={() => toggle(d)}
                                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, border: "1px solid #D5DCE0", background: d.active ? "#E8F6EF" : "#F4F6F7", color: d.active ? "#15803d" : "#5B6B72", cursor: "pointer" }}>
                                    {d.active ? "Active" : "Paused"}
                                </button>
                                <button type="button" aria-label={`Remove ${d.name}`} onClick={() => remove(d)} style={{ border: 0, background: "none", color: "#b91c1c", cursor: "pointer" }}><Trash2 size={17} /></button>
                            </div>
                        ))}

                        {loaded && items.length < max && (
                            <form onSubmit={add} style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #EEF1F2", display: "grid", gap: 10 }}>
                                <b style={{ fontSize: 14 }}>Add a dispatcher</b>
                                <input style={inp} placeholder="Name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                <input style={inp} placeholder="WhatsApp number (10 digits)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                <input style={inp} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                <small style={{ color: "#8A979D" }}>Add a WhatsApp number, an email, or both.</small>
                                {err && <small style={{ color: "#b91c1c" }}>{err}</small>}
                                <button type="submit" disabled={busy}
                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: 0, background: "#6D3FD1", color: "#fff", fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                                    <Plus size={16} />{busy ? "Adding…" : "Add dispatcher"}
                                </button>
                            </form>
                        )}
                        {loaded && items.length >= max && <p style={{ fontSize: 12.5, color: "#8A979D" }}>You've reached the limit of {max} dispatchers.</p>}
                        {loaded && items.length >= max && err && <small style={{ color: "#b91c1c" }}>{err}</small>}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}