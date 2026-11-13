// Holiday 2026 collections, drawn in code as vector PDF backgrounds (bg/) + their fill-in field specs.
//   A  Evergreen & Candlelight (Christmas)      GFS Baskerville + Inter
//   B  Longest Night (Blue Christmas, Hanukkah, solstice; no religious symbols)   Inter
//   C  Harvest Table (Thanksgiving)            Caladea + Inter
// Fonts in fonts/ (GFS Baskerville and Inter: SIL OFL; Caladea: Apache 2.0). Units: CSS px at 96 per inch.
// Writes bg/<piece>.pdf and holiday-fields.json (merged into fields.json by holiday_merge.py).
// Usage: node products/fillable/holiday.mjs
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright"); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;

const CSS = `
@font-face{font-family:Bask;src:url(${F("GFSBaskerville.otf")})}
@font-face{font-family:Cala;src:url(${F("Caladea-Regular.ttf")})}
@font-face{font-family:Cala;font-style:italic;src:url(${F("Caladea-Italic.ttf")})}
@font-face{font-family:InterH;font-weight:300;src:url(${F("Inter-Light.otf")})}
@font-face{font-family:InterH;font-weight:400;src:url(${F("Inter-Regular.otf")})}
@font-face{font-family:InterH;font-weight:600;src:url(${F("Inter-SemiBold.otf")})}
*{margin:0;padding:0;box-sizing:border-box}
.page{position:relative;overflow:hidden}
.cap{position:absolute;text-align:center;font-family:InterH;white-space:nowrap}
.ln{position:absolute;height:0;border-bottom:1px solid}
svg{position:absolute;left:0;top:0;overflow:visible}`;

