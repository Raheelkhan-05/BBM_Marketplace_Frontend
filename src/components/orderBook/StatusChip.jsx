import { STATUS_LABEL } from "./orderBookFmt.js";
export default function StatusChip({ status }) {
    return <span className={`ob-chip ${status}`}>{STATUS_LABEL[status] || status}</span>;
}