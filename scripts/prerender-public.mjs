// scripts/prerender-public.mjs
// Run AFTER `vite build`. Writes dist/<route>/index.html for every public page
// with the real <title>, meta description, canonical link and the full page
// text inside <div id="root">. Crawlers, link checkers and bank / payment
// gateway reviewers (who may not run JavaScript) then see the content.
//
// React still uses createRoot(), so it simply replaces this static markup when
// the app boots; there is no hydration mismatch.
//
// package.json:  "build": "vite build && node scripts/prerender-public.mjs"

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_PAGE_LIST } from "../src/data/publicPages.js";
import { COMPANY, FOOTER_LINKS, SERVICES, addressOneLine } from "../src/config/company.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const withBreaks = (s) => esc(s).replace(/\n/g, "<br>");

function footerHtml() {
    const links = FOOTER_LINKS.map((l) => `<li><a href="${esc(l.to)}">${esc(l.label)}</a></li>`).join("");
    return `<footer>
<h2>${esc(COMPANY.legalName)}</h2>
<p>${esc(addressOneLine())}<br>CIN: ${esc(COMPANY.cin)}${COMPANY.gstin ? `<br>GSTIN: ${esc(COMPANY.gstin)}` : ""}<br>Email: <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a><br>Phone: <a href="tel:${esc(COMPANY.phone)}">${esc(COMPANY.phoneDisplay)}</a></p>
<nav aria-label="Policies and information"><ul>${links}</ul></nav>
</footer>`;
}

function bodyHtml(page) {
    const parts = [
        `<main style="max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.7">`,
        `<h1>${esc(page.title)}</h1>`,
        `<p>${esc(page.intro)}</p>`,
        `<p><small>Last updated: ${esc(page.lastUpdated)}</small></p>`,
    ];
    for (const item of page.content) {
        if (item.k === "h1") parts.push(`<h2>${esc(item.t)}</h2>`);
        else if (item.k === "h2") parts.push(`<h3>${esc(item.t)}</h3>`);
        else parts.push(`<p>${withBreaks(item.t)}</p>`);
    }
    parts.push(`<p><em>${esc(page.disclaimer)}</em></p>`, footerHtml(), `</main>`);
    return parts.join("\n");
}

const template = await readFile(path.join(dist, "index.html"), "utf8");
if (!/<div id="root">\s*<\/div>/.test(template)) {
    throw new Error('dist/index.html has no empty <div id="root"></div>; adjust the pattern in prerender-public.mjs');
}

for (const page of PUBLIC_PAGE_LIST) {
    const url = `${COMPANY.siteUrl}${page.path}`;
    const head = `<meta name="description" content="${esc(page.metaDescription)}">\n<link rel="canonical" href="${esc(url)}">`;

    let html = template
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.metaTitle)}</title>`)
        .replace(/<meta\s+name="description"[^>]*>/i, "")
        .replace(/<link\s+rel="canonical"[^>]*>/i, "")
        .replace("</head>", `${head}\n</head>`)
        .replace(/<div id="root">\s*<\/div>/, () => `<div id="root">${bodyHtml(page)}</div>`);

    const outDir = path.join(dist, page.path.replace(/^\//, ""));
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html, "utf8");
    console.log(`prerendered ${page.path}  (${page.content.length} blocks)`);
}

const services = SERVICES.map((s) => `<li><strong>${esc(s.name)}</strong>: ${esc(s.text)}</li>`).join("");
const noscript = `<noscript><main style="max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.7">
<h1>${esc(COMPANY.legalName)} (${esc(COMPANY.brand)})</h1>
<p>A business-to-business company serving registered businesses: manufacturers, brand owners, distributors, traders and exporters.</p>
<h2>Our services</h2><ul>${services}</ul>
<p><a href="/services">Services</a> · <a href="/pricing">Pricing &amp; fees</a></p>
${footerHtml()}
</main></noscript>`;
await writeFile(path.join(dist, "index.html"), template.replace("</body>", `${noscript}\n</body>`), "utf8");
console.log("added noscript home content to dist/index.html");