// ---------- motifs ----------
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function bough(x0, y0, x1, y1, bend, col, col2, n = 34, len = 16, sw = 1.3) {
  const cx = (x0 + x1) / 2 + bend[0], cy = (y0 + y1) / 2 + bend[1];
  const P = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  let s = `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" stroke="${col2}" stroke-width="${sw * 1.2}" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i < n; i++) {
    const t = i / n, [x, y] = P(t), [xa, ya] = P(Math.min(1, t + 0.01));
    const ang = Math.atan2(ya - y, xa - x), L = len * (1 - t * 0.55);
    for (const side of [-1, 1]) for (const k of [0.55, 0.95]) {
      const a = ang + side * k, c = rnd() < 0.3 ? col2 : col;
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * L).toFixed(1)}" y2="${(y + Math.sin(a) * L).toFixed(1)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
  }
  return s;
}
const berries = (pts, col) => pts.map(([x, y, r = 4]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff" opacity=".35"/>`).join("");
function candle(cx, base, w, h, body, glowCol, line) {
  const id = "g" + Math.round(cx) + Math.round(base);
  return `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${glowCol}" stop-opacity=".55"/><stop offset="1" stop-color="${glowCol}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="${cx}" cy="${base - h - 14}" r="${w * 1.9}" fill="url(#${id})"/>
  <rect x="${cx - w / 2}" y="${base - h}" width="${w}" height="${h}" rx="3" fill="${body}" stroke="${line}" stroke-width="1"/>
  <line x1="${cx}" y1="${base - h}" x2="${cx}" y2="${base - h - 6}" stroke="#3a2a1a" stroke-width="1.4"/>
  <path d="M${cx} ${base - h - 28}C${cx + 7} ${base - h - 16} ${cx + 6} ${base - h - 6} ${cx} ${base - h - 5}C${cx - 6} ${base - h - 6} ${cx - 7} ${base - h - 16} ${cx} ${base - h - 28}Z" fill="#f2b84b"/>
  <path d="M${cx} ${base - h - 19}C${cx + 3} ${base - h - 12} ${cx + 3} ${base - h - 8} ${cx} ${base - h - 7}C${cx - 3} ${base - h - 8} ${cx - 3} ${base - h - 12} ${cx} ${base - h - 19}Z" fill="#fff4cf"/>`;
}
const star = (x, y, r, col, o = 1) => `<path d="M${x} ${y - r}Q${x + r * .16} ${y - r * .16} ${x + r} ${y}Q${x + r * .16} ${y + r * .16} ${x} ${y + r}Q${x - r * .16} ${y + r * .16} ${x - r} ${y}Q${x - r * .16} ${y - r * .16} ${x} ${y - r}Z" fill="${col}" opacity="${o}"/>`;
function starfield(w, h, n, col, frac = .62, s0 = 1) {
  let s = ""; for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h * frac; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((rnd() * 1.1 + .3) * s0).toFixed(2)}" fill="${col}" opacity="${(rnd() * .6 + .3).toFixed(2)}"/>`; }
  return s;
}
function wheat(x, y, ang, len, col, grain) {
  const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  let s = `<line x1="${x}" y1="${y}" x2="${x + dx * len}" y2="${y + dy * len}" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/>`;
  for (let i = 0; i < 9; i++) {
    const t = 0.45 + i * 0.065, px = x + dx * len * t, py = y + dy * len * t;
    for (const side of [-1, 1]) s += `<ellipse cx="0" cy="0" rx="7" ry="2.8" fill="${grain}" transform="translate(${(px + side * -dy * 4).toFixed(1)} ${(py + side * dx * 4).toFixed(1)}) rotate(${(ang + side * -28).toFixed(1)})"/>`;
  }
  return s + `<ellipse cx="0" cy="0" rx="7" ry="2.6" fill="${grain}" transform="translate(${(x + dx * len * 1.03).toFixed(1)} ${(y + dy * len * 1.03).toFixed(1)}) rotate(${ang})"/>`;
}
const leaf = (x, y, ang, L, col) => `<path d="M0 0C${L * .3} ${-L * .32} ${L * .75} ${-L * .3} ${L} 0C${L * .75} ${L * .3} ${L * .3} ${L * .32} 0 0Z" fill="${col}" transform="translate(${x} ${y}) rotate(${ang})"/><line x1="0" y1="0" x2="${L * .9}" y2="0" stroke="#fff" stroke-opacity=".25" stroke-width=".8" transform="translate(${x} ${y}) rotate(${ang})"/>`;
const S = (w, h, body) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const cap = (t, top, size, col, ls = .4, weight = 400, left = 0, width = null) => `<div class="cap" style="left:${left}px;${width ? `width:${width}px` : "right:0"};top:${top}px;font-size:${size}px;letter-spacing:${ls}em;font-weight:${weight};color:${col}">${t}</div>`;
// Writing lines that sit under each line of a multiline field (matches build.py: first baseline = top + 2.67 + .88*size, then lead*size).
const lines = (f, n, col, x0 = f.left, x1 = f.left + f.width) => Array.from({ length: n }, (_, i) => `<div class="ln" style="left:${x0}px;width:${x1 - x0}px;top:${(f.top + 2.67 + .88 * f.size + i * f.lead * f.size + 5).toFixed(1)}px;border-color:${col}"></div>`).join("");

// ---------- palettes ----------
const A = { pine: "#22382e", pine2: "#3e5b48", cream: "#f7f1e4", brass: "#b48a45", berry: "#8e2f3a", ink: "#2b2a27", lightPine: "#5f8068", lightPine2: "#86a58c" };
const B = { d1: "#1b2140", d2: "#3c4570", d3: "#8a8fb3", d4: "#d9cfe0", silver: "#c9ccd8", paper: "#f6f5f9", ink: "#2a2d40" };
const C = { oat: "#efe5d3", terra: "#b45f3c", mustard: "#c99a3f", brown: "#4b3527", olive: "#7a7a45", rust: "#8f3f26" };
const sky = (deg = 180) => `linear-gradient(${deg}deg,${B.d1} 0%,${B.d2} 45%,${B.d3} 78%,${B.d4} 100%)`;

const designs = {}, products = [];
const fld = (name, left, top, width, height, size, font, color, value, extra = {}) => ({ name, page: 1, left, top, width, height, size, font, color, value, ...extra });
const CARD_SHEET = { size: [612, 792], scale: 0.94 };

