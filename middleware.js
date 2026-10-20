// middleware.js  (frontend project ROOT, next to index.html and vercel.json)
// npm i @vercel/edge
// Env (Vercel frontend project): SEO_API_BASE = your live backend base URL, no trailing slash
import { next } from "@vercel/edge";

export const config = {
    // skip API, static assets and anything with a file extension (so /sitemap.xml, /favicon.ico etc. pass through)
    matcher: ["/((?!api|assets|.*\\..*).*)"],
};

const BOTS =
    /googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slackbot|telegrambot|discordbot|embedly/i;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default async function middleware(request) {
    const ua = request.headers.get("user-agent") || "";
    if (!BOTS.test(ua)) return next();

    try {
        const url = new URL(request.url);
        const apiBase = process.env.SEO_API_BASE;
        if (!apiBase) return next();

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);

        const [metaRes, shellRes] = await Promise.all([
            fetch(`${apiBase}/api/seo/ssr-meta?path=${encodeURIComponent(url.pathname)}`, {
                headers: { "x-seo-source": "edge", "user-agent": ua },
                signal: ctrl.signal,
            }),
            fetch(new URL("/index.html", url), { signal: ctrl.signal }),
        ]);
        clearTimeout(timer);
        if (!metaRes.ok || !shellRes.ok) return next();

        const seo = await metaRes.json();
        let html = await shellRes.text();

        // data-rh="true" is react-helmet-async's marker: when the app boots, Helmet REPLACES these tags
        // instead of adding a second set (two canonical/robots tags would confuse Google).
        const metaTags = (seo.meta || [])
            .map((m) => `<meta data-rh="true" ${m.name ? `name="${esc(m.name)}"` : `property="${esc(m.property)}"`} content="${esc(m.content)}">`)
            .join("");
        const linkTags = (seo.link || []).map((l) => `<link data-rh="true" rel="${esc(l.rel)}" href="${esc(l.href)}">`).join("");

        html = html
            .replace(/<title>[\s\S]*?<\/title>/i, `<title data-rh="true">${esc(seo.title)}</title>`)
            .replace("</head>", `${metaTags}${linkTags}</head>`);

        return new Response(html, {
            headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
            },
        });
    } catch {
        return next(); // never break the page for a bot because the SEO lookup failed
    }
}