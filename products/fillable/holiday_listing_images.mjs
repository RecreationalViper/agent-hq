// Listing images (2000x1500, 4:3) for the holiday collections, made from the real fill-in files.
// Needs page renders in a folder (pass it as the first argument; see the pdftoppm list in the commit message),
// writes previews/listing/<set>-1..4.jpg. Scenes are styled in code: no stock photos, nothing invented.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = createRequire("/usr/local/lib/node_modules/x")("playwright"); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = process.argv[2] || "/tmp/img/r";
const OUT = path.join(HERE, "previews", "listing"); fs.mkdirSync(OUT, { recursive: true });
const img = (n) => pathToFileURL(path.join(R, n + ".png")).href;
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;

const CSS = `
@font-face{font-family:Bask;src:url(${F("GFSBaskerville.otf")})}
@font-face{font-family:InterH;font-weight:400;src:url(${F("Inter-Regular.otf")})}
@font-face{font-family:InterH;font-weight:600;src:url(${F("Inter-SemiBold.otf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:2000px;height:1500px;overflow:hidden;position:relative;font-family:InterH}
.p{position:absolute;box-shadow:0 30px 60px rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.22)}
.p img{display:block;width:100%;height:100%}
.lab{position:absolute;font:600 30px InterH;letter-spacing:.06em;text-align:center}
.h1{position:absolute;left:0;right:0;text-align:center;font:400 84px Bask}
.sub{position:absolute;left:0;right:0;text-align:center;font:400 34px InterH;letter-spacing:.02em}
.bok{position:absolute;border-radius:50%;filter:blur(18px)}`;

const grain = (base, line, op = .18) => `background-color:${base};background-image:
  repeating-linear-gradient(92deg, rgba(0,0,0,${op}) 0 2px, transparent 2px 23px),
  repeating-linear-gradient(88deg, rgba(255,255,255,${op * .5}) 0 1px, transparent 1px 41px),
  linear-gradient(180deg, ${line}, transparent 30%, rgba(0,0,0,.18));`;
const linen = (base) => `background-color:${base};background-image:
  repeating-linear-gradient(0deg, rgba(0,0,0,.035) 0 1px, transparent 1px 4px),
  repeating-linear-gradient(90deg, rgba(0,0,0,.035) 0 1px, transparent 1px 4px),
  radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.25), transparent 70%);`;
const bokeh = (n, col, seed = 3) => { let s = "", x = seed; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) { const d = 60 + r() * 160; s += `<div class="bok" style="left:${r() * 2000 - 80}px;top:${r() * 1500 - 80}px;width:${d}px;height:${d}px;background:${col};opacity:${(.15 + r() * .3).toFixed(2)}"></div>`; } return s; };
const P = (src, x, y, w, h, rot = 0, extra = "") => `<div class="p" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg);${extra}"><img src="${img(src)}"></div>`;
const arch = (src, x, y, w, rot = 0) => P(src, x, y, w, w * 1.4, rot, "border-radius:50% 50% 4px 4px / 35.5% 35.5% 4px 4px;overflow:hidden");
// fold-over place card: front half of the flat file, standing (slight perspective)
const tent = (x, y, w, rot = 0) => `<div class="p" style="left:${x}px;top:${y}px;width:${w}px;height:${w * 192 / 336}px;transform:perspective(900px) rotateX(14deg) rotate(${rot}deg);overflow:hidden"><img src="${img("h-place")}" style="width:100%;height:auto;margin-top:-${w * 192 / 336}px"></div>`;
const easy = (dark, title, items, pieceA, pieceB, bg) => `<div style="position:absolute;inset:0;${bg}"></div>
  <div class="h1" style="top:90px;color:${dark}">${title}</div>
  <div class="sub" style="top:200px;color:${dark};opacity:.8">No Canva or paid software · computer, tablet or phone</div>
  <div style="position:absolute;left:150px;top:330px;width:1040px;height:700px;background:#1d1d1f;border-radius:28px;padding:26px;box-shadow:0 30px 60px rgba(0,0,0,.35)">
    <div style="width:100%;height:100%;background:#f4f4f4;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <img src="${img(pieceA)}" style="height:92%;box-shadow:0 6px 20px rgba(0,0,0,.2)"></div></div>
  <div style="position:absolute;left:60px;top:1030px;width:1220px;height:34px;background:linear-gradient(#cfcfd2,#9a9a9f);border-radius:0 0 30px 30px;box-shadow:0 20px 40px rgba(0,0,0,.3)"></div>
  <div style="position:absolute;left:1330px;top:420px;width:400px;height:820px;background:#1d1d1f;border-radius:60px;padding:22px;box-shadow:0 30px 60px rgba(0,0,0,.35)">
    <div style="width:100%;height:100%;background:#f4f4f4;border-radius:42px;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <img src="${img(pieceB)}" style="width:90%;box-shadow:0 6px 20px rgba(0,0,0,.2)"></div></div>
  <div style="position:absolute;left:150px;top:1140px;width:1100px;font:400 34px/1.7 InterH;color:${dark}">${items.map((t) => `✓&nbsp; ${t}`).join("<br>")}</div>`;

