// src/components/seller/ExpiredLock.jsx
//
// "Frozen listing" visuals for an expired row, driven by a single `phase`:
//
//   "locked"    FROST HAS FORMED ON THE CARD. It grows in from the edges
//               (the bottom edge first and thickest), as real frost does:
//               feathery, fern-like ice crystals that branch into finer and finer
//               side-branches, a soft grey-white rim that thins out toward the
//               middle, fine grain and a few glints. Then a handful of natural
//               hairline cracks run through it: random walks that wander,
//               taper, fork and fade, each with a whitened halo.
//               Everything is random, but stable for a given listing.
//               The middle of the card stays clear, so content is fully readable.
//   "unlocking" renewal in flight: the sheet trembles, amber ripples leave the
//               padlock.
//   "released"  success: a REAL shatter, simulated with physics:
//               - the sheet jolts and fracture lines flash;
//               - it splits along a radial web (tiny pieces at the impact, bigger
//                 further out), different every time;
//               - pieces let go from the impact outwards; each is thrown a little
//                 (those next to the impact pop upward first), then falls under
//                 gravity with air drag, tumbling and flipping edge-on;
//               - ice chips and fine frost dust spray from the impact;
//               - everything drops out through the bottom of the card.
//
// The banner (yellow row) sits ABOVE the veil in the parent, so its colour is
// never touched by the frost.
//
// <FrostVeil> takes the card and padlock DOM ELEMENTS (held in state via
// callback refs by the parent). Props are unchanged, so the page needs no edits.
//
// Implementation: one <canvas> per frozen row. The texture is painted once; during
// the break it is copied and each piece draws its own cut-out of that copy, so
// frost and cracks break apart with the glass.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const TAU = Math.PI * 2;
const GREEN = "#15803d";

const HOLD = 0.12;          // s: fracture lines show, nothing falls yet
const GRAVITY = 2300;       // px / s^2
const DRAG = 1.6;           // horizontal air drag
const GROW_SECONDS = 1.7;   // how long the frost takes to form
const MAX_SHATTER = 1.9;    // hard stop (parent unmounts at 2.0s)

