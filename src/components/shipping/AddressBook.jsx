// components/shipping/AddressBook.jsx
//
// Amazon-style delivery address selector, shared identically by
// BuyNowModal and TransportPreferenceModal.
//
// TOP LEVEL: only the currently-deliverable address is ever shown here —
// contact name, then full address, then phone — with a single "Change"
// action. Nothing else is rendered at top level.
//
// FIRST-RUN AUTOFILL: if the buyer has zero saved addresses, one is
// seeded from their business profile AND immediately persisted via
// createBuyerAddress (the backend marks the first address `is_default`
// automatically), so "the deliverable address" always refers to a real,
// saved row — never to an unsaved draft sitting only in local state.
//
// CHANGE MODAL: "Change" opens every saved address as a list of groups.
// Clicking a group expands it in place to reveal two actions:
//   - "Deliver to this address" -> selects it, persists it as default
//     (setDefaultBuyerAddress), closes the modal, and it now shows on top.
//   - "Edit" -> opens the same address form pre-filled for that address;
//     saving updates it in place (updateBuyerAddress) and returns to the
//     list without changing the current selection.
// "Add a new address" opens a blank form; saving creates it
// (createBuyerAddress), selects it, persists it as default, and closes
// the modal — matching how picking an existing address behaves.
//
// SINGLE SOURCE OF TRUTH: every selection (autofill, pick, or new save)
// is reported to the parent via onChange AND persisted server-side via
// setDefaultBuyerAddress, so "the last address picked anywhere" stays
// consistent across BuyNowModal, TransportPreferenceModal, sessions and
// devices.
//
// LABEL: the buyer can type their own name for an address (e.g.
// "Warehouse", "Head Office"); if left blank it falls back to their
// contact name, then to "Address N" — never a hardcoded generic string.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapPin, Plus, Loader2, ChevronDown, Pencil, Check, X, Phone } from "lucide-react";
import { C, TextField } from "../seller/listingForm/FormPrimitives.jsx";
import {
    fetchBuyerAddresses, createBuyerAddress, updateBuyerAddress, fetchBusinessProfile,
    fetchCheckoutStatus, setDefaultBuyerAddress,
} from "../../utils/api.js";
import { usePincodeResolution } from "../../hooks/usePincodeResolution.js";

const EMPTY_ADDRESS = { label: "", contact_name: "", contact_phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "" };

// Business-registration text (registered_address / dispatch_address) is
// very often ALREADY a fully-formatted string that ends with the same
// city, state and pincode we also pull out separately (bp.district /
// bp.state / bp.pincode). If we don't strip that trailing chunk before
// saving, every display template that appends ", {city}, {state} –
// {pincode}" ends up showing it twice, e.g.:
//   "...Rajkot, Rajkot, Gujarat — 360003, RAJKOT, Gujarat – 360003"
// This strips a trailing occurrence of the city/state/pincode (in any
// order, any dash style, any casing) from the raw line so address_line1
// only ever contains the STREET portion.
function stripTrailingLocation(raw, { city, state, pincode }) {
    let line = String(raw || "").trim();
    if (!line) return line;

    const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dash = "[-\\u2010-\\u2015]"; // hyphen + all common unicode dashes (–, —, etc.)
    const sep = "[\\s,]*";

    const patterns = [
        city && state && pincode && new RegExp(`${sep}${esc(city)}${sep},?${sep}${esc(state)}${sep}${dash}${sep}${esc(pincode)}${sep}$`, "i"),
        state && pincode && new RegExp(`${sep}${esc(state)}${sep}${dash}${sep}${esc(pincode)}${sep}$`, "i"),
        city && new RegExp(`${sep}${esc(city)}${sep}${esc(city)}${sep}$`, "i"), // "...Rajkot, Rajkot"
        pincode && new RegExp(`${sep}${esc(pincode)}${sep}$`, "i"),
    ].filter(Boolean);

    for (const re of patterns) {
        if (re.test(line)) line = line.replace(re, "").trim();
    }
    return line.replace(/[\s,]+$/, "").trim();
}

