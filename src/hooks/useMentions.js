// src/hooks/useMentions.js
// "@" tagging for a textarea. `people` = [{ userId, name }] (everyone in the chat except me).
//   const mn = useMentions({ people, text, setText, taRef });
//   textarea: onChange -> setText + mn.detect(value, caret);  onKeyDown -> if (mn.onKeyDown(e)) return;
//   on send:  mentions = mn.collect(text);  mn.reset();
//   render <MentionList options={mn.options} idx={mn.idx} onPick={mn.pick} />
import { useCallback, useMemo, useRef, useState } from "react";

export default function useMentions({ people, text, setText, taRef }) {
    const [q, setQ] = useState(null);      // { start, query, caret } while a "@word" is being typed
    const [idx, setIdx] = useState(0);
    const picked = useRef(new Map());      // name -> userId

    const options = useMemo(() => {
        if (!q) return [];
        const k = q.query.toLowerCase();
        return (people || []).filter((p) => !k || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(k))).slice(0, 6);
    }, [q, people]);

    const detect = useCallback((value, caret) => {
        const m = /(^|\s)@([^\s@]{0,30})$/.exec(String(value).slice(0, caret));
        setQ(m ? { start: caret - m[2].length - 1, query: m[2], caret } : null);
        setIdx(0);
    }, []);

    const pick = useCallback((p) => {
        if (!q) return;
        const ins = `@${p.name} `;
        setText(text.slice(0, q.start) + ins + text.slice(q.caret));
        picked.current.set(p.name, p.userId);
        setQ(null);
        const pos = q.start + ins.length;
        requestAnimationFrame(() => { const t = taRef.current; if (t) { t.focus(); t.setSelectionRange(pos, pos); } });
    }, [q, text, setText, taRef]);

    const onKeyDown = useCallback((e) => {
        if (!options.length) return false;
        if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (i + 1) % options.length); return true; }
        if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (i - 1 + options.length) % options.length); return true; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(options[idx] || options[0]); return true; }
        if (e.key === "Escape") { e.preventDefault(); setQ(null); return true; }
        return false;
    }, [options, idx, pick]);

    // Only people whose "@Name" is still in the final text are tagged.
    const collect = useCallback((value) => [...picked.current].filter(([n]) => String(value).includes(`@${n}`)).map(([, id]) => id), []);
    const reset = useCallback(() => { picked.current.clear(); setQ(null); }, []);

    return { options, idx, detect, pick, onKeyDown, collect, reset };
}