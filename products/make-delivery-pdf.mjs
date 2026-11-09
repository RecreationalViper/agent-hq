// Builds the Forever Held buyer access PDF (US Letter, tappable buttons).
// Usage: node make-delivery-pdf.mjs <out.pdf> <programLink> <signLink> <cardLink>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [out = "ForeverHeld-SoftBotanical-Access.pdf", program, sign, card] = process.argv.slice(2);
const btn = (label, sub, url) => url
  ? `<a class="btn" href="${url}"><span>${label}</span><small>${sub}</small></a>`
  : `<div class="btn pending"><span>${label}</span><small>Link coming soon</small></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; width: 8.5in; height: 11in; background: #f6f1e9; color: #3e4438; font-family: Georgia, "Times New Roman", serif; }
.page { position: relative; height: 11in; padding: .7in .85in .6in; border: 10px solid #f6f1e9; outline: 1px solid #c9cfbf; outline-offset: -22px; }
.brand { text-align: center; letter-spacing: .35em; font-size: 10.5pt; color: #6d7f5f; text-transform: uppercase; }
h1 { text-align: center; font-weight: normal; font-style: italic; font-size: 30pt; color: #55684a; margin: .18in 0 .04in; }
.sub { text-align: center; font-size: 11.5pt; color: #6b6f63; margin-bottom: .28in }
.sprig { text-align: center; color: #8a9a7b; font-size: 16pt; letter-spacing: .4em; margin: .05in 0 .2in }
p { font-size: 11.5pt; line-height: 1.55; margin: 0 0 .12in }
h2 { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; letter-spacing: .28em; color: #6d7f5f; text-transform: uppercase; font-weight: 600; margin: .26in 0 .12in; text-align: center }
.btns { display: flex; flex-direction: column; gap: .13in; align-items: center }
.btn { display: block; width: 4.9in; padding: .14in .2in; border-radius: 40px; background: #6d7f5f; color: #fff; text-decoration: none; text-align: center; font-family: Helvetica, Arial, sans-serif }
.btn span { display: block; font-size: 12.5pt; font-weight: 600; letter-spacing: .02em }
.btn small { display: block; font-size: 9pt; opacity: .85; margin-top: 2px }
.btn.pending { background: #b9c1ae }
ul { margin: 0; padding-left: .22in; font-size: 10.8pt; line-height: 1.5 }
li { margin-bottom: .06in }
.note { font-size: 10pt; color: #6b6f63; text-align: center; margin-top: .1in }
.foot { position: absolute; bottom: .55in; left: 0; right: 0; text-align: center; font-size: 10.5pt; color: #6b6f63; font-style: italic }
</style></head><body><div class="page">
<div class="brand">Forever Held</div>
<h1>Soft Botanical Memorial Suite</h1>
<div class="sub">Thank you for allowing us to support you during this time.</div>
<div class="sprig">❧ ❧ ❧</div>
<p>We extend our deepest condolences to you and your family. We hope these templates bring a sense of ease and calm as you prepare to celebrate and remember your loved one.</p>
<h2>Open your templates</h2>
<div class="btns">
${btn("Funeral Program", "US Letter, folds to 5.5 x 8.5 in", program)}
${btn("Welcome Sign", "24 x 36 in, also prints 16 x 24 or 12 x 18", sign)}
${btn("Share-a-Memory Card", "4.25 x 5.5 in", card)}
</div>
<p class="note">Tap a button, then <b>Use template</b> in Canva. A free Canva account works. You get your own copy to edit.</p>
<h2>Simple printing tips</h2>
<ul>
<li><b>Download:</b> in Canva, tap Share → Download → <b>PDF Print</b>.</li>
<li><b>Paper:</b> heavy cardstock (65–80 lb) in white or soft ivory for the program and cards. Ask your print shop to mount the sign on foam board.</li>
<li><b>At home:</b> print at <b>Actual size / 100%</b> (not “Fit to page”), double-sided, flipped on the short edge for the program.</li>
<li><b>Short on time?</b> Upload your PDF to Staples, Office Depot or FedEx Office for same-day printing, folding and mounting.</li>
</ul>
<div class="foot">Wishing you peace, comfort, and gentle memories. · Forever Held</div>
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: out, format: "Letter", printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: out.replace(/\.pdf$/, "-preview.png"), fullPage: true });
await browser.close();
console.log("made", out);