const S = {
  "harvest-table": [
    // 1 hero: sign on the chair-side table with cards and place cards
    `<div style="position:absolute;inset:0;${grain("#a87a52", "rgba(255,240,220,.25)")}"></div>
     <div style="position:absolute;left:0;right:0;top:880px;height:420px;${linen("#ece3d2")};box-shadow:0 -4px 20px rgba(0,0,0,.15)"></div>
     ${P("h-sign", 640, 120, 720, 900, -1)}${P("h-card", 170, 760, 420, 544, -7)}${P("h-card", 1420, 760, 420, 544, 6)}
     ${tent(780, 1110, 440, 0)}`,
    // 2 what's included
    `<div style="position:absolute;inset:0;${linen("#efe7d8")}"></div>
     <div class="h1" style="top:60px;color:#4b3527">What's included</div>
     ${P("h-sign", 120, 230, 640, 800)}${P("h-cards", 880, 230, 560, 725)}${tent(1530, 470, 380)}
     <div class="lab" style="left:120px;top:1060px;width:640px;color:#4b3527">"WE SAVED A SEAT FOR YOU" SIGN<br><span style="font-weight:400;opacity:.75">8 x 10 in · fits a standard frame</span></div>
     <div class="lab" style="left:880px;top:1000px;width:560px;color:#4b3527">"I'M THANKFUL FOR" CARDS<br><span style="font-weight:400;opacity:.75">4 per page</span></div>
     <div class="lab" style="left:1500px;top:720px;width:440px;color:#4b3527">PLACE CARDS<br><span style="font-weight:400;opacity:.75">fold to stand · 4 per page</span></div>
     <div class="sub" style="top:1310px;color:#4b3527">+ Start Here guide · instant download · print on US Letter</div>`,
    // 3 detail: thankful cards at the table
    `<div style="position:absolute;inset:0;${grain("#9b6e48", "rgba(255,240,220,.2)")}"></div>
     ${P("h-card", 260, 170, 760, 984, -4)}${P("h-card", 1080, 260, 660, 855, 5)}
     <div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:rgba(239,229,211,.92)"></div>
     <div class="h1" style="top:1345px;font-size:56px;color:#4b3527">Let everyone finish the sentence</div>`,
    easy("#4b3527", "Fill it in, print it tonight", ["Type a name once, every card updates", "Print at home or at any print shop", "Instant download"], "h-sign", "h-card", linen("#efe7d8")),
  ],
  "evergreen": [
    `<div style="position:absolute;inset:0;${grain("#3a2a20", "rgba(255,210,150,.12)", .22)}"></div>${bokeh(26, "#f6c66a", 5)}
     ${P("e-sign", 620, 100, 760, 950, 0)}${arch("e-orn", 190, 640, 340, -8)}${P("e-card", 1460, 700, 400, 518, 6)}${arch("e-orn", 1500, 140, 260, 9)}`,
    `<div style="position:absolute;inset:0;${linen("#f3ecdd")}"></div>
     <div class="h1" style="top:60px;color:#22382e">What's included</div>
     ${P("e-sign", 100, 230, 600, 750)}${P("e-card", 790, 260, 380, 492, -2)}${P("e-card2", 1020, 470, 380, 492, 3)}${arch("e-orn", 1530, 300, 330, 2)}
     <div class="lab" style="left:100px;top:1010px;width:600px;color:#22382e">CANDLE TABLE SIGN<br><span style="font-weight:400;opacity:.75">8 x 10 in · fits a standard frame</span></div>
     <div class="lab" style="left:800px;top:1010px;width:600px;color:#22382e">HOLIDAY MEMORY CARDS<br><span style="font-weight:400;opacity:.75">green + ink-saver version · 4 per page</span></div>
     <div class="lab" style="left:1470px;top:800px;width:450px;color:#22382e">ORNAMENT CARDS<br><span style="font-weight:400;opacity:.75">cut, punch, add ribbon · 4 per page</span></div>
     <div class="sub" style="top:1310px;color:#22382e">+ Start Here guide · instant download · print on US Letter</div>`,
    `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%, #2f4a3c, #15241c)"></div>${bokeh(30, "#ffd47a", 9)}
     ${arch("e-orn", 330, 180, 520, -5)}${arch("e-orn", 1110, 240, 480, 6)}
     <div style="position:absolute;left:585px;top:0;width:3px;height:190px;background:#c9535e"></div><div style="position:absolute;left:1350px;top:0;width:3px;height:250px;background:#c9535e"></div>
     <div class="h1" style="top:1260px;font-size:60px;color:#f7f1e4">A keepsake for the tree</div>`,
    easy("#22382e", "Fill it in, print it tonight", ["Type a name once, every card updates", "Print at home or at any print shop", "Instant download"], "e-sign", "e-card", linen("#f3ecdd")),
  ],
  "longest-night": [
    `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%, #4a5280, #1b2140 75%)"></div>${bokeh(24, "#dfe3ff", 4)}
     <div style="position:absolute;left:0;right:0;top:960px;height:540px;${linen("#d9d6e3")}"></div>
     ${P("l-sign", 160, 120, 680, 850, -2)}${P("l-prog1", 950, 260, 920, 710, 2, "")}${P("l-card", 1150, 900, 380, 492, -5)}`,
    `<div style="position:absolute;inset:0;${linen("#eceaf2")}"></div>
     <div class="h1" style="top:60px;color:#2a2d40">What's included</div>
     ${P("l-prog1", 80, 240, 900, 695)}${P("l-prog2", 80, 790, 640, 495, -2)}${P("l-sign", 1060, 230, 470, 588)}${P("l-sign2", 1170, 470, 470, 588, 4)}${P("l-card", 1580, 760, 330, 427, -3)}
     <div class="lab" style="left:740px;top:1060px;width:420px;color:#2a2d40;text-align:left">SERVICE PROGRAM<br><span style="font-weight:400;opacity:.75">folds to 5.5 x 8.5 in · names, order of service, candle litany</span></div>
     <div class="lab" style="left:1180px;top:1090px;width:420px;color:#2a2d40">TABLE SIGN<br><span style="font-weight:400;opacity:.75">8 x 10 in + ink-saver version</span></div>
     <div class="lab" style="left:1580px;top:1210px;width:340px;color:#2a2d40">CANDLE CARDS<br><span style="font-weight:400;opacity:.75">4 per page</span></div>
     <div class="sub" style="top:1380px;color:#2a2d40">+ Start Here guide · faith-neutral · instant download</div>`,
    `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#1b2140,#3c4570 60%,#8a8fb3)"></div>${bokeh(30, "#ffffff", 11)}
     ${P("l-prog2", 200, 180, 1600, 1236, 0)}`,
    easy("#2a2d40", "Ready for your service", ["Edit every word: names, readings, order of service", "Print as many copies as you need", "Instant download"], "l-prog1", "l-card", linen("#eceaf2")),
  ],
};

const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 2000, height: 1500 } });
for (const [set, scenes] of Object.entries(S)) for (const [i, body] of scenes.entries()) {
  const tmp = path.join(R, `_scene.html`);
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  const f = path.join(OUT, `${set}-${i + 1}.jpg`); await p.screenshot({ path: f, type: "jpeg", quality: 88 }); console.log("saved", f);
}
await b.close();
