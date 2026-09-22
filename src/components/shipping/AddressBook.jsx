// components/shipping/AddressBook.jsx
//
// Shared address picker + "add new address" form, used identically by
// BuyNowModal and TransportPreferenceModal so a buyer sees the exact same
// list, the exact same form, and picking/saving an address behaves the
// same way in both places.
//
// SINGLE SOURCE OF TRUTH: whenever the buyer selects an existing address
// or saves a new one, this component calls setDefaultBuyerAddress so that
// address becomes their `is_default` address server-side. Both BuyNowModal
// and TransportPreferenceModal fetch addresses via fetchBuyerAddresses,
// which already orders is_default first — so "the last address I picked
// anywhere" is consistent across the whole app (and across sessions/
// devices), not just within one open modal.
//
// CONTROLLED SELECTION: `value` is the address id the parent WANTS
// selected (e.g. restored from a saved order-form session, or a hint
// passed in from wherever the modal was opened). On load, and whenever
// `value` changes, this component reconciles against the fetched address
// list and reports the match via `onChange`. Explicit user actions
// (clicking a row, saving a new address) report immediately, without
// waiting for `value` to catch up — `value` is a hint, not a lock.
//
// DRAFT REPORTING: while the "add new address" form is open, every field
// change is reported via onChange too (with `isDraft: true` and no `id`)
// so a parent that needs live pincode/city/state for something like a
// price quote doesn't have to wait for the buyer to click "Save address".
//
// LABEL: previously every address was silently labelled "Office" (or,
// when seeded from the business profile, a stray literal "Deliver To: ").
// The buyer can now type their own name for an address (e.g. "Warehouse",
// "Head Office"); if they leave it blank, it falls back to their contact
// name, then to "Address N" — never a hardcoded generic string.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { C, TextField } from "../seller/listingForm/FormPrimitives.jsx";
import {
    fetchBuyerAddresses, createBuyerAddress, fetchBusinessProfile,
    fetchCheckoutStatus, setDefaultBuyerAddress,
} from "../../utils/api.js";
import { usePincodeResolution } from "../../hooks/usePincodeResolution.js";

const EMPTY_ADDRESS = { label: "", contact_name: "", contact_phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "" };

// FIXED: phone used to come from a prop (`access?.profile?.phone`) that
// was populated by a SEPARATE effect elsewhere in the app — there was no
// guarantee that effect had finished by the time this seeding ran, so the
// phone field frequently came back blank on a buyer's very first address.
// Now both pieces are fetched together, right here, so there's nothing to
// race against.
function seedFromBusinessProfile(bp, phone) {
    if (!bp) return null;
    const useDispatch = bp.dispatch_same_as_registered === false && bp.dispatch_address;
    return {
        label: "",
        contact_name: bp.legal_name || bp.trade_name || "",
        contact_phone: phone || "",
        address_line1: useDispatch ? bp.dispatch_address : (bp.registered_address || ""),
        address_line2: "",
        city: bp.district || "",
        state: useDispatch ? (bp.dispatch_state || bp.state || "") : (bp.state || ""),
        pincode: useDispatch ? (bp.dispatch_pincode || bp.pincode || "") : (bp.pincode || ""),
    };
}

function fallbackLabel(addr, existingCount) {
    const trimmed = (addr.label || "").trim();
    if (trimmed) return trimmed;
    const name = (addr.contact_name || "").trim();
    if (name) return name;
    return `Address ${existingCount + 1}`;
}

