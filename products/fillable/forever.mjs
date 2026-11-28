// "Forever in My Heart": Valentine's remembrance set (concept A, picked by the owner 2026-11-27).
// Draws the vector backgrounds in bg/ AND writes the matching fill-in fields into fields.json (same pattern as alife.mjs).
// Art is drawn in code (two hearts as one line, a candle); fonts are SIL OFL files in fonts/.
// Usage: NODE_PATH=... node products/fillable/forever.mjs && python3 products/fillable/build.py --only="Forever in My Heart"
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
for (const p of ["playwright", path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "playwright")]) { try { playwright = require(p); break; } catch {} }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;
const FONTS = `@font-face{font-family:Corm;src:url(${F("CormorantGaramond.ttf")})}
@font-face{font-family:Corm;font-style:italic;src:url(${F("CormorantGaramond-Italic.ttf")})}
@font-face{font-family:InterSB;src:url(${F("Inter-SemiBold.otf")})}`;
const C = { cream: "#FBF5F0", blush: "#EFD6D2", rose: "#A4485A", wine: "#4B1E2B", gold: "#B8925A", line: "#D9B7B3", ink: "#2B1A1F", soft: "#6B4A50", petal: "#F3E2D8" };

const S = {
  "Top line": "VALENTINE'S DAY · IN REMEMBRANCE",
  "Name": "Daniel Thomas Reyes",
  "Years": "1958  —  2025",
  "Message": "Married thirty-four years.\nLoved for always.",
  "Greeting": "My Daniel,",
  "Letter": "I still set out two cups every morning. I hope you know how much you are missed, and how much you are still loved.",
  "Signed": "Love always, Maria",
  "First name": "Daniel",
  "Bottom line": "FOREVER IN OUR HEARTS",
  "Date line": "Valentine's Day 2027",
};

let FIELDS = [], PAGE = 1;
const fld = (name, left, top, width, height, size, font, color, o = {}) => {
  if (o.photo) { FIELDS.push({ name, type: "photo", page: PAGE, left, top, width, height }); return ""; }
  FIELDS.push({ name, page: PAGE, left, top, width, height, size, font, color, value: S[name] ?? "", ...o }); return "";
};
const box = (x, y, w, h, css) => `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${css}"></div>`;
const rule = (x, y, w, t = 1, col = C.gold) => box(x, y, w, t, `background:${col}`);
const frame = (W, H, inset, col = C.line, t = 1) => box(inset, inset, W - 2 * inset, H - 2 * inset, `border:${t}px solid ${col}`);
const txt = (t, x, y, w, css) => `<div class="t" style="left:${x}px;top:${y}px;width:${w}px;${css}">${t}</div>`;
const center = (t, W, y, css) => txt(t, 0, y, W, `text-align:center;${css}`);

// two hearts drawn as one line, centred at cx, top y, size s
const heartPath = (x, y, s) => `M${x} ${y + s * .3}C${x} ${y - s * .1} ${x - s * .55} ${y - s * .15} ${x - s * .55} ${y + s * .22}C${x - s * .55} ${y + s * .55} ${x - s * .1} ${y + s * .75} ${x} ${y + s}C${x + s * .1} ${y + s * .75} ${x + s * .55} ${y + s * .55} ${x + s * .55} ${y + s * .22}C${x + s * .55} ${y - s * .15} ${x} ${y - s * .1} ${x} ${y + s * .3}Z`;
const hearts = (W, cx, y, s, col = C.rose, sw = 1.6) => `<svg class="a" width="${W}" height="${s * 1.35}" style="left:0;top:${y}px" viewBox="0 0 ${W} ${s * 1.35}">
  <path d="${heartPath(cx - s * .28, 4, s)}" fill="none" stroke="${col}" stroke-width="${sw}"/>
  <path d="${heartPath(cx + s * .28, 4 + s * .1, s * .92)}" fill="none" stroke="${col}" stroke-width="${sw}" opacity=".55"/></svg>`;
