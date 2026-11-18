// src/pages/GrowStorePage.jsx — "My shop" in the new GROW UI (route: /grow/shop).
// Same data and actions as SellerStorePage: fetchSellerDashboard, updateSellerProfile,
// fetchSellerBankDetails / saveSellerBankDetails, uploadSellerFile, lookupPincode.
//   1. Shop card          – logo, name, share + view shop
//   2. GST registration   – read-only            (collapsed by default)
//   3. Contact            – contact person + logo (collapsed by default)
//   4. Operations         – working days, transport, order hours, dispatch pincode (collapsed by default)
//   5. Bank details                              (collapsed by default)
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
    fetchSellerDashboard, updateSellerProfile,
    fetchSellerBankDetails, saveSellerBankDetails, uploadSellerFile,
} from "../utils/api.js";
import { lookupPincode } from "../utils/sellerListingApi.js";
import { WEEKDAYS } from "../components/seller/fieldConfigs.js";
import { TRANSPORT_OPTIONS } from "../../shared/transportOptions.js";
import Ic from "../components/growSeller/Ic.jsx";
import { Empty } from "../components/growSeller/ui.jsx";
import { useGrowSeller } from "../context/GrowSellerContext.js";
import "../components/growSeller/grow-store.css";
import { ShopHeaderView, SmartImg } from "../components/home/ShopHeader.jsx";
import {
    STORE_TEMPLATES, STORE_ACCENTS, HIGHLIGHT_IDEAS, SELL_IDEAS,
    MAX_TAGLINE, MAX_ABOUT, MAX_HIGHLIGHTS, MAX_HIGHLIGHT_LEN, MAX_SELLS, MAX_SELL_LEN, MAX_POINTS, MAX_POINT_LEN,
    sanitizeTheme, readableOn,
} from "../utils/storeTheme.js";


