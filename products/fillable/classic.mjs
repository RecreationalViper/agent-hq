// Draws the "Classic Elegance" suite backgrounds (ivory, deep navy, soft gold) as vector PDFs in bg/.
// Everything is drawn in code (SVG ornaments + Cormorant Garamond / Cinzel, both SIL Open Font License,
// in fonts/). Coordinates are CSS px at 96 per inch, the same units as fields.json.
// Usage: node products/fillable/classic.mjs
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright"); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;

const C = { ivory: "#f8f4ea", navy: "#1f2d44", gold: "#b08d57", goldSoft: "#cdb88e", ink: "#4a4a52", well: "#efe8d8" };

const CSS = `
@font-face{font-family:Cormorant;src:url(${F("CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${F("CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${F("Cinzel.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${C.ivory}}
.page{position:relative;overflow:hidden}
.abs{position:absolute}
.cap{position:absolute;text-align:center;font-family:Cinzel;font-weight:500;letter-spacing:.32em;color:var(--c,${C.navy});font-size:var(--s,10px);white-space:nowrap}
.ital{position:absolute;text-align:center;font-family:Cormorant;font-style:italic;font-weight:500;color:var(--c,${C.navy})}
svg{position:absolute;overflow:visible}
`;

// ---------- ornaments ----------
const svg = (x, y, w, h, body) => `<svg style="left:${x}px;top:${y}px" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Double gold rule with small diamonds in the corners.
function frame(x, y, w, h, gap = 5, color = C.gold) {
  const d = (cx, cy, r) => `<path d="M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z" fill="${color}"/>`;
  return svg(x, y, w, h, `
    <rect x="0.6" y="0.6" width="${w - 1.2}" height="${h - 1.2}" fill="none" stroke="${color}" stroke-width="1.2"/>
    <rect x="${gap}" y="${gap}" width="${w - 2 * gap}" height="${h - 2 * gap}" fill="none" stroke="${color}" stroke-width="0.5"/>
    ${d(0.6, 0.6, 4)}${d(w - 0.6, 0.6, 4)}${d(0.6, h - 0.6, 4)}${d(w - 0.6, h - 0.6, 4)}`);
}

// Fine line - diamond - line divider, centred on cx.
function fleuron(cx, y, w, color = C.gold) {
  const h = 12, half = w / 2;
  return svg(cx - half, y - h / 2, w, h, `
    <line x1="0" y1="${h / 2}" x2="${half - 10}" y2="${h / 2}" stroke="${color}" stroke-width="0.7"/>
    <line x1="${half + 10}" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${color}" stroke-width="0.7"/>
    <path d="M${half} 1L${half + 5} ${h / 2}L${half} ${h - 1}L${half - 5} ${h / 2}Z" fill="${color}"/>
    <circle cx="${half - 8}" cy="${h / 2}" r="1.2" fill="${color}"/><circle cx="${half + 8}" cy="${h / 2}" r="1.2" fill="${color}"/>`);
}

// Laurel wreath: two mirrored branches of leaves curving up from a small tie at the bottom.
function laurel(cx, y, w, color = C.gold, sweep = 128) {
  const r = w * 0.4, L = w * 0.085, Wd = w * 0.03;
  const top = r * (1 - Math.cos(sweep * Math.PI / 180)) ;
  const h = top + L * 1.4 + 6;
  const ccx = w / 2, ccy = h - r - 4; // circle centre; bottom of the wreath at h - 4
  const P = (deg, side) => { const a = deg * Math.PI / 180; return { x: ccx - side * Math.sin(a) * r, y: ccy + Math.cos(a) * r }; };
  const leaf = (x, y2, rot, k) => `<path d="M0 0Q${(L * k / 2).toFixed(1)} ${(-Wd * k).toFixed(1)} ${(L * k).toFixed(1)} 0Q${(L * k / 2).toFixed(1)} ${(Wd * k).toFixed(1)} 0 0Z" transform="translate(${x.toFixed(1)} ${y2.toFixed(1)}) rotate(${rot.toFixed(1)})" fill="${color}"/>`;
  let out = "";
  for (const side of [-1, 1]) {
    let d = "";
    for (let i = 0; i <= 48; i++) { const p = P(8 + (sweep - 8) * i / 48, side); d += `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }
    out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(0.6, w / 300).toFixed(2)}" stroke-linecap="round"/>`;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const deg = 14 + (sweep - 18) * i / (n - 1), p = P(deg, side), q = P(deg + 1, side);
      const tang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      const k = 1 - 0.3 * i / (n - 1);
      out += leaf(p.x, p.y, tang - 32, k) + leaf(p.x, p.y, tang + 32, k);
    }
    const t = P(sweep, side), t2 = P(sweep + 1, side);
    out += leaf(t.x, t.y, Math.atan2(t2.y - t.y, t2.x - t.x) * 180 / Math.PI, 0.75);
  }
  const by = h - 4;
  out += `<circle cx="${ccx}" cy="${by}" r="${(w * 0.013).toFixed(1)}" fill="${color}"/>`;
  out += `<path d="M${ccx} ${by}q${(-w * 0.04).toFixed(1)} ${(w * 0.03).toFixed(1)} ${(-w * 0.06).toFixed(1)} ${(w * 0.035).toFixed(1)}M${ccx} ${by}q${(w * 0.04).toFixed(1)} ${(w * 0.03).toFixed(1)} ${(w * 0.06).toFixed(1)} ${(w * 0.035).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${Math.max(0.6, w / 300).toFixed(2)}"/>`;
  return svg(cx - w / 2, y, w, h + w * 0.05, out);
}

