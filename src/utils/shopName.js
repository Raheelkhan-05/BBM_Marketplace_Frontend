// The name buyers should see: the SHOP name, falling back to the seller name only if no shop name exists.
export function shopNameOf(seller) {
    return (
        seller?.shop_name || seller?.shopName ||
        seller?.shop?.display_name || seller?.shop?.name ||
        seller?.display_name || seller?.displayName ||
        "this seller"
    );
}