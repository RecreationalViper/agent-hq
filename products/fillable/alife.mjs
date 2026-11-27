// "A Life": the magazine-style collection (replaces the Rainbow Bridge concept), plus the $4.99 "Tonight" quick kit.
// Draws every background as a vector PDF in bg/ AND writes the matching fill-in fields into fields.json,
// so layout and fields can never drift apart. Then run build.py to make the PDFs.
// All art is type and rules drawn in code; fonts are SIL OFL files in fonts/.
// Usage: NODE_PATH=... node products/fillable/alife.mjs && python3 products/fillable/build.py --only="A Life"
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
for (const p of ["playwright", path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "playwright")]) {
  try { playwright = require(p); break; } catch {}
}
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (f) => pathToFileURL(path.join(HERE, "fonts", f)).href;
const FONTS = `
@font-face{font-family:Corm;src:url(${F("CormorantGaramond.ttf")})}
@font-face{font-family:Corm;font-style:italic;src:url(${F("CormorantGaramond-Italic.ttf")})}
@font-face{font-family:InterSB;src:url(${F("Inter-SemiBold.otf")})}
@font-face{font-family:InterR;src:url(${F("Inter-Regular.otf")})}`;

// Palette: newsprint white, ink, warm grey, one oxblood accent (prints well on home printers: mostly white paper).
const C = { paper: "#F7F3EC", ink: "#161616", grey: "#5F5850", accent: "#8E2F25", rule: "#D3C9BA", well: "#E9E1D4" };

// Sample family (shown in previews and as the starting text buyers type over)
const S = {
  "Name": "Walter James Brooks",
  "Years": "1939  —  2026",
  "Full dates": "April 2, 1939  ·  November 14, 2026",
  "Cover line": "Machinist, fisherman, grandfather of nine and the best storyteller on Elm Street",
  "Service line": "SATURDAY, NOVEMBER 22, 2026 · 11:00 AM\nST. MARK'S CHURCH · 118 ELM STREET, FAIRVIEW",
  "Service date and place": "SATURDAY, NOVEMBER 22, 2026 · 11:00 AM\nST. MARK'S CHURCH · 118 ELM STREET, FAIRVIEW",
  "Thank you note": "Thank you for being here to remember Walter with us. Your cards, casseroles and stories have carried us through these days, and he would have loved seeing everyone in one room.",
  "Reception details": "Lunch follows in the parish hall.\nSt. Mark's Church, 118 Elm Street",
  "Closing verse": "To live in hearts we leave behind is not to die.\n— Thomas Campbell",
  "In lieu of flowers": "IN LIEU OF FLOWERS, GIFTS MAY BE MADE TO THE FAIRVIEW FOOD PANTRY",
  "Deck": "He could fix anything with a wrench, a joke or a fresh pot of coffee.",
  "Life story": "Walter was born on April 2, 1939, in Fairview, the youngest of four boys. He started at the Fairview tool plant at eighteen and stayed for forty-one years, the man everyone called when a machine made a sound nobody liked. He married Ruth Ellen Carter in 1962, and together they raised three children in the white house on Elm Street, where the porch light was always on.\nWalter fished the lake every summer morning he could, kept a garden mostly for the tomatoes, and never missed a grandchild's ballgame. He taught all nine of them to tie a hook, change a tire and tell a story with a straight face. He is remembered for his patience, his terrible puns and the way he made everyone feel like the most important person in the room.\nIn his last years he still rose before dawn, still made the coffee too strong, and still waved at every car that passed the porch. We will keep the light on for him.",
  "Short story": "Walter spent forty-one years at the Fairview tool plant, fifty-four years married to Ruth, and every summer morning he could on the lake. He taught nine grandchildren to tie a hook, change a tire and tell a story with a straight face. He is remembered for his patience, his terrible puns and the porch light he always left on.\nHe loved Ruth's peach cobbler, Hank Williams on the radio and a good, long story. We will keep the light on for him.",
  "Favorite things": "Early mornings on the lake\nRuth's peach cobbler\nBaseball on the radio\nHank Williams records\nHis workbench\nA good, long story",
  "Pull quote": "“Measure twice, laugh often, and always leave the porch light on.”",
  "Sign line": "WELCOME · THANK YOU FOR BEING HERE",
  "Name line": "FOR WALTER JAMES BROOKS",
  "Thank you message": "Your kindness and your presence meant more to our family than words can say. Thank you for helping us remember Walter.",
  "Signed": "With love and gratitude,\nthe Brooks family",
  "Verse": "To live in hearts we leave behind is not to die.",
  "Gathering": "A Celebration of Life",
  "Service details": "Saturday, November 22, 2026 · 11:00 AM\nSt. Mark's Church\n118 Elm Street, Fairview",
  "Note": "Lunch follows in the parish hall. All are welcome.",
};
const ITEMS = [["Prelude", "“Abide with Me” · organ"], ["Welcome", "Rev. Ann Miller"], ["Opening Prayer", "Rev. Ann Miller"],
  ["Reading", "Ecclesiastes 3:1-8, read by Laura Brooks"], ["Hymn", "“How Great Thou Art”"], ["Remembrance", "David Brooks, son"],
  ["Stories from Elm Street", "Friends and neighbors"], ["Moment of Silence", ""], ["Benediction", "Rev. Ann Miller"],
  ["Recessional", "“Shall We Gather at the River”"]];
