// Renders 3 holiday collection concepts as preview boards (PNG) for owner approval.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = createRequire("/usr/local/lib/node_modules/x")("playwright"); }
const OUT = new URL(".", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });

// deterministic random
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- motifs ----------
// pine bough along a gentle curve from (x0,y0) to (x1,y1)
function bough(x0, y0, x1, y1, bend, col, col2, n = 34, len = 16) {
  const cx = (x0 + x1) / 2 + bend[0], cy = (y0 + y1) / 2 + bend[1];
  const P = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  let s = `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" stroke="${col2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i < n; i++) {
    const t = i / n, [x, y] = P(t), [xa, ya] = P(Math.min(1, t + 0.01));
    const ang = Math.atan2(ya - y, xa - x), L = len * (1 - t * 0.55);
    for (const side of [-1, 1]) for (const k of [0.55, 0.95]) {
      const a = ang + side * k;
      const c = rnd() < 0.3 ? col2 : col;
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * L).toFixed(1)}" y2="${(y + Math.sin(a) * L).toFixed(1)}" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/>`;
    }
  }
  return s;
}
const berries = (pts, col) => pts.map(([x, y, r = 4]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff" opacity=".35"/>`).join("");
function candle(cx, base, w, h, body, glowCol) {
  return `<defs><radialGradient id="g${cx}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${glowCol}" stop-opacity=".55"/><stop offset="1" stop-color="${glowCol}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="${cx}" cy="${base - h - 14}" r="${w * 1.9}" fill="url(#g${cx})"/>
  <rect x="${cx - w / 2}" y="${base - h}" width="${w}" height="${h}" rx="3" fill="${body}"/>
  <line x1="${cx}" y1="${base - h}" x2="${cx}" y2="${base - h - 6}" stroke="#3a2a1a" stroke-width="1.4"/>
  <path d="M${cx} ${base - h - 28}C${cx + 7} ${base - h - 16} ${cx + 6} ${base - h - 6} ${cx} ${base - h - 5}C${cx - 6} ${base - h - 6} ${cx - 7} ${base - h - 16} ${cx} ${base - h - 28}Z" fill="#f2b84b"/>
  <path d="M${cx} ${base - h - 19}C${cx + 3} ${base - h - 12} ${cx + 3} ${base - h - 8} ${cx} ${base - h - 7}C${cx - 3} ${base - h - 8} ${cx - 3} ${base - h - 12} ${cx} ${base - h - 19}Z" fill="#fff4cf"/>`;
}
const star = (x, y, r, col, o = 1) => `<path d="M${x} ${y - r}Q${x + r * .16} ${y - r * .16} ${x + r} ${y}Q${x + r * .16} ${y + r * .16} ${x} ${y + r}Q${x - r * .16} ${y + r * .16} ${x - r} ${y}Q${x - r * .16} ${y - r * .16} ${x} ${y - r}Z" fill="${col}" opacity="${o}"/>`;
function starfield(w, h, n, col, avoid) {
  let s = ""; for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h * .62; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rnd() * 1.1 + .3).toFixed(2)}" fill="${col}" opacity="${(rnd() * .6 + .3).toFixed(2)}"/>`; }
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
function leaf(x, y, ang, L, col) {
  return `<path d="M0 0C${L * .3} ${-L * .32} ${L * .75} ${-L * .3} ${L} 0C${L * .75} ${L * .3} ${L * .3} ${L * .32} 0 0Z" fill="${col}" transform="translate(${x} ${y}) rotate(${ang})"/><line x1="0" y1="0" x2="${L * .9}" y2="0" stroke="#fff" stroke-opacity=".25" stroke-width=".8" transform="translate(${x} ${y}) rotate(${ang})"/>`;
}
const svg = (w, h, body, st = "") => `<svg style="position:absolute;left:0;top:0;${st}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// ---------- concept A: Evergreen & Candlelight ----------
const A = { name: "Evergreen & Candlelight", pine: "#22382e", pine2: "#3e5b48", cream: "#f7f1e4", brass: "#b48a45", berry: "#8e2f3a", ink: "#2b2a27" };
function signA() {
  const w = 768, h = 960; seed = 11;
  const art = svg(w, h, `
    <rect x="34" y="34" width="${w - 68}" height="${h - 68}" fill="none" stroke="${A.brass}" stroke-width="1.2"/>
    ${bough(70, 150, 384, 118, [0, -40], A.pine, A.pine2, 30, 22)}${bough(698, 150, 384, 118, [0, -40], A.pine, A.pine2, 30, 22)}
    ${bough(140, 92, 330, 175, [-20, 30], A.pine2, A.pine, 18, 15)}${bough(628, 92, 438, 175, [20, 30], A.pine2, A.pine, 18, 15)}
    ${berries([[372, 132, 6], [388, 124, 5], [380, 145, 5], [360, 122, 4], [402, 140, 4]], A.berry)}
    ${candle(384, 395, 46, 92, A.cream, "#f5c86a")}
    <rect x="${384 - 23}" y="303" width="46" height="92" rx="3" fill="none" stroke="${A.brass}" stroke-width="1"/>
    ${bough(220, 860, 384, 820, [0, 30], A.pine, A.pine2, 20, 15)}${bough(548, 860, 384, 820, [0, 30], A.pine, A.pine2, 20, 15)}
    ${berries([[384, 822, 5], [372, 830, 4], [396, 830, 4]], A.berry)}`);
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${A.cream}">${art}
   <div class="t" style="top:430px;font:400 15px Inter;letter-spacing:.42em;color:${A.brass}">THIS CANDLE BURNS IN LOVING MEMORY OF</div>
   <div class="t" style="top:478px;font:400 66px 'GFS Baskerville';color:${A.pine};line-height:1.05">Margaret Anne Ellis</div>
   <div class="t" style="top:568px;font:400 16px Inter;letter-spacing:.3em;color:${A.ink}">1948 &nbsp;·&nbsp; 2026</div>
   <div class="t" style="top:640px;font:italic 400 26px 'GFS Baskerville';color:${A.ink};line-height:1.45;padding:0 120px">Though your chair is quiet this Christmas,<br>your love still fills the room.</div>
  </div>`;
}
function cardA() {
  const w = 408, h = 528; seed = 23;
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${A.pine}">${svg(w, h, `
     <rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="${A.brass}" stroke-width="1"/>
     ${bough(40, 70, 210, 52, [0, -20], "#5f8068", "#86a58c", 18, 13)}${bough(368, 70, 198, 52, [0, -20], "#5f8068", "#86a58c", 18, 13)}
     ${berries([[204, 60, 5], [194, 68, 4], [214, 68, 4]], "#c9535e")}`)}
   <div class="t" style="top:110px;font:400 11px Inter;letter-spacing:.38em;color:${A.brass}">A FAVORITE HOLIDAY MEMORY OF</div>
   <div class="t" style="top:136px;font:400 32px 'GFS Baskerville';color:${A.cream}">Grandma Maggie</div>
   ${[0, 1, 2, 3, 4].map(i => `<div class="ln" style="top:${236 + i * 44}px;left:52px;right:52px;border-color:${A.brass}66"></div>`).join("")}
   <div class="t hand" style="top:205px;color:${A.cream};padding:0 52px;text-align:left;font:italic 21px 'GFS Baskerville';line-height:44px">She made the cinnamon rolls every Christmas morning and let us lick the spoon...</div>
   <div class="t" style="top:462px;font:400 10px Inter;letter-spacing:.3em;color:${A.brass}">SHARED WITH LOVE BY &nbsp;_______________</div></div>`;
}
function tagA() { // ornament keepsake card (hangs on tree)
  const w = 300, h = 420; seed = 5;
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${A.cream};border-radius:150px 150px 10px 10px">${svg(w, h, `
     <circle cx="150" cy="44" r="9" fill="none" stroke="${A.brass}" stroke-width="2"/>
     <path d="M150 35V12" stroke="${A.berry}" stroke-width="2"/>
     ${bough(40, 150, 150, 112, [0, -14], A.pine, A.pine2, 14, 12)}${bough(260, 150, 150, 112, [0, -14], A.pine, A.pine2, 14, 12)}
     ${berries([[150, 116, 5], [141, 122, 4], [159, 122, 4]], A.berry)}
     <path d="M90 360H210" stroke="${A.brass}" stroke-width="1"/>`)}
   <div class="t" style="top:170px;font:400 10px Inter;letter-spacing:.38em;color:${A.brass}">CHRISTMAS IN HEAVEN</div>
   <div class="t" style="top:196px;font:400 30px 'GFS Baskerville';color:${A.pine};line-height:1.1">Margaret<br>Anne Ellis</div>
   <div class="t" style="top:290px;font:italic 17px 'GFS Baskerville';color:${A.ink}">Forever in our hearts</div>
   <div class="t" style="top:372px;font:400 11px Inter;letter-spacing:.3em;color:${A.ink}">1948 · 2026</div></div>`;
}