// Oval photo frame (double gold line around a soft well).
function oval(cx, cy, rx, ry, color = C.gold, well = C.well) {
  return svg(cx - rx - 10, cy - ry - 10, 2 * rx + 20, 2 * ry + 20, `
    <ellipse cx="${rx + 10}" cy="${ry + 10}" rx="${rx}" ry="${ry}" fill="${well}" stroke="${color}" stroke-width="1.3"/>
    <ellipse cx="${rx + 10}" cy="${ry + 10}" rx="${rx + 7}" ry="${ry + 7}" fill="none" stroke="${color}" stroke-width="0.5"/>`);
}
const cap = (text, cx, top, s = 10, color = C.navy, w = 500) => `<div class="cap" style="left:${cx - w / 2}px;width:${w}px;top:${top}px;--s:${s}px;--c:${color}">${text}</div>`;
const ital = (text, cx, top, s, color = C.navy, w = 700) => `<div class="ital" style="left:${cx - w / 2}px;width:${w}px;top:${top}px;font-size:${s}px;--c:${color}">${text}</div>`;
const rule = (x, y, w, color = "#d9cfba") => `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:1px;background:${color}"></div>`;

// ---------- the seven pieces ----------
const L = 264, R = 792; // panel centres on the program
const designs = {
  "classic-program": {
    w: 1056, h: 816, pages: [
      // outside: back panel (left) + cover (right)
      `${frame(26, 26, 476, 764)}${frame(554, 26, 476, 764)}
       ${laurel(L, 50, 92)}
       ${cap("A Note of Thanks", L, 160, 10)}
       ${fleuron(L, 352, 120)}
       ${cap("Reception", L, 382, 10)}
       ${fleuron(L, 526, 120)}
       ${cap("In Loving Memory", R, 78, 12)}
       ${oval(R, 255, 96, 120)}
       ${laurel(R, 586, 186)}`,
      // inside: order of service (left) + life story (right)
      `${frame(26, 26, 476, 764)}${frame(554, 26, 476, 764)}
       ${ital("Order of Service", L, 64, 32)}
       ${fleuron(L, 126, 140)}
       ${cap("In Loving Memory", R, 74, 10)}
       ${fleuron(R, 194, 140)}
       ${laurel(R, 662, 110)}`
    ]
  },
  "classic-sign": {
    w: 2304, h: 3456, pages: [
      `${frame(96, 96, 2112, 3264, 20)}
       ${laurel(1152, 250, 560)}
       ${ital("Welcome", 1152, 690, 290, C.navy, 1800)}
       ${fleuron(1152, 1150, 520)}
       ${oval(1152, 1637, 245, 300)}
       ${fleuron(1152, 2760, 520)}
       ${laurel(1152, 2860, 420)}`
    ]
  },
  "classic-card": {
    w: 408, h: 528, pages: [
      `${frame(14, 14, 380, 500)}
       ${laurel(204, 22, 72)}
       ${ital("Share a Memory", 204, 96, 36)}
       ${Array.from({ length: 7 }, (_, i) => rule(44, 214 + i * 33, 320)).join("")}
       ${cap("From", 64, 466, 8, C.navy, 60)}${rule(96, 476, 268)}`
    ]
  },
  "classic-bookmark": {
    w: 192, h: 672, pages: [
      `${frame(9, 9, 174, 654, 4)}
       ${laurel(96, 30, 84)}
       ${cap("In Loving Memory", 96, 100, 7, C.navy, 180)}
       ${fleuron(96, 236, 80)}
       ${fleuron(96, 530, 80)}
       ${laurel(96, 566, 96)}`
    ]
  },
  "classic-thankyou": {
    w: 408, h: 528, pages: [
      `${frame(14, 14, 380, 500)}
       ${laurel(204, 24, 76)}
       ${ital("Thank You", 204, 102, 44)}
       ${cap("For Your Kindness", 204, 164, 8)}
       ${fleuron(204, 192, 90)}
       ${fleuron(204, 474, 90)}`
    ]
  },
  "classic-announcement": {
    w: 540, h: 960, bg: C.navy, pages: [
      `${frame(20, 20, 500, 920, 6, C.gold)}
       ${laurel(270, 60, 150, C.gold)}
       ${cap("In Loving Memory", 270, 196, 12, C.goldSoft)}
       ${oval(270, 330, 82, 102, C.gold, "#2a3a55")}
       ${fleuron(270, 548, 140, C.gold)}
       ${fleuron(270, 870, 140, C.gold)}`
    ]
  },
  "classic-guestbook": {
    w: 816, h: 1056, pages: [
      `${frame(28, 28, 760, 1000)}
       ${laurel(408, 44, 92)}
       ${ital("Guest Book", 408, 128, 50)}
       ${cap("In Loving Memory of", 408, 196, 9)}
       ${fleuron(408, 280, 160)}
       ${cap("Name", 150, 304, 8, C.navy, 160)}
       ${cap("A Favorite Memory or Message", 528, 304, 8, C.navy, 400)}
       ${Array.from({ length: 13 }, (_, i) => rule(70, 360 + i * 52, 676, "#d6ccb6")).join("")}
       <div class="abs" style="left:310px;top:330px;width:1px;height:654px;background:#e3dac8"></div>
       ${fleuron(408, 1004, 160)}`
    ]
  }
};

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const [name, d] of Object.entries(designs)) {
  const pagesHtml = d.pages.map((body) => `<div class="page" style="width:${d.w}px;height:${d.h}px;background:${d.bg || C.ivory};page-break-after:always">${body}</div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}@page{size:${d.w}px ${d.h}px;margin:0}</style></head><body>${pagesHtml}</body></html>`;
  const file = path.join(HERE, "bg", `_${name}.html`);
  fs.writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, "bg", `${name}.pdf`), width: `${d.w}px`, height: `${d.h}px`, printBackground: true, pageRanges: `1-${d.pages.length}` });
  fs.unlinkSync(file);
  console.log("drew bg/" + name + ".pdf");
}
await browser.close();