ITEMS.forEach(([a, b], i) => { S[`Service item ${i + 1}`] = a; S[`Service item ${i + 1} detail`] = b; });

// ---------- drawing helpers (px at 96 dpi; build.py turns px into points) ----------
let FIELDS = [];
let PAGE = 1;
const fld = (name, left, top, width, height, size, font, color, o = {}) => {
  const f = { name, page: PAGE, left: +left.toFixed(1), top: +top.toFixed(1), width: +width.toFixed(1), height: +height.toFixed(1),
    size: +size.toFixed(2), font, color, value: S[name] ?? "", ...o };
  if (o.photo) { FIELDS.push({ name, type: "photo", page: PAGE, left: f.left, top: f.top, width: f.width, height: f.height }); return ""; }
  delete f.photo;
  FIELDS.push(f);
  return "";
};
const box = (x, y, w, h, css) => `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${css}"></div>`;
const rule = (x, y, w, t = 1, col = C.ink) => box(x, y, w, t, `background:${col}`);
const vrule = (x, y, h, t = 1, col = C.rule) => box(x, y, t, h, `background:${col}`);
// small caps label (Inter SemiBold, tracked)
const label = (t, x, y, s = 8.5, col = C.ink, align = "left", w = 600) => {
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  return `<div class="lab" style="left:${left}px;top:${y}px;width:${w}px;font-size:${s}px;color:${col};text-align:${align}">${t}</div>`;
};
const serif = (t, x, y, s, col = C.ink, ital = false, align = "left", w = 1000, extra = "") => {
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  return `<div class="ser" style="left:${left}px;top:${y}px;width:${w}px;font-size:${s}px;color:${col};text-align:${align};${ital ? "font-style:italic;" : ""}${extra}">${t}</div>`;
};
const masthead = (x, y, s, col = C.ink, align = "left", w = 2000) => serif("A Life", x, y, s, col, false, align, w, "letter-spacing:-.035em;line-height:.8");
const well = (x, y, w, h) => box(x, y, w, h, `background:${C.well};outline:1px solid ${C.rule};outline-offset:-${Math.max(4, w / 60)}px`);

