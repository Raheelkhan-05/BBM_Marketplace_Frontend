// src/components/orderBook/orderBookFmt.js
export { inr, qty, dateTime, dateShort, listTime, clock, fileSize } from "../sales/salesThreadFmt.js";

export const STATUS_LABEL = { placed: "Placed", processed: "Processed", shipped: "Shipped", completed: "Completed", cancelled: "Cancelled" };
export const FLOW = ["placed", "processed", "shipped", "completed"];
export const FILTERS = [["all", "All"], ["placed", "Placed"], ["processed", "Processed"], ["shipped", "Shipped"], ["completed", "Completed"], ["cancelled", "Cancelled"]];

// "Hinges 4 inch" or "Hinges 4 inch +2 more"
export const itemsSummary = (items = []) => {
    if (!items.length) return "No products";
    const rest = items.length - 1;
    return `${items[0].productName}${rest > 0 ? ` +${rest} more` : ""}`;
};