/* PURE-START (no DOM; geometry + random) */

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Stable per-listing seed: the frost looks different on every listing, but the
// same listing keeps its own frost between renders.
function hashSeed(v) {
    const s = String(v ?? "x");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

// A point near a random edge (bottom favoured), pushed inward by a skewed random depth.
function edgePoint(rand, W, H, maxD) {
    const r = rand();
    const d = Math.pow(rand(), 2.2) * maxD;
    if (r < 0.35) return [rand() * W, H - d];
    if (r < 0.5) return [rand() * W, d];
    if (r < 0.75) return [d, rand() * H];
    return [W - d, rand() * H];
}

// A frost crystal: a stem with symmetric side branches that get shorter toward the
// tip, each carrying finer branches of its own (up to 3 levels), like a fern.
function fern(rand, x, y, ang, len, depth, t0, dur, alpha, out) {
    const step = 3;
    const n = Math.max(2, Math.round(len / step));
    const pts = [[x, y]], angs = [ang], cum = [0];
    let a = ang, px = x, py = y;
    const curve = (rand() - 0.5) * 0.05;
    for (let i = 1; i <= n; i++) {
        a += (rand() - 0.5) * 0.16 + curve;
        px += Math.cos(a) * step;
        py += Math.sin(a) * step;
        pts.push([px, py]); angs.push(a); cum.push(i * step);
    }
    const total = n * step;
    out.push({ kind: "fern", pts, cum, total, w0: [1.1, 0.75, 0.5][depth], alpha, t0, dur });
    if (depth >= 2) return;

    const gap = depth === 0 ? 5.5 + rand() * 3.5 : 4.5 + rand() * 2.5;
    for (let d = gap; d < total - 3; d += gap * (0.8 + rand() * 0.5)) {
        const i = Math.min(n, Math.round(d / step));
        const frac = d / total;
        const bl = len * 0.36 * (1 - frac * 0.65) * (0.7 + rand() * 0.6);
        if (bl < (depth === 0 ? 6 : 4)) continue;
        for (const s of [-1, 1]) {
            if (rand() < 0.18) continue; // not perfectly symmetric
            fern(rand, pts[i][0], pts[i][1], angs[i] + s * (0.85 + rand() * 0.35), bl,
                depth + 1, t0 + dur * frac, Math.max(0.15, dur * 0.45), alpha * 0.9, out);
        }
    }
}

// A natural crack: a wandering, slightly curving random walk that forks at random.
function crack(rand, x, y, ang, len, depth, t0, dur, alpha, w0, out) {
    const pts = [[x, y]], cum = [0];
    let a = ang, px = x, py = y, total = 0;
    const drift = (rand() - 0.5) * 0.06;
    const forks = [];
    while (total < len) {
        const step = 3 + rand() * 3;
        a += (rand() - 0.5) * 0.55 + drift;
        px += Math.cos(a) * step;
        py += Math.sin(a) * step;
        total += step;
        pts.push([px, py]); cum.push(total);
        if (depth < 2 && total > 8 && rand() < 0.07) forks.push({ i: pts.length - 1, a });
    }
    out.push({ kind: "crack", pts, cum, total, w0, alpha, t0, dur });
    forks.forEach((f) => {
        const side = rand() < 0.5 ? -1 : 1;
        crack(rand, pts[f.i][0], pts[f.i][1], f.a + side * (0.4 + rand() * 0.5),
            (len - cum[f.i]) * (0.3 + rand() * 0.35) + 4, depth + 1,
            t0 + dur * (cum[f.i] / total), Math.max(0.1, dur * 0.5), alpha * 0.85, w0 * 0.8, out);
    });
}

function buildStrokes(rand, W, H) {
    const out = [];

    // 1) frost creeping in from all four edges (bottom thickest)
    const edges = [
        { len: W, pos: (u) => [u, H], dir: -Math.PI / 2, dens: 16, boost: 1.25 },
        { len: W, pos: (u) => [u, 0], dir: Math.PI / 2, dens: 24, boost: 0.8 },
        { len: H, pos: (u) => [0, u], dir: 0, dens: 20, boost: 1 },
        { len: H, pos: (u) => [W, u], dir: Math.PI, dens: 20, boost: 1 },
    ];
    edges.forEach((e) => {
        const cap = Math.min(W, H) * 0.6;
        for (let u = rand() * 10; u < e.len; u += e.dens * (0.6 + rand() * 0.9)) {
            const [x, y] = e.pos(u);
            const len = Math.min(cap, (18 + Math.pow(rand(), 1.6) * 62) * e.boost);
            fern(rand, x, y, e.dir + (rand() - 0.5) * 0.9, len, 0,
                rand() * 0.55, 0.55 + len / 160, 0.55 + rand() * 0.45, out);
        }
    });

    // 2) a few lone crystals that seeded away from the edges
    const lone = Math.round((W * H) / 7000);
    for (let i = 0; i < lone; i++) {
        fern(rand, rand() * W, rand() * H, rand() * TAU, 12 + rand() * 14, 1,
            rand() * 0.9, 0.35 + rand() * 0.2, 0.4 + rand() * 0.4, out);
    }

    // 3) natural cracks, appearing after the frost: some start at an edge, some inside
    const nCracks = Math.round((W * H) / 22000) + 4;
    for (let i = 0; i < nCracks; i++) {
        let x, y, ang;
        if (rand() < 0.4) {
            [x, y] = edgePoint(rand, W, H, 6);
            const cx = W / 2 - x, cy = H / 2 - y;
            ang = Math.atan2(cy, cx) + (rand() - 0.5) * 1.2;
        } else {
            x = rand() * W; y = rand() * H; ang = rand() * TAU;
        }
        const len = 25 + Math.pow(rand(), 1.4) * 95;
        crack(rand, x, y, ang, len, 0, 0.9 + rand() * 0.6, 0.25 + len / 400, 0.5 + rand() * 0.5, 1.0, out);
    }
    // fine crazing, mostly where the frost is
    const crazing = Math.round((W * H) / 4500);
    for (let i = 0; i < crazing; i++) {
        const [x, y] = rand() < 0.7 ? edgePoint(rand, W, H, Math.min(W, H) * 0.5) : [rand() * W, rand() * H];
        crack(rand, x, y, rand() * TAU, 6 + rand() * 9, 2, 1.0 + rand() * 0.6, 0.15, 0.3 + rand() * 0.2, 0.6, out);
    }
    return out;
}

// Sutherland–Hodgman: clip a polygon to the card rectangle.
function clipPoly(poly, w, h) {
    const planes = [
        { inside: (p) => p[0] >= 0, cut: (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + (b[1] - a[1]) * t]; } },
        { inside: (p) => p[0] <= w, cut: (a, b) => { const t = (w - a[0]) / (b[0] - a[0]); return [w, a[1] + (b[1] - a[1]) * t]; } },
        { inside: (p) => p[1] >= 0, cut: (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, 0]; } },
        { inside: (p) => p[1] <= h, cut: (a, b) => { const t = (h - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, h]; } },
    ];
    let out = poly;
    for (const pl of planes) {
        const input = out;
        out = [];
        for (let i = 0; i < input.length; i++) {
            const a = input[i], b = input[(i + 1) % input.length];
            const ai = pl.inside(a), bi = pl.inside(b);
            if (ai) out.push(a);
            if (ai !== bi) out.push(pl.cut(a, b));
        }
        if (!out.length) return [];
    }
    return out;
}

