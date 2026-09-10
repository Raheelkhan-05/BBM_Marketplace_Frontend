// utils/notificationTypes.js
//
// Classifies a notification as "purchase" (buyer-facing order update) or
// "sales" (seller-facing order update) by its LINK, not its `type` string.
//
// Why link and not type: most order notifications do use a
// "order_status_*" / "order_placed" type convention, but that convention
// isn't reliable on its own — e.g. cancelMyOrder() in orders.controller.js
// sends a notification typed "order_status_cancelled" to the SELLER (with
// link "/seller/orders/:id"), which would land in the wrong bucket if we
// classified by type prefix. The link the notification points to is always
// correct for "which orders list does this belong on", since it's built
// from the exact route the recipient is meant to land on.
const PURCHASE_LINK_RE = /^\/orders\/[^/?#]+/;
const SALES_LINK_RE = /^\/seller\/orders\/[^/?#]+/;
const CHAT_LINK_RE = /^\/chat\/[^/?#]+/;


export function isPurchaseOrderNotification(n) {
    return typeof n?.link === "string" && PURCHASE_LINK_RE.test(n.link);
}

export function isSalesOrderNotification(n) {
    return typeof n?.link === "string" && SALES_LINK_RE.test(n.link);
}

export function isOrderNotification(n) {
    return isPurchaseOrderNotification(n) || isSalesOrderNotification(n);
}

export function orderIdFromLink(link) {
    if (typeof link !== "string") return null;
    const m = link.match(/^\/(?:seller\/)?orders\/([^/?#]+)/);
    return m ? m[1] : null;
}

export function isChatNotification(n) {
    return typeof n?.link === "string" && CHAT_LINK_RE.test(n.link);
}