const ICON = {
    gst: { d: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4", s: { background: "#E6F0FB", color: "#0F63B5" } },
    contact: { d: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6", s: { background: "#FDE9E2", color: "#C23A0B" } },
    ops: { d: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4", s: { background: "#E3F5EC", color: "#12794A" } },
    bank: { d: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18", s: { background: "#FFF4C2", color: "#8A6500" } },
    look: { d: "M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.9-.6-1.2-.6-2 0-.9.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4c0-4.4-4-9-9-9zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01", s: { background: "#F1E9FB", color: "#6B3FA0" } },
};

const hhmm = (t) => String(t || "").slice(0, 5);
const arr = (v) => (Array.isArray(v) ? v : []);

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch { return false; }
}

/* ---------- small pieces ---------- */

// Collapsible card used by every section. Starts collapsed. The body stays
// mounted (just hidden) so unsaved edits are kept when the section is
// closed, and data a section loads on mount (bank details) is ready on open.
function Collapsible({ id, title, sub, right, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    const ic = ICON[id];
    const bodyId = `st-body-${id}`;
    return (
        <section className="card">
            <button type="button" className="st-tog" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
                <span className="st-ico" style={ic.s}><svg className="ic" viewBox="0 0 24 24"><path d={ic.d} /></svg></span>
                <span className="st-h" style={{ flex: 1, margin: 0, display: "block" }}>
                    <b>{title}</b><small>{sub}</small>
                </span>
                {right}
                <Ic n="chev" />
            </button>
            <div id={bodyId} hidden={!open} style={{ marginTop: 12 }}>
                {children}
            </div>
        </section>
    );
}

function SaveRow({ dirty, saving, error, onSave, label = "Save changes", disabled }) {
    return (
        <div className="st-save">
            <button type="button" className="bt go sm" disabled={!dirty || saving || disabled} onClick={onSave}>
                {saving ? <><Ic n="spin" />Saving…</> : label}
            </button>
            {error && <span className="st-err" role="alert">{error}</span>}
        </div>
    );
}

function Chips({ value, onChange, options }) {
    return (
        <div className="st-chips">
            {options.map(([k, t]) => {
                const on = value.includes(k);
                return (
                    <button key={k} type="button" aria-pressed={on}
                        onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>{t}</button>
                );
            })}
        </div>
    );
}

/* ---------- sections ---------- */
function ShopCard({ seller }) {
    const { say } = useGrowSeller();
    const slug = seller.shop_slug;
    const link = slug ? `${window.location.origin}/seller/${encodeURIComponent(slug)}` : "";
    const letter = (seller.display_name || "S").trim()[0]?.toUpperCase();

    const share = async () => {
        // Start the copy and the share in the same tick: Safari only allows the share sheet right after a tap.
        const copying = copyText(link);
        if (typeof navigator !== "undefined" && navigator.share) {
            try { await navigator.share({ title: seller.display_name || "Our shop", text: "Browse our products", url: link }); } catch { /* dismissed */ }
        }
        if (await copying) say("Shop link copied.");
    };

    return (
        <div className="card">
            <div className="st-hero">
                <div className="st-logo"><SmartImg src={seller.logo_url} width={160} alt="" fallback={letter} /></div>
                <div className="st-who">
                    <h2>{seller.display_name || "Your shop"}</h2>
                    {seller.status === "approved" && <span className="stt approved">Live</span>}
                </div>
            </div>
            {link ? (
                <>
                    <div className="st-link">{link}</div>
                    <div className="st-acts">
                        <a className="bt sm" href={link} target="_blank" rel="noreferrer">View my shop</a>
                        <button type="button" className="bt go sm" onClick={share}><Ic n="share" />Share</button>
                    </div>
                </>
            ) : <p className="sub2">Your shop link will appear here once your shop is set up.</p>}
        </div>
    );
}

function GstSection({ business }) {
    const b = business || {};
    const nature = Array.isArray(b.nature_of_business) ? b.nature_of_business.join(", ") : b.nature_of_business;
    const rows = [
        ["Legal name", b.legal_name], ["Trade name", b.trade_name], ["GSTIN", b.gstin],
        ["GSTIN status", b.gstin_status ?? b.status], ["Constitution", b.constitution],
        ["Taxpayer type", b.taxpayer_type], ["Registration date", b.gst_registration_date ?? b.registration_date],
        ["Registered address", b.registered_address ?? b.address], ["District", b.district],
        ["State", b.state], ["Pincode", b.pincode], ["PAN", b.pan], ["Nature of business", nature],
    ].filter(([, v]) => v);
    return (
        <Collapsible id="gst" title="GST registration" sub="Taken from your GST record" right={<span className="st-pill">Read only</span>}>
            {rows.length
                ? rows.map(([k, v]) => <div className="st-row" key={k}><small>{k}</small><b>{v}</b></div>)
                : <p className="sub2">No GST details on file.</p>}
        </Collapsible>
    );
}

function ContactSection({ seller, email, token, onSaved }) {
    const { say } = useGrowSeller();
    const initial = seller.contact_person || "";
    const initialLogo = seller.logo_url || "";
    const [person, setPerson] = useState(initial);
    const [logo, setLogo] = useState(initialLogo);
    const [logoBusy, setLogoBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const dirty = (person.trim() !== initial || logo !== initialLogo) && !logoBusy;
    const letter = (seller.display_name || "S").trim()[0]?.toUpperCase();

    const pickLogo = async (file) => {
        if (!file) return;
        if (!file.type?.startsWith("image/")) return setError("Please choose an image file.");
        setError(null);
        setLogoBusy(true);
        try {
            const r = await uploadSellerFile(token, file, "logo");
            if (r?.success) setLogo(r.url); else setError(r?.message || "Logo upload failed. Try again.");
        } catch { setError("Logo upload failed. Try again."); }
        finally { setLogoBusy(false); }
    };

    const save = async () => {
        setError(null);
        if (person.trim().length < 2) return setError("Enter the contact person's name.");
        setSaving(true);
        let res = null;
        try { res = await updateSellerProfile(token, { contact_person: person.trim(), logo_url: logo || null }); } catch { res = null; }
        setSaving(false);
        if (!res?.success) return setError(res?.message || "Couldn't save changes.");
        say(res.staged ? "Saved. Changes will go live after review." : "Contact details saved.");
        onSaved();
    };

    return (
        <Collapsible id="contact" title="Contact" sub="Who buyers and our team reach out to">
            <div className="f">
                <label htmlFor="st-person">Contact person</label>
                <div className="inp"><input id="st-person" value={person} autoComplete="name" placeholder="Full name" onChange={(e) => { setPerson(e.target.value); setError(null); }} /></div>
            </div>
            <div className="st-two">
                <div className="f"><label>Contact number</label>
                    <div className="inp ro"><input readOnly value={seller.whatsapp_number ? `+91 ${seller.whatsapp_number}` : ""} /></div></div>
                <div className="f"><label>Email</label>
                    <div className="inp ro"><input readOnly value={email || ""} /></div></div>
            </div>
            <div className="f">
                <label>Company logo (optional)</label>
                <div className="st-lg">
                    <div className="st-logo"><SmartImg src={logo} width={160} alt="Company logo" fallback={letter} /></div>
                    <div className="st-btns">
                        <label className={`st-up${logoBusy ? " off" : ""}`}>
                            {logoBusy
                                ? <><Ic n="spin" />Uploading…</>
                                : <>
                                    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                                    {logo ? "Replace logo" : "Add logo"}
                                </>}
                            <input type="file" accept="image/*" hidden disabled={logoBusy}
                                onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {logo && !logoBusy && <button type="button" className="st-rm" onClick={() => setLogo("")}>Remove</button>}
                    </div>
                </div>
            </div>
            <SaveRow dirty={dirty} saving={saving} error={error} onSave={save} />
        </Collapsible>
    );
}

function OperationsSection({ seller, token, onSaved }) {
    const { say } = useGrowSeller();
    const init = () => ({
        working_days: arr(seller.working_days),
        transport_options: arr(seller.transport_options),
        order_acceptance_start: hhmm(seller.order_acceptance_start),
        order_acceptance_end: hhmm(seller.order_acceptance_end),
        dispatch_pincode: seller.dispatch_pincode || "",
        dispatch_district: seller.dispatch_district || "",
        dispatch_state: seller.dispatch_state || "",
    });
    const [f, setF] = useState(init);
    const [base, setBase] = useState(init);
    const [pin, setPin] = useState(null); // null | checking | error
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const dirty = JSON.stringify(f) !== JSON.stringify(base);
    const set = (patch) => { setF((p) => ({ ...p, ...patch })); setError(null); };

    useEffect(() => { // resolve district/state whenever a complete pincode has none
        const p = f.dispatch_pincode;
        if (!/^\d{6}$/.test(p) || (f.dispatch_district && f.dispatch_state)) return undefined;
        let live = true;
        setPin("checking");
        lookupPincode(p).then((r) => {
            if (!live) return;
            if (r?.success) { setF((x) => (x.dispatch_pincode === p ? { ...x, dispatch_district: r.district, dispatch_state: r.state } : x)); setPin(null); }
            else setPin("error");
        }).catch(() => live && setPin("error"));
        return () => { live = false; };
    }, [f.dispatch_pincode, f.dispatch_district, f.dispatch_state]);

    const valid = f.working_days.length > 0 && f.transport_options.length > 0
        && !!f.order_acceptance_start && !!f.order_acceptance_end && /^\d{6}$/.test(f.dispatch_pincode);

    const save = async () => {
        setError(null);
        if (!valid) return setError("Choose working days, transport, order hours and a 6-digit pincode.");
        setSaving(true);
        let res = null;
        try { res = await updateSellerProfile(token, f); } catch { res = null; }
        setSaving(false);
        if (!res?.success) return setError(res?.message || "Couldn't save changes.");
        setBase(f);
        say(res.staged ? "Saved. Changes will go live after review." : "Operations saved.");
        onSaved();
    };

    const where = f.dispatch_district && f.dispatch_state ? `${f.dispatch_district}, ${f.dispatch_state}` : "";

    return (
        <Collapsible id="ops" title="Operations" sub="Working days, transport and dispatch">
            <div className="f">
                <label>Working days</label>
                <Chips value={f.working_days} onChange={(v) => set({ working_days: WEEKDAYS.filter((d) => v.includes(d)) })}
                    options={WEEKDAYS.map((d) => [d, d.slice(0, 3)])} />
            </div>
            <div className="f">
                <label>Transport channels you can service</label>
                <Chips value={f.transport_options} onChange={(v) => set({ transport_options: v })}
                    options={TRANSPORT_OPTIONS.map((t) => [t.key, t.label])} />
                <p className="st-cap">Buyers can only request the methods you select here.</p>
            </div>
            <div className="st-two">
                <div className="f"><label htmlFor="st-from">Orders from</label>
                    <div className="inp"><input id="st-from" type="time" value={f.order_acceptance_start} onChange={(e) => set({ order_acceptance_start: e.target.value })} /></div></div>
                <div className="f"><label htmlFor="st-until">Orders until</label>
                    <div className="inp"><input id="st-until" type="time" value={f.order_acceptance_end} onChange={(e) => set({ order_acceptance_end: e.target.value })} /></div></div>
            </div>
            <div className="f">
                <label htmlFor="st-pin">Dispatch pincode</label>
                <div className="inp">
                    <input id="st-pin" inputMode="numeric" maxLength={6} placeholder="6-digit pincode" autoComplete="postal-code"
                        value={f.dispatch_pincode}
                        onChange={(e) => { setPin(null); set({ dispatch_pincode: e.target.value.replace(/\D/g, "").slice(0, 6), dispatch_district: "", dispatch_state: "" }); }} />
                </div>
                {pin === "checking" && <p className="st-cap">Checking…</p>}
                {pin === "error" && <p className="st-cap bad">Couldn't verify this pincode. Check it and try again.</p>}
                {!pin && where && <p className="st-cap ok">Dispatching from {where}</p>}
            </div>
            <SaveRow dirty={dirty} saving={saving} error={error} onSave={save} disabled={!valid} />
        </Collapsible>
    );
}

function BankSection({ token }) {
    const { say } = useGrowSeller();
    const [f, setF] = useState({ account_number: "", ifsc_code: "" });
    const [base, setBase] = useState(f);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const dirty = f.account_number !== base.account_number || f.ifsc_code !== base.ifsc_code;
    const valid = /^\d{9,18}$/.test(f.account_number) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc_code);

    useEffect(() => {
        let live = true;
        Promise.resolve(fetchSellerBankDetails(token)).then((res) => {
            if (!live) return;
            if (res?.success && res.bank) {
                const b = { account_number: res.bank.account_number || "", ifsc_code: res.bank.ifsc_code || "" };
                setF(b); setBase(b);
            }
            setLoaded(true);
        }).catch(() => live && setLoaded(true));
        return () => { live = false; };
    }, [token]);

    const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setError(null); };

    const save = async () => {
        setError(null);
        if (!valid) return setError("Enter a 9 to 18 digit account number and a valid IFSC code.");
        setSaving(true);
        let res = null;
        try { res = await saveSellerBankDetails(token, { account_number: f.account_number, ifsc_code: f.ifsc_code }); } catch { res = null; }
        setSaving(false);
        if (!res?.success) return setError(res?.message || "Couldn't save bank details.");
        setBase(f);
        say("Bank details saved.");
    };

    return (
        <Collapsible id="bank" title="Bank details" sub="Where your order payouts are sent">
            {!loaded ? <div className="sk line" style={{ marginTop: 6 }} /> : (
                <>
                    <div className="f"><label htmlFor="st-acc">Account number</label>
                        <div className="inp"><input id="st-acc" inputMode="numeric" maxLength={18} autoComplete="off" placeholder="9 to 18 digits"
                            value={f.account_number} onChange={(e) => set("account_number", e.target.value.replace(/\D/g, ""))} /></div></div>
                    <div className="f"><label htmlFor="st-ifsc">IFSC code</label>
                        <div className="inp"><input id="st-ifsc" maxLength={11} autoComplete="off" placeholder="e.g. ABCD0123456"
                            value={f.ifsc_code} onChange={(e) => set("ifsc_code", e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))} /></div>
                        <p className="st-cap">Used only to send your order payouts.</p></div>
                    <SaveRow dirty={dirty} saving={saving} error={error} onSave={save} label="Save bank details" disabled={!valid} />
                </>
            )}
        </Collapsible>
    );
}

const COVER_UPLOAD_KIND = "logo"; // change to "cover" if your upload endpoint supports a separate kind

function ListEditor({ label, hint, items, onChange, max, maxLen, placeholder, ideas = [], rows = false }) {
    const [text, setText] = useState("");
    const full = items.length >= max;

    const add = (raw) => {
        const t = String(raw).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLen);
        if (!t || full) return;
        if (!items.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
        setText("");
    };
    const remove = (i) => onChange(items.filter((_, k) => k !== i));
    const onKey = (e) => {
        if (e.key === "Enter" || (!rows && e.key === ",")) { e.preventDefault(); add(text); }
    };
    const unused = ideas.filter((i) => !items.some((v) => v.toLowerCase() === i.toLowerCase()));

    return (
        <div className="f">
            <label>{label} <span className="le-n">· {items.length}/{max}</span></label>

            {items.length > 0 && (
                <div className={`le-list${rows ? " rows" : ""}`}>
                    {items.map((t, i) => (
                        <div key={t} className="le-item">
                            <span>{t}</span>
                            <button type="button" className="le-x" aria-label={`Remove ${t}`} onClick={() => remove(i)}>×</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="le-add">
                <div className="inp">
                    <input value={text} maxLength={maxLen} disabled={full} placeholder={full ? "Limit reached" : placeholder}
                        onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
                </div>
                <button type="button" className="bt sm" disabled={full || !text.trim()} onClick={() => add(text)}>Add</button>
            </div>

            {hint && <p className="st-cap">{hint}</p>}

            {!full && unused.length > 0 && (
                <div className="le-ideas">
                    <small>Need ideas?</small>
                    {unused.map((i) => <button key={i} type="button" onClick={() => add(i)}>+ {i}</button>)}
                </div>
            )}
        </div>
    );
}

function LayoutThumb({ id, accent }) {
    const deep = `color-mix(in srgb, ${accent} 50%, #000)`;
    const bar = (w, c = "#0B1116", o = 0.18) => <i style={{ display: "block", height: 3, width: w, borderRadius: 2, background: c, opacity: o }} />;
    const box = { height: 58, borderRadius: 10, overflow: "hidden", position: "relative", border: "1px solid rgba(11,17,22,0.1)", background: "#fff" };
    const sq = (c, s = 16) => <b style={{ width: s, height: s, borderRadius: 5, background: c, flex: "none" }} />;
    const ring = (c) => (
        <span aria-hidden style={{ position: "absolute", right: -14, top: -14, width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${c}` }} />
    );
    if (id === "solid") {
        return (
            <div style={{ ...box, background: `linear-gradient(135deg, ${accent}, ${deep})`, border: "none", padding: 8, display: "flex", alignItems: "flex-end", gap: 6 }}>
                {ring("rgba(255,255,255,0.3)")}
                {sq("#fff", 20)}<div style={{ display: "grid", gap: 4, flex: 1 }}>{bar("70%", "#fff", 0.9)}{bar("45%", "#fff", 0.5)}</div>
            </div>
        );
    }
    if (id === "cover") {
        return (
            <div style={box}>
                <div style={{ height: 26, background: `linear-gradient(135deg, ${accent}, ${deep})`, position: "relative" }}>{ring("rgba(255,255,255,0.3)")}</div>
                <div style={{ display: "flex", gap: 6, padding: "0 8px", marginTop: -9, alignItems: "flex-end" }}>
                    {sq("#fff", 20)}<div style={{ paddingBottom: 3 }}>{bar(34, "#0B1116", 0.5)}</div>
                </div>
            </div>
        );
    }
    if (id === "compact") {
        return (
            <div style={{ ...box, background: `color-mix(in srgb, ${accent} 8%, #fff)`, display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
                <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
                {sq(accent, 18)}<div style={{ display: "grid", gap: 4, flex: 1 }}>{bar("60%", "#0B1116", 0.5)}{bar("35%")}</div>
            </div>
        );
    }
    return (
        <div style={{ ...box, padding: 8, display: "grid", gap: 6 }}>
            <span aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: accent }} />
            {ring(`color-mix(in srgb, ${accent} 30%, #fff)`)}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                {sq(`color-mix(in srgb, ${accent} 18%, #fff)`, 18)}
                <div style={{ display: "grid", gap: 4, flex: 1 }}>{bar(24, accent, 0.8)}{bar("60%", "#0B1116", 0.5)}</div>
            </div>
            {bar("85%")}
        </div>
    );
}

function AppearanceSection({ seller, token, onSaved }) {
    const { say } = useGrowSeller();
    const initial = sanitizeTheme(seller.store_theme);
    const [draft, setDraft] = useState(initial);
    const [base, setBase] = useState(initial);
    const [coverBusy, setCoverBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    // const [device, setDevice] = useState("full");

    const clean = sanitizeTheme(draft);
    const dirty = JSON.stringify(clean) !== JSON.stringify(base) && !coverBusy;
    const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setError(null); };

    const pickCover = async (file) => {
        if (!file) return;
        if (!file.type?.startsWith("image/")) return setError("Please choose an image file.");
        setError(null);
        setCoverBusy(true);
        try {
            const r = await uploadSellerFile(token, file, COVER_UPLOAD_KIND);
            if (r?.success) set({ coverUrl: r.url }); else setError(r?.message || "Upload failed. Try again.");
        } catch { setError("Upload failed. Try again."); }
        finally { setCoverBusy(false); }
    };

    const save = async () => {
        setError(null);
        setSaving(true);
        let res = null;
        try { res = await updateSellerProfile(token, { store_theme: clean }); } catch { res = null; }
        setSaving(false);
        if (!res?.success) return setError(res?.message || "Couldn't save your store look.");
        setBase(clean);
        say(res.staged ? "Saved. Changes will go live after review." : "Store look saved.");
        onSaved();
    };

    const previewShop = {
        display_name: seller.display_name || "Your shop",
        shop_slug: seller.shop_slug,
        logo_url: seller.logo_url,
        city: seller.city || seller.dispatch_district,
        state: seller.state || seller.dispatch_state,
        status: seller.status,
        store_theme: clean,
    };

    return (
        <Collapsible id="look" title="Store look" sub="How your shop introduces itself to buyers">
            <div className="f">
                <label>Live preview</label>
                <div className="sl-frame">
                    <ShopHeaderView shop={previewShop} defaultOpen />
                </div>
                <p className="st-cap">This is how buyers see your store header. Details open under “About this store”.</p>
            </div>

            <div className="f">
                <label>Layout</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {STORE_TEMPLATES.map((t) => {
                        const on = clean.template === t.id;
                        return (
                            <button key={t.id} type="button" aria-pressed={on} onClick={() => set({ template: t.id })}
                                style={{ textAlign: "left", padding: 8, borderRadius: 12, background: "#fff", cursor: "pointer", border: `2px solid ${on ? clean.accent : "rgba(11,17,22,0.12)"}` }}>
                                <LayoutThumb id={t.id} accent={clean.accent} />
                                <b style={{ display: "block", marginTop: 7, fontSize: 12.5 }}>{t.label}</b>
                                <small style={{ display: "block", fontSize: 11, opacity: 0.65, lineHeight: 1.3 }}>{t.hint}</small>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="f">
                <label>Accent colour</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {STORE_ACCENTS.map((a) => {
                        const on = clean.accent === a.hex;
                        return (
                            <button key={a.hex} type="button" aria-label={a.name} aria-pressed={on} title={a.name} onClick={() => set({ accent: a.hex })}
                                style={{
                                    width: 34, height: 34, borderRadius: 999, background: a.hex, cursor: "pointer", border: "2px solid #fff",
                                    boxShadow: on ? `0 0 0 2px ${a.hex}` : "0 0 0 1px rgba(11,17,22,0.15)", color: readableOn(a.hex), display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                {on && <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {clean.template === "cover" && (
                <div className="f">
                    <label>Cover photo (optional)</label>
                    <div className="st-btns">
                        <label className={`st-up${coverBusy ? " off" : ""}`}>
                            {coverBusy ? <><Ic n="spin" />Uploading…</> : clean.coverUrl ? "Replace photo" : "Add photo"}
                            <input type="file" accept="image/*" hidden disabled={coverBusy}
                                onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {clean.coverUrl && !coverBusy && <button type="button" className="st-rm" onClick={() => set({ coverUrl: "" })}>Remove</button>}
                    </div>
                    <p className="st-cap">Wide photos work best (shop front, warehouse, products). Without one, a gradient in your accent colour is used.</p>
                </div>
            )}

            <div className="f">
                <label htmlFor="sa-tag">Tagline (optional)</label>
                <div className="inp">
                    <input id="sa-tag" maxLength={MAX_TAGLINE} value={draft.tagline || ""} placeholder="e.g. Bearings and spares for commercial vehicles"
                        onChange={(e) => set({ tagline: e.target.value })} />
                </div>
                <p className="st-cap">{(draft.tagline || "").length}/{MAX_TAGLINE} · One line buyers read first.</p>
            </div>

            <ListEditor
                label="Highlights" items={clean.highlights} onChange={(v) => set({ highlights: v })}
                max={MAX_HIGHLIGHTS} maxLen={MAX_HIGHLIGHT_LEN} placeholder="Type a highlight, press Enter"
                hint="Short badges shown on the banner. Write your own (e.g. “30+ years in trade”)." ideas={HIGHLIGHT_IDEAS} />

            <div className="f">
                <label htmlFor="sa-about">About your shop (optional)</label>
                <div className="inp">
                    <textarea id="sa-about" rows={4} maxLength={MAX_ABOUT} value={draft.about || ""}
                        placeholder="Who you are, how long you've been trading, what buyers can count on…"
                        onChange={(e) => set({ about: e.target.value })}
                        style={{ width: "100%", border: "none", background: "transparent", outline: "none", resize: "vertical", font: "inherit", minHeight: 88, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 6 }} />
                </div>
                <p className="st-cap">{(draft.about || "").length}/{MAX_ABOUT} · Shown under “About this store”.</p>
            </div>

            <ListEditor
                label="What you sell" items={clean.sells} onChange={(v) => set({ sells: v })}
                max={MAX_SELLS} maxLen={MAX_SELL_LEN} placeholder="Add a category or product type"
                hint="Your main categories or product types." ideas={SELL_IDEAS} />

            <ListEditor
                label="Key points" rows items={clean.points} onChange={(v) => set({ points: v })}
                max={MAX_POINTS} maxLen={MAX_POINT_LEN} placeholder="Add a bullet point, press Enter"
                hint="Features or promises, one per line (e.g. “Same-day dispatch before 4 PM”)." />

            <p className="st-cap">Only fill what you need. A tagline plus 2–3 highlights already looks complete.</p>

            <SaveRow dirty={dirty} saving={saving} error={error} onSave={save} label="Save store look" />
        </Collapsible>
    );
}

/* ---------- page ---------- */
export default function GrowStorePage() {
    const nav = useNavigate();
    const { token } = useAuth();
    const [dash, setDash] = useState(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetchSellerDashboard(token);
            if (res?.success) { setDash(res); setFailed(false); } else setFailed(true);
        } catch { setFailed(true); }
        setLoading(false);
    }, [token]);

    useEffect(() => { if (token) load(); else setLoading(false); }, [token, load]);

    const back = (
        <div className="back">
            {/* <button className="ib" type="button" aria-label="Back to enquiries" onClick={() => nav("/grow/enquiries")}><Ic n="back" /></button> */}
            <div className="hh">
                <h1>My shop</h1>
                <div className="live"><i />Your details and how buyers reach you</div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="v" aria-busy="true">
                {back}
                <div className="sk tall" style={{ marginTop: 18 }} />
                <div className="sk" style={{ marginTop: 14 }} />
                <div className="sk tall" style={{ marginTop: 14 }} />
            </div>
        );
    }

    if (failed || !dash) {
        return (
            <div className="v">
                {back}
                <div style={{ marginTop: 18 }}>
                    <Empty title="Couldn't load your shop" text="Check your connection and try again.">
                        <br /><button className="bt go" type="button" onClick={() => { setLoading(true); load(); }}>Try again</button>
                    </Empty>
                </div>
            </div>
        );
    }

    // `effective` includes any staged edits, so what the seller just saved is what they see.
    const seller = dash.effective || dash.seller;

    return (
        <div className="v">
            {back}
            <div className="dgrid">
                <div className="dcol">
                    <ShopCard seller={seller} />
                    <AppearanceSection seller={seller} token={token} onSaved={load} />
                    {dash.seller?.has_pending_changes && (
                        <div className="note warn">Some of your changes are waiting for review and will go live once approved.</div>
                    )}
                    <GstSection business={dash.business} />
                    <ContactSection seller={seller} email={dash.email} token={token} onSaved={load} />
                </div>
                <div className="dcol">
                    <OperationsSection seller={seller} token={token} onSaved={load} />
                    <BankSection token={token} />
                </div>
            </div>
        </div>
    );
}