// ---------- concept B: Longest Night (quiet, faith-neutral) ----------
const B = { name: "Longest Night", d1: "#1b2140", d2: "#3c4570", d3: "#8a8fb3", d4: "#d9cfe0", silver: "#c9ccd8", paper: "#f4f3f7", ink: "#2a2d40" };
const sky = `linear-gradient(180deg,${B.d1} 0%,${B.d2} 45%,${B.d3} 78%,${B.d4} 100%)`;
function signB() {
  const w = 768, h = 960; seed = 31;
  const art = svg(w, h, `${starfield(w, h, 160, "#fff")}
    ${star(384, 170, 34, "#fff")}${star(384, 170, 60, "#fff", .14)}
    
    <path d="M0 900C160 860 280 875 384 860C500 845 620 870 768 850V960H0Z" fill="#fff" opacity=".18"/>
    <path d="M0 925C180 900 300 915 420 900C560 885 660 905 768 895V960H0Z" fill="#fff" opacity=".25"/>`);
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${sky}">${art}
   <div class="t" style="top:340px;font:300 15px Inter;letter-spacing:.55em;color:${B.silver}">ON THE LONGEST NIGHT WE REMEMBER</div>
   <div class="t" style="top:392px;font:200 64px Inter;letter-spacing:.02em;color:#fff;line-height:1.1">Margaret Anne Ellis</div>
   <div class="t" style="top:485px;font:300 16px Inter;letter-spacing:.4em;color:${B.silver}">1948 — 2026</div>
   <div class="t" style="top:575px;font:300 24px Inter;color:#fff;line-height:1.55;padding:0 140px;opacity:.92">Even in the darkest night,<br>your light finds us.</div>
  </div>`;
}
function programB() {
  const w = 528, h = 816; seed = 41; // 5.5x8.5 program cover
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${sky}">${svg(w, h, `${starfield(w, h, 110, "#fff")}${star(264, 150, 26, "#fff")}${star(264, 150, 44, "#fff", .14)}
     <path d="M0 760C120 735 200 745 264 738C350 728 440 748 528 735V816H0Z" fill="#fff" opacity=".22"/>`)}
   <div class="t" style="top:250px;font:300 12px Inter;letter-spacing:.55em;color:${B.silver}">A SERVICE OF REMEMBRANCE</div>
   <div class="t" style="top:285px;font:200 50px Inter;color:#fff;line-height:1.1">The Longest<br>Night</div>
   <div class="t" style="top:430px;font:300 15px Inter;color:#fff;opacity:.9;line-height:1.7">Monday, December 21, 2026<br>7:00 in the evening<br>Grace Fellowship Hall</div>
   <div class="t" style="top:600px;font:300 15px Inter;color:#fff;opacity:.85;line-height:1.6;padding:0 70px">For all who carry an empty place<br>into this season</div></div>`;
}
function cardB() { // light, ink-friendly candle-lighting name card
  const w = 408, h = 528; seed = 53;
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${B.paper}">${svg(w, h, `
     <rect x="0" y="0" width="${w}" height="150" fill="url(#bg)"/><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${B.d1}"/><stop offset="1" stop-color="${B.d3}"/></linearGradient></defs>
     ${starfield(w, 240, 45, "#fff")}${star(204, 75, 18, "#fff")}`)}
   <div class="t" style="top:186px;font:300 11px Inter;letter-spacing:.42em;color:${B.d2}">TONIGHT I LIGHT A CANDLE FOR</div>
   <div class="ln" style="top:262px;left:60px;right:60px;border-color:${B.d3}"></div>
   <div class="t" style="top:222px;font:200 30px Inter;color:${B.ink}">Dad</div>
   <div class="t" style="top:300px;font:300 11px Inter;letter-spacing:.42em;color:${B.d2}">WHAT I CARRY WITH ME</div>
   ${[0, 1, 2].map(i => `<div class="ln" style="top:${366 + i * 38}px;left:60px;right:60px;border-color:${B.d3}88"></div>`).join("")}
   <div class="t" style="top:338px;font:300 17px Inter;color:${B.ink};padding:0 60px;text-align:left;line-height:38px">His terrible jokes and his steady hands.</div></div>`;
}

