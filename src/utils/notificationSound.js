// Synthesizes a short, iOS-style two-tone chime using the Web Audio API —
// no audio asset needed. Swap this for a real <audio> file later if you'd
// rather ship a recorded sound.
let audioCtx = null;

function getContext() {
    if (typeof window === "undefined") return null;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
    }
    return audioCtx;
}

export function playNotificationSound() {
    const ctx = getContext();
    if (!ctx) return;
    // Browsers suspend the AudioContext until a user gesture happens
    // somewhere on the page. By the time a notification arrives the user has
    // almost always already clicked/tapped something, but resume() defensively.
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const tones = [
        { freq: 1046.5, start: 0, dur: 0.11 },    // C6
        { freq: 1568.0, start: 0.09, dur: 0.16 }, // G6
    ];

    tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
    });
}