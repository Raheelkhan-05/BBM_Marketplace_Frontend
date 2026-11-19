// src/components/grow/GrowProductPhotos.jsx
// Seller side of "photo requests". Live photos are read-only here: the seller can only ASK to add a
// photo or replace one. Everything goes to admin first; the live photos stay as they are meanwhile.
import { useCallback, useEffect, useState } from "react";
import { uploadSellerFile } from "../../utils/api.js";
import { fetchProductImageRequests, createProductImageRequest, cancelProductImageRequest } from "../../utils/sellerListingApi.js";
import { resizedImageUrl } from "../../utils/imageUrl.js";
import { useDrop } from "./growUi.js";
import "./grow-photos.css";

const MAX_MB = 10;
const isImg = (f) => !!f.type?.startsWith("image/");
const th = (u, w = 240) => resizedImageUrl(u, { width: w });
const STATUS = {
    pending: ["Waiting for approval", "wait"], approved: ["Approved", "ok"],
    rejected: ["Not approved", "bad"], cancelled: ["Cancelled", "off"],
};
const when = (s) => { try { return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return ""; } };

export default function GrowProductPhotos({ token, submissionId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [cancelling, setCancelling] = useState(null);
    const [note, setNote] = useState(null);          // { tone: "ok" | "err" | "", text }
    const [showAll, setShowAll] = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await fetchProductImageRequests(token, submissionId);
            if (r?.success) { setData(r); setError(""); } else setError(r?.message || "Couldn't load photos.");
        } catch { setError("Network error. Check your connection and try again."); }
    }, [token, submissionId]);
    useEffect(() => { setData(null); load(); }, [load]);

    const submit = async (files, replaceUrl = null) => {
        if (busy || !data) return;
        let list = Array.from(files || []).filter(isImg);
        if (!list.length) return setNote({ tone: "err", text: "Please choose image files (JPG, PNG, etc.)." });
        const tooBig = list.filter((f) => f.size > MAX_MB * 1024 * 1024);
        list = list.filter((f) => f.size <= MAX_MB * 1024 * 1024);
        if (!list.length) return setNote({ tone: "err", text: `Each photo must be under ${MAX_MB} MB.` });
        if (replaceUrl) list = list.slice(0, 1);
        else {
            if (data.slotsLeft <= 0) return setNote({ tone: "err", text: `A product can have up to ${data.limits.maxImages} photos.` });
            list = list.slice(0, data.slotsLeft);
        }

        setBusy(true); setNote(null);
        let ok = 0, problem = tooBig.length ? `${tooBig.length} file(s) over ${MAX_MB} MB were skipped.` : "";
        for (const f of list) {
            try {
                const up = await uploadSellerFile(token, f, "listings");
                if (!up?.success) { problem = "Upload failed. Try again."; continue; }
                const r = await createProductImageRequest(token, submissionId,
                    replaceUrl ? { action: "replace", imageUrl: up.url, replaceImageUrl: replaceUrl } : { action: "add", imageUrl: up.url });
                if (r?.success) ok += 1; else { problem = r?.message || "Couldn't send the photo."; break; }
            } catch { problem = "Network error. Please try again."; break; }
        }
        setBusy(false);
        await load();
        if (ok) setNote({ tone: problem ? "" : "ok", text: `${ok} photo${ok === 1 ? "" : "s"} sent for approval. Buyers keep seeing the current photos until then.${problem ? ` ${problem}` : ""}` });
        else setNote({ tone: "err", text: problem || "Nothing was sent." });
    };

    const cancel = async (id) => {
        setCancelling(id);
        try {
            const r = await cancelProductImageRequest(token, submissionId, id);
            setNote(r?.success ? { tone: "ok", text: "Request cancelled." } : { tone: "err", text: r?.message || "Couldn't cancel." });
        } catch { setNote({ tone: "err", text: "Network error. Please try again." }); }
        setCancelling(null);
        load();
    };

    const drop = useDrop((files) => submit(files), { disabled: busy || !data || data.slotsLeft <= 0 });

    if (error && !data) return <p className="gph-note err">{error}</p>;
    if (!data) return <div className="gph"><div className="gph-skel" /><div className="gph-skel" /></div>;

    const locked = new Set([...(data.replaceLocked || [])]);
    const pending = data.requests.filter((r) => r.status === "pending");
    const resolved = data.requests.filter((r) => r.status !== "pending");
    const resolvedShown = showAll ? resolved : resolved.slice(0, 4);

    return (
        <div className="gph">
            <p className="gph-note">
                New photos and changes are checked by our team before buyers see them. Until then, the current photos stay exactly as they are.
            </p>
            {note && <p className={`gph-note ${note.tone || ""}`} role="status">{note.text}</p>}

            <div>
                <p className="gph-h">Live photos · {data.images.length}</p>
                <div className="gph-grid">
                    {data.images.map((u, i) => {
                        const isLocked = locked.has(u);
                        return (
                            <div className="gph-tile" key={u}>
                                <img src={th(u)} alt={`Product photo ${i + 1}`} loading="lazy" />
                                {i === 0 && <span className="gph-tag">Cover</span>}
                                {isLocked && <span className="gph-tag wait">Change pending</span>}
                                <label className={`gph-rep${isLocked || busy ? " off" : ""}`}>
                                    Replace
                                    <input type="file" accept="image/*" hidden disabled={isLocked || busy}
                                        onChange={(e) => { submit(e.target.files, u); e.target.value = ""; }} />
                                </label>
                            </div>
                        );
                    })}
                    <label className={`gph-add${drop.active ? " on" : ""}${busy || data.slotsLeft <= 0 ? " off" : ""}`} {...drop.bind}>
                        {busy ? "Uploading…" : data.slotsLeft <= 0 ? <small>Photo limit reached</small> : <><span>+ Add photo</span><small>or drop here</small></>}
                        <input type="file" accept="image/*" multiple hidden disabled={busy || data.slotsLeft <= 0}
                            onChange={(e) => { submit(e.target.files); e.target.value = ""; }} />
                    </label>
                </div>
            </div>

            {(pending.length > 0 || resolved.length > 0) && (
                <div>
                    <p className="gph-h">Your requests</p>
                    <div className="gph-list">
                        {[...pending, ...resolvedShown].map((r) => {
                            const [label, tone] = STATUS[r.status] || [r.status, "off"];
                            return (
                                <div className="gph-row" key={r.id}>
                                    <div className="gph-pair">
                                        {r.action === "replace" && <><img className="gph-th old" src={th(r.replace_image_url, 120)} alt="Photo to be replaced" /><span className="gph-arrow" aria-hidden="true">→</span></>}
                                        <img className="gph-th" src={th(r.image_url, 120)} alt="Requested photo" />
                                    </div>
                                    <div className="gph-info">
                                        <b>{r.action === "replace" ? "Replace a photo" : "New photo"}</b>
                                        <span className={`gph-pill ${tone}`}>{label}</span>
                                        <small>
                                            {r.status === "rejected" && r.rejection_reason ? `Reason: ${r.rejection_reason}` : `Sent ${when(r.created_at)}`}
                                        </small>
                                    </div>
                                    {r.status === "pending" && (
                                        <button type="button" className="gph-x" disabled={cancelling === r.id} onClick={() => cancel(r.id)}>
                                            {cancelling === r.id ? "…" : "Cancel"}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {resolved.length > 4 && (
                        <button type="button" className="gph-more" onClick={() => setShowAll((v) => !v)}>
                            {showAll ? "Show fewer" : `Show ${resolved.length - 4} older`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}