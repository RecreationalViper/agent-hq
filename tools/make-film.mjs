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
const W = 1920, H = 1080, FPS = 30, DESIGN_SECONDS = 15;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;
const MH_KEY = ["MAGICHOUR_API_KEY", "MAGIC_HOUR_API_KEY", "ART_API_KEY"].map((k) => process.env[k]?.trim()).find(Boolean);
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
  <img class="art" src="${url("products/fillable/art/spray.png")}" style="right:70px;bottom:40px;width:420px">
  <div class="card" id="c1" style="left:110px;top:150px;width:1000px"><img src="${url("store/img/program-cover.png")}"></div>
  <div class="cap" id="t1" style="left:1220px;top:360px;width:600px"><span class="brand" style="font-size:20px;display:block;margin-bottom:26px">FOREVER HELD</span>A memorial program you can finish tonight<i>Soft Botanical memorial kit</i></div>
</div>
<div class="scene" id="s2">
  <div class="card" id="c2" style="left:420px;top:52px;width:1080px"><img src="${url("store/img/program-inside.png")}"></div>
  <div class="cap" id="t2" style="left:0;right:0;bottom:34px;text-align:center;font-size:40px;font-style:italic;color:#4a5842;text-shadow:0 1px 0 rgba(255,255,255,.6)">Tap any line and type your own words in the free Adobe Acrobat Reader app</div>
</div>
<div class="scene" id="s3">
  <div class="card" id="c3a" style="left:330px;top:70px;width:560px"><img src="${url("store/img/welcome-sign.png")}"></div>
  <div class="card" id="c3b" style="left:960px;top:250px;width:520px"><img src="${url("store/img/memory-card.png")}"></div>
  <div class="cap" id="t3" style="left:1530px;top:300px;width:330px;font-size:50px">Welcome sign<i>and share-a-memory cards, all matching</i></div>
</div>
<div class="scene" id="s4" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <img src="${url("products/fillable/art/sign-top.png")}" id="a4" style="width:820px;margin-bottom:6px">
  <div class="brand" style="font-size:30px;margin-bottom:30px">FOREVER HELD</div>
  <div id="t4" style="font-size:88px;font-weight:500;line-height:1">Soft Botanical Memorial Kit</div>
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
  const [broll, frames] = await Promise.all([brollFromMagicHour(), renderDesign()]);
  if (process.env.FILM_FRAMES) return console.log(`preview frames in ${frames}`);
  const design = path.join(WORK, "design.mp4");
  ff(["-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", design]);
  const film = path.join(OUT, "forever-held-film.mp4");
  const grade = "eq=saturation=0.92:gamma=1.02,noise=alls=5:allf=t,vignette=PI/5";
  if (broll) {
    // Opening shot: upscaled, warm soft grade, slow ease, title over it; crossfade into the product scenes.
    const open = path.join(WORK, "open.mp4");
    ff(["-i", broll, "-t", "5", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${FPS},unsharp=5:5:0.4,colorbalance=rs=.03:bs=-.03,format=yuv420p`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", open]);
    ff(["-i", open, "-i", design, "-filter_complex", `[0][1]xfade=transition=fade:duration=1:offset=4,${grade},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", film]);
  } else {
    ff(["-i", design, "-vf", `${grade},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", film]);
  }
  ff(["-sseof", "-2", "-i", film, "-frames:v", "1", "-q:v", "3", path.join(OUT, "forever-held-poster.jpg")]);
  const mb = ((await fs.stat(film)).size / 1e6).toFixed(1);
  console.log(`Film ready: store/video/forever-held-film.mp4 (${mb} MB)${broll ? " with the Magic Hour opening" : ""}`);
  if (process.env.DISCORD_BOT_TOKEN && !process.env.FILM_NO_POST) {
    const { postFiles } = await import(path.join(ROOT, "discord.mjs"));
    await postFiles("content", `🎬 **Forever Held product film** (${mb} MB, 1080p). Tap to play, then download. It's also on the website.`, [{ name: "forever-held-film.mp4", data: await fs.readFile(film), type: "video/mp4" }]);
  }
  if (MH_KEY) { const a = await mh("/account").catch(() => ({})); console.log(`  Magic Hour credits left: ${a.credits ?? "?"}`); }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