// ---------- concept C: Harvest Table (Thanksgiving / autumn) ----------
const C = { name: "Harvest Table", oat: "#efe5d3", oat2: "#e6d8bf", terra: "#b45f3c", mustard: "#c99a3f", brown: "#4b3527", olive: "#7a7a45", rust: "#8f3f26" };
function sprays(cx, y, flip = 1) {
  let s = ""; seed = 61;
  s += wheat(cx, y, -90 - 30 * flip, 120, C.brown, C.mustard) + wheat(cx, y, -90 - 12 * flip, 135, C.brown, "#d8ad55");
  s += leaf(cx, y - 10, -150 * flip + (flip < 0 ? 180 : 0), 58, C.terra) + leaf(cx, y - 5, (flip > 0 ? -205 : 25), 48, C.rust);
  s += leaf(cx, y - 20, (flip > 0 ? -120 : -60), 44, C.olive);
  return s;
}
function signC() {
  const w = 768, h = 960;
  const art = svg(w, h, `
    <rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="6" fill="none" stroke="${C.brown}" stroke-width="1.3"/>
    <g transform="translate(384 250)">${wheat(0, 0, -112, 150, C.brown, C.mustard)}${wheat(0, 0, -68, 150, C.brown, C.mustard)}${wheat(0, 0, -90, 165, C.brown, "#d8ad55")}
    ${leaf(0, 0, -160, 70, C.terra)}${leaf(0, 0, -20, 70, C.terra)}${leaf(0, 0, 160, 54, C.rust)}${leaf(0, 0, 20, 54, C.rust)}${leaf(0, 0, -135, 50, C.olive)}${leaf(0, 0, -45, 50, C.olive)}
    <circle cx="0" cy="0" r="7" fill="${C.brown}"/></g>
    <path d="M300 730H468" stroke="${C.terra}" stroke-width="1.4"/><circle cx="384" cy="730" r="4" fill="${C.terra}"/><g transform="translate(384 860) scale(.6)">${leaf(0,0,-170,70,C.terra)}${leaf(0,0,-10,70,C.terra)}${leaf(0,0,-140,50,C.olive)}${leaf(0,0,-40,50,C.olive)}${wheat(0,0,-90,120,C.brown,C.mustard)}<circle r="6" fill="${C.brown}"/></g>`);
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${C.oat}">${art}
   <div class="t" style="top:300px;font:600 15px Inter;letter-spacing:.42em;color:${C.terra}">WE SAVED A SEAT FOR YOU</div>
   <div class="t" style="top:345px;font:400 74px Caladea;color:${C.brown};line-height:1.05">Margaret<br>Anne Ellis</div>
   <div class="t" style="top:520px;font:600 15px Inter;letter-spacing:.35em;color:${C.olive}">1948 &nbsp;·&nbsp; 2026</div>
   <div class="t" style="top:585px;font:italic 400 26px Caladea;color:${C.brown};line-height:1.5;padding:0 120px">Grateful for every year<br>we had you at this table.</div>
  </div>`;
}
function cardC() {
  const w = 408, h = 528;
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${C.oat}">${svg(w, h, `
     <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="4" fill="none" stroke="${C.brown}" stroke-width="1"/>
     <g transform="translate(204 112) scale(.55)">${wheat(0, 0, -112, 150, C.brown, C.mustard)}${wheat(0, 0, -68, 150, C.brown, C.mustard)}${leaf(0, 0, -160, 70, C.terra)}${leaf(0, 0, -20, 70, C.terra)}<circle r="6" fill="${C.brown}"/></g>`)}
   <div class="t" style="top:132px;font:600 11px Inter;letter-spacing:.38em;color:${C.terra}">I'M THANKFUL FOR</div>
   <div class="t" style="top:156px;font:400 32px Caladea;color:${C.brown}">Uncle Ray</div>
   ${[0, 1, 2, 3, 4].map(i => `<div class="ln" style="top:${246 + i * 42}px;left:50px;right:50px;border-color:${C.brown}55"></div>`).join("")}
   <div class="t" style="top:216px;color:${C.brown};padding:0 50px;text-align:left;font:italic 20px Caladea;line-height:42px">the way he carved the turkey like it was a sport, and every story that came with it.</div>
   <div class="t" style="top:470px;font:600 10px Inter;letter-spacing:.3em;color:${C.olive}">FROM &nbsp;_______________</div></div>`;
}
function tentC() { // place card (folded tent) 3.5x2
  const w = 336, h = 192;
  return `<div class="pc" style="width:${w}px;height:${h}px;background:${C.oat}">${svg(w, h, `<g transform="translate(46 150) scale(.42)">${wheat(0, 0, -100, 150, C.brown, C.mustard)}${leaf(0, 0, -150, 70, C.terra)}${leaf(0, 0, -40, 60, C.olive)}</g>
      <g transform="translate(290 150) scale(.42)">${wheat(0, 0, -80, 150, C.brown, C.mustard)}${leaf(0, 0, -30, 70, C.terra)}${leaf(0, 0, -140, 60, C.olive)}</g>`)}
   <div class="t" style="top:58px;font:600 9px Inter;letter-spacing:.38em;color:${C.terra}">IN LOVING MEMORY</div>
   <div class="t" style="top:80px;font:400 30px Caladea;color:${C.brown}">Grandpa Joe</div></div>`;
}