const AddressBook = forwardRef(function AddressBook({ token, value, onChange, disabled }, ref) {
    const [addresses, setAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(true);
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
    const [error, setError] = useState(null);

    // Holds the latest onChange without needing it in effect deps —
    // parents very often pass a fresh inline function every render, and
    // including it directly in a dependency array would re-fire effects
    // (and, worse, could loop) for reasons that have nothing to do with
    // the address data actually changing.
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // Tracks the id of whichever address we last told the parent about,
    // so the reconciliation effect below doesn't re-report the same
    // selection on every unrelated re-render.
    const reportedIdRef = useRef(null);

    const { resolved: pincodeGeo, status: pincodeStatus, message: pincodeMessage } =
        usePincodeResolution(showNewAddress ? newAddress.pincode : null);

    useEffect(() => {
        if (pincodeGeo) setNewAddress((a) => ({ ...a, city: pincodeGeo.district, state: pincodeGeo.state }));
    }, [pincodeGeo]);

    // Initial fetch. If the buyer has zero saved addresses, seed the "add
    // new" form from their business profile so they aren't starting from
    // a blank form.
    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            setLoadingAddresses(true);
            const res = await fetchBuyerAddresses(token);
            if (cancelled) return;
            if (!res?.success) { setLoadingAddresses(false); return; }
            const list = res.addresses || [];
            setAddresses(list);
            setLoadingAddresses(false);

            if (list.length === 0) {
                const [bpRes, statusRes] = await Promise.all([
                    fetchBusinessProfile(token),
                    fetchCheckoutStatus(token),
                ]);
                if (cancelled) return;
                const seeded = bpRes?.success
                    ? seedFromBusinessProfile(bpRes.profile, statusRes?.profile?.phone)
                    : null;
                setNewAddress(seeded || EMPTY_ADDRESS);
                setShowNewAddress(true);
            }
        })();
        return () => { cancelled = true; };
    }, [token]);

    // Reconcile the controlled `value` (or the default address) against
    // whatever's loaded, and report it. Re-runs whenever the list loads,
    // `value` changes (e.g. a session restore, or the OTHER modal setting
    // a new default), or the buyer backs out of the "add new" form —
    // in every one of those cases something needs to be (re-)reported.
    useEffect(() => {
        if (loadingAddresses || showNewAddress) return;
        if (!addresses.length) return;
        const target = (value && addresses.find((a) => a.id === value))
            || addresses.find((a) => a.is_default)
            || addresses[0];
        if (!target || reportedIdRef.current === target.id) return;
        reportedIdRef.current = target.id;
        onChangeRef.current?.({ ...target, isDraft: false });
    }, [addresses, value, loadingAddresses, showNewAddress]);

    // Live-report every keystroke in the "add new" form so a parent that
    // needs pincode/city/state right away (e.g. for a price quote) has it
    // before the buyer ever clicks "Save address".
    useEffect(() => {
        if (!showNewAddress) return;
        reportedIdRef.current = null;
        onChangeRef.current?.({
            id: null, isDraft: true,
            label: newAddress.label, contact_name: newAddress.contact_name, contact_phone: newAddress.contact_phone,
            address_line1: newAddress.address_line1, address_line2: newAddress.address_line2,
            city: newAddress.city, state: newAddress.state, pincode: newAddress.pincode,
        });
    }, [showNewAddress, newAddress]);

    const setAddrField = (key, val) => setNewAddress((a) => ({ ...a, [key]: val }));

    const persistDefault = async (addressId) => {
        if (!addressId || !token) return;
        try { await setDefaultBuyerAddress(token, addressId); }
        catch { /* best-effort — not worth blocking the UI over */ }
    };

    const selectExisting = (addr) => {
        setShowNewAddress(false);
        setError(null);
        reportedIdRef.current = addr.id;
        onChangeRef.current?.({ ...addr, isDraft: false });
        if (addr.id !== value) persistDefault(addr.id);
    };

    const saveNewAddress = async () => {
        const missing = ["contact_name", "contact_phone", "address_line1", "city", "state", "pincode"].filter((k) => !newAddress[k].trim());
        if (missing.length) { setError("Please fill in the address completely."); return null; }
        setError(null);
        const payload = { ...newAddress, label: fallbackLabel(newAddress, addresses.length), is_default: true };
        const res = await createBuyerAddress(token, payload);
        if (!res?.success) { setError(res?.message || "Couldn't save address."); return null; }
        setAddresses((prev) => [res.address, ...prev]);
        setShowNewAddress(false);
        reportedIdRef.current = res.address.id;
        onChangeRef.current?.({ ...res.address, isDraft: false });
        return res.address.id;
    };

    // Exposed to parents that need a guaranteed, real address id right
    // before doing something (placing an order, finalising a transport
    // preference) — commits whatever's in the "add new" form if it's
    // open, otherwise just hands back the current selection.
    useImperativeHandle(ref, () => ({
        async ensureSavedAddress() {
            if (showNewAddress) return saveNewAddress();
            return value || addresses.find((a) => a.is_default)?.id || null;
        },
    }));

    return (
        <div className="flex flex-col gap-2.5">
            {loadingAddresses ? (
                <div className="flex items-center gap-2 py-2 text-[12px] font-semibold" style={{ color: C.muted }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your addresses…
                </div>
            ) : (
                <>
                    {!showNewAddress && addresses.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {addresses.map((a) => {
                                const isSelected = value === a.id || (!value && a.is_default);
                                return (
                                    <button key={a.id} type="button" disabled={disabled} onClick={() => selectExisting(a)}
                                        className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150 disabled:opacity-60"
                                        style={{
                                            borderColor: isSelected ? C.secondary : C.hair,
                                            background: isSelected ? `${C.secondary}08` : "#fff",
                                        }}>
                                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                                            style={{ borderColor: isSelected ? C.secondary : C.hair }}>
                                            {isSelected && <span className="h-2 w-2 rounded-full" style={{ background: C.secondary }} />}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>{a.label} · {a.contact_name}</p>
                                            <p className="mt-0.5 text-[12px] font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                                                {a.address_line1}, {a.city}, {a.state} – {a.pincode}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                            <button type="button" disabled={disabled}
                                onClick={() => { setNewAddress(EMPTY_ADDRESS); setError(null); setShowNewAddress(true); }}
                                className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1.5 text-[12.5px] font-bold disabled:opacity-60" style={{ color: C.secondary }}>
                                <Plus className="h-3.5 w-3.5" /> Add a new address
                            </button>
                        </div>
                    )}

                    {showNewAddress && (
                        <div className="flex flex-col gap-2.5">
                            <TextField
                                dense label="Address name (optional)"
                                placeholder="e.g. Home, Warehouse, Head Office"
                                value={newAddress.label}
                                onChange={(v) => setAddrField("label", v)}
                            />
                            <div className="grid grid-cols-2 gap-2.5">
                                <TextField dense label="Contact name" value={newAddress.contact_name} onChange={(v) => setAddrField("contact_name", v)} />
                                <TextField dense label="Phone" value={newAddress.contact_phone} onChange={(v) => setAddrField("contact_phone", v)} />
                            </div>
                            <TextField dense label="Address line 1" value={newAddress.address_line1} onChange={(v) => setAddrField("address_line1", v)} />
                            <TextField dense label="Address line 2 (optional)" value={newAddress.address_line2} onChange={(v) => setAddrField("address_line2", v)} />
                            <TextField
                                dense
                                label="Pincode"
                                value={newAddress.pincode}
                                onChange={(v) => {
                                    const digits = v.replace(/\D/g, "").slice(0, 6);
                                    setNewAddress((a) => ({ ...a, pincode: digits, city: "", state: "" }));
                                }}
                            />
                            {pincodeStatus === "loading" && (
                                <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Looking up location…</p>
                            )}
                            {pincodeStatus === "error" && (
                                <p className="text-[11.5px] font-medium" style={{ color: "#B3261E" }}>{pincodeMessage}</p>
                            )}
                            {pincodeStatus === "ok" && newAddress.city && (
                                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                    <p className="text-[13px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                        {newAddress.city}, {newAddress.state}
                                    </p>
                                </div>
                            )}
                            {addresses.length > 0 && (
                                <button type="button" onClick={() => { setShowNewAddress(false); setError(null); }} className="w-fit text-[12.5px] font-bold" style={{ color: C.muted }}>
                                    Use a saved address instead
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={saveNewAddress}
                                className="w-fit rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white"
                                style={{ background: C.secondary }}
                            >
                                Save address
                            </button>
                        </div>
                    )}

                    {error && <p className="text-[12px] font-semibold" style={{ color: "#B3261E" }}>{error}</p>}
                </>
            )}
        </div>
    );
});

export default AddressBook;