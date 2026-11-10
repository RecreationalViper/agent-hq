// Makes the Forever Held product film for the website (1920x1080, about 20 seconds, no sound).
//   1. Opening shot: Magic Hour text-to-video (atmospheric memorial table, no people, no text), if a key and credits exist.
//   2. Product scenes: the REAL product previews animated in code (slow push-ins, parallax, light sweep), so every
//      word on the product is sharp and true. Rendered frame by frame with Playwright.
//   3. ffmpeg joins them with a soft crossfade, one colour grade, light film grain and a vignette.
// Output: store/video/forever-held-film.mp4 + poster jpg. Posts to Discord #content when DISCORD_BOT_TOKEN is set.
// Usage: node tools/make-film.mjs   (FILM_BROLL=path.mp4 to reuse a clip; FILM_NO_AI=1 to skip Magic Hour)
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "store/video");
const WORK = path.join(ROOT, ".film");
const require = createRequire(import.meta.url);
// FILM_FORMAT=pin makes the 2:3 Pinterest video pin (1000x1500); default is the 16:9 website film.
const PIN = process.env.FILM_FORMAT === "pin";
const W = PIN ? 1000 : 1920, H = PIN ? 1500 : 1080, FPS = 30, DESIGN_SECONDS = 15;
const NAME = PIN ? "forever-held-pin" : "forever-held-film";
const L = PIN ? {
  art: "left:290px;bottom:40px;width:420px", c1: "left:70px;top:540px;width:860px", t1: "left:60px;right:60px;top:150px;text-align:center;text-wrap:balance",
  c2: "left:50px;top:240px;width:900px", t2: "left:70px;right:70px;top:1050px;text-align:center;font-size:46px;font-style:italic;color:#4a5842",
  c3a: "left:70px;top:330px;width:470px", c3b: "left:480px;top:600px;width:440px", t3: "left:60px;right:60px;top:110px;text-align:center;font-size:56px",
  a4: "width:760px;margin-bottom:6px", t4: "font-size:76px;font-weight:500;line-height:1.05;max-width:820px;text-wrap:balance"
} : {
  art: "right:70px;bottom:40px;width:420px", c1: "left:110px;top:150px;width:1000px", t1: "left:1220px;top:360px;width:600px",
  c2: "left:420px;top:52px;width:1080px", t2: "left:0;right:0;bottom:34px;text-align:center;font-size:40px;font-style:italic;color:#4a5842;text-shadow:0 1px 0 rgba(255,255,255,.6)",
  c3a: "left:330px;top:70px;width:560px", c3b: "left:960px;top:250px;width:520px", t3: "left:1530px;top:300px;width:330px;font-size:50px",
  a4: "width:820px;margin-bottom:6px", t4: "font-size:88px;font-weight:500;line-height:1"
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;
const MH_KEY = ["MAGICHOUR_API_KEY", "MAGIC_HOUR_API_KEY", "ART_API_KEY"].map((k) => process.env[k]?.trim()).find(Boolean);
const USE_MH = (process.env.FILM_OPENING || "painted") === "magichour";
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

// ---------- 1. Magic Hour opening shot ----------
const BROLL_PROMPT = "Cinematic slow dolly-in across a quiet memorial table beside a window at golden hour. A single lit candle with a gentle flame, a small glass vase of white ranunculus and soft eucalyptus, folded cream linen, a closed hardcover book. Warm low sunlight, floating dust in the light, shallow depth of field, soft bokeh, muted sage green and warm cream palette, calm and reverent, 35mm film look, subtle grain. No people, no faces, no hands, no text, no letters.";

async function mh(pathname, init = {}) {
  const r = await fetch(`https://api.magichour.ai/v1${pathname}`, { ...init, signal: AbortSignal.timeout(60000), headers: { Authorization: `Bearer ${MH_KEY}`, "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`Magic Hour ${r.status}: ${j.code || ""} ${j.message || ""}`.trim()); e.status = r.status; throw e; }
  return j;
}

async function brollFromMagicHour() {
  if (process.env.FILM_BROLL) return process.env.FILM_BROLL;
  if (!MH_KEY || process.env.FILM_NO_AI === "1") { console.log("  no Magic Hour shot (no key or turned off)"); return null; }
  const acct = await mh("/account").catch(() => ({}));
  console.log(`  Magic Hour credits before: ${acct.credits ?? "?"}`);
  let job;
  for (const resolution of ["720p", "480p"]) {
    const cost = (resolution === "720p" ? 48 : 24) * 5;
    if (acct.credits != null && acct.credits < cost) { console.log(`  not enough credits for ${resolution} (${cost} needed)`); continue; }
    try {
      job = await mh("/text-to-video", { method: "POST", body: JSON.stringify({ name: "Forever Held film opening", model: "ltx-2.5", end_seconds: 5, aspect_ratio: "16:9", resolution, audio: false, style: { prompt: BROLL_PROMPT } }) });
      console.log(`  Magic Hour ${resolution} clip queued (${job.credits_charged} credits)`);
      break;
    } catch (e) { console.log(`  ${resolution} not available: ${e.message}`); if (e.status !== 402 && e.status !== 400 && e.status !== 422) return null; }
  }
  if (!job) return null;
  for (let i = 0; i < 80; i++) {
    await sleep(15000);
    const v = await mh(`/video-projects/${job.id}`).catch((e) => ({ status: "poll-failed", e }));
    if (v.status === "complete" && v.downloads?.[0]?.url) {
      const file = path.join(WORK, "broll.mp4");
      await fs.writeFile(file, Buffer.from(await (await fetch(v.downloads[0].url)).arrayBuffer()));
      console.log(`  Magic Hour clip ready (charged ${v.credits_charged ?? job.credits_charged} credits)`);
      await fs.mkdir(OUT, { recursive: true });
      await fs.copyFile(file, path.join(OUT, "opening-shot-raw.mp4"));
      return file;
    }
    if (["error", "canceled"].includes(v.status)) { console.log(`  Magic Hour clip failed: ${JSON.stringify(v.error || v.status)}`); return null; }
  }
  console.log("  Magic Hour clip took too long; continuing without it");
  return null;
}

// ---------- 1b. Free opening: a painted still (Cloudflare, free) brought to life in code ----------
const STILL_PROMPT = "Cinematic 35mm photograph of a quiet memorial table beside a window at golden hour: a single lit white pillar candle, a small glass vase of white ranunculus and soft eucalyptus, folded cream linen, a closed hardcover book. Warm low sunlight streaming in, floating dust in the light, shallow depth of field, soft bokeh, muted sage green and warm cream palette, calm and reverent, subtle film grain. No people, no hands, no text, no letters, no watermark.";

async function paintStill() {
  if (process.env.FILM_STILL) return process.env.FILM_STILL; // reuse a still (testing)
  const saved = path.join(OUT, "opening-still.jpg");
  if (PIN && await fs.stat(saved).then(() => true, () => false)) { const f = path.join(WORK, "saved-still.jpg"); await fs.copyFile(saved, f); console.log("  reusing the website film's painted still"); return f; }
  const id = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN;
  if (!id || !tok) { console.log("  no Cloudflare key, so no painted opening"); return null; }
  const tries = [
    ["@cf/leonardo/lucid-origin", { prompt: STILL_PROMPT, width: 1920, height: 1088, guidance: 4.5, num_steps: 30 }],
    ["@cf/leonardo/phoenix-1.0", { prompt: STILL_PROMPT, width: 1920, height: 1088, guidance: 3, num_steps: 30 }],
    ["@cf/black-forest-labs/flux-1-schnell", { prompt: STILL_PROMPT, steps: 8 }]
  ];
  for (const [model, body] of tries) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${model}`, { method: "POST", signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const type = r.headers.get("content-type") || "";
      let buf;
      if (type.startsWith("image/")) buf = Buffer.from(await r.arrayBuffer());
      else { const j = await r.json().catch(() => ({})); const b64 = j.result?.image || j.image; if (b64) buf = Buffer.from(b64, "base64"); else { console.log(`  ${model}: ${j.errors?.[0]?.message || `HTTP ${r.status}`}`); continue; } }
      if (!r.ok || buf.length < 5000) { console.log(`  ${model}: HTTP ${r.status}`); continue; }
      const file = path.join(WORK, "still.jpg");
      await fs.writeFile(file, buf);
      if (!PIN) await fs.copyFile(file, path.join(OUT, "opening-still.jpg"));
      console.log(`  painted the opening still with ${model}`);
      return file;
    } catch (e) { console.log(`  ${model} failed: ${e.message}`); }
  }
  return null;
}

// Slow push-in with drift, breathing window light, floating dust and a title, rendered frame by frame.
async function renderOpening(still, browser) {
  const frames = path.join(WORK, "oframes");
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });
  const dust = Array.from({ length: 70 }, (_, i) => { const r = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1; return { x: r(1) * W * 0.9, y: r(2) * H, s: 1.5 + r(3) * 4, v: 8 + r(4) * 26, d: (r(5) - .5) * 30, o: .25 + r(6) * .5, ph: r(7) * 6 }; });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
*{margin:0;padding:0}body{width:${W}px;height:${H}px;overflow:hidden;background:#000}
#bg{position:absolute;${PIN ? "left:0;top:0;height:100%;width:auto;max-width:none" : "inset:0;width:100%;height:100%;object-fit:cover"};transform-origin:58% 52%}
#glow{position:absolute;inset:0;background:radial-gradient(ellipse 55% 60% at 30% 25%,rgba(255,214,150,.38),rgba(255,214,150,0) 70%);mix-blend-mode:screen}
.d{position:absolute;border-radius:50%;background:rgba(255,236,200,.95);filter:blur(1.2px)}
#shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(20,16,10,.55))}
#title{position:absolute;left:0;right:0;bottom:${PIN ? 230 : 120}px;text-align:center;font:italic ${PIN ? 60 : 64}px Cormorant;color:#fbf5ea;text-shadow:0 2px 24px rgba(0,0,0,.45)}
</style></head><body><img id="bg" src="${pathToFileURL(still).href}"><div id="glow"></div>
${dust.map((p, i) => `<div class="d" id="d${i}" style="width:${p.s}px;height:${p.s}px"></div>`).join("")}
<div id="shade"></div><div id="title">For the day you say goodbye</div>
<script>const D=${JSON.stringify(dust)};const e=(x)=>x<0?0:x>1?1:x*x*(3-2*x);
window.setT=(t)=>{const p=t/5;document.getElementById("bg").style.transform=${PIN ? "`translateX(${-0.07*1500*1920/1088 - 0.5*1500*1920/1088*e(p)}px) scale(${1.03+.04*p})`" : "`scale(${1.04+.10*p}) translate(${-12*p}px,${6*p}px)`"};
document.getElementById("glow").style.opacity=.75+.25*Math.sin(t*1.3);
D.forEach((d,i)=>{const s=document.getElementById("d"+i).style;s.transform=\`translate(\${d.x+d.d*Math.sin(t*.6+d.ph)}px,\${((d.y-d.v*t)%${H}+${H})%${H}}px)\`;s.opacity=d.o*(.6+.4*Math.sin(t*1.7+d.ph));});
const ti=document.getElementById("title").style;ti.opacity=Math.min(e((t-1.2)/1),1-e((t-3.2)/.7));ti.transform=\`translateY(\${14*(1-e((t-1.2)/1.4))}px)\`;};</script></body></html>`;
  const f = path.join(WORK, "opening.html");
  await fs.writeFile(f, html);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(pathToFileURL(f).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 5 * FPS; i++) {
    await page.evaluate((t) => window.setT(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  }
  await page.close();
  const out = path.join(WORK, "painted-open.mp4");
  ff(["-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", out]);
  console.log("  rendered the painted opening");
  return out;
}

// ---------- 2. Product scenes (real previews, animated in code) ----------
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${url("products/fillable/fonts/Cinzel.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;background:#efe8dc;font-family:Cormorant;color:#3d4a36}
.light{position:absolute;inset:-20%;background:radial-gradient(ellipse 60% 55% at 62% 40%,rgba(255,250,240,.95),rgba(239,232,220,0) 70%),radial-gradient(ellipse 50% 50% at 15% 90%,rgba(186,198,170,.35),rgba(239,232,220,0) 70%)}
.scene{position:absolute;inset:0;opacity:0}
.card{position:absolute;background:#fff;padding:14px;box-shadow:0 40px 80px -30px rgba(52,62,45,.55),0 6px 18px rgba(52,62,45,.14);overflow:hidden}
.card img{display:block;width:100%}
.card::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(var(--sweep,-120%))}
.cap{position:absolute;font-size:64px;line-height:1.08;font-weight:500;letter-spacing:-.01em}
.cap i{display:block;font-size:34px;font-weight:400;color:#5f6e56;margin-top:18px;letter-spacing:0}
.brand{font-family:Cinzel;letter-spacing:.45em;color:#6d7f5f}
.art{position:absolute;opacity:.9}
</style></head><body><div class="light"></div>
<div class="scene" id="s1">
  <img class="art" src="${url("products/fillable/art/spray.png")}" style="${L.art}">
  <div class="card" id="c1" style="${L.c1}"><img src="${url("store/img/program-cover.png")}"></div>
  <div class="cap" id="t1" style="${L.t1}"><span class="brand" style="font-size:20px;display:block;margin-bottom:26px">FOREVER HELD</span>A memorial program you can finish tonight<i>Soft Botanical memorial kit</i></div>
</div>
<div class="scene" id="s2">
  <div class="card" id="c2" style="${L.c2}"><img src="${url("store/img/program-inside.png")}"></div>
  <div class="cap" id="t2" style="${L.t2}">Tap any line and type your own words in the free Adobe Acrobat Reader app</div>
</div>
<div class="scene" id="s3">
  <div class="card" id="c3a" style="${L.c3a}"><img src="${url("store/img/welcome-sign.png")}"></div>
  <div class="card" id="c3b" style="${L.c3b}"><img src="${url("store/img/memory-card.png")}"></div>
  <div class="cap" id="t3" style="${L.t3}">Welcome sign<i>and share-a-memory cards, all matching</i></div>
</div>
<div class="scene" id="s4" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <img src="${url("products/fillable/art/sign-top.png")}" id="a4" style="${L.a4}">
  <div class="brand" style="font-size:30px;margin-bottom:30px">FOREVER HELD</div>
  <div id="t4" style="${L.t4}">Soft Botanical Memorial Kit</div>
  <div style="font-size:40px;font-style:italic;color:#5f6e56;margin-top:26px">Editable printable · instant download · $12.99</div>
  <div class="brand" style="font-size:18px;margin-top:44px;letter-spacing:.3em">PAYHIP.COM/B/VQNSA</div>
</div>
<script>
const ease = (x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const fade = (t, a, b, f = 0.6) => Math.min(ease((t - a) / f), 1 - ease((t - (b - f)) / f));
const $ = (id) => document.getElementById(id).style;
window.setT = (t) => {
  // scene windows overlap by 0.6s for crossfades
  $("s1").opacity = fade(t, -1, 4.6); $("s2").opacity = fade(t, 4.0, 8.6); $("s3").opacity = fade(t, 8.0, 12.1); $("s4").opacity = fade(t, 11.5, 99);
  const p1 = ease(t / 4.6), p2 = ease((t - 4) / 4.6), p3 = ease((t - 8) / 4.1), p4 = ease((t - 11.5) / 3.5);
  $("c1").transform = \`translate(\${-20 + 40 * p1}px,\${10 - 20 * p1}px) scale(\${1 + 0.05 * p1}) rotate(-1deg)\`;
  $("c1").setProperty("--sweep", \`\${-120 + 260 * ease((t - 0.8) / 2.6)}%\`);
  $("t1").opacity = ease((t - 0.7) / 0.9); $("t1").transform = \`translateY(\${24 * (1 - ease((t - 0.7) / 1.2))}px)\`;
  $("c2").transform = \`translate(\${30 - 60 * p2}px,0) scale(\${1.02 + 0.04 * p2})\`;
  $("c2").setProperty("--sweep", \`\${-120 + 260 * ease((t - 4.6) / 2.8)}%\`);
  $("t2").opacity = ease((t - 4.9) / 0.8);
  $("c3a").transform = \`translate(\${-15 + 30 * p3}px,\${10 - 25 * p3}px) rotate(-2deg) scale(\${1 + 0.03 * p3})\`;
  $("c3b").transform = \`translate(\${25 - 50 * p3}px,\${-10 + 30 * p3}px) rotate(2.5deg)\`;
  $("c3a").setProperty("--sweep", \`\${-120 + 260 * ease((t - 8.4) / 2.4)}%\`);
  $("t3").opacity = ease((t - 8.7) / 0.8);
  $("t4").transform = \`scale(\${0.97 + 0.03 * p4})\`; $("a4").opacity = ease((t - 11.8) / 1.2);
};
</script></body></html>`;

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  return createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright");
}

async function renderDesign() {
  const frames = path.join(WORK, "frames");
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });
  const page_ = path.join(WORK, "film.html");
  await fs.writeFile(page_, HTML);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(pathToFileURL(page_).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const only = process.env.FILM_FRAMES?.split(",").map(Number); // quick preview: FILM_FRAMES=1,6,10,14
  const times = only || Array.from({ length: DESIGN_SECONDS * FPS }, (_, i) => i / FPS);
  for (const [i, t] of times.entries()) {
    await page.evaluate((t) => window.setT(t), t);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  }
  await browser.close();
  console.log(`  rendered ${times.length} product frames`);
  return frames;
}

// ---------- 3. Edit ----------
async function main() {
  await fs.mkdir(WORK, { recursive: true });
  await fs.mkdir(OUT, { recursive: true });
  const mode = process.env.FILM_OPENING || "painted"; // painted (free, no logo) | magichour (free tier adds its logo) | none
  let broll = null;
  if (mode === "magichour") broll = await brollFromMagicHour();
  else if (mode === "painted") {
    const still = await paintStill();
    if (still) { const { chromium } = loadPlaywright(); const b = await chromium.launch(); try { broll = await renderOpening(still, b); } finally { await b.close(); } }
  }
  const frames = await renderDesign();
  if (process.env.FILM_FRAMES) return console.log(`preview frames in ${frames}`);
  const design = path.join(WORK, "design.mp4");
  ff(["-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", design]);
  const film = path.join(OUT, `${NAME}.mp4`);
  const grade = "eq=saturation=0.92:gamma=1.02,noise=alls=5:allf=t,vignette=PI/5";
  if (broll) {
    // Opening shot: upscaled, warm soft grade, slow ease, title over it; crossfade into the product scenes.
    const open = path.join(WORK, "open.mp4");
    ff(["-i", broll, "-t", "5", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${FPS},unsharp=5:5:0.4,colorbalance=rs=.03:bs=-.03,format=yuv420p`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", open]);
    ff(["-i", open, "-i", design, "-filter_complex", `[0][1]xfade=transition=fade:duration=1:offset=4,${grade},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", film]);
  } else {
    ff(["-i", design, "-vf", `${grade},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", film]);
  }
  ff(["-sseof", "-2", "-i", film, "-frames:v", "1", "-q:v", "3", path.join(OUT, `${NAME}-poster.jpg`)]);
  const mb = ((await fs.stat(film)).size / 1e6).toFixed(1);
  console.log(`Film ready: store/video/${NAME}.mp4 (${mb} MB)${broll ? ` with the ${mode} opening` : ""}`);
  if (process.env.DISCORD_BOT_TOKEN && !process.env.FILM_NO_POST) {
    const { postFiles } = await import(path.join(ROOT, "discord.mjs"));
    const msg = PIN
      ? `📌 **Pinterest video pin** (2:3, ${mb} MB). Tap it, then download, then upload it in the Pinterest app as a new Pin.\n**Title:** Editable Funeral Program, Welcome Sign & Memory Cards | Soft Botanical\n**Description:** A gentle, matching memorial kit you can finish tonight. Type your own words in the free Adobe Acrobat Reader app on your phone, then print at home or at a print shop. Instant download.\n**Link:** https://payhip.com/b/vqNSA`
      : `🎬 **Forever Held product film** (${mb} MB, 1080p). Tap to play, then download. It's also on the website.`;
    await postFiles("content", msg, [{ name: `${NAME}.mp4`, data: await fs.readFile(film), type: "video/mp4" }]);
  }
  if (MH_KEY && USE_MH) { const a = await mh("/account").catch(() => ({})); console.log(`  Magic Hour credits left: ${a.credits ?? "?"}`); }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