// ======================= A: Evergreen & Candlelight =======================
{
  const AN = "Evergreen & Candlelight";
  // A1 table sign 8x10
  seed = 11;
  const verse = fld("Verse", 120, 640, 528, 120, 24, "I", A.ink, "Though your chair is quiet this Christmas,\nyour love still fills the room.", { multiline: true, lead: 1.5 });
  designs["evergreen-sign"] = { w: 768, h: 960, bg: A.cream, pages: [`${S(768, 960, `
    <rect x="34" y="34" width="700" height="892" fill="none" stroke="${A.brass}" stroke-width="1.2"/>
    ${bough(70, 150, 384, 118, [0, -40], A.pine, A.pine2, 30, 22)}${bough(698, 150, 384, 118, [0, -40], A.pine, A.pine2, 30, 22)}
    ${bough(140, 92, 330, 175, [-20, 30], A.pine2, A.pine, 18, 15)}${bough(628, 92, 438, 175, [20, 30], A.pine2, A.pine, 18, 15)}
    ${berries([[372, 132, 6], [388, 124, 5], [380, 145, 5], [360, 122, 4], [402, 140, 4]], A.berry)}
    ${candle(384, 395, 46, 92, A.cream, "#f5c86a", A.brass)}
    ${bough(220, 860, 384, 820, [0, 30], A.pine, A.pine2, 20, 15)}${bough(548, 860, 384, 820, [0, 30], A.pine, A.pine2, 20, 15)}
    ${berries([[384, 822, 5], [372, 830, 4], [396, 830, 4]], A.berry)}`)}
    ${cap("THIS CANDLE BURNS IN LOVING MEMORY OF", 430, 15, A.brass, .42)}`] };
  products.push({ file: `${AN}/01 Table Sign - ${AN} (fill-in).pdf`, title: `Holiday Memorial Table Sign - ${AN}`, bg: "evergreen-sign.pdf",
    fields: [fld("Name", 64, 474, 640, 80, 58, "R", A.pine, "Margaret Anne Ellis"), fld("Years", 234, 566, 300, 24, 16, "S", A.ink, "1948  -  2026"), verse],
    sheet: { size: [612, 792], scale: 1, cols: 1, rows: 1 } });

  // A2 memory card (dark) + A2b (light, saves ink)
  for (const [key, bgc, fg, sub, br, lineCol, label] of [["evergreen-card", A.pine, A.cream, A.lightPine, A.lightPine2, A.brass + "77", "Memory Cards"], ["evergreen-card-light", A.cream, A.pine, A.pine, A.pine2, A.brass + "99", "Memory Cards (ink-saver)"]]) {
    seed = 23;
    const mem = fld("Memory", 52, 200, 304, 230, 19, "I", fg, "She made the cinnamon rolls every Christmas morning and let us lick the spoon...", { multiline: true, lead: 2.3, align: 0 });
    designs[key] = { w: 408, h: 528, bg: bgc, pages: [`${S(408, 528, `
      <rect x="18" y="18" width="372" height="492" fill="none" stroke="${A.brass}" stroke-width="1"/>
      ${bough(40, 70, 210, 52, [0, -20], sub, br, 18, 13)}${bough(368, 70, 198, 52, [0, -20], sub, br, 18, 13)}
      ${berries([[204, 60, 5], [194, 68, 4], [214, 68, 4]], key.endsWith("light") ? A.berry : "#c9535e")}`)}
      ${cap("A FAVORITE HOLIDAY MEMORY OF", 106, 11, A.brass, .38)}
      ${lines(mem, 5, lineCol)}
      ${cap("SHARED WITH LOVE BY", 456, 9, A.brass, .3, 400, 52, 140)}
      <div class="ln" style="left:190px;width:166px;top:468px;border-color:${lineCol}"></div>`] };
    products.push({ file: `${AN}/0${key.endsWith("light") ? "2b" : "2"} ${label} - ${AN} (fill-in).pdf`, title: `Holiday Memory Cards - ${AN}`, bg: `${key}.pdf`,
      fields: [fld("Name", 40, 126, 328, 46, 32, "R", fg, "Grandma Maggie"), mem, fld("Shared by", 192, 450, 164, 18, 11, "S", fg, "", { align: 0 })], sheet: CARD_SHEET });
  }

  // A3 ornament keepsake card (arch, 3.125 x 4.375 in), 4 per sheet
  seed = 5;
  designs["evergreen-ornament"] = { w: 300, h: 420, bg: "#ffffff", pages: [`${S(300, 420, `
    <path d="M1 419V150A149 149 0 0 1 299 150V419Z" fill="${A.cream}" stroke="${A.brass}" stroke-width="1" stroke-dasharray="4 3"/>
    <path d="M10 410V150A140 140 0 0 1 290 150V410Z" fill="none" stroke="${A.brass}" stroke-width=".8"/>
    <circle cx="150" cy="40" r="7" fill="#fff" stroke="${A.brass}" stroke-width="1.2"/>
    ${bough(40, 150, 150, 112, [0, -14], A.pine, A.pine2, 14, 12)}${bough(260, 150, 150, 112, [0, -14], A.pine, A.pine2, 14, 12)}
    ${berries([[150, 116, 5], [141, 122, 4], [159, 122, 4]], A.berry)}
    <path d="M100 352H200" stroke="${A.brass}" stroke-width="1"/>`)}
    ${cap("IN LOVING MEMORY", 166, 10, A.brass, .38)}`] };
  products.push({ file: `${AN}/03 Ornament Cards - ${AN} (fill-in).pdf`, title: `Christmas Memorial Ornament Cards - ${AN}`, bg: "evergreen-ornament.pdf",
    fields: [fld("Name", 30, 190, 240, 84, 30, "R", A.pine, "Margaret\nAnne Ellis", { multiline: true, lead: 1.1 }),
      fld("Words", 30, 290, 240, 40, 18, "I", A.ink, "Christmas in heaven", { multiline: true, lead: 1.3 }),
      fld("Years", 60, 366, 180, 18, 12, "S", A.ink, "1948  -  2026")],
    sheet: { size: [612, 792], scale: 1, cols: 2, rows: 2 } });
}

