import fs from "node:fs";
import path from "node:path";

const htmlPath = process.argv[2];
if (!htmlPath) {
    console.error("Usage: node scripts/extract-grow-assets.mjs <path-to-grow.html>");
    process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pub = path.resolve("public");
fs.mkdirSync(path.join(pub, "brands"), { recursive: true });

const save = (dataUri, file) => {
    const m = /^data:image\/\w+;base64,(.+)$/.exec(dataUri);
    if (!m) throw new Error("Not a base64 image: " + file);
    fs.writeFileSync(file, Buffer.from(m[1], "base64"));
    console.log("saved", path.relative(process.cwd(), file));
};

const shot = /<figure class="shot"><img src="(data:image\/[^"]+)"/.exec(html);
if (!shot) throw new Error("Listing screenshot not found in HTML");
save(shot[1], path.join(pub, "grow_listing.jpg"));

const arr = /var L=(\[\[[\s\S]*?\]\]);\s*function tile/.exec(html);
if (!arr) throw new Error("Brand list not found in HTML");
JSON.parse(arr[1]).forEach(([name, , uri]) =>
    save(uri, path.join(pub, "brands", slug(name) + ".jpg"))
);