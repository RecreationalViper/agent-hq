// Draws the backgrounds for three new collections as vector PDFs in bg/, on the same proven geometry as
// Classic Elegance (so the fill-in fields line up the same way):
//   golden  = Golden Hour (celebration of life: sunflowers, warm cream, terracotta)
//   grace   = Homegoing Grace (faith: dove in gold light, plum and gold; dark sign + phone card, light paper pieces)
//   rainbow = Rainbow Bridge (pet memorial: pastel rainbow, paw prints)
// All art is drawn in code; fonts are SIL Open Font License files in fonts/.
// Usage: node products/fillable/suites.mjs [golden|grace|rainbow]
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright"); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;

const FONTS = `
@font-face{font-family:Cormorant;src:url(${F("CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${F("CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${F("Cinzel.ttf")})}
@font-face{font-family:Baskerville;src:url(${F("GFSBaskerville.otf")})}
@font-face{font-family:Caladea;src:url(${F("Caladea-Regular.ttf")})}
@font-face{font-family:Caladea;font-style:italic;src:url(${F("Caladea-Italic.ttf")})}
@font-face{font-family:InterL;src:url(${F("Inter-Light.otf")})}
@font-face{font-family:InterR;src:url(${F("Inter-Regular.otf")})}`;

const svg = (x, y, w, h, body) => `<svg style="left:${x}px;top:${y}px" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const deg = Math.PI / 180;

// ---------------- motifs ----------------
function sunflower(cx, cy, r, op = 1) {
  let s = "";
  const ring = (rr, n, col, a0) => { for (let i = 0; i < n; i++) s += `<ellipse cx="${cx}" cy="${(cy - rr).toFixed(1)}" rx="${(rr * 0.27).toFixed(1)}" ry="${(rr * 0.6).toFixed(1)}" fill="${col}" opacity="${op}" transform="rotate(${(a0 + 360 * i / n).toFixed(1)} ${cx} ${cy})"/>`; };
  ring(r, 16, "#E3A72F", 0); ring(r * 0.82, 16, "#F2C14E", 11);
  s += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.36).toFixed(1)}" fill="#5A3518"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="#3E2410"/>`;
  return s;
}
const leafPath = (x, y, l, a, col) => `<path d="M0 0C${l * .35} ${-l * .3} ${l * .75} ${-l * .24} ${l} 0C${l * .75} ${l * .24} ${l * .35} ${l * .3} 0 0Z" fill="${col}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a})"/><path d="M0 0L${(l * .9).toFixed(1)} 0" stroke="#ffffff55" stroke-width="${Math.max(0.5, l / 60).toFixed(2)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a})"/>`;
// three sunflowers and olive leaves, centred; width w
function sunCrest(cx, y, w) {
  const h = w * 0.62, c = w / 2;
  let b = leafPath(c - w * 0.08, h * 0.62, w * 0.34, 200, "#8A9A5B") + leafPath(c + w * 0.08, h * 0.62, w * 0.34, -20, "#A7B072");
  b += sunflower(c - w * 0.27, h * 0.56, w * 0.15) + sunflower(c + w * 0.27, h * 0.56, w * 0.15) + sunflower(c, h * 0.44, w * 0.2);
  return svg(cx - w / 2, y, w, h, b);
}
function doveCrest(cx, y, w, gold = "#C9A45C", dove = "#4A2740") {
  const h = w * 0.62, c = w / 2, cy = h * 0.52;
  let b = "";
  for (let i = 0; i < 48; i++) {
    const a = i * 7.5 * deg, L = w * (i % 2 ? 0.26 : 0.31), r0 = w * 0.12;
    b += `<line x1="${(c + Math.cos(a) * r0).toFixed(1)}" y1="${(cy + Math.sin(a) * r0).toFixed(1)}" x2="${(c + Math.cos(a) * L).toFixed(1)}" y2="${(cy + Math.sin(a) * L).toFixed(1)}" stroke="${gold}" stroke-width="${Math.max(0.5, w / 260).toFixed(2)}" opacity="${i % 2 ? .45 : .75}"/>`;
  }
  const k = w / 260;
  b += `<g transform="translate(${(c - 58 * k).toFixed(1)} ${(cy - 44 * k).toFixed(1)}) scale(${k.toFixed(3)})" fill="${dove}"><ellipse cx="60" cy="62" rx="34" ry="13" transform="rotate(-12 60 62)"/><circle cx="93" cy="50" r="9"/><path d="M101 49L111 51L101 54Z" fill="${gold}"/><path d="M52 58C40 30 44 12 58 4C62 22 72 36 78 54Z"/><path d="M60 58C66 32 80 20 96 18C90 32 84 46 76 58Z" opacity=".75"/><path d="M30 66L6 58L12 66L4 76L30 72Z"/></g>`;
  return svg(cx - w / 2, y - h * 0.08, w, h, b);
}
const RB = ["#E9B8A8", "#F3D6A4", "#C9D8B6", "#B9CFE0", "#D6C4E4"];
function rainbowCrest(cx, y, w) {
  const h = w * 0.56, c = w / 2, base = h * 0.92, sw = w * 0.055;
  let b = "";
  RB.forEach((col, i) => { const r = w * 0.44 - i * sw * 1.05; b += `<path d="M${(c - r).toFixed(1)} ${base}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(c + r).toFixed(1)} ${base}" fill="none" stroke="${col}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`; });
  const k = w / 260;
  b += `<path transform="translate(${c} ${(base - w * 0.1).toFixed(1)}) scale(${(k * 0.9).toFixed(3)})" d="M0 10C-14 0 -22 -8 -16 -16C-11 -22 -3 -20 0 -14C3 -20 11 -22 16 -16C22 -8 14 0 0 10Z" fill="#E3A08C"/>`;
  return svg(cx - w / 2, y, w, h, b);
}
function paw(x, y, sz, col, rot = 0) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${(sz / 40).toFixed(3)})" fill="${col}"><ellipse cx="0" cy="8" rx="11" ry="9"/><ellipse cx="-12" cy="-6" rx="4.5" ry="6"/><ellipse cx="-4" cy="-13" rx="4.5" ry="6"/><ellipse cx="5" cy="-13" rx="4.5" ry="6"/><ellipse cx="13" cy="-6" rx="4.5" ry="6"/></g>`;
}

