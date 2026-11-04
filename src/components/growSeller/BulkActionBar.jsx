// Sticky bar shown while listings are selected. Sits above the mobile dock.
import Ic from "./Ic.jsx";

const ACTIONS = [
    ["price", "tag", "Price"],
    ["mkt", "mega", "Promotion"],
    ["vis", "eye", "Visibility"],
    ["active", "bolt", "Pause/Live"],
];

export default function BulkActionBar({ count, onClear, onAction }) {
    return (
        <div className="bulkbar" role="toolbar" aria-label="Actions for selected listings">
            <div className="bbn" aria-live="polite">
                <b>{count}</b> selected
                <button type="button" className="bbx" aria-label="Clear selection" onClick={onClear}><Ic n="x" /></button>
            </div>
            <div className="bbs">
                {ACTIONS.map(([key, icon, label]) => (
                    <button key={key} type="button" className="bb" onClick={() => onAction(key)}>
                        <Ic n={icon} />{label}
                    </button>
                ))}
            </div>
        </div>
    );
}