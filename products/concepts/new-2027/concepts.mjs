// Concept boards for the next three Forever Held collections (owner picks before anything is built).
// A Forever in My Heart (Valentine's remembrance), B Service of Remembrance (church/hospice), C Birthday in Heaven.
// All art is drawn in code; fonts are OFL files from products/fillable/fonts.
// Usage: NODE_PATH=... node products/concepts/new-2027/concepts.mjs
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
let pw; for (const p of ["playwright", path.join(process.env.NODE_PATH || "", "playwright")]) { try { pw = require(p); break; } catch {} }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT = (f) => pathToFileURL(path.join(HERE, "../../fillable/fonts", f)).href;
const CSS = `
@font-face{font-family:Corm;src:url(${FONT("CormorantGaramond.ttf")})}
@font-face{font-family:Corm;font-style:italic;src:url(${FONT("CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${FONT("Cinzel.ttf")})}
@font-face{font-family:InterSB;src:url(${FONT("Inter-SemiBold.otf")})}
@font-face{font-family:InterR;src:url(${FONT("Inter-Regular.otf")})}
@font-face{font-family:InterL;src:url(${FONT("Inter-Light.otf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1800px;height:1250px;background:#E6DED2;font-family:InterR;color:#2a2622;position:relative;overflow:hidden}
.k{font-family:InterSB;letter-spacing:.22em;text-transform:uppercase}
.head{position:absolute;left:70px;top:52px;right:70px}
.head .k{font-size:18px;color:#6b5646}
.head h1{font:italic 400 84px/1 Corm;margin:10px 0 8px}
.head p{font-size:24px;color:#5f5850;max-width:1300px}
.row{position:absolute;left:70px;right:70px;top:300px;height:700px;display:flex;align-items:center;justify-content:center;gap:60px}
.pc{position:relative;flex:none;overflow:hidden;box-shadow:0 30px 60px -24px rgba(40,30,20,.5),0 2px 6px rgba(40,30,20,.15)}
.pc *{position:absolute}
.cap{position:absolute;bottom:-34px;left:0;right:0;text-align:center;font-size:15px;color:#5f5850;font-family:InterSB;letter-spacing:.12em;text-transform:uppercase;position:absolute}
.wrapc{position:relative;flex:none}
.foot{position:absolute;left:70px;right:70px;bottom:46px;display:flex;gap:46px;align-items:flex-end;font-size:17px;color:#4a443e}
.sw{display:flex;gap:10px}.sw i{display:block;width:44px;height:44px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.foot b{font-family:InterSB;font-weight:400;display:block;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#6b5646;margin-bottom:6px}
.c{left:0;right:0;text-align:center}
`;
const T = (txt, top, css) => `<div class="c" style="top:${top}px;${css}">${txt}</div>`;