// ---------------- themes ----------------
const THEMES = {
  golden: {
    paper: "#FBF4E6", ink: "#3E2A1A", line: "#E6D3B3", well: "#F3E6CC", accent: "#B5651D", dark: "#4A2C16", darkLine: "#E3A72F", darkCap: "#F2C14E",
    ital: "font-family:Cormorant;font-style:italic;font-weight:500", cap: "font-family:InterL;letter-spacing:.3em",
    crest: (cx, y, w) => sunCrest(cx, y, w),
    frame: (x, y, w, h, gap, color) => svg(x, y, w, h, `<rect x="0.6" y="0.6" width="${w - 1.2}" height="${h - 1.2}" rx="${Math.min(18, w * 0.03)}" fill="none" stroke="${color}" stroke-width="1"/>`),
    fleuron: (cx, y, w, color) => svg(cx - w / 2, y - 7, w, 14, `<line x1="0" y1="7" x2="${w / 2 - 12}" y2="7" stroke="${color}" stroke-width=".7"/><line x1="${w / 2 + 12}" y1="7" x2="${w}" y2="7" stroke="${color}" stroke-width=".7"/>${sunflower(w / 2, 7, 6)}`),
    words: { cover: "Celebrating the Life of", inside: "In Loving Memory", order: "Order of Service", welcome: "Welcome", memory: "Share a Memory", thanks: "Thank You", thanksSub: "For Celebrating With Us", guest: "Guest Book", guestSub: "Celebrating the Life of" }
  },
  grace: {
    paper: "#F8F2E8", ink: "#2E1A2B", line: "#DCCDB8", well: "#EFE4D3", accent: "#9A7638", dark: "#2E1A2B", darkLine: "#C9A45C", darkCap: "#D9C8B0", darkSign: true,
    ital: "font-family:Cinzel;font-weight:400;letter-spacing:.04em", cap: "font-family:Cinzel;letter-spacing:.3em",
    crest: (cx, y, w, onDark) => doveCrest(cx, y, w, "#C9A45C", onDark ? "#F4EBDD" : "#4A2740"),
    frame: (x, y, w, h, gap, color) => { const d = (cx, cy, r) => `<path d="M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z" fill="${color}"/>`;
      return svg(x, y, w, h, `<rect x="0.6" y="0.6" width="${w - 1.2}" height="${h - 1.2}" fill="none" stroke="${color}" stroke-width="1.3"/><rect x="${gap}" y="${gap}" width="${w - 2 * gap}" height="${h - 2 * gap}" fill="none" stroke="${color}" stroke-width="0.5"/>${d(0.6, 0.6, 4)}${d(w - 0.6, 0.6, 4)}${d(0.6, h - 0.6, 4)}${d(w - 0.6, h - 0.6, 4)}`); },
    fleuron: (cx, y, w, color) => svg(cx - w / 2, y - 8, w, 16, `<line x1="0" y1="8" x2="${w / 2 - 12}" y2="8" stroke="${color}" stroke-width=".7"/><line x1="${w / 2 + 12}" y1="8" x2="${w}" y2="8" stroke="${color}" stroke-width=".7"/><path d="M${w / 2 - 1} 1h2v4h4v2h-4v8h-2v-8h-4v-2h4z" fill="${color}"/>`),
    words: { cover: "A Homegoing Celebration", inside: "In Loving Memory", order: "Order of Service", welcome: "Welcome", memory: "Share a Memory", thanks: "Thank You", thanksSub: "For Your Prayers and Love", guest: "Guest Book", guestSub: "In Loving Memory of" }
  },
  rainbow: {
    paper: "#FFFAF4", ink: "#4B3B36", line: "#EADBD0", well: "#F6ECE4", accent: "#B07A6A", dark: "#FFF4EA", darkLine: "#E9B8A8", darkCap: "#B07A6A", lightPhone: true,
    ital: "font-family:Caladea;font-style:italic", cap: "font-family:InterR;letter-spacing:.28em",
    crest: (cx, y, w) => rainbowCrest(cx, y, w),
    frame: (x, y, w, h, gap, color) => svg(x, y, w, h, `<rect x="0.8" y="0.8" width="${w - 1.6}" height="${h - 1.6}" rx="${Math.min(22, w * 0.04)}" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="1 5" stroke-linecap="round"/>`),
    fleuron: (cx, y, w, color) => svg(cx - w / 2, y - 8, w, 16, `<line x1="0" y1="8" x2="${w / 2 - 14}" y2="8" stroke="${color}" stroke-width=".7"/><line x1="${w / 2 + 14}" y1="8" x2="${w}" y2="8" stroke="${color}" stroke-width=".7"/>${paw(w / 2, 8, 11, color)}`),
    words: { cover: "Forever in Our Hearts", inside: "Remembering", order: "Our Time Together", welcome: "Welcome", memory: "Share a Memory", thanks: "Thank You", thanksSub: "For Loving Them Too", guest: "Paw Prints on Our Hearts", guestSub: "Remembering" }
  }
};

