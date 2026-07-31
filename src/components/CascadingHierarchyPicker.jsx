// src/components/admin/CascadingHierarchyPicker.jsx
import { useState, useEffect } from "react";
import SingleLevelDropdown from "./SingleLevelDropdown.jsx";

// entityLevel: "subcategory" | "product" | "brand" — how deep this entity sits.
// Renders Category [+ Subcategory [+ Product]] dropdowns as needed, prefilled
// from `ancestors`. Changing a rung clears everything below it. Reports the
// final chain up via onChange({ category, subcategory, product }).
export default function CascadingHierarchyPicker({ token, entityLevel, ancestors, onChange }) {
    const [category, setCategory] = useState(ancestors?.category || null);
    const [subcategory, setSubcategory] = useState(ancestors?.subcategory || null);
    const [product, setProduct] = useState(ancestors?.product || null);
    // Only one rung's panel can be open across the whole picker at a time —
    // opening one closes whichever other one was open.
    const [openLevel, setOpenLevel] = useState(null);

    useEffect(() => {
        onChange({ category, subcategory, product });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, subcategory, product]);

    const showSubcategory = entityLevel === "product" || entityLevel === "brand";
    const showProduct = entityLevel === "brand";

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SingleLevelDropdown
                token={token} pickerLevel="category" parentId={null}
                value={category} label="Category"
                open={openLevel === "category"}
                onOpenChange={(v) => setOpenLevel(v ? "category" : null)}
                onChange={(id, name) => { setCategory({ id, name }); setSubcategory(null); setProduct(null); }}
            />
            {showSubcategory && (
                <SingleLevelDropdown
                    token={token} pickerLevel="subcategory" parentId={category?.id}
                    value={subcategory} label="Subcategory" disabled={!category}
                    open={openLevel === "subcategory"}
                    onOpenChange={(v) => setOpenLevel(v ? "subcategory" : null)}
                    onChange={(id, name) => { setSubcategory({ id, name }); setProduct(null); }}
                />
            )}
            {showProduct && (
                <SingleLevelDropdown
                    token={token} pickerLevel="product" parentId={subcategory?.id}
                    value={product} label="Generic Product" disabled={!subcategory}
                    open={openLevel === "product"}
                    onOpenChange={(v) => setOpenLevel(v ? "product" : null)}
                    onChange={(id, name) => setProduct({ id, name })}
                />
            )}
        </div>
    );
}