function polyArea(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
}

// Radial web around the impact: tiny pieces near it, bigger further out. Random
// ray count, ring spacing, wobble and splits, so no two breaks look alike.
function buildShards(rand, W, H, cx, cy) {
    const maxD = Math.max(
        Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy), 1
    );
    const N = 22 + Math.floor(rand() * 11);
    const a0 = rand() * TAU;
    const growth = 1.24 + rand() * 0.06;
    const radii = [0, 12 + rand() * 10];
    while (radii[radii.length - 1] < maxD + 20) radii.push(radii[radii.length - 1] * growth);
    const K = radii.length - 1;
    const wob = Array.from({ length: N }, () => (rand() - 0.5) * 0.4);

    const V = [[[cx, cy]]];
    for (let k = 1; k <= K; k++) {
        const row = [];
        for (let j = 0; j < N; j++) {
            const ang = a0 + ((j + wob[j] + (rand() - 0.5) * 0.3) * TAU) / N;
            const rad = radii[k] * (1 + (rand() - 0.5) * 0.2);
            row.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
        }
        V.push(row);
    }

    const shards = [];
    const add = (poly) => {
        const c = clipPoly(poly, W, H);
        if (c.length < 3) return;
        const area = polyArea(c);
        if (area < 6) return;
        const mx = c.reduce((s, p) => s + p[0], 0) / c.length;
        const my = c.reduce((s, p) => s + p[1], 0) / c.length;
        const dist = Math.hypot(mx - cx, my - cy);
        const away = dist > 0 ? [(mx - cx) / dist, (my - cy) / dist] : [0, 0];
        const f = 1 - Math.min(1, dist / maxD);          // 1 at the impact, 0 far away
        const small = area < 500;
        const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
        shards.push({
            poly: c, mx, my,
            x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
            tint: 0.08 + rand() * 0.1,
            // the break spreads outward from the impact
            delay: HOLD + Math.pow(dist / maxD, 0.8) * 0.35 + rand() * 0.05,
            // thrown outward; pieces right next to the impact also pop upward
            vx: away[0] * (30 + rand() * 90) * (0.4 + f) + (rand() - 0.5) * 40,
            vy: away[1] * (20 + rand() * 60) * (0.4 + f) - (50 + rand() * 150) * f * f,
            w: (rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 5) * (small ? 1.6 : 0.8),
            ph: rand() * TAU, fr: 2 + rand() * 6,
        });
    };

    for (let j = 0; j < N; j++) add([V[0][0], V[1][j], V[1][(j + 1) % N]]);
    for (let k = 1; k < K; k++) {
        for (let j = 0; j < N; j++) {
            const j2 = (j + 1) % N;
            const q = [V[k][j], V[k][j2], V[k + 1][j2], V[k + 1][j]];
            if (rand() < 0.35) { add([q[0], q[1], q[2]]); add([q[0], q[2], q[3]]); }
            else add(q);
        }
    }
    return shards;
}

