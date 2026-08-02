// hooks/useCatalogFileImport.js
import { useCallback, useRef, useState } from "react";
import { uploadCatalogFile, fetchImportStatus } from "../utils/api";

const POLL_MS = 2000;

export default function useCatalogFileImport() {
    const [state, setState] = useState({ phase: "idle" }); // idle | uploading | processing | done | error
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const pollRef = useRef(null);
    const abortRef = useRef(null);

    const stopPolling = useCallback(() => {
        clearTimeout(pollRef.current);
        abortRef.current?.abort();
    }, []);

    const poll = useCallback((jobId) => {
        const tick = async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const status = await fetchImportStatus(jobId, controller.signal);
                if (status.status === "processing") {
                    setProgress(status.progress || null);
                    pollRef.current = setTimeout(tick, POLL_MS);
                } else if (status.status === "done") {
                    setResult({ landing: status.landing, summary: status.summary });
                    setState({ phase: "done" });
                } else {
                    setState({ phase: "error", message: status.message || "Import failed." });
                }
            } catch (err) {
                if (err.name !== "AbortError") setState({ phase: "error", message: "Lost connection while importing." });
            }
        };
        tick();
    }, []);

    const startImport = useCallback(async (file) => {
        setState({ phase: "uploading" });
        setProgress(null);
        setResult(null);
        try {
            const res = await uploadCatalogFile(file);
            if (!res?.success || !res.jobId) {
                setState({ phase: "error", message: res?.message || "Could not start import." });
                return;
            }
            setState({ phase: "processing" });
            poll(res.jobId);
        } catch {
            setState({ phase: "error", message: "Upload failed. Please try again." });
        }
    }, [poll]);

    const reset = useCallback(() => {
        stopPolling();
        setState({ phase: "idle" });
        setProgress(null);
        setResult(null);
    }, [stopPolling]);

    return { state, progress, result, startImport, reset };
}