// ---------- boards ----------
const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{width:1600px;font-family:Inter}
.pc{position:absolute;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.15)}
.t{position:absolute;left:0;right:0;text-align:center}
.ln{position:absolute;border-bottom:1px solid}
.board{position:relative;width:1600px;height:1150px;overflow:hidden}
.lab{position:absolute;left:60px;bottom:40px;right:60px;font-family:Inter}
.sw{display:inline-block;width:34px;height:34px;border-radius:50%;margin-right:8px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,.12)}`;
const place = (html, x, y, s, rot = 0) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:scale(${s}) rotate(${rot}deg);transform-origin:0 0">${html.replace('class="pc" style="', 'class="pc" style="position:relative;')}</div>`;
function board(letter, c, bg, pieces, sw, mood, pieceList, fg = "#2b2a27") {
  return `<div class="board" style="background:${bg}">${pieces}
  <div class="lab" style="color:${fg}">
    <div style="font:700 22px Inter;letter-spacing:.2em;opacity:.6">CONCEPT ${letter}</div>
    <div style="font:600 46px Inter;margin:4px 0 6px">${c.name}</div>
    <div style="font:400 22px Inter;opacity:.85;margin-bottom:14px">${mood}</div>
    <div>${sw.map(x => `<span class="sw" style="background:${x}"></span>`).join("")}<span style="font:400 19px Inter;opacity:.75;margin-left:14px">${pieceList}</span></div>
  </div></div>`;
}
const boards = {
  A: board("A", A, "linear-gradient(135deg,#e9e1d1,#d8cdb8)",
    place(signA(), 70, 60, .78) + place(cardA(), 700, 150, .95, 3) + place(tagA(), 1180, 110, 1.05, -4),
    [A.pine, A.cream, A.brass, A.berry, A.pine2], "Warm Christmas: hand-drawn pine, berries and one glowing candle on cream.",
    "Table sign · memory cards · tree ornament card · Christmas service program · thank-you card"),
  B: board("B", B, "linear-gradient(135deg,#dfe0ea,#c5c7d6)",
    place(signB(), 70, 60, .78) + place(programB(), 700, 90, .98, -2) + place(cardB(), 1230, 180, .82, 4),
    [B.d1, B.d2, B.d3, B.d4, B.silver], "Quiet and modern for Blue Christmas, Hanukkah and the winter solstice. One star, no religious symbols.",
    "Table sign · Longest Night program · candle-lighting cards · ink-light print versions"),
  C: board("C", C, "linear-gradient(135deg,#e7dccb,#d4c3a6)",
    place(signC(), 70, 60, .78) + place(cardC(), 700, 150, .95, -3) + place(tentC(), 1180, 260, 1.15, 4),
    [C.brown, C.terra, C.mustard, C.olive, C.oat], "Thanksgiving: wheat and autumn leaves on warm oat paper. \"We saved a seat for you.\"",
    "Empty-chair sign · \"I'm thankful for\" cards · name place cards · gratitude table card"),
};

const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1150 }, deviceScaleFactor: 1.5 });
for (const [k, html] of Object.entries(boards)) {
  await p.setContent(`<style>${CSS}</style>${html}`); await p.waitForTimeout(150);
  await p.screenshot({ path: `${OUT}/concept-${k}.png` });
}
await b.close(); console.log("done");