/* PURE-END */

/* ============================== canvas painting ============================== */

// Soft grey-white frost rim, blotchy and irregular, thinning toward the middle,
// plus grain and a few glints. Grey-biased on purpose: the card is white, so
// pure-white frost would be invisible.
function paintBase(ctx, rand, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(214,221,227,0.07)";
    ctx.fillRect(0, 0, W, H);

    const maxD = Math.min(W, H) * 0.55;
    const blob = (x, y, r, a) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(203,211,218,${a})`);
        g.addColorStop(1, "rgba(203,211,218,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const nBlobs = Math.round((W * H) / 2600) + 20;
    for (let i = 0; i < nBlobs; i++) {
        const [x, y] = edgePoint(rand, W, H, maxD);
        const d = Math.min(Math.min(x, W - x), Math.min(y, H - y));
        const k = Math.max(0.25, 1 - d / maxD);
        blob(x, y, 10 + rand() * 30, (0.06 + rand() * 0.1) * k);
    }
    for (let i = 0; i < 5; i++) blob(rand() * W, rand() * H, 20 + rand() * 40, 0.03 + rand() * 0.04);

    const dots = Math.min(900, Math.round((W * H) / 190));
    for (let i = 0; i < dots; i++) {
        const [x, y] = rand() < 0.7 ? edgePoint(rand, W, H, maxD) : [rand() * W, rand() * H];
        const s = 0.7 + rand() * 1.1;
        ctx.fillStyle = rand() < 0.55
            ? `rgba(255,255,255,${0.5 + rand() * 0.45})`
            : `rgba(125,136,146,${0.16 + rand() * 0.18})`;
        ctx.fillRect(x, y, s, s);
    }

    ctx.lineCap = "round";
    for (let i = 0; i < 10; i++) {
        const [x, y] = edgePoint(rand, W, H, maxD);
        const l = 2.5 + rand() * 3;
        ctx.strokeStyle = "rgba(120,132,142,0.35)";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke();
    }
}

// Draw the first `p` (0..1) of a stroke's length. Ferns are one path in two passes
// (grey body, white core). Cracks taper segment by segment, in three passes
// (whitened halo, dark fissure, light lip).
function paintStroke(ctx, s, p) {
    const lim = s.total * p;
    const pts = s.pts, cum = s.cum;

    // collect the visible polyline (last point interpolated)
    const vis = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
        if (cum[i] <= lim) vis.push(pts[i]);
        else {
            const seg = cum[i] - cum[i - 1];
            const f = seg > 0 ? (lim - cum[i - 1]) / seg : 0;
            vis.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
            break;
        }
    }
    if (vis.length < 2) return;

    if (s.kind === "fern") {
        ctx.beginPath();
        ctx.moveTo(vis[0][0], vis[0][1]);
        for (let i = 1; i < vis.length; i++) ctx.lineTo(vis[i][0], vis[i][1]);
        ctx.strokeStyle = `rgba(140,154,166,${0.32 * s.alpha})`;
        ctx.lineWidth = s.w0 * 1.9;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * s.alpha})`;
        ctx.lineWidth = s.w0 * 0.8;
        ctx.stroke();
        return;
    }

    for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < vis.length; i++) {
            const w = s.w0 * (1 - 0.7 * (cum[i - 1] / s.total));
            let ox = 0, oy = 0;
            if (pass === 0) { ctx.strokeStyle = `rgba(255,255,255,${0.16 * s.alpha})`; ctx.lineWidth = w * 4.5; }
            else if (pass === 1) { ctx.strokeStyle = `rgba(62,74,84,${0.62 * s.alpha})`; ctx.lineWidth = w; }
            else { ctx.strokeStyle = `rgba(255,255,255,${0.85 * s.alpha})`; ctx.lineWidth = w * 0.6; ox = -0.6; oy = -0.6; }
            ctx.beginPath();
            ctx.moveTo(vis[i - 1][0] + ox, vis[i - 1][1] + oy);
            ctx.lineTo(vis[i][0] + ox, vis[i][1] + oy);
            ctx.stroke();
        }
    }
}