function designs(T) {
  const cap = (text, cx, top, s = 10, color = T.ink, w = 500) => `<div class="cap" style="left:${cx - w / 2}px;width:${w}px;top:${top}px;--s:${s}px;--c:${color}">${text}</div>`;
  const ital = (text, cx, top, s, color = T.ink, w = 700) => `<div class="ital" style="left:${cx - w / 2}px;width:${w}px;top:${top}px;font-size:${s}px;--c:${color}">${text}</div>`;
  const rule = (x, y, w, color = T.line) => `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:1px;background:${color}"></div>`;
  const oval = (cx, cy, rx, ry, color = T.accent, well = T.well) => svg(cx - rx - 10, cy - ry - 10, 2 * rx + 20, 2 * ry + 20, `<ellipse cx="${rx + 10}" cy="${ry + 10}" rx="${rx}" ry="${ry}" fill="${well}" stroke="${color}" stroke-width="1.3"/><ellipse cx="${rx + 10}" cy="${ry + 10}" rx="${rx + 7}" ry="${ry + 7}" fill="none" stroke="${color}" stroke-width="0.5"/>`);
  const fr = (x, y, w, h, gap = 5, color = T.accent) => T.frame(x, y, w, h, gap, color);
  const fl = (cx, y, w, color = T.accent) => T.fleuron(cx, y, w, color);
  const cr = (cx, y, w, onDark = false) => T.crest(cx, y, w, onDark);
  const pawTrail = (x, y, s) => T === THEMES.rainbow ? svg(x, y, s * 5, s * 2, [0, 1, 2, 3].map((i) => paw(s * 0.6 + i * s * 1.1, i % 2 ? s * 0.6 : s * 1.3, s * 0.8, "#D9B3A6", -18)).join("")) : "";
  const W = T.words, L = 264, R = 792;
  const signDark = !!T.darkSign;
  const phoneBg = T.lightPhone ? T.paper : T.dark;
  return {
    program: { w: 1056, h: 816, pages: [
      `${fr(26, 26, 476, 764)}${fr(554, 26, 476, 764)}
       ${cr(L, 50, 92)}
       ${cap("A Note of Thanks", L, 160, 10)}
       ${fl(L, 352, 120)}
       ${cap("Reception", L, 382, 10)}
       ${fl(L, 526, 120)}
       ${cap(W.cover, R, 78, 11, T.ink, 440)}
       ${oval(R, 255, 96, 120)}
       ${cr(R, 586, 180)}${pawTrail(580, 720, 16)}`,
      `${fr(26, 26, 476, 764)}${fr(554, 26, 476, 764)}
       ${ital(W.order, L, 64, 30)}
       ${fl(L, 126, 140)}
       ${cap(W.inside, R, 74, 10)}
       ${fl(R, 194, 140)}
       ${cr(R, 662, 110)}`
    ] },
    sign: { w: 2304, h: 3456, bg: signDark ? T.dark : T.paper, pages: [
      `${fr(96, 96, 2112, 3264, 20, signDark ? T.darkLine : T.accent)}
       ${cr(1152, 250, 560, signDark)}
       ${ital(W.welcome, 1152, 700, signDark ? 230 : 290, signDark ? "#F4EBDD" : T.ink, 1900)}
       ${fl(1152, 1150, 520, signDark ? T.darkLine : T.accent)}
       ${oval(1152, 1637, 245, 300, signDark ? T.darkLine : T.accent, signDark ? "#4A2740" : T.well)}
       ${fl(1152, 2760, 520, signDark ? T.darkLine : T.accent)}
       ${cr(1152, 2860, 420, signDark)}`
    ] },
    card: { w: 408, h: 528, pages: [
      `${fr(14, 14, 380, 500)}
       ${cr(204, 22, 72)}
       ${ital(W.memory, 204, 96, 34)}
       ${Array.from({ length: 7 }, (_, i) => rule(44, 214 + i * 33, 320)).join("")}
       ${cap("From", 64, 466, 8, T.ink, 60)}${rule(96, 476, 268)}`
    ] },
    bookmark: { w: 192, h: 672, pages: [
      `${fr(9, 9, 174, 654, 4)}
       ${cr(96, 30, 84)}
       ${cap(T === THEMES.rainbow ? "Forever Loved" : "In Loving Memory", 96, 100, 7, T.ink, 180)}
       ${fl(96, 236, 80)}
       ${fl(96, 530, 80)}
       ${cr(96, 566, 96)}`
    ] },
    thankyou: { w: 408, h: 528, pages: [
      `${fr(14, 14, 380, 500)}
       ${cr(204, 24, 76)}
       ${ital(W.thanks, 204, 102, 42)}
       ${cap(W.thanksSub, 204, 164, 8, T.ink, 380)}
       ${fl(204, 192, 90)}
       ${fl(204, 474, 90)}`
    ] },
    announcement: { w: 540, h: 960, bg: phoneBg, pages: [
      `${fr(20, 20, 500, 920, 6, T.darkLine)}
       ${cr(270, 60, 150, !T.lightPhone)}
       ${cap(T === THEMES.rainbow ? "Forever in Our Hearts" : "In Loving Memory", 270, 196, 12, T.darkCap)}
       ${oval(270, 330, 82, 102, T.darkLine, T.lightPhone ? T.well : "#ffffff14")}
       ${fl(270, 548, 140, T.darkLine)}
       ${fl(270, 870, 140, T.darkLine)}`
    ] },
    guestbook: { w: 816, h: 1056, pages: [
      `${fr(28, 28, 760, 1000)}
       ${cr(408, 44, 92)}
       ${ital(W.guest, 408, 128, T === THEMES.rainbow ? 40 : 48)}
       ${cap(W.guestSub, 408, 196, 9)}
       ${fl(408, 280, 160)}
       ${cap("Name", 150, 304, 8, T.ink, 160)}
       ${cap("A Favorite Memory or Message", 528, 304, 8, T.ink, 400)}
       ${Array.from({ length: 13 }, (_, i) => rule(70, 360 + i * 52, 676)).join("")}
       <div class="abs" style="left:310px;top:330px;width:1px;height:654px;background:${T.line}"></div>
       ${fl(408, 1004, 160)}`
    ] }
  };
}