const candle = (W, cx, y, s) => `<svg class="a" width="${W}" height="${s * 2.2}" style="left:0;top:${y}px"><defs><radialGradient id="g"><stop offset="0" stop-color="#F4C978" stop-opacity=".55"/><stop offset="1" stop-color="#F4C978" stop-opacity="0"/></radialGradient></defs>
  <circle cx="${cx}" cy="${s * .62}" r="${s * .62}" fill="url(#g)"/>
  <rect x="${cx - s * .15}" y="${s * .84}" width="${s * .3}" height="${s * 1.3}" rx="3" fill="${C.cream}"/>
  <line x1="${cx}" y1="${s * .84}" x2="${cx}" y2="${s * .78}" stroke="#3a2a1a" stroke-width="1.4"/>
  <path d="M${cx} ${s * .38}C${cx + s * .09} ${s * .55} ${cx + s * .08} ${s * .68} ${cx} ${s * .72}C${cx - s * .08} ${s * .68} ${cx - s * .09} ${s * .55} ${cx} ${s * .38}Z" fill="#F4C978"/>
  <path d="M${cx} ${s * .52}C${cx + s * .04} ${s * .6} ${cx + s * .04} ${s * .66} ${cx} ${s * .68}C${cx - s * .04} ${s * .66} ${cx - s * .04} ${s * .6} ${cx} ${s * .52}Z" fill="#FFF4D6"/></svg>`;
const tracked = (t, W, y, s, col) => center(t, W, y, `font:${s}px InterSB;letter-spacing:.24em;color:${col}`);

const PIECES = {};
// Table sign 8 x 10 in
PIECES.sign = { w: 768, h: 960, html: () => {
  const W = 768;
  let s = box(0, 0, W, 960, `background:${C.cream}`) + frame(W, 960, 28) + frame(W, 960, 36, C.line + "80");
  fld("Top line", 80, 96, W - 160, 24, 13, "S", C.rose, { align: 1 });
  s += hearts(W, W / 2, 158, 120);
  s += center("Forever in my heart", W, 350, `font:italic 82px/1 Corm;color:${C.wine}`);
  s += rule(W / 2 - 50, 466, 100, 2);
  fld("Name", 60, 498, W - 120, 60, 46, "R", C.ink, { align: 1 });
  fld("Years", 60, 568, W - 120, 24, 15, "S", C.rose, { align: 1 });
  fld("Message", 90, 624, W - 180, 116, 27, "I", C.soft, { align: 1, multiline: true, lead: 1.4 });
  s += hearts(W, W / 2, 786, 40, C.gold, 1.4);
  return s; } };
// Love-letter card 4.25 x 5.5 in
PIECES.letter = { w: 408, h: 528, html: () => {
  const W = 408;
  let s = box(0, 0, W, 528, `background:${C.blush}`) + box(16, 16, W - 32, 496, `background:${C.cream}`);
  s += hearts(W, W / 2, 34, 40);
  s += center("A letter to you", W, 96, `font:italic 42px/1 Corm;color:${C.wine}`);
  fld("Greeting", 44, 156, W - 88, 24, 16, "I", C.wine, { align: 0 });
  for (let i = 0; i < 8; i++) s += rule(44, 212 + i * 30, W - 88, 1, C.line);
  fld("Letter", 44, 190, W - 88, 262, 14, "I", C.soft, { align: 0, multiline: true, lead: 2.14 });
  fld("Signed", 44, 462, W - 88, 24, 15, "I", C.wine, { align: 2 });
  return s; } };
// Candle card 3 x 4 in
PIECES.candle = { w: 288, h: 384, html: () => {
  const W = 288;
  let s = box(0, 0, W, 384, `background:${C.wine}`) + frame(W, 384, 12, C.gold + "88");
  s += candle(W, W / 2, 40, 82);
  s += center("Tonight we light<br>a candle for", W, 226, `font:italic 22px/1.25 Corm;color:${C.petal}`);
  fld("First name", 24, 284, W - 48, 40, 30, "R", "#E7C98F", { align: 1 });
  fld("Bottom line", 24, 334, W - 48, 16, 8, "S", C.line, { align: 1 });
  return s; } };