// ---------- the cover (program front, welcome signs, phone announcement) ----------
// Laid out on a 528-unit-wide grid and scaled by u = width / 528, so one design serves every size.
function cover(ox, oy, W, H, opts = {}) {
  const u = W / 528, X = (v) => ox + v * u, Y = (v) => oy + v * u, L = (v) => v * u;
  const m = 32;                                // side margin in units
  const blocks = opts.blocks || [];            // fields stacked under the name
  const below = 8 + 52 + blocks.reduce((a, b) => a + b.h + 10, 0) + (opts.foot ? 46 : 0) + 34;
  const photoH = H / u - 222 - below;
  let s = "";
  s += label(opts.kicker || "A CELEBRATION OF LIFE", X(m), Y(38), L(8.5));
  s += label(opts.kickerRight || "COMMEMORATIVE ISSUE", X(528 - m), Y(38), L(8.5), C.ink, "right", L(300));
  s += rule(X(m), Y(56), L(528 - 2 * m), Math.max(1, L(1.4)));
  s += masthead(X(m - 4), Y(74), L(150));
  s += label("ISSUE", X(528 - m), Y(118), L(7.5), C.accent, "right", L(200));
  fld("Years", X(528 - m - 170), Y(132), L(170), L(22), 12 * u, "S", C.ink, { align: 2 });
  s += rule(X(528 - m - 90), Y(162), L(90), Math.max(1, L(1)), C.accent);
  s += rule(X(m), Y(210), L(528 - 2 * m), Math.max(1, L(0.8)), C.rule);
  const py = 222;
  s += well(X(m), Y(py), L(528 - 2 * m), L(photoH));
  fld("Photo", X(m), Y(py), L(528 - 2 * m), L(photoH), 0, "R", C.ink, { photo: true });
  let y = py + photoH + 10;
  fld("Name", X(m - 2), Y(y), L(528 - 2 * m + 4), L(52), (opts.nameSize || 40) * u, "R", C.ink, { align: 0 });
  y += 54;
  for (const b of blocks) {
    if (b.ruleAbove) { s += rule(X(m), Y(y), L(528 - 2 * m), Math.max(1, L(0.8)), C.rule); y += 8; }
    fld(b.name, X(m), Y(y), L(528 - 2 * m), L(b.h), b.size * u, b.font, b.color, { align: 0, multiline: !!b.multi, lead: b.lead || 1.3 });
    y += b.h + 10 - (b.ruleAbove ? 8 : 0);
  }
  if (opts.foot) {
    s += rule(X(m), Y(H / u - 34 - 46), L(528 - 2 * m), Math.max(1, L(1.4)));
    fld(opts.foot, X(m), Y(H / u - 34 - 38), L(528 - 2 * m), L(36), 9 * u, "S", C.accent, { align: 0, multiline: true, lead: 1.65 });
  }
  return s;
}

// ---------- pieces ----------
const PIECES = {};

PIECES.program = { w: 1056, h: 816, pages: [
  () => { // outside: back cover (left) + front cover (right)
    let s = vrule(528, 0, 816, 1, "#E6DED1");
    s += label("FROM THE FAMILY", 32, 38); s += label("A NOTE OF THANKS", 496, 38, 8.5, C.accent, "right", 300);
    s += rule(32, 56, 464, 1.4);
    fld("Thank you note", 32, 74, 464, 166, 19, "I", C.ink, { align: 0, multiline: true, lead: 1.45 });
    s += label("RECEPTION", 32, 262, 8.5, C.accent);
    fld("Reception details", 32, 280, 464, 70, 14, "R", C.grey, { align: 0, multiline: true, lead: 1.5 });
    s += rule(32, 372, 464, 0.8, C.rule);
    s += serif("“", 24, 368, 150, C.accent, false, "left", 200, "line-height:1");
    fld("Closing verse", 32, 478, 464, 160, 23, "I", C.ink, { align: 0, multiline: true, lead: 1.35 });
    fld("In lieu of flowers", 32, 676, 464, 34, 8.5, "S", C.accent, { align: 0, multiline: true, lead: 1.65 });
    s += rule(32, 740, 464, 1.4);
    s += label("A LIFE · REMEMBERED WITH LOVE", 32, 752, 7.5, C.grey);
    fld("Years", 326, 748, 170, 18, 9, "S", C.grey, { align: 2 });
    s += cover(528, 0, 528, 816, { foot: "Service line", blocks: [{ name: "Cover line", h: 44, size: 16, font: "I", color: C.grey, multi: true, lead: 1.25 }] });
    return s;
  },
  () => { // inside: contents / order of service (left) + feature story (right)
    let s = vrule(528, 0, 816, 1, "#E6DED1");
    s += label("IN THIS ISSUE", 32, 38, 8.5, C.accent); s += label("THE SERVICE", 496, 38, 8.5, C.ink, "right", 300);
    s += rule(32, 56, 464, 1.4);
    s += serif("Order of Service", 30, 66, 46, C.ink, true, "left", 470, "line-height:1");
    for (let i = 0; i < 10; i++) {
      const y = 134 + i * 54;
      s += serif(String(i + 1).padStart(2, "0"), 32, y + 2, 30, C.accent, false, "left", 60, "line-height:1");
      fld(`Service item ${i + 1}`, 90, y + 2, 406, 24, 16, "R", C.ink, { align: 0 });
      fld(`Service item ${i + 1} detail`, 90, y + 26, 406, 19, 12.5, "I", C.grey, { align: 0 });
      s += rule(32, y + 49, 464, 0.8, C.rule);
    }
    fld("Service date and place", 32, 698, 464, 40, 9, "S", C.accent, { align: 0, multiline: true, lead: 1.65 });
    s += rule(32, 750, 464, 1.4);
    s += label("A LIFE", 32, 760, 7.5, C.grey); s += label("2", 496, 760, 7.5, C.grey, "right", 50);
    // feature
    const o = 528;
    s += label("FEATURE", o + 32, 38, 8.5, C.accent); s += label("THE STORY OF A LIFE", o + 496, 38, 8.5, C.ink, "right", 300);
    s += rule(o + 32, 56, 464, 1.4);
    fld("Name", o + 30, 68, 468, 46, 34, "R", C.ink, { align: 0 });
    fld("Full dates", o + 32, 116, 464, 20, 13, "I", C.accent, { align: 0 });
    fld("Deck", o + 32, 142, 464, 50, 16, "I", C.grey, { align: 0, multiline: true, lead: 1.3 });
    s += rule(o + 32, 204, 464, 0.8, C.rule);
    fld("Life story", o + 32, 218, 256, 548, 12.5, "R", C.ink, { align: 0, multiline: true, lead: 1.58 });
    s += vrule(o + 304, 218, 548);
    s += well(o + 318, 218, 178, 196);
    fld("Photo 2", o + 318, 218, 178, 196, 0, "R", C.ink, { photo: true });
    s += label("FAVORITE THINGS", o + 318, 430, 7.5, C.accent);
    fld("Favorite things", o + 318, 446, 178, 140, 12.5, "R", C.ink, { align: 0, multiline: true, lead: 1.5 });
    s += rule(o + 318, 596, 178, 0.8, C.rule);
    s += serif("“", o + 314, 596, 64, C.accent, false, "left", 80, "line-height:1");
    fld("Pull quote", o + 318, 640, 178, 126, 15, "I", C.accent, { align: 0, multiline: true, lead: 1.3 });
    s += rule(o + 32, 778, 464, 1.4);
    s += label("A LIFE", o + 32, 786, 7.5, C.grey); s += label("3", o + 496, 786, 7.5, C.grey, "right", 50);
    return s;
  },
] };