// Both pieces (business profile + phone) are fetched together, right
// here, so there's nothing to race against on a buyer's very first
// address.
function seedFromBusinessProfile(bp, phone) {
    if (!bp) return null;
    const useDispatch = bp.dispatch_same_as_registered === false && bp.dispatch_address;
    const city = bp.district || "";
    const state = useDispatch ? (bp.dispatch_state || bp.state || "") : (bp.state || "");
    const pincode = useDispatch ? (bp.dispatch_pincode || bp.pincode || "") : (bp.pincode || "");
    const rawLine = useDispatch ? bp.dispatch_address : bp.registered_address;

    return {
        // Intentionally blank: this is the buyer's FIRST, auto-seeded
        // address. It must never be forced to equal contact_name (see
        // fallbackLabel below) — that produced "Company · Company" in
        // the UI. The backend defaults an empty label to "Office".
        label: "",
        contact_name: bp.legal_name || bp.trade_name || "",
        contact_phone: phone || "",
        address_line1: stripTrailingLocation(rawLine, { city, state, pincode }),
        address_line2: "",
        city, state, pincode,
    };
}

// NOTE: never use this on the auto-seeded first-run address — falling
// back to contact_name there produces "Company · Company" since the
// card already shows contact_name right next to the label. It's only
// safe for addresses the buyer explicitly named, or a manual "Add new".
function fallbackLabel(addr, existingCount) {
    const trimmed = (addr.label || "").trim();
    if (trimmed) return trimmed;
    const name = (addr.contact_name || "").trim();
    if (name) return name;
    return `Address ${existingCount + 1}`;
}

// ---- The card shown at top level: contact name, then full address,
// then phone, then a single "Change" action. ----
function SelectedAddressCard({ address, onChangeClick, disabled }) {
    if (!address) return null;
    return (
        <div className="flex flex-col gap-2 rounded-xl border p-3.5" style={{ borderColor: C.hair, background: "#fff" }}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">

                    <p className="mt-1 text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>
                        {address.contact_name}
                        {address.label && address.label.trim().toLowerCase() !== address.contact_name.trim().toLowerCase() ? (
                            <span className="ml-1.5 font-semibold" style={{ color: C.muted }}>· {address.label}</span>
                        ) : null}
                    </p>
                    <p className="mt-1 text-[12.5px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                        {address.address_line1}
                        {address.address_line2 ? `, ${address.address_line2}` : ""}, {address.city}, {address.state} – {address.pincode}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold tracking-wide" style={{ color: C.ink }}>
                        <Phone className="h-3 w-3 shrink-0" style={{ color: C.muted }} />
                        {address.contact_phone}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onChangeClick}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
                    style={{ color: C.secondary, background: `${C.secondary}0f` }}
                >
                    Change
                </button>
            </div>
        </div>
    );
}

