// src/lib/legalContent.js
// Cleans legal content arrays of the shape [{ t: string, k: "h1" | "h2" | "body" }].
//
// The Terms were auto-generated from a .docx and carry artefacts that show up
// publicly: "Top of Form"/"Bottom of Form" lines, an internal drafting note,
// headings glued onto the end of the previous paragraph, paragraphs flagged as
// headings, headings that lost their leading digit, a missing section heading
// and duplicated blocks. This fixes them at load time so the 200 KB source
// file does not have to be hand-edited. (The numbering gaps in the source,
// e.g. no 7.33 / 7.36, and the duplicated 4.x numbering still need a lawyer.)
//
// Plain JS, no imports: also loaded by scripts/prerender-public.mjs in Node.

const JUNK = new Set(["top of form", "bottom of form"]);
const DRAFT_NOTES = [/^This establishes the general restriction framework/i];

// "3.1 Registration and Eligibility" (short, no full stop, not a sentence)
const SUB_HEADING = /^(\d{1,2}\.\d{1,3})\s+([A-Z][^\n.:]{2,120})$/;
// "...Applicable Law. 7.117 Payment and Settlement \u2014 Limitation..."
const TRAIL_SUB = /^([\s\S]*?\.)\s+(\d{1,2}\.\d{1,3})\s+([A-Z][^\n.:]{2,120})$/;
// "...Applicable Law. 23. GOVERNING LAW AND JURISDICTION"
const TRAIL_H1 = /^([\s\S]*?\.)\s+(\d{1,2})\.\s+([A-Z][A-Z0-9 ,&'\u2019/\-\u2013\u2014]{5,})$/;
// ".56 Payment Processing ..." (the leading "7" was lost; only happens in Section 7)
const LOST_NUMBER = /^\.(\d{2,3})\s+([A-Z].{3,140})$/;

function expandBody(text) {
    let rest = text;
    const tail = [];

    let m = rest.match(TRAIL_H1);
    if (m) {
        rest = m[1];
        tail.push({ t: `${m[2]}. ${m[3].trim()}`, k: "h1" });
    } else {
        m = rest.match(TRAIL_SUB);
        if (m) {
            rest = m[1];
            tail.push({ t: `${m[2]} ${m[3].trim()}`, k: "h2" });
        }
    }

    const out = [];
    rest
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((piece, i) => {
            // Only pieces that were glued on after a blank line can be headings.
            const sub = i > 0 ? piece.match(SUB_HEADING) : null;
            if (sub) out.push({ t: `${sub[1]} ${sub[2].trim()}`, k: "h2" });
            else out.push({ t: piece, k: "body" });
        });

    return [...out, ...tail];
}

function expandItem(item) {
    const t = String(item?.t ?? "").trim();
    if (!t) return [];
    if (JUNK.has(t.toLowerCase()) || DRAFT_NOTES.some((r) => r.test(t))) return [];

    if (item.k === "h1") return [{ t, k: "h1" }];

    if (item.k === "h2") {
        // A clause (e.g. "24.5.1 The seat of arbitration...") flagged as a heading.
        if (t.length > 110 || /^\d+\.\d+\.\d+/.test(t)) return expandBody(t);
        return [{ t, k: "h2" }];
    }

    const lost = t.match(LOST_NUMBER);
    if (lost) return [{ t: `7.${lost[1]} ${lost[2]}`, k: "h2" }];

    return expandBody(t);
}

function fixHeadings(items, { renameH1, missingH1 }) {
    const out = [];
    const seenH1 = new Set();
    for (const it of items) {
        if (it.k === "h1") {
            const t = renameH1[it.t] ?? it.t;
            const num = t.match(/^(\d{1,2})\./);
            if (num) seenH1.add(num[1]);
            out.push({ ...it, t });
            continue;
        }
        if (it.k === "h2") {
            const num = it.t.match(/^(\d{1,2})\.1\s/);
            if (num && missingH1[num[1]] && !seenH1.has(num[1])) {
                out.push({ t: missingH1[num[1]], k: "h1" });
                seenH1.add(num[1]);
            }
        }
        out.push(it);
    }
    return out;
}

// Drops a "## heading + paragraphs" block when an identical one already appeared.
function dedupeBlocks(items) {
    const seen = new Set();
    const out = [];
    let i = 0;
    while (i < items.length) {
        if (items[i].k !== "h2") {
            out.push(items[i]);
            i += 1;
            continue;
        }
        let j = i + 1;
        while (j < items.length && items[j].k === "body") j += 1;
        const block = items.slice(i, j);
        const key = block.map((b) => b.t).join("\u0001");
        if (block.length > 1 && seen.has(key)) {
            i = j;
            continue;
        }
        seen.add(key);
        out.push(...block);
        i = j;
    }
    return out;
}

export function normalizeLegalContent(raw, options = {}) {
    const { renameH1 = {}, missingH1 = {} } = options;
    const expanded = raw.flatMap(expandItem);
    return dedupeBlocks(fixHeadings(expanded, { renameH1, missingH1 }));
}

// Joins lines, skipping empty ones, for contact-style blocks.
export function lines(...parts) {
    return parts.filter(Boolean).join("\n");
}