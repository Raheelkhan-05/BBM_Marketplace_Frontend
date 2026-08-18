// components/seller/listingForm/PolicySelect.jsx
import { useEffect, useState } from "react";
import { fetchListingPolicyOptions } from "../../../utils/sellerListingApi.js";
import { SelectField } from "./FormPrimitives.jsx";

export default function PolicySelect({ kind, label, value, onChange, error, required }) {
    const [options, setOptions] = useState([]);
    useEffect(() => { fetchListingPolicyOptions(kind).then((r) => { if (r?.success) setOptions(r.items); }); }, [kind]);
    // console.log(options);

    return (
        <SelectField
            label={label} required={required} error={error}
            value={value} onChange={onChange}
            options={options.map((o) => ({ value: o.key, label: o.label }))}
            placeholder="Select…"
        />
    );
}