// ---- One row inside the modal: collapsed shows the address; expanded
// (after a click) reveals "Deliver to this address" / "Edit". ----
function AddressRow({ addr, isSelected, isExpanded, onToggle, onDeliverHere, onEdit }) {
    return (
        <div className="rounded-xl border" style={{ borderColor: isSelected ? C.secondary : C.hair, background: isSelected ? `${C.secondary}08` : "#fff" }}>
            <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: isSelected ? C.secondary : C.hair }}>
                    {isSelected && <Check className="h-2.5 w-2.5" style={{ color: C.secondary }} strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                        {addr.contact_name}{addr.label ? ` · ${addr.label}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                        {addr.address_line1}, {addr.city}, {addr.state} – {addr.pincode}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>
                        {addr.contact_phone}
                    </p>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 transition-transform duration-150" style={{ color: C.muted, transform: isExpanded ? "rotate(180deg)" : "none" }} />
            </button>
            {isExpanded && (
                <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: C.hair }}>
                    <button type="button" onClick={onDeliverHere}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: C.secondary }}>
                        <Check className="h-3.5 w-3.5" /> Deliver to this address
                    </button>
                    <button type="button" onClick={onEdit}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold" style={{ color: C.ink, background: "rgba(20,27,34,0.045)" }}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                </div>
            )}
        </div>
    );
}

// ---- The add/edit form, reused for both "Add a new address" and
// "Edit" on an existing group. ----
function AddressForm({ value, onField, onCancel, onSave, showCancel, saving, error }) {
    const { resolved: pincodeGeo, status: pincodeStatus, message: pincodeMessage } = usePincodeResolution(value.pincode || null);
    useEffect(() => {
        if (pincodeGeo) onField("city", pincodeGeo.district), onField("state", pincodeGeo.state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pincodeGeo]);

    return (
        <div className="flex flex-col gap-2.5 p-1">
            <TextField dense label="Address name (optional)" placeholder="e.g. Home, Warehouse, Head Office"
                value={value.label} onChange={(v) => onField("label", v)} />
            <div className="grid grid-cols-2 gap-2.5">
                <TextField dense label="Contact name" value={value.contact_name} onChange={(v) => onField("contact_name", v)} />
                <TextField dense label="Phone" value={value.contact_phone} onChange={(v) => onField("contact_phone", v)} />
            </div>
            <TextField dense label="Address line 1" value={value.address_line1} onChange={(v) => onField("address_line1", v)} />
            <TextField dense label="Address line 2 (optional)" value={value.address_line2} onChange={(v) => onField("address_line2", v)} />
            <TextField
                dense label="Pincode" value={value.pincode}
                onChange={(v) => {
                    const digits = v.replace(/\D/g, "").slice(0, 6);
                    onField("pincode", digits); onField("city", ""); onField("state", "");
                }}
            />
            {pincodeStatus === "loading" && <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Looking up location…</p>}
            {pincodeStatus === "error" && <p className="text-[11.5px] font-medium" style={{ color: "#B3261E" }}>{pincodeMessage}</p>}
            {pincodeStatus === "ok" && value.city && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                    <p className="text-[13px] font-semibold tracking-wide" style={{ color: C.ink }}>{value.city}, {value.state}</p>
                </div>
            )}
            {error && <p className="text-[12px] font-semibold" style={{ color: "#B3261E" }}>{error}</p>}
            <div className="flex items-center gap-2">
                <button type="button" onClick={onSave} disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60" style={{ background: C.secondary }}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save address
                </button>
                {showCancel && (
                    <button type="button" onClick={onCancel} className="text-[12.5px] font-bold" style={{ color: C.muted }}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

const AddressBook = forwardRef(function AddressBook({ token, value, onChange, disabled }, ref) {
    const [addresses, setAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(true);
    const [selectedId, setSelectedId] = useState(value ?? null);
    const [seeding, setSeeding] = useState(false);

    const seedInFlightRef = useRef(false); // guards against a double create call


    const [modalOpen, setModalOpen] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // formMode: null | "add" | "edit". formTarget: address id being
    // edited (null for "add").
    const [formMode, setFormMode] = useState(null);
    const [formTarget, setFormTarget] = useState(null);
    const [formData, setFormData] = useState(EMPTY_ADDRESS);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Holds the latest onChange without needing it in effect deps.
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const reportSelection = (addr) => {
        setSelectedId(addr.id);
        onChangeRef.current?.({ ...addr, isDraft: false });
    };

    const persistDefault = async (addressId) => {
        if (!addressId || !token) return;
        try { await setDefaultBuyerAddress(token, addressId); }
        catch { /* best-effort — not worth blocking the UI over */ }
    };

    // Initial fetch. If the buyer has zero saved addresses, seed from
    // their business profile AND persist it immediately, so the top
    // level always points at a real saved row.

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            setLoadingAddresses(true);
            const res = await fetchBuyerAddresses(token);
            if (cancelled) return;
            if (!res?.success) { setLoadingAddresses(false); return; }
            const list = res.addresses || [];

            if (list.length === 0) {
                if (seedInFlightRef.current) return; // already seeding — never call create twice
                seedInFlightRef.current = true;

                setLoadingAddresses(false);
                setSeeding(true);
                const [bpRes, statusRes] = await Promise.all([
                    fetchBusinessProfile(token),
                    fetchCheckoutStatus(token),
                ]);
                if (cancelled) return;
                const seeded = bpRes?.success ? seedFromBusinessProfile(bpRes.profile, statusRes?.profile?.phone) : null;
                if (seeded && seeded.contact_name && seeded.address_line1 && seeded.pincode) {
                    // label deliberately NOT run through fallbackLabel here —
                    // send it blank, let the backend's own "Office" default
                    // apply, so it never mirrors contact_name.
                    const payload = { ...seeded, is_default: true };
                    const createRes = await createBuyerAddress(token, payload);
                    if (cancelled) return;
                    if (createRes?.success) {
                        setAddresses([createRes.address]);
                        reportSelection(createRes.address);
                    }
                }
                setSeeding(false);
                return;
            }

            setAddresses(list);
            setLoadingAddresses(false);
            const target = (value && list.find((a) => a.id === value)) || list.find((a) => a.is_default) || list[0];
            if (target) reportSelection(target);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // If the parent's `value` hint changes later (e.g. a session
    // restore) and it points at an address we already have loaded,
    // reconcile to it.
    useEffect(() => {
        if (!value || !addresses.length || value === selectedId) return;
        const target = addresses.find((a) => a.id === value);
        if (target) reportSelection(target);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, addresses]);

    const selectedAddress = addresses.find((a) => a.id === selectedId) || null;

    const openChangeModal = () => { setExpandedId(null); setFormMode(null); setError(null); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setExpandedId(null); setFormMode(null); setError(null); };

    const deliverHere = (addr) => {
        reportSelection(addr);
        if (addr.id !== value) persistDefault(addr.id);
        closeModal();
    };

    const openEdit = (addr) => {
        setFormTarget(addr.id);
        setFormData({
            label: addr.label || "", contact_name: addr.contact_name || "", contact_phone: addr.contact_phone || "",
            address_line1: addr.address_line1 || "", address_line2: addr.address_line2 || "",
            city: addr.city || "", state: addr.state || "", pincode: addr.pincode || "",
        });
        setError(null);
        setFormMode("edit");
    };

    const openAdd = () => {
        setFormTarget(null);
        setFormData(EMPTY_ADDRESS);
        setError(null);
        setFormMode("add");
    };

    const cancelForm = () => { setFormMode(null); setFormTarget(null); setError(null); };

    const setField = (key, val) => setFormData((f) => ({ ...f, [key]: val }));

    const saveForm = async () => {
        const missing = ["contact_name", "contact_phone", "address_line1", "city", "state", "pincode"].filter((k) => !formData[k].trim());
        if (missing.length) { setError("Please fill in the address completely."); return; }
        setError(null);
        setSaving(true);
        try {
            if (formMode === "edit") {
                const patch = { ...formData, label: fallbackLabel(formData, addresses.length) };
                const res = await updateBuyerAddress(token, formTarget, patch);
                if (!res?.success) { setError(res?.message || "Couldn't save address."); return; }
                setAddresses((prev) => prev.map((a) => (a.id === formTarget ? res.address : a)));
                if (formTarget === selectedId) onChangeRef.current?.({ ...res.address, isDraft: false });
                setFormMode(null);
                setFormTarget(null);
            } else {
                const payload = { ...formData, label: fallbackLabel(formData, addresses.length), is_default: true };
                const res = await createBuyerAddress(token, payload);
                if (!res?.success) { setError(res?.message || "Couldn't save address."); return; }
                setAddresses((prev) => [res.address, ...prev]);
                deliverHere(res.address);
                setFormMode(null);
            }
        } finally {
            setSaving(false);
        }
    };

    // Exposed to parents that need a guaranteed, real address id right
    // before doing something (placing an order, finalising a transport
    // preference).
    useImperativeHandle(ref, () => ({
        async ensureSavedAddress() {
            return selectedId || addresses.find((a) => a.is_default)?.id || null;
        },
    }));

    return (
        <div className="flex flex-col gap-2.5">
            {(loadingAddresses || seeding) ? (
                <div className="flex items-center gap-2 py-2 text-[12px] font-semibold" style={{ color: C.muted }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {seeding ? "Setting up your address…" : "Loading your addresses…"}
                </div>
            ) : (
                <SelectedAddressCard address={selectedAddress} onChangeClick={openChangeModal} disabled={disabled} />
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
                    <div onClick={closeModal} className="absolute inset-0 bg-black/40" />
                    <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                        <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: C.hair }}>
                            <span className="text-[14px] font-bold" style={{ color: C.ink }}>
                                {formMode ? (formMode === "edit" ? "Edit address" : "Add a new address") : "Choose a delivery address"}
                            </span>
                            <button type="button" onClick={closeModal} className="rounded-full p-1.5" style={{ background: "rgba(20,27,34,0.045)" }}>
                                <X className="h-4 w-4" style={{ color: C.ink }} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3.5">
                            {formMode ? (
                                <AddressForm
                                    value={formData}
                                    onField={setField}
                                    onCancel={cancelForm}
                                    onSave={saveForm}
                                    showCancel
                                    saving={saving}
                                    error={error}
                                />
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {addresses.map((addr) => (
                                        <AddressRow
                                            key={addr.id}
                                            addr={addr}
                                            isSelected={addr.id === selectedId}
                                            isExpanded={expandedId === addr.id}
                                            onToggle={() => setExpandedId((cur) => (cur === addr.id ? null : addr.id))}
                                            onDeliverHere={() => deliverHere(addr)}
                                            onEdit={() => openEdit(addr)}
                                        />
                                    ))}
                                    <button type="button" onClick={openAdd}
                                        className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1.5 text-[12.5px] font-bold" style={{ color: C.secondary }}>
                                        <Plus className="h-3.5 w-3.5" /> Add a new address
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default AddressBook;