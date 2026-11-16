// Voice notes: recorder hook, recording bar, send/mic button and the player.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Mic, Trash2, Send, Play, Pause } from "lucide-react";
import "../../sales/sales-chat.extras.css";

export const VOICE_MAX_SEC = 300;
const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const pickMime = () => { try { return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || ""; } catch { return ""; } };
export const voiceSupported = () =>
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
export const fmtDur = (s) => { const n = Math.max(0, Math.round(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

/** onDone({ blob, type, duration }) is called when the person taps send. */
export function useVoiceRecorder({ onDone, onError }) {
    const [state, setState] = useState("idle");           // idle | starting | recording
    const [secs, setSecs] = useState(0);
    const cb = useRef({}); cb.current = { onDone, onError };
    const recRef = useRef(null), streamRef = useRef(null), chunks = useRef([]), t0 = useRef(0);
    const timer = useRef(0), cancelled = useRef(false), busy = useRef(false);

    const release = () => { clearInterval(timer.current); streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

    const start = useCallback(async () => {
        if (busy.current) return;
        if (!voiceSupported()) return cb.current.onError?.("Voice notes aren't supported on this browser.");
        busy.current = true; setState("starting");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            streamRef.current = stream;
            const mime = pickMime();
            const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
            chunks.current = []; cancelled.current = false;
            rec.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
            rec.onstop = () => {
                release();
                const duration = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
                const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
                const blob = new Blob(chunks.current, { type });
                chunks.current = []; recRef.current = null; busy.current = false;
                setState("idle"); setSecs(0);
                if (cancelled.current) return;
                if (blob.size < 800) return cb.current.onError?.("That recording was too short.");
                cb.current.onDone?.({ blob, type, duration });
            };
            rec.start(250);
            recRef.current = rec; t0.current = Date.now(); setSecs(0); setState("recording");
            timer.current = setInterval(() => {
                const s = Math.round((Date.now() - t0.current) / 1000);
                setSecs(s);
                if (s >= VOICE_MAX_SEC && rec.state === "recording") rec.stop();
            }, 250);
        } catch (e) {
            release(); busy.current = false; setState("idle");
            cb.current.onError?.(e?.name === "NotAllowedError" || e?.name === "SecurityError"
                ? "Microphone access is blocked. Allow it in your browser settings."
                : e?.name === "NotFoundError" ? "No microphone found." : "Couldn't start recording.");
        }
    }, []);

    const stop = useCallback(() => { cancelled.current = false; if (recRef.current?.state === "recording") recRef.current.stop(); }, []);
    const cancel = useCallback(() => {
        cancelled.current = true;
        if (recRef.current?.state === "recording") recRef.current.stop();
        else { release(); busy.current = false; setState("idle"); }
    }, []);

    useEffect(() => () => {
        cancelled.current = true;
        try { if (recRef.current?.state === "recording") recRef.current.stop(); } catch { /* ignore */ }
        release();
    }, []);

    return { state, secs, start, stop, cancel, supported: voiceSupported() };
}

export function VoiceRecordingBar({ secs, onCancel, onSend }) {
    return (
        <div className="vn-rec" role="group" aria-label="Recording a voice note">
            <button type="button" className="vn-ic" aria-label="Discard recording" onClick={onCancel}><Trash2 size={18} /></button>
            <span className="vn-dot" aria-hidden="true" />
            <span className="vn-time">{fmtDur(secs)}</span>
            <span className="vn-hint">Recording… <small>max {fmtDur(VOICE_MAX_SEC)}</small></span>
            <button type="button" className="st-send" aria-label="Send voice note" onClick={onSend}><Send size={18} /></button>
        </div>
    );
}

// Send button when there is something to send, otherwise the mic (like WhatsApp).
export function SendOrMic({ canSend, hasContent, rec, onSend, label = "Send message" }) {
    if (hasContent || !rec.supported) {
        return <button type="button" className="st-send" aria-label={label} disabled={!canSend} onClick={onSend}><Send size={18} /></button>;
    }
    return (
        <button type="button" className="st-send vn-mic" aria-label="Record a voice note" disabled={rec.state === "starting"} onClick={rec.start}>
            <Mic size={18} />
        </button>
    );
}

let playing = null;   // only one voice note plays at a time

export const VoicePlayer = memo(function VoicePlayer({ src, duration }) {
    const ref = useRef(null);
    const [on, setOn] = useState(false);
    const [pos, setPos] = useState(0);
    const [total, setTotal] = useState(Number(duration) || 0);
    const [rate, setRate] = useState(1);
    const [err, setErr] = useState(false);

    useEffect(() => () => { const a = ref.current; if (a) { a.pause(); if (playing === a) playing = null; } }, []);

    const toggle = async () => {
        const a = ref.current; if (!a || !src) return;
        if (a.paused) {
            if (playing && playing !== a) playing.pause();
            playing = a;
            try { a.playbackRate = rate; await a.play(); setErr(false); } catch { setErr(true); }
        } else a.pause();
    };
    const seekTo = (t) => { const a = ref.current; if (!a || !total) return; const v = Math.min(total, Math.max(0, t)); a.currentTime = v; setPos(v); };
    const onBar = (e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * total); };
    const onBarKey = (e) => { if (e.key === "ArrowRight") seekTo(pos + 5); else if (e.key === "ArrowLeft") seekTo(pos - 5); };
    const cycle = () => { const n = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; setRate(n); if (ref.current) ref.current.playbackRate = n; };
    const pct = total ? Math.min(100, (pos / total) * 100) : 0;

    return (
        <div className={`vn-p${err ? " err" : ""}`}>
            <audio ref={ref} src={src || undefined} preload="metadata"
                onPlay={() => setOn(true)} onPause={() => setOn(false)}
                onEnded={() => { setOn(false); setPos(0); if (playing === ref.current) playing = null; }}
                onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setTotal(d); }}
                onError={() => setErr(true)} />
            <button type="button" className="vn-play" onClick={toggle} disabled={!src} aria-label={on ? "Pause voice note" : "Play voice note"}>
                {on ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="vn-mid">
                <div className="vn-bar" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(total)}
                    aria-valuenow={Math.round(pos)} onClick={onBar} onKeyDown={onBarKey}>
                    <span style={{ width: `${pct}%` }} />
                </div>
                <small>{err ? "Couldn't play" : fmtDur(on || pos > 0 ? pos : total)}</small>
            </div>
            <button type="button" className="vn-rate" onClick={cycle} aria-label="Playback speed">{rate}×</button>
        </div>
    );
});