// ======================= B: Longest Night =======================
{
  const BN = "Longest Night";
  // B1 sign (dusk) + B1b ink-saver (paper with a sky band)
  seed = 31;
  designs["longest-sign"] = { w: 768, h: 960, bg: B.d1, pages: [`<div style="position:absolute;inset:0;background:${sky()}"></div>${S(768, 960, `${starfield(768, 960, 160, "#fff")}
    ${star(384, 170, 34, "#fff")}${star(384, 170, 60, "#fff", .14)}
    <path d="M0 900C160 860 280 875 384 860C500 845 620 870 768 850V960H0Z" fill="#fff" opacity=".18"/>
    <path d="M0 925C180 900 300 915 420 900C560 885 660 905 768 895V960H0Z" fill="#fff" opacity=".25"/>`)}
    ${cap("ON THE LONGEST NIGHT WE REMEMBER", 330, 15, B.silver, .5, 300)}`] };
  seed = 33;
  designs["longest-sign-light"] = { w: 768, h: 960, bg: B.paper, pages: [`<div style="position:absolute;left:0;right:0;top:0;height:300px;background:linear-gradient(180deg,${B.d1},${B.d2} 55%,${B.d3})"></div>
    ${S(768, 960, `${starfield(768, 300, 70, "#fff", 1)}${star(384, 150, 34, "#fff")}${star(384, 150, 60, "#fff", .14)}
    <path d="M0 300C200 285 300 292 384 288C480 284 620 296 768 286V300Z" fill="${B.paper}"/>
    <rect x="34" y="334" width="700" height="592" fill="none" stroke="${B.d3}" stroke-width="1"/>`)}
    ${cap("ON THE LONGEST NIGHT WE REMEMBER", 380, 15, B.d2, .5, 400)}`] };
  for (const [key, light] of [["longest-sign", false], ["longest-sign-light", true]]) {
    const top = light ? 50 : 0, fg = light ? B.ink : "#ffffff", sub = light ? B.d2 : B.silver;
    products.push({ file: `${BN}/01${light ? "b" : ""} Table Sign${light ? " (ink-saver)" : ""} - ${BN} (fill-in).pdf`, title: `Longest Night Memorial Table Sign - ${BN}`, bg: `${key}.pdf`,
      fields: [fld("Name", 64, 372 + top, 640, 76, 52, "S", fg, "Margaret Anne Ellis"),
        fld("Years", 234, 470 + top, 300, 24, 16, "S", sub, "1948  -  2026"),
        fld("Verse", 130, 560 + top, 508, 130, 23, "S", fg, "Even in the darkest night,\nyour light finds us.", { multiline: true, lead: 1.55 })],
      sheet: { size: [612, 792], scale: 1, cols: 1, rows: 1 } });
  }

  // B2 program, 11 x 8.5 folding to 5.5 x 8.5. Outside: back (left, light) + cover (right, dusk). Inside: light.
  seed = 41;
  const P2 = 528;
  designs["longest-program"] = { w: 1056, h: 816, bg: B.paper, pages: [
    `<div style="position:absolute;left:${P2}px;top:0;width:${P2}px;height:816px;background:${sky()}"></div>
     ${S(1056, 816, `<g transform="translate(${P2} 0)">${starfield(P2, 816, 110, "#fff")}${star(264, 150, 26, "#fff")}${star(264, 150, 44, "#fff", .14)}
       <path d="M0 760C120 735 200 745 264 738C350 728 440 748 528 735V816H0Z" fill="#fff" opacity=".22"/></g>
       ${star(264, 70, 12, B.d2)}<line x1="214" y1="104" x2="314" y2="104" stroke="${B.d3}" stroke-width="1"/>`)}
     ${cap("NAMES WE HOLD IN THE LIGHT", 124, 12, B.d2, .42, 400, 0, P2)}
     ${cap("A SERVICE OF REMEMBRANCE", 240, 12, B.silver, .55, 300, P2, P2)}`,
    `${S(1056, 816, `${star(264, 60, 12, B.d2)}${star(792, 60, 12, B.d2)}
       <line x1="${P2}" y1="40" x2="${P2}" y2="776" stroke="${B.d3}" stroke-width=".6" stroke-dasharray="2 5"/>`)}
     ${cap("ORDER OF SERVICE", 92, 12, B.d2, .45, 400, 0, P2)}
     ${cap("THE LIGHTING OF CANDLES", 92, 12, B.d2, .45, 400, P2, P2)}`] };
  const svc = [["Gathering music", ""], ["Welcome", "Rev. Anna Morales"], ["Reading", "Psalm 23"], ["Reflection", "Holding grief in a season of light"], ["The lighting of candles", "All are welcome to come forward"], ["Silence", ""], ["Closing blessing", ""], ["", ""]];
  const progFields = [
    fld("Names remembered", 64, 160, 400, 470, 15, "S", B.ink, "Margaret Anne Ellis\nJames Robert Okafor\nRuth Ann Lindqvist\nDaniel \"Danny\" Pierce\nEsther Goldberg\nSamuel Thomas Reyes\nLily May Carter", { multiline: true, lead: 2.0 }),
    fld("Closing words", 64, 660, 400, 96, 13, "S", B.d2, "However you came tonight, you are not alone. Take a candle home with you.", { multiline: true, lead: 1.6 }),
    fld("Title", P2 + 40, 276, P2 - 80, 140, 50, "S", "#ffffff", "The Longest\nNight", { multiline: true, lead: 1.15 }),
    fld("When and where", P2 + 40, 436, P2 - 80, 100, 15, "S", "#ffffff", "Monday, December 21, 2026\n7:00 in the evening\nGrace Fellowship Hall", { multiline: true, lead: 1.7 }),
    fld("Cover words", P2 + 60, 596, P2 - 120, 60, 15, "S", "#ffffff", "For all who carry an empty place\ninto this season", { multiline: true, lead: 1.6 }),
  ];
  svc.forEach(([item, detail], i) => {
    const y = 140 + i * 72;
    progFields.push(Object.assign(fld(`Service item ${i + 1}`, 64, y, 400, 24, 17, "S", B.ink, item), { page: 2 }));
    progFields.push(Object.assign(fld(`Service item ${i + 1} detail`, 64, y + 28, 400, 20, 13, "S", B.d2, detail), { page: 2 }));
  });
  progFields.push(Object.assign(fld("Candle words", P2 + 64, 140, 400, 560, 15, "S", B.ink,
    "We light this candle for the ones we have lost, and for the love that does not end.\n\nWe light this candle for the hard memories, and the gentle ones.\n\nWe light this candle for ourselves, that we may be kind to our own hearts.\n\nAnd we light this candle for hope, small and steady, like the returning sun.",
    { multiline: true, lead: 1.75 }), { page: 2 }));
  products.push({ file: `${BN}/02 Program - ${BN} (fill-in).pdf`, title: `Longest Night Service Program - ${BN}`, bg: "longest-program.pdf", fields: progFields });

  // B3 candle-lighting card (light, ink-friendly)
  seed = 53;
  const carry = fld("What I carry", 60, 336, 288, 140, 16, "S", B.ink, "His terrible jokes and his steady hands.", { multiline: true, lead: 2.4, align: 0 });
  designs["longest-card"] = { w: 408, h: 528, bg: B.paper, pages: [`<div style="position:absolute;left:0;right:0;top:0;height:150px;background:linear-gradient(180deg,${B.d1},${B.d3})"></div>
    ${S(408, 528, `${starfield(408, 150, 45, "#fff", 1)}${star(204, 75, 18, "#fff")}`)}
    ${cap("TONIGHT I LIGHT A CANDLE FOR", 184, 11, B.d2, .42, 400)}
    <div class="ln" style="left:60px;width:288px;top:262px;border-color:${B.d3}"></div>
    ${cap("WHAT I CARRY WITH ME", 296, 11, B.d2, .42, 400)}
    ${lines(carry, 3, B.d3 + "99")}`] };
  products.push({ file: `${BN}/03 Candle-Lighting Cards - ${BN} (fill-in).pdf`, title: `Candle-Lighting Remembrance Cards - ${BN}`, bg: "longest-card.pdf",
    fields: [fld("Name", 40, 214, 328, 44, 30, "S", B.ink, "Dad"), carry], sheet: CARD_SHEET });
}