// Candle card, ink-saver version: same layout on cream paper
PIECES.candlelight = { w: 288, h: 384, html: () => {
  const W = 288;
  let s = box(0, 0, W, 384, `background:${C.cream}`) + frame(W, 384, 12, C.line);
  s += candle(W, W / 2, 40, 82).replace(`fill="${C.cream}"`, `fill="#FFFFFF" stroke="${C.line}"`);
  s += center("Tonight we light<br>a candle for", W, 226, `font:italic 22px/1.25 Corm;color:${C.soft}`);
  fld("First name", 24, 284, W - 48, 40, 30, "R", C.wine, { align: 1 });
  fld("Bottom line", 24, 334, W - 48, 16, 8, "S", C.rose, { align: 1 });
  return s; } };
// Phone post 1080 x 1920 (drawn at 540 x 960)
PIECES.phone = { w: 540, h: 960, html: () => {
  const W = 540;
  let s = box(0, 0, W, 960, `background:${C.cream}`) + frame(W, 960, 20) ;
  fld("Date line", 40, 50, W - 80, 22, 13, "S", C.rose, { align: 1 });
  s += box(110, 96, 320, 380, `background:${C.blush};outline:1px solid ${C.line};outline-offset:-8px`);
  fld("Photo", 110, 96, 320, 380, 0, "R", C.ink, { photo: true });
  s += hearts(W, W / 2, 500, 58);
  s += center("Forever in my heart", W, 590, `font:italic 52px/1 Corm;color:${C.wine}`);
  s += rule(W / 2 - 40, 662, 80, 1.5);
  fld("Name", 40, 682, W - 80, 44, 32, "R", C.ink, { align: 1 });
  fld("Years", 40, 732, W - 80, 20, 12, "S", C.rose, { align: 1 });
  fld("Message", 60, 772, W - 120, 90, 20, "I", C.soft, { align: 1, multiline: true, lead: 1.4 });
  return s; } };

const PRODUCTS = [
  ["Forever in My Heart/01 Table Sign 8x10 - Forever in My Heart (fill-in).pdf", "Valentine's Remembrance Table Sign - Forever in My Heart", "sign", { size: [612, 792], scale: 1, cols: 1, rows: 1 }],
  ["Forever in My Heart/02 Love Letter Cards - Forever in My Heart (fill-in).pdf", "Love Letter Cards - Forever in My Heart", "letter", { size: [612, 792], scale: 0.94 }],
  ["Forever in My Heart/03 Candle Cards - Forever in My Heart (fill-in).pdf", "Candle Cards - Forever in My Heart", "candle", { size: [612, 792], scale: 1, cols: 2, rows: 2 }],
  ["Forever in My Heart/03b Candle Cards Ink-Saver - Forever in My Heart (fill-in).pdf", "Candle Cards (ink-saver) - Forever in My Heart", "candlelight", { size: [612, 792], scale: 1, cols: 2, rows: 2 }],
  ["Forever in My Heart/04 Phone Post - Forever in My Heart (fill-in).pdf", "Remembrance Post for Phones - Forever in My Heart", "phone"],
];

const CSS = `${FONTS}*{margin:0;padding:0;box-sizing:border-box}html,body{background:${C.cream}}.page{position:relative;overflow:hidden}
.a,.t{position:absolute}.t{white-space:nowrap;line-height:1.15}`;
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
const byPiece = {};
for (const [key, d] of Object.entries(PIECES)) {
  FIELDS = []; PAGE = 1;
  const body = d.html();
  byPiece[key] = FIELDS;
  const file = path.join(HERE, "bg", `_forever-${key}.html`);
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}@page{size:${d.w}px ${d.h}px;margin:0}</style></head><body><div class="page" style="width:${d.w}px;height:${d.h}px">${body}</div></body></html>`);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, "bg", `forever-${key}.pdf`), width: `${d.w}px`, height: `${d.h}px`, printBackground: true, pageRanges: "1" });
  fs.unlinkSync(file);
  console.log(`drew bg/forever-${key}.pdf (${FIELDS.length} fields)`);
}
await browser.close();

const fpath = path.join(HERE, "fields.json");
const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
data.products = data.products.filter((p) => !p.file.startsWith("Forever in My Heart/"));
for (const [file, title, key, sheet] of PRODUCTS) data.products.push({ file, title, bg: `forever-${key}.pdf`, fields: byPiece[key], ...(sheet ? { sheet } : {}) });
fs.writeFileSync(fpath, JSON.stringify(data, null, 1));
console.log("fields.json: Forever in My Heart updated");