function paintStrokes(ctx, strokes, t) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
        const q = (t - s.t0) / s.dur;
        if (q <= 0) continue;
        const p = q >= 1 ? 1 : 1 - Math.pow(1 - q, 2);
        paintStroke(ctx, s, p);
    }
}

/* ============================== measuring ============================== */

// Measures the card and the centre of the padlock. Debounced so the numbers
// settle after the banner's height animation. Keeps the last good measurement
// if the padlock unmounts (the banner collapsing after a renewal).
function useBox(container, target) {
    const [box, setBox] = useState(null);
    useEffect(() => {
        if (!container || !target) return;
        let timer;
        const measure = () => {
            const cr = container.getBoundingClientRect();
            const tr = target.getBoundingClientRect();
            if (!cr.width) return;
            const next = {
                w: cr.width, h: cr.height,
                cx: tr.left - cr.left + tr.width / 2,
                cy: tr.top - cr.top + tr.height / 2,
            };
            setBox((p) =>
                p && Math.abs(p.w - next.w) < 0.5 && Math.abs(p.h - next.h) < 0.5 &&
                    Math.abs(p.cx - next.cx) < 0.5 && Math.abs(p.cy - next.cy) < 0.5 ? p : next
            );
        };
        const schedule = () => { clearTimeout(timer); timer = setTimeout(measure, 120); };
        schedule();
        const ro = new ResizeObserver(schedule);
        ro.observe(container);
        ro.observe(target);
        window.addEventListener("resize", schedule);
        document.fonts?.ready?.then(schedule);
        return () => { clearTimeout(timer); ro.disconnect(); window.removeEventListener("resize", schedule); };
    }, [container, target]);
    return box;
}

/* ============================== shatter simulation ============================== */

// Builds one shatter and returns draw(ctx, t) -> true while anything is still moving.
// `tex` is a snapshot of the finished frost; each piece draws its own cut-out of it.
function createShatter(rand, tex, W, H, dpr, cx, cy) {
    const ix = cx + (rand() - 0.5) * 10, iy = cy + (rand() - 0.5) * 10;
    const shards = buildShards(rand, W, H, ix, iy);

    const chips = Array.from({ length: 22 }, () => {
        const ang = rand() * TAU, sp = 60 + rand() * 260;
        return {
            size: 2 + rand() * 3.5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 90,
            delay: HOLD + rand() * 0.1, rot: rand() * TAU, w: (rand() - 0.5) * 16, life: 0.8 + rand() * 0.4,
        };
    });
    const dust = Array.from({ length: 36 }, () => {
        const ang = rand() * TAU, sp = 30 + rand() * 120;
        return {
            size: 0.8 + rand() * 1.2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            delay: HOLD + rand() * 0.15, life: 0.5 + rand() * 0.4,
        };
    });

    return function draw(ctx, t) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const shake = t < 0.3 ? (1 - t / 0.3) * 2.2 : 0;
        const shx = (Math.random() - 0.5) * 2 * shake;
        const shy = (Math.random() - 0.5) * 2 * shake;
        const ramp = Math.min(1, t / HOLD);
        const edgeA = Math.min(1, t / 0.08);

        let alive = 0;
        for (const s of shards) {
            const tau = t - s.delay;
            let ox = shx, oy = shy, ang = 0, flip = 1;
            if (tau > 0) {
                ox = (s.vx * (1 - Math.exp(-DRAG * tau))) / DRAG;
                oy = s.vy * tau + 0.5 * GRAVITY * tau * tau;
                ang = s.w * tau;
                flip = 1 - (1 - Math.abs(Math.cos(s.ph + s.fr * tau))) * 0.7; // tumbling edge-on
                if (s.my + oy > H + 80) continue; // gone
            }
            alive++;

            ctx.save();
            ctx.translate(s.mx + ox, s.my + oy);
            if (ang) ctx.rotate(ang);
            if (flip !== 1) ctx.scale(flip, 1);
            ctx.translate(-s.mx, -s.my);

            ctx.beginPath();
            ctx.moveTo(s.poly[0][0], s.poly[0][1]);
            for (let i = 1; i < s.poly.length; i++) ctx.lineTo(s.poly[i][0], s.poly[i][1]);
            ctx.closePath();
            ctx.clip();

            const sx = Math.max(0, s.x0 - 1), sy = Math.max(0, s.y0 - 1);
            const sw = Math.min(W, s.x1 + 1) - sx, sh = Math.min(H, s.y1 + 1) - sy;
            if (sw > 0 && sh > 0) ctx.drawImage(tex, sx * dpr, sy * dpr, sw * dpr, sh * dpr, sx, sy, sw, sh);

            ctx.globalAlpha = ramp;
            ctx.fillStyle = `rgba(200,209,216,${s.tint})`;
            ctx.fill();
            ctx.globalAlpha = edgeA;
            ctx.strokeStyle = "rgba(110,122,132,0.45)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        // ice chips: thrown out, then falling
        let loose = 0;
        for (const c of chips) {
            const tau = t - c.delay;
            if (tau < 0) { loose++; continue; }
            const y = iy + c.vy * tau + 0.5 * GRAVITY * tau * tau;
            if (tau > c.life || y > H + 20) continue;
            loose++;
            const x = ix + (c.vx * (1 - Math.exp(-DRAG * tau))) / DRAG;
            const a = 1 - Math.max(0, (tau - c.life * 0.7) / (c.life * 0.3));
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(x, y);
            ctx.rotate(c.rot + c.w * tau);
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.strokeStyle = "rgba(120,132,142,0.75)";
            ctx.lineWidth = 0.8;
            ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.7);
            ctx.strokeRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.7);
            ctx.restore();
        }
        // fine frost dust
        for (const p of dust) {
            const tau = t - p.delay;
            if (tau < 0) { loose++; continue; }
            if (tau > p.life) continue;
            loose++;
            const k = 3;
            const x = ix + (p.vx * (1 - Math.exp(-k * tau))) / k;
            const y = iy + (p.vy * (1 - Math.exp(-k * tau))) / k + 30 * tau * tau;
            ctx.globalAlpha = 0.7 * (1 - tau / p.life);
            ctx.fillStyle = "rgb(150,162,172)";
            ctx.beginPath(); ctx.arc(x, y, p.size, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        return alive > 0 || loose > 0;
    };
}