// ======================= C: Harvest Table =======================
{
  const CN = "Harvest Table";
  const cluster = (s = 1) => `${wheat(0, 0, -112, 150, C.brown, C.mustard)}${wheat(0, 0, -68, 150, C.brown, C.mustard)}${wheat(0, 0, -90, 165, C.brown, "#d8ad55")}
    ${leaf(0, 0, -160, 70, C.terra)}${leaf(0, 0, -20, 70, C.terra)}${leaf(0, 0, 160, 54, C.rust)}${leaf(0, 0, 20, 54, C.rust)}${leaf(0, 0, -135, 50, C.olive)}${leaf(0, 0, -45, 50, C.olive)}<circle r="7" fill="${C.brown}"/>`;
  const sprig = `${leaf(0, 0, -170, 70, C.terra)}${leaf(0, 0, -10, 70, C.terra)}${leaf(0, 0, -140, 50, C.olive)}${leaf(0, 0, -40, 50, C.olive)}${wheat(0, 0, -90, 120, C.brown, C.mustard)}<circle r="6" fill="${C.brown}"/>`;
  // C1 empty-chair sign 8x10
  designs["harvest-sign"] = { w: 768, h: 960, bg: C.oat, pages: [`${S(768, 960, `
    <rect x="40" y="40" width="688" height="880" rx="6" fill="none" stroke="${C.brown}" stroke-width="1.3"/>
    <g transform="translate(384 250)">${cluster()}</g>
    <path d="M300 740H468" stroke="${C.terra}" stroke-width="1.4"/><circle cx="384" cy="740" r="4" fill="${C.terra}"/>
    <g transform="translate(384 862) scale(.6)">${sprig}</g>`)}
    ${cap("WE SAVED A SEAT FOR YOU", 296, 15, C.terra, .42, 600)}`] };
  products.push({ file: `${CN}/01 Empty-Chair Sign - ${CN} (fill-in).pdf`, title: `Thanksgiving Memorial Empty-Chair Sign - ${CN}`, bg: "harvest-sign.pdf",
    fields: [fld("Name", 64, 334, 640, 176, 74, "R", C.brown, "Margaret\nAnne Ellis", { multiline: true, lead: 1.05 }),
      fld("Years", 234, 518, 300, 24, 16, "S", C.olive, "1948  -  2026"),
      fld("Verse", 120, 580, 528, 120, 25, "I", C.brown, "Grateful for every year\nwe had you at this table.", { multiline: true, lead: 1.5 })],
    sheet: { size: [612, 792], scale: 1, cols: 1, rows: 1 } });

  // C2 "I'm thankful for" cards
  const thanks = fld("Memory", 50, 204, 308, 210, 18, "I", C.brown, "the way he carved the turkey like it was a sport, and every story that came with it.", { multiline: true, lead: 2.35, align: 0 });
  designs["harvest-card"] = { w: 408, h: 528, bg: C.oat, pages: [`${S(408, 528, `
    <rect x="16" y="16" width="376" height="496" rx="4" fill="none" stroke="${C.brown}" stroke-width="1"/>
    <g transform="translate(204 104) scale(.5)">${wheat(0, 0, -112, 150, C.brown, C.mustard)}${wheat(0, 0, -68, 150, C.brown, C.mustard)}${leaf(0, 0, -160, 70, C.terra)}${leaf(0, 0, -20, 70, C.terra)}<circle r="6" fill="${C.brown}"/></g>`)}
    ${cap("I'M THANKFUL FOR", 122, 11, C.terra, .38, 600)}
    ${lines(thanks, 5, C.brown + "55")}
    ${cap("FROM", 460, 9, C.olive, .3, 600, 50, 60)}
    <div class="ln" style="left:112px;width:246px;top:472px;border-color:${C.brown}55"></div>`] };
  products.push({ file: `${CN}/02 Thankful Cards - ${CN} (fill-in).pdf`, title: `"I'm Thankful For" Memory Cards - ${CN}`, bg: "harvest-card.pdf",
    fields: [fld("Name", 40, 144, 328, 44, 32, "R", C.brown, "Uncle Ray"), thanks, fld("From", 114, 454, 244, 18, 11, "S", C.brown, "", { align: 0 })], sheet: CARD_SHEET });

  // C3 tent place cards: 3.5 x 4 in flat, fold at the middle to 3.5 x 2. Back half is upside down.
  const tent = (rot) => `<g transform="${rot ? "rotate(180 168 96)" : ""}"><g transform="translate(46 152) scale(.42)">${wheat(0, 0, -100, 150, C.brown, C.mustard)}${leaf(0, 0, -150, 70, C.terra)}${leaf(0, 0, -40, 60, C.olive)}</g>
    <g transform="translate(290 152) scale(.42)">${wheat(0, 0, -80, 150, C.brown, C.mustard)}${leaf(0, 0, -30, 70, C.terra)}${leaf(0, 0, -140, 60, C.olive)}</g></g>`;
  designs["harvest-place"] = { w: 336, h: 384, bg: C.oat, pages: [`${S(336, 384, `${tent(true)}<g transform="translate(0 192)">${tent(false)}</g>
    <line x1="0" y1="192" x2="336" y2="192" stroke="${C.brown}" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="3 4"/>
    <g transform="rotate(180 168 96)"><text x="168" y="92" text-anchor="middle" font-family="Cala" font-style="italic" font-size="20" fill="${C.brown}">Happy Thanksgiving</text></g>`)}`] };
  products.push({ file: `${CN}/03 Place Cards - ${CN} (fill-in).pdf`, title: `Thanksgiving Place Cards - ${CN}`, bg: "harvest-place.pdf",
    fields: [fld("Top line", 40, 246, 256, 16, 10, "S", C.terra, "IN LOVING MEMORY"), fld("Name", 40, 266, 256, 44, 32, "R", C.brown, "Grandpa Joe")],
    sheet: { size: [612, 792], scale: 1, cols: 2, rows: 2 } });
}

// ---------- draw ----------
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(path.join(HERE, "bg"), { recursive: true });
for (const [name, d] of Object.entries(designs)) {
  const pagesHtml = d.pages.map((body) => `<div class="page" style="width:${d.w}px;height:${d.h}px;background:${d.bg};page-break-after:always">${body}</div>`).join("");
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
fs.writeFileSync(path.join(HERE, "holiday-fields.json"), JSON.stringify({ products }, null, 1));
console.log("wrote holiday-fields.json:", products.length, "products");