const only = process.argv[2];
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const [key, T] of Object.entries(THEMES)) {
  if (only && only !== key) continue;
  const CSS = `${FONTS}*{margin:0;padding:0;box-sizing:border-box}html,body{background:${T.paper}}.page{position:relative;overflow:hidden}.abs{position:absolute}
.cap{position:absolute;text-align:center;${T.cap};font-weight:500;color:var(--c);font-size:var(--s,10px);white-space:nowrap;text-transform:uppercase}
.ital{position:absolute;text-align:center;${T.ital};color:var(--c);line-height:1.1}svg{position:absolute;overflow:visible}`;
  for (const [name, d] of Object.entries(designs(T))) {
    const pagesHtml = d.pages.map((body) => `<div class="page" style="width:${d.w}px;height:${d.h}px;background:${d.bg || T.paper};page-break-after:always">${body}</div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}@page{size:${d.w}px ${d.h}px;margin:0}</style></head><body>${pagesHtml}</body></html>`;
    const file = path.join(HERE, "bg", `_${key}-${name}.html`);
    fs.writeFileSync(file, html);
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(HERE, "bg", `${key}-${name}.pdf`), width: `${d.w}px`, height: `${d.h}px`, printBackground: true, pageRanges: `1-${d.pages.length}` });
    fs.unlinkSync(file);
    console.log(`drew bg/${key}-${name}.pdf`);
  }
}
await browser.close();
