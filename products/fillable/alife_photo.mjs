// Draws the sample "photo" used only in A Life previews and the try-it demo (a lake at dawn, drawn in code,
// warm black-and-white like an old family snapshot). Not part of the files buyers receive.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let pw; for (const p of ["playwright", path.join(process.env.NODE_PATH || "", "playwright")]) { try { pw = require(p); break; } catch {} }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(HERE, "previews", "a-life", "sample-photo.jpg");
let reeds = "";
for (let i = 0; i < 70; i++) { const x = 760 + i * 6 + Math.sin(i * 7) * 9, h = 120 + (i * 37 % 90); reeds += `<path d="M${x} 900 Q${x + 8} ${900 - h / 2} ${x + (i % 2 ? 18 : -10)} ${900 - h}" stroke="#2a2520" stroke-width="${2 + i % 3}" fill="none"/>`; }
let ripples = "";
for (let i = 0; i < 40; i++) { const y = 640 + i * 7 + i * i * 0.35, w = 60 + i * 9; ripples += `<rect x="${600 - w / 2 + Math.sin(i) * 40}" y="${y}" width="${w}" height="${1.5 + i / 18}" fill="#f3e7cf" opacity="${0.55 - i / 90}"/>`; }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e655a"/><stop offset=".55" stop-color="#d9ccb4"/><stop offset=".62" stop-color="#efe3c8"/></linearGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfc1a6"/><stop offset="1" stop-color="#4b443b"/></linearGradient>
<radialGradient id="sun" cx="600" cy="610" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8e6"/><stop offset=".25" stop-color="#f6ead0" stop-opacity=".9"/><stop offset="1" stop-color="#f6ead0" stop-opacity="0"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .17  0 0 0 0 .13  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
<rect width="1200" height="640" fill="url(#sky)"/><rect y="630" width="1200" height="370" fill="url(#lake)"/>
<circle cx="600" cy="610" r="260" fill="url(#sun)"/><circle cx="600" cy="612" r="34" fill="#fffaf0"/>
<path d="M0 600 Q140 560 300 590 T620 586 T900 572 T1200 596 L1200 636 L0 636Z" fill="#7d7264" opacity=".75"/>
<path d="M0 622 Q200 600 420 618 T820 612 T1200 620 L1200 640 L0 640Z" fill="#5b5248"/>
${ripples}
<g fill="#2a2520"><rect x="120" y="742" width="560" height="22"/><rect x="150" y="764" width="10" height="160"/><rect x="330" y="764" width="10" height="150"/><rect x="520" y="764" width="10" height="140"/><rect x="660" y="764" width="10" height="130"/>
<rect x="560" y="690" width="12" height="54"/><path d="M572 692 L700 540" stroke="#2a2520" stroke-width="4"/><path d="M700 540 Q712 640 706 760" stroke="#2a2520" stroke-width="1.2" fill="none"/>
<ellipse cx="470" cy="716" rx="26" ry="28"/><rect x="446" y="716" width="50" height="30" rx="6"/><circle cx="470" cy="676" r="15"/><path d="M450 672 h40 l-6 -12 h-28z"/></g>
${reeds}
<rect width="1200" height="1000" filter="url(#grain)"/><rect width="1200" height="1000" fill="url(#vig)"/></svg>`;
const b = await pw.chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 1000 } });
await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await pg.screenshot({ path: out, type: "jpeg", quality: 88 }); await b.close(); console.log("saved", out);