const signBlocks = [{ name: "Cover line", h: 44, size: 16, font: "I", color: C.grey, multi: true, lead: 1.25 }];
PIECES.sign = { w: 2304, h: 3456, pages: [() => cover(0, 0, 2304, 3456, { kickerRight: "WELCOME", foot: "Sign line", blocks: signBlocks, nameSize: 42 })] };
PIECES.sign8x10 = { w: 768, h: 960, pages: [() => cover(0, 0, 768, 960, { kickerRight: "WELCOME", foot: "Sign line", blocks: [{ name: "Cover line", h: 40, size: 14, font: "I", color: C.grey, multi: true, lead: 1.25 }], nameSize: 40 })] };
PIECES.announcement = { w: 540, h: 960, pages: [() => cover(0, 0, 540, 960, { kickerRight: "WITH LOVE", nameSize: 38, blocks: [
  { name: "Gathering", h: 24, size: 18, font: "I", color: C.accent },
  { name: "Service details", h: 66, size: 14, font: "R", color: C.ink, multi: true, lead: 1.45, ruleAbove: true },
  { name: "Note", h: 40, size: 12.5, font: "I", color: C.grey, multi: true, lead: 1.4 }] })] };

PIECES.card = { w: 408, h: 528, pages: [() => {
  let s = label("A LIFE · LETTERS", 28, 28, 7.5, C.accent);
  s += masthead(380, 16, 30, C.ink, "right", 200);
  s += rule(28, 46, 352, 1.2);
  s += serif("Share a memory", 26, 58, 40, C.ink, true, "left", 360, "line-height:1");
  fld("Name line", 28, 108, 352, 16, 8, "S", C.grey, { align: 0 });
  for (let i = 0; i < 9; i++) s += rule(28, 160 + i * 32, 352, 0.8, C.rule);
  s += label("FROM", 28, 462, 7.5, C.grey); s += rule(66, 472, 314, 0.8, C.rule);
  s += rule(28, 494, 352, 1.2);
  return s;
}] };

