// Decides what the Enter key does in the chat composers.
//   Desktop (mouse / trackpad): Enter sends, Shift+Enter adds a new line.
//   Phone / tablet (touch):     Enter adds a new line, the Send button sends.
//   Everywhere:                 Ctrl+Enter or Cmd+Enter always sends (for tablets with a keyboard).
import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";
const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

// true when the main way of pointing is a finger
export default function useTouchDevice() {
    const [touch, setTouch] = useState(read);
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
        const mq = window.matchMedia(QUERY);
        const on = () => setTouch(mq.matches);
        on();
        if (mq.addEventListener) { mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }
        mq.addListener(on); return () => mq.removeListener(on);   // older Safari
    }, []);
    return touch;
}

// Should this key press send the message?
export function isSendKey(e, touch) {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing) return false;   // IME typing (e.g. Hindi, Gujarati) must never send
    if (e.ctrlKey || e.metaKey) return true;
    if (touch) return false;                                              // touch: Enter = new line
    return !e.shiftKey;                                                   // desktop: Enter = send, Shift+Enter = new line
}

export const sendHint = (touch, tag = "@ to tag a teammate") =>
    touch ? `Tap send to post · ${tag}` : `Enter to send · Shift+Enter for a new line · ${tag}`;