/* ============================== the frost + shatter ============================== */

export function FrostVeil({ container, target, phase = "locked", reduceMotion = false, seed = 1 }) {
    const box = useBox(container, target);
    const canvasRef = useRef(null);
    const dataRef = useRef(null);       // { W, H, dpr, cx, cy }
    const finalDrawRef = useRef(null);  // paints the finished frost
    const growRaf = useRef(0);
    const simRaf = useRef(0);
    const grownRef = useRef(false);
    const shatterRef = useRef(false);

    // Paint the frost whenever the card is (re)measured. Growth plays once.
    useEffect(() => {
        if (!box || shatterRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const W = box.w, H = box.h;
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (W * H))));
        canvas.width = Math.ceil(W * dpr);
        canvas.height = Math.ceil(H * dpr);
        const ctx = canvas.getContext("2d");
        dataRef.current = { W, H, dpr, cx: box.cx, cy: box.cy };

        const rand = mulberry32(hashSeed(seed));
        const strokes = buildStrokes(rand, W, H);

        const base = document.createElement("canvas");
        base.width = canvas.width; base.height = canvas.height;
        const bctx = base.getContext("2d");
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintBase(bctx, rand, W, H);

        const draw = (t, baseAlpha) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.globalAlpha = baseAlpha;
            ctx.drawImage(base, 0, 0, W, H);
            ctx.globalAlpha = 1;
            paintStrokes(ctx, strokes, t);
        };
        const finish = () => { draw(99, 1); base.width = 0; base.height = 0; };
        finalDrawRef.current = () => { if (base.width) draw(99, 1); };

        if (grownRef.current || reduceMotion) { grownRef.current = true; finish(); return; }

        let start = null;
        const loop = (now) => {
            if (start == null) start = now;
            const t = (now - start) / 1000;
            if (t >= GROW_SECONDS + 0.2) { grownRef.current = true; finish(); return; }
            const a = Math.min(1, t / 0.9);
            draw(t, 1 - Math.pow(1 - a, 2));
            growRaf.current = requestAnimationFrame(loop);
        };
        growRaf.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(growRaf.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box, seed]);

    // The break
    useEffect(() => {
        if (phase !== "released" || shatterRef.current) return;
        const canvas = canvasRef.current;
        const d = dataRef.current;
        if (!canvas || !d) return;
        shatterRef.current = true;
        cancelAnimationFrame(growRaf.current);
        if (reduceMotion) return; // the canvas just fades out via CSS

        finalDrawRef.current?.();
        const { W, H, dpr } = d;
        const ctx = canvas.getContext("2d");

        // snapshot of the finished frost: every piece draws its own cut-out of it
        const tex = document.createElement("canvas");
        tex.width = canvas.width; tex.height = canvas.height;
        tex.getContext("2d").drawImage(canvas, 0, 0);

        const rand = mulberry32((Math.random() * 4294967296) >>> 0);
        const draw = createShatter(rand, tex, W, H, dpr, d.cx, d.cy);

        const t0 = performance.now();
        const frame = (now) => {
            const t = (now - t0) / 1000;
            if (!draw(ctx, t) || t > MAX_SHATTER) { ctx.clearRect(0, 0, W, H); return; }
            simRaf.current = requestAnimationFrame(frame);
        };
        simRaf.current = requestAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    useEffect(() => () => {
        cancelAnimationFrame(growRaf.current);
        cancelAnimationFrame(simRaf.current);
    }, []);

    if (!box) return null;

    const unlocking = phase === "unlocking";
    const fadeOut = phase === "released" && reduceMotion;

    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
            {/* tremble while the renewal request is in flight */}
            <motion.div
                className="absolute inset-0"
                animate={{ x: unlocking && !reduceMotion ? [0, -1.4, 1.4, -1, 1, 0] : 0 }}
                transition={unlocking && !reduceMotion
                    ? { duration: 0.45, repeat: Infinity, ease: "linear" }
                    : { duration: 0.12 }}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute left-0 top-0"
                    style={{
                        width: box.w, height: box.h,
                        opacity: fadeOut ? 0 : 1, transition: "opacity 0.3s ease",
                    }}
                />
            </motion.div>

            {/* warm ripples while renewing */}
            {unlocking && !reduceMotion && [0, 1].map((i) => (
                <motion.span
                    key={i}
                    className="absolute rounded-full border-2"
                    style={{ left: box.cx - 24, top: box.cy - 24, width: 48, height: 48, borderColor: "#f59e0b" }}
                    initial={{ scale: 0.5, opacity: 0.5 }}
                    animate={{ scale: [0.5, 3.2], opacity: [0.5, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
                />
            ))}
        </div>
    );
}

/* ============================== padlock ============================== */

// Colour story: cold grey (locked) -> warm amber (renewing) -> green (open).
// `innerRef` lets the parent hand the element to <FrostVeil> as the impact point.
export function PadlockBadge({ phase = "locked", reduceMotion = false, innerRef }) {
    const open = phase === "released";
    const working = phase === "unlocking";
    const pal = open
        ? { bg: "#dcfce7", fg: GREEN }
        : working
            ? { bg: "#fef3c7", fg: "#b45309" }
            : { bg: "#e5e7eb", fg: "#4b5563" };
    return (
        <motion.span
            ref={innerRef}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
            animate={{
                scale: working && !reduceMotion ? [1, 1.08, 1] : 1,
                opacity: 1,
                backgroundColor: pal.bg,
                color: pal.fg,
            }}
            transition={{
                default: { duration: 0.3 },
                scale: working && !reduceMotion
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                    : { type: "spring", stiffness: 380, damping: 20, delay: open ? 0 : 0.2 },
            }}
        >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <motion.g
                    style={{ originX: 1, originY: 1 }}
                    animate={{ y: open ? -4 : working ? -1.5 : 0, rotate: open ? -32 : working ? -6 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: open ? 14 : 24 }}
                >
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </motion.g>
                <rect x="4.5" y="11" width="15" height="10" rx="2.2" fill="currentColor" fillOpacity="0.15" />
                <circle cx="12" cy="16" r="1.1" fill="currentColor" stroke="none" />
            </svg>
        </motion.span>
    );
}