PIECES.thankyou = { w: 408, h: 528, pages: [() => {
  let s = label("A NOTE OF THANKS", 28, 28, 7.5, C.accent);
  s += masthead(380, 16, 30, C.ink, "right", 200);
  s += rule(28, 46, 352, 1.2);
  s += serif("Thank you", 24, 62, 70, C.ink, true, "left", 360, "line-height:1");
  s += rule(28, 152, 60, 1.2, C.accent);
  fld("Thank you message", 28, 172, 352, 150, 15, "I", C.ink, { align: 0, multiline: true, lead: 1.45 });
  fld("Signed", 28, 336, 352, 48, 13, "R", C.grey, { align: 0, multiline: true, lead: 1.4 });
  s += rule(28, 474, 352, 1.2);
  s += label("FOREVER HELD", 28, 484, 6.5, C.grey);
  return s;
}] };

PIECES.bookmark = { w: 192, h: 672, pages: [() => {
  let s = masthead(96, 26, 58, C.ink, "center", 192);
  s += rule(18, 84, 156, 1.2);
  s += label("IN LOVING MEMORY", 96, 94, 6.5, C.accent, "center", 180);
  fld("Name", 14, 112, 164, 58, 19, "R", C.ink, { multiline: true, lead: 1.15 });
  fld("Years", 14, 174, 164, 18, 9, "S", C.grey);
  s += rule(78, 206, 36, 1.2, C.accent);
  fld("Verse", 18, 222, 156, 196, 13, "I", C.ink, { multiline: true, lead: 1.5 });
  s += well(24, 430, 144, 168);
  fld("Photo", 24, 430, 144, 168, 0, "R", C.ink, { photo: true });
  s += rule(18, 612, 156, 1.2);
  s += label("FOREVER HELD", 96, 624, 6, C.grey, "center", 180);
  return s;
}] };

PIECES.guestbook = { w: 816, h: 1056, pages: [() => {
  let s = label("THE GUEST BOOK", 48, 40, 8.5, C.accent); s += label("PLEASE SIGN AND SHARE", 768, 40, 8.5, C.ink, "right", 300);
  s += rule(48, 58, 720, 1.4);
  s += masthead(44, 70, 96);
  s += label("IN MEMORY OF", 768, 82, 8, C.accent, "right", 300);
  fld("Name", 330, 98, 438, 36, 26, "I", C.ink, { align: 2 });
  s += rule(48, 160, 720, 1.4);
  s += label("NAME", 48, 174, 7.5, C.grey); s += label("A MEMORY OR MESSAGE", 316, 174, 7.5, C.grey);
  for (let i = 0; i < 13; i++) s += rule(48, 250 + i * 58, 720, 0.8, C.rule);
  s += vrule(298, 196, 750);
  s += rule(48, 990, 720, 1.4);
  s += label("A LIFE · GUEST BOOK", 48, 1000, 7.5, C.grey);
  return s;
}] };

// Tonight kit: one-page program (US Letter portrait, single-sided, no folding)
PIECES.onepage = { w: 816, h: 1056, pages: [() => {
  let s = label("A CELEBRATION OF LIFE", 48, 40); s += label("COMMEMORATIVE ISSUE", 768, 40, 8.5, C.ink, "right", 300);
  s += rule(48, 58, 720, 1.6);
  s += masthead(44, 72, 150);
  s += label("ISSUE", 768, 112, 7.5, C.accent, "right", 200);
  fld("Years", 568, 126, 200, 22, 12, "S", C.ink, { align: 2 });
  s += rule(678, 156, 90, 1, C.accent);
  s += rule(48, 204, 720, 0.8, C.rule);
  s += well(48, 218, 300, 372);
  fld("Photo", 48, 218, 300, 372, 0, "R", C.ink, { photo: true });
  fld("Name", 370, 214, 398, 46, 30, "R", C.ink, { align: 0 });
  fld("Full dates", 372, 262, 396, 20, 12.5, "I", C.accent, { align: 0 });
  s += rule(372, 292, 396, 0.8, C.rule);
  fld("Short story", 372, 306, 396, 284, 14, "R", C.ink, { align: 0, multiline: true, lead: 1.6 });
  s += rule(48, 612, 720, 1.4);
  s += label("IN THIS ISSUE", 48, 624, 8.5, C.accent);
  s += serif("Order of Service", 46, 640, 38, C.ink, true, "left", 400, "line-height:1");
  for (let i = 0; i < 8; i++) {
    const col = i < 4 ? 0 : 1, r = i % 4, x = 48 + col * 372, y = 700 + r * 52;
    s += serif(String(i + 1).padStart(2, "0"), x, y + 2, 26, C.accent, false, "left", 50, "line-height:1");
    fld(`Service item ${i + 1}`, x + 46, y + 1, 300, 22, 15, "R", C.ink, { align: 0 });
    fld(`Service item ${i + 1} detail`, x + 46, y + 24, 300, 18, 12, "I", C.grey, { align: 0 });
    s += rule(x, y + 47, 348, 0.8, C.rule);
  }
  s += rule(48, 920, 720, 1.4);
  fld("Service date and place", 48, 932, 470, 40, 9, "S", C.accent, { align: 0, multiline: true, lead: 1.65 });
  fld("In lieu of flowers", 530, 932, 238, 40, 8, "S", C.grey, { align: 2, multiline: true, lead: 1.65 });
  s += rule(48, 990, 720, 0.8, C.rule);
  s += label("A LIFE · REMEMBERED WITH LOVE", 48, 1000, 7.5, C.grey);
  return s;
}] };