// ---------- A: Forever in My Heart ----------
const heartPath = (x, y, s) => `M${x} ${y + s * .3}C${x} ${y - s * .1} ${x - s * .55} ${y - s * .15} ${x - s * .55} ${y + s * .22}C${x - s * .55} ${y + s * .55} ${x - s * .1} ${y + s * .75} ${x} ${y + s}C${x + s * .1} ${y + s * .75} ${x + s * .55} ${y + s * .55} ${x + s * .55} ${y + s * .22}C${x + s * .55} ${y - s * .15} ${x} ${y - s * .1} ${x} ${y + s * .3}Z`;
const hearts = (w, cx, y, s, col) => `<svg width="${w}" height="${s * 1.3}" style="left:0;top:${y}px" viewBox="0 0 ${w} ${s * 1.3}"><path d="${heartPath(cx - s * .28, 4, s)}" fill="none" stroke="${col}" stroke-width="1.6"/><path d="${heartPath(cx + s * .28, 4 + s * .1, s * .92)}" fill="none" stroke="${col}" stroke-width="1.6" opacity=".55"/></svg>`;
const A = { name: "A · Forever in My Heart", sub: "Valentine's remembrance for someone grieving a husband, wife or partner. Soft, romantic, not sad: two hearts drawn as one line.",
  sw: ["#FBF5F0", "#EFD6D2", "#A4485A", "#4B1E2B", "#B8925A"], fonts: "Cormorant Garamond Italic + Inter", when: "Pins from Dec 26 · sells Jan 1 – Feb 14",
  pieces: "Table sign 8x10 · Love-letter cards · Candle cards · Phone post · $8.99",
  items: [
    { cap: "Table sign 8 x 10", w: 440, h: 550, html: `<div style="inset:0;background:#FBF5F0"></div><div style="inset:16px;border:1px solid #D9B7B3"></div>
      ${T("Valentine's Day · In remembrance", 56, "font:12px InterSB;letter-spacing:.24em;text-transform:uppercase;color:#A4485A")}
      ${hearts(440, 220, 96, 74, "#A4485A")}
      ${T("Forever in my heart", 222, "font:italic 50px/1 Corm;color:#4B1E2B")}
      <div style="left:190px;width:60px;top:296px;height:1.5px;background:#B8925A"></div>
      ${T("Daniel Thomas Reyes", 322, "font:30px Times,serif;color:#2b1a1f")}
      ${T("1958 — 2025", 368, "font:13px Helvetica;letter-spacing:.2em;color:#A4485A")}
      ${T("Married thirty-four years.<br>Loved for always.", 412, "font:italic 19px/1.4 Times,serif;color:#6b4a50")}` },
    { cap: "Love-letter card 4.25 x 5.5", w: 330, h: 427, html: `<div style="inset:0;background:#EFD6D2"></div><div style="inset:14px;background:#FBF5F0"></div>
      ${hearts(330, 165, 34, 34, "#A4485A")}
      ${T("A letter to you", 86, "font:italic 36px Corm;color:#4B1E2B")}
      <div style="left:40px;top:150px;font:italic 17px Times,serif;color:#4B1E2B">My Daniel,</div>
      <div style="left:40px;right:40px;top:178px;font:italic 15px/31px Times,serif;color:#5a3a40">I still set out two cups every morning…</div>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<div style="left:40px;right:40px;top:${202 + i * 31}px;height:1px;background:#E2C6C2"></div>`).join("")}
      <div style="right:40px;top:392px;font:italic 15px Times,serif;color:#4B1E2B">Love always, Maria</div>` },
    { cap: "Candle card", w: 270, h: 360, html: `<div style="inset:0;background:#4B1E2B"></div><div style="inset:12px;border:1px solid #B8925A80"></div>
      <svg width="270" height="150" style="left:0;top:40px"><defs><radialGradient id="ga"><stop offset="0" stop-color="#F4C978" stop-opacity=".55"/><stop offset="1" stop-color="#F4C978" stop-opacity="0"/></radialGradient></defs>
      <circle cx="135" cy="58" r="58" fill="url(#ga)"/><rect x="121" y="78" width="28" height="70" rx="3" fill="#FBF5F0"/><path d="M135 38C143 52 142 62 135 64C128 62 127 52 135 38Z" fill="#F4C978"/></svg>
      ${T("Tonight we light<br>a candle for", 206, "font:italic 20px/1.3 Corm;color:#F3E2D8")}
      ${T("Daniel", 262, "font:34px Times,serif;color:#E7C98F")}
      ${T("Forever in our hearts", 312, "font:11px InterSB;letter-spacing:.22em;text-transform:uppercase;color:#D9B7B3")}` },
  ] };

// ---------- B: Service of Remembrance ----------
const candles = (w, top, n, col, h0) => { let s = `<svg width="${w}" height="${h0 + 60}" style="left:0;top:${top}px"><defs><radialGradient id="gb${top}"><stop offset="0" stop-color="#F2C46B" stop-opacity=".6"/><stop offset="1" stop-color="#F2C46B" stop-opacity="0"/></radialGradient></defs>`;
  const gap = w / (n + 1); for (let i = 0; i < n; i++) { const x = gap * (i + 1), h = h0 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + 1))); const yb = h0 + 50;
    s += `<circle cx="${x}" cy="${yb - h - 16}" r="${gap * .55}" fill="url(#gb${top})"/><rect x="${x - gap * .13}" y="${yb - h}" width="${gap * .26}" height="${h}" rx="2" fill="${col}"/><path d="M${x} ${yb - h - 26}C${x + 6} ${yb - h - 15} ${x + 5} ${yb - h - 6} ${x} ${yb - h - 5}C${x - 5} ${yb - h - 6} ${x - 6} ${yb - h - 15} ${x} ${yb - h - 26}Z" fill="#E9A93A"/>`; }
  return s + "</svg>"; };
const names = ["Ruth Ann Baker", "James Carter", "Elena Morales", "Walter Brooks", "Grace Kim", "Thomas Ellis", "Mary O'Neil", "Samuel Hayes", "Linda Carter", "Joseph Novak", "Dorothy Mae Johnson", "Henry Patel", "Margaret Ellis", "Luis Ortega", "Anne Whitfield", "Frank DeLuca", "Rose Bennett", "Isaac Green"];
const B = { name: "B · Service of Remembrance", sub: "For churches, hospices and funeral homes holding their yearly memorial service, when the names of everyone lost that year are read aloud and a candle is lit for each.",
  sw: ["#F4EFE6", "#2F3E4E", "#8A9AA6", "#D9A441", "#1E2A36"], fonts: "Cinzel + Cormorant Garamond", when: "Sells all year · peaks Nov (All Souls), Dec, Memorial Day",
  pieces: "Program with names list · Welcome sign · Candle-lighting cards · Names banner · $14.99",
  items: [
    { cap: "Program cover 5.5 x 8.5", w: 330, h: 510, html: `<div style="inset:0;background:#F4EFE6"></div><div style="left:0;right:0;top:0;height:230px;background:#2F3E4E"></div>
      ${candles(330, 70, 7, "#F4EFE6", 110)}
      ${T("Fairview Community Hospice", 258, "font:11px InterSB;letter-spacing:.22em;text-transform:uppercase;color:#8A9AA6")}
      ${T("A Service of<br>Remembrance", 290, "font:34px/1.15 Cinzel;color:#1E2A36")}
      <div style="left:140px;width:50px;top:384px;height:1.5px;background:#D9A441"></div>
      ${T("We light a candle for each<br>name we carry in our hearts", 402, "font:italic 17px/1.35 Corm;color:#4a5866")}
      ${T("Sunday, December 13, 2026 · 4 PM", 462, "font:10.5px Helvetica;letter-spacing:.14em;text-transform:uppercase;color:#2F3E4E")}` },
    { cap: "Names we remember", w: 330, h: 510, html: `<div style="inset:0;background:#F4EFE6"></div>
      ${T("Names we remember", 40, "font:24px Cinzel;color:#1E2A36")}
      <div style="left:140px;width:50px;top:84px;height:1.5px;background:#D9A441"></div>
      <div style="left:30px;right:30px;top:104px;columns:2;column-gap:20px;font:13px/23px Times,serif;color:#2F3E4E;text-align:center">${names.map((n) => `<div style="position:static">${n}</div>`).join("")}</div>
      ${T("As each name is read, a candle is lit.", 330 + 128, "font:italic 15px Corm;color:#4a5866")}` },
    { cap: "Welcome sign 16 x 20", w: 400, h: 500, html: `<div style="inset:0;background:#2F3E4E"></div><div style="inset:16px;border:1px solid #D9A44166"></div>
      ${candles(400, 40, 9, "#F4EFE6", 120)}
      ${T("Welcome", 230, "font:44px Cinzel;color:#F4EFE6")}
      ${T("to our yearly", 290, "font:italic 20px Corm;color:#C9D2D9")}
      ${T("Service of Remembrance", 318, "font:22px Cinzel;color:#E3B45A")}
      ${T("Tonight we remember the ones<br>we have loved and lost this year.", 372, "font:italic 18px/1.4 Corm;color:#C9D2D9")}
      ${T("Grace Community Church", 444, "font:11px InterSB;letter-spacing:.22em;text-transform:uppercase;color:#8A9AA6")}` },
  ] };

// ---------- C: Birthday in Heaven ----------
const constel = (w, top, col) => { const pts = [[.12, .6], [.24, .3], [.38, .5], [.52, .2], [.66, .45], [.8, .25], [.9, .55]];
  let s = `<svg width="${w}" height="90" style="left:0;top:${top}px"><path d="M${pts.map(([x, y]) => `${x * w} ${y * 90}`).join("L")}" stroke="${col}" stroke-width="1" fill="none" opacity=".6"/>`;
  pts.forEach(([x, y], i) => { const r = i === 3 ? 7 : 4.5, X = x * w, Y = y * 90; s += `<path d="M${X} ${Y - r}Q${X + r * .18} ${Y - r * .18} ${X + r} ${Y}Q${X + r * .18} ${Y + r * .18} ${X} ${Y + r}Q${X - r * .18} ${Y + r * .18} ${X - r} ${Y}Q${X - r * .18} ${Y - r * .18} ${X} ${Y - r}Z" fill="${col}"/>`; });
  return s + "</svg>"; };
const dots = (w, h, n, seed) => { let s = "", r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647); for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${(rnd() * 1.2 + .3).toFixed(2)}" fill="#fff" opacity="${(rnd() * .6 + .2).toFixed(2)}"/>`; return `<svg width="${w}" height="${h}" style="left:0;top:0">${s}</svg>`; };
const C2 = { name: "C · Birthday in Heaven", sub: "A new kind of product: for their birthday and the anniversary of their passing, the days families come back to every year. Dawn sky, gold stars, warm and hopeful.",
  sw: ["#FFFDF8", "#DCE6EE", "#F6E3D3", "#23324A", "#E0B65A"], fonts: "Cormorant Garamond + Inter Light", when: "Sells all year · people come back every year",
  pieces: "Birthday sign 8x10 · Notes-to-heaven cards · One-year anniversary card · Phone post · $6.99",
  items: [
    { cap: "Birthday sign 8 x 10", w: 440, h: 550, html: `<div style="inset:0;background:linear-gradient(#DCE6EE,#F6E3D3 70%,#FFFDF8)"></div>
      ${constel(440, 50, "#E0B65A")}
      ${T("Happy birthday in heaven", 172, "font:italic 40px Corm;color:#23324A")}
      ${T("Mom", 226, "font:96px/1 Corm;color:#23324A")}
      <div style="left:195px;width:50px;top:346px;height:1.5px;background:#E0B65A"></div>
      ${T("Celebrating 70 years of<br>Linda Marie Carter", 370, "font:21px/1.35 Times,serif;color:#33425a")}
      ${T("March 18 · Forever loved", 452, "font:12px Helvetica;letter-spacing:.2em;text-transform:uppercase;color:#9a7a3a")}` },
    { cap: "Notes-to-heaven card", w: 330, h: 427, html: `<div style="inset:0;background:#FFFDF8"></div><div style="left:0;right:0;top:0;height:110px;background:linear-gradient(#DCE6EE,#FFFDF8)"></div>
      ${constel(330, 18, "#E0B65A")}
      ${T("If I could tell you<br>one thing today…", 110, "font:italic 28px/1.15 Corm;color:#23324A")}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<div style="left:36px;right:36px;top:${200 + i * 30}px;height:1px;background:#D7DEE5"></div>`).join("")}
      <div style="left:36px;top:388px;font:11px InterSB;letter-spacing:.2em;color:#8a96a3">FROM</div><div style="left:84px;right:36px;top:398px;height:1px;background:#D7DEE5"></div>` },
    { cap: "Anniversary post for phones", w: 270, h: 480, html: `<div style="inset:0;background:linear-gradient(#23324A,#3a4a66)"></div>${dots(270, 300, 60, 11)}
      ${constel(270, 60, "#E0B65A")}
      ${T("One year in heaven", 180, "font:italic 30px Corm;color:#F6E3D3")}
      ${T("Linda Marie Carter", 232, "font:22px Times,serif;color:#FFFDF8")}
      ${T("March 18, 2025", 268, "font:11px Helvetica;letter-spacing:.2em;color:#E0B65A")}
      ${T("A year without you.<br>A lifetime of love.", 322, "font:italic 18px/1.4 Corm;color:#DCE6EE")}` },
  ] };

const board = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="head"><div class="k">Forever Held · New collection concept</div><h1>${c.name}</h1><p>${c.sub}</p></div>
<div class="row">${c.items.map((it) => `<div class="wrapc"><div class="pc" style="width:${it.w}px;height:${it.h}px">${it.html}</div><div class="cap">${it.cap}</div></div>`).join("")}</div>
<div class="foot"><div><b>Palette</b><div class="sw">${c.sw.map((x) => `<i style="background:${x}"></i>`).join("")}</div></div>
<div><b>Type</b>${c.fonts}</div><div><b>Pieces</b>${c.pieces}</div><div><b>When</b>${c.when}</div></div></body></html>`;

const b = await pw.chromium.launch(); const pg = await b.newPage({ viewport: { width: 1800, height: 1250 } });
for (const [c, f] of [[A, "concept-A-forever-in-my-heart"], [B, "concept-B-service-of-remembrance"], [C2, "concept-C-birthday-in-heaven"]]) {
  const tmp = path.join(HERE, `_${f}.html`); fs.writeFileSync(tmp, board(c)); await pg.goto(pathToFileURL(tmp).href); fs.unlinkSync(tmp); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(HERE, `${f}.jpg`), type: "jpeg", quality: 88 }); console.log("saved", f);
}
await b.close();
