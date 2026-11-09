// Downloads product preview images, renders the Forever Held logo PNGs (with the Lora web font),
// and screenshots the store page on a phone and a laptop. Runs on GitHub Actions (needs internet).
// IMAGES env: JSON {"program-cover.png": "https://...", ...}
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW_PATH || "playwright");
const images = JSON.parse(process.env.IMAGES || "{}");
await fs.mkdir("store/img", { recursive: true });
for (const [name, url] of Object.entries(images)) {
  const res = await fetch(url);
  if (!res.ok) { console.log(`couldn't download ${name}: HTTP ${res.status}`); continue; }
  await fs.writeFile(`store/img/${name}`, Buffer.from(await res.arrayBuffer()));
  console.log(`saved store/img/${name}`);
}
const mark = await fs.readFile("store/brand/mark.svg", "utf8");
const font = `<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500&display=block" rel="stylesheet">`;
const logo = (w, h, layout, bg) => `<!doctype html><html><head>${font}<style>html,body{margin:0;width:${w}px;height:${h}px;background:${bg}}
.l{width:100%;height:100%;display:flex;${layout === "wide" ? "flex-direction:row;gap:26px" : "flex-direction:column;gap:18px"};align-items:center;justify-content:center;font:500 ${layout === "wide" ? 92 : 64}px/1 Lora,serif;color:#3d4a36;letter-spacing:.01em}
.l svg{width:${layout === "wide" ? 190 : 260}px;height:auto}</style></head><body><div class="l">${mark}<span>Forever Held</span></div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, w, h, layout, bg] of [["logo-wide.png", 1200, 300, "wide", "transparent"], ["logo-square.png", 800, 800, "square", "#f3efe7"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(logo(w, h, layout, bg), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `store/brand/${file}`, omitBackground: bg === "transparent" });
  console.log(`rendered store/brand/${file}`);
}
await fs.mkdir("store/brand/screens", { recursive: true });
const url = "file://" + process.cwd() + "/store/index.html";
for (const [file, opts] of [["phone.png", { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ["laptop.png", { viewport: { width: 1280, height: 800 } }]]) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `store/brand/screens/${file}`, fullPage: true });
  await ctx.close();
  console.log(`screenshot store/brand/screens/${file}`);
}
await browser.close();