// ---------- products (file names, which background, print sheets) ----------
const SHEET4 = { size: [612, 792], scale: 0.94 };
const PRODUCTS = [
  ["A Life/01 Program - A Life (fill-in).pdf", "Memorial Program - A Life", "program"],
  ["A Life/02 Welcome Sign - A Life (fill-in).pdf", "Welcome Sign 24x36 - A Life", "sign"],
  ["A Life/03 Memory Card - A Life (fill-in).pdf", "Share a Memory Card - A Life", "card", SHEET4],
  ["A Life/04 Bookmark - A Life (fill-in).pdf", "Memorial Bookmark - A Life", "bookmark", { size: [612, 792], scale: 1, cols: 4, rows: 1 }],
  ["A Life/05 Thank-You Card - A Life (fill-in).pdf", "Thank-You Card - A Life", "thankyou", SHEET4],
  ["A Life/06 Phone Announcement - A Life (fill-in).pdf", "Memorial Announcement for Phones - A Life", "announcement"],
  ["A Life/07 Guest Book Page - A Life (fill-in).pdf", "Guest Book Page - A Life", "guestbook"],
  ["A Life Tonight Kit/01 One-Page Program - A Life (fill-in).pdf", "One-Page Program - A Life Tonight Kit", "onepage"],
  ["A Life Tonight Kit/02 Welcome Sign 8x10 - A Life (fill-in).pdf", "Welcome Sign 8x10 - A Life Tonight Kit", "sign8x10", { size: [612, 792], scale: 1, cols: 1, rows: 1 }],
  ["A Life Tonight Kit/03 Memory Card - A Life (fill-in).pdf", "Share a Memory Card - A Life Tonight Kit", "card", SHEET4],
];

// ---------- render ----------
const CSS = `${FONTS}*{margin:0;padding:0;box-sizing:border-box}html,body{background:${C.paper}}.page{position:relative;overflow:hidden;background:${C.paper}}
.a{position:absolute}.lab{position:absolute;font-family:InterSB;letter-spacing:.22em;white-space:nowrap;line-height:1.2}
.ser{position:absolute;font-family:Corm;white-space:nowrap;line-height:1.1}`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
const fieldsByPiece = {};
for (const [key, d] of Object.entries(PIECES)) {
  FIELDS = [];
  const bodies = d.pages.map((fn, i) => { PAGE = i + 1; return fn(); });
  fieldsByPiece[key] = FIELDS;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}@page{size:${d.w}px ${d.h}px;margin:0}</style></head><body>${bodies.map((b) => `<div class="page" style="width:${d.w}px;height:${d.h}px;page-break-after:always">${b}</div>`).join("")}</body></html>`;
  const file = path.join(HERE, "bg", `_alife-${key}.html`);
  fs.writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, "bg", `alife-${key}.pdf`), width: `${d.w}px`, height: `${d.h}px`, printBackground: true, pageRanges: `1-${d.pages.length}` });
  fs.unlinkSync(file);
  console.log(`drew bg/alife-${key}.pdf (${FIELDS.length} fields)`);
}
await browser.close();

const fpath = path.join(HERE, "fields.json");
const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
data.products = data.products.filter((p) => !/^A Life( Tonight Kit)?\//.test(p.file));
for (const [file, title, key, sheet] of PRODUCTS) {
  const p = { file, title, bg: `alife-${key}.pdf`, fields: fieldsByPiece[key] };
  if (sheet) p.sheet = sheet;
  data.products.push(p);
}
fs.writeFileSync(fpath, JSON.stringify(data, null, 1));
console.log(`fields.json: ${PRODUCTS.length} A Life products`);
