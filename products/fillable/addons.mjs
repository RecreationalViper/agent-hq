// Draws the Soft Botanical add-on backgrounds (art + fixed labels, no fill-in text) as vector PDFs in bg/.
// Coordinates are CSS px at 96 per inch, the same units fields.json uses (x 0.75 = PDF points).
// Usage: node products/fillable/addons.mjs
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright"); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const art = (n) => pathToFileURL(path.join(HERE, "art", n)).href;
const fontDir = ["/usr/share/fonts/truetype/google-fonts", path.join(HERE, "fonts")].find((d) => fs.existsSync(path.join(d, "Lora-Variable.ttf")));
const font = (f) => pathToFileURL(path.join(fontDir, f)).href;

const CSS = `
@font-face{font-family:Lora;src:url(${font("Lora-Variable.ttf")})}
@font-face{font-family:Lora;font-style:italic;src:url(${font("Lora-Italic-Variable.ttf")})}
@font-face{font-family:Poppins;font-weight:500;src:url(${font("Poppins-Medium.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#f7f3ec}
.page{position:relative;overflow:hidden;background:#f7f3ec}
.frame{position:absolute;border:1px solid #ddd8cc}
.abs{position:absolute}
.label{position:absolute;left:0;right:0;text-align:center;font:500 var(--s,9px)/1 Poppins;letter-spacing:.3em;color:#5f6e56;text-transform:uppercase}
.script{position:absolute;left:0;right:0;text-align:center;font-family:Lora;font-style:italic;color:#5f6e56}
.rule{position:absolute;height:1px;background:#d9ddd0}
img{position:absolute;display:block}
`;

// Each design: size in px and absolutely placed pieces.
const designs = {
  bookmark: {
    w: 192, h: 672,
    html: `
      <div class="frame" style="inset:7px"></div>
      <img src="${art("card-spray.png")}" style="left:31px;top:26px;width:130px">
      <div class="label" style="top:104px;--s:7px">In loving memory</div>
      <div class="rule" style="left:76px;width:40px;top:236px"></div>
      <img src="${art("divider.png")}" style="left:46px;top:520px;width:100px">
      <img src="${art("spray.png")}" style="left:26px;top:582px;width:140px">`
  },
  thankyou: {
    w: 408, h: 528,
    html: `
      <div class="frame" style="inset:5px"></div>
      <img src="${art("card-spray.png")}" style="left:122px;top:30px;width:164px">
      <div class="script" style="top:104px;font-size:38px">Thank you</div>
      <div class="label" style="top:164px;--s:7.5px">For your kindness</div>
      <div class="rule" style="left:184px;width:40px;top:190px"></div>
      <img src="${art("divider.png")}" style="left:139px;top:470px;width:130px">`
  },
  announcement: {
    w: 540, h: 960,
    html: `
      <img src="${art("sign-top.png")}" style="left:70px;top:0;width:400px">
      <div class="label" style="top:222px;--s:11px">In loving memory</div>
      <img src="${art("tree.png")}" style="left:174px;top:248px;width:192px">
      <div class="rule" style="left:250px;width:40px;top:668px"></div>
      <img src="${art("spray.png")}" style="left:150px;top:842px;width:240px">`
  },
  guestbook: {
    w: 816, h: 1056,
    html: `
      <div class="frame" style="inset:18px"></div>
      <img src="${art("card-spray.png")}" style="left:323px;top:52px;width:170px">
      <div class="script" style="top:130px;font-size:44px">Guest Book</div>
      <div class="label" style="top:198px;--s:9px">In loving memory of</div>
      <div class="label" style="top:290px;--s:8px;left:70px;right:auto;text-align:left">Name</div>
      <div class="label" style="top:290px;--s:8px;left:330px;right:auto;text-align:left">A favorite memory or message</div>
      ${Array.from({ length: 13 }, (_, i) => `<div class="rule" style="left:70px;width:676px;top:${360 + i * 52}px;background:#cfd5c5"></div>`).join("")}
      <div class="abs" style="left:310px;top:316px;width:1px;height:${12 * 52 + 44}px;background:#e2e5dc"></div>
      <img src="${art("divider.png")}" style="left:333px;top:${360 + 12 * 52 + 40}px;width:150px">`
  }
};

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(path.join(HERE, "bg"), { recursive: true });
for (const [name, d] of Object.entries(designs)) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}@page{size:${d.w}px ${d.h}px;margin:0}</style></head>
    <body><div class="page" style="width:${d.w}px;height:${d.h}px">${d.html}</div></body></html>`;
  const file = path.join(HERE, "bg", `_${name}.html`);
  fs.writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, "bg", `${name}.pdf`), width: `${d.w}px`, height: `${d.h}px`, printBackground: true, pageRanges: "1" });
  fs.unlinkSync(file);
  console.log("drew bg/" + name + ".pdf");
}
await browser.close();
