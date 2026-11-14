"""Builds the three themed holiday product pages (approved mockups, Nov 13 2026) into store/:
harvest-table.html, evergreen-candlelight.html, longest-night.html.
Same layout for all three, each with its own colors, background and copy.
Page images: store/img/holiday/pages/*.jpg (rendered from the real fill-in PDFs).
Fonts: store/fonts/*.woff (self-hosted, OFL). Usage: python3 tools/holiday-pages.py"""
import json
from html import escape as e
from pathlib import Path
import site_chrome as SC  # shared menu, search and assistant chat

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "store"
SITE = "https://foreverheld.pages.dev"
CHECKLIST = "https://payhip.com/b/eYJqS"
cols = {c["id"]: c for c in json.loads((ROOT / "products/collections.json").read_text())["collections"]}

def stars():
    return "".join(f'<i style="left:{(i*137)%100}%;top:{(i*53)%70}%;width:{1+(i%3)}px;height:{1+(i%3)}px;opacity:{0.3+(i%5)/8:.2f}"></i>' for i in range(90))

def bokeh():
    return "".join(f'<i style="left:{(i*71)%100}%;top:{(i*37)%90}%;width:{40+(i*23)%90}px;height:{40+(i*23)%90}px;opacity:{0.08+(i%4)/18:.2f}"></i>' for i in range(26))

def leaves():
    pts = [(8, 18, -20), (88, 12, 35), (78, 62, -50), (14, 74, 15), (52, 88, 60), (94, 40, -10), (30, 40, 40)]
    leaf = '<svg viewBox="0 0 40 40"><path d="M20 2C30 10 34 24 20 38C6 24 10 10 20 2Z" fill="currentColor"/><path d="M20 6V36" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>'
    return "".join(f'<i style="left:{x}%;top:{y}%;transform:rotate({r}deg)">{leaf}</i>' for x, y, r in pts)

MARQ = ["Instant download", "Fill in on your phone", "Print tonight", "Made with care"]
ARCH = "border-radius:50% 50% 4px 4px / 35.5% 35.5% 4px 4px"

SETS = [
 dict(id="holiday-2026-C", slug="harvest-table", serif="Caladea", serif_file="Caladea-Regular", serif_i="Caladea-Italic",
  title="Harvest Table · Thanksgiving memorial printables",
  desc="A Thanksgiving memorial set for the first holiday with an empty chair: a \"We saved a seat for you\" sign, thankful cards and place cards. Fill in on your phone, print at home.",
  vars="--aura:.15;--accent:#d8ad55;--accent2:#b45f3c;--text:#efe5d3;--deep:#2a1b12;--bgc:#1a110b",
  bg="""radial-gradient(60vw 50vw at 72% 30%, rgba(232,160,70,.42), transparent 60%),
  radial-gradient(50vw 40vw at 15% 85%, rgba(180,95,60,.35), transparent 60%),
  linear-gradient(180deg,#24160e,#120b07)""",
  btn="color:#fff;background:linear-gradient(160deg,rgba(232,170,80,.95),rgba(180,95,60,.95));border:1px solid rgba(255,230,180,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 14px 40px rgba(232,150,60,.45)",
  layer=("leaves", leaves()), grain=.12, theme="#1a110b",
  eyebrow="Thanksgiving · Thursday, Nov 26",
  h1="We saved<br>a seat <em>for you.</em>",
  lead="For the first Thanksgiving with an empty chair. A sign for their place, cards for what everyone's thankful for, and place cards for the whole table.",
  hero=[("h-sign", "Empty-chair sign: We saved a seat for you", ""), ("h-card", "I'm thankful for card", ""), ("h-card", "", "")],
  h2="Three pieces, one gentle table.",
  pieces=[("h-sign", "", "Empty-chair sign", "8 x 10 in. Their name, their years, your words. Fits any standard frame."),
          ("h-cards", "", "\"I'm thankful for\" cards", "Four to a page. Every guest finishes the sentence about them."),
          ("h-place", "max-height:70%", "Place cards", "Fold to stand. \"In loving memory\" for their seat, names for everyone else.")],
  steps_h="Checkout to table in one evening.", print_line="Print at home on US Letter, or at any print shop.",
  alt="Harvest Table Thanksgiving memorial set"),
 dict(id="holiday-2026-A", slug="evergreen-candlelight", serif="GFS Baskerville", serif_file="GFSBaskerville", serif_i=None,
  title="Evergreen & Candlelight · Christmas memorial printables",
  desc="A Christmas memorial set: a candle table sign, holiday memory cards and ornament keepsake cards with their name. Fill in on your phone, print at home.",
  vars="--aura:.15;--accent:#e6c27a;--accent2:#8e2f3a;--text:#f4eedf;--deep:#0f1d16;--bgc:#0c1712",
  bg="""radial-gradient(55vw 45vw at 70% 28%, rgba(245,190,100,.38), transparent 60%),
  radial-gradient(45vw 40vw at 12% 90%, rgba(142,47,58,.35), transparent 60%),
  linear-gradient(180deg,#183026,#0a140f)""",
  btn="color:#fff;background:linear-gradient(160deg,rgba(214,170,92,.95),rgba(150,105,48,.95));border:1px solid rgba(255,235,190,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 14px 40px rgba(230,180,90,.4)",
  layer=("bok", bokeh()), grain=.12, theme="#0c1712",
  eyebrow="Christmas · Friday, Dec 25",
  h1="Keep them close<br><em>this Christmas.</em>",
  lead="A candle that burns in their name, memories shared around the table, and an ornament with their name on the tree.",
  hero=[("e-sign", "Candle table sign: This candle burns in loving memory of", ""), ("e-orn", "Ornament keepsake card", ARCH), ("e-card", "Holiday memory card", "")],
  h2="A quiet place for them, all season.",
  pieces=[("e-sign", "", "Candle table sign", "8 x 10 in. \"This candle burns in loving memory of…\" Fits any standard frame."),
          ("e-card", "", "Holiday memory cards", "Four to a page, plus an ink-saving version. Everyone writes a favorite memory."),
          ("e-orn", ARCH, "Ornament cards", "Cut, punch, add a ribbon. Their name on the tree, one for everyone who wants one.")],
  steps_h="Ready by Christmas Eve.", print_line="Print at home on US Letter, or at any print shop.",
  alt="Evergreen and Candlelight Christmas memorial set"),
 dict(id="holiday-2026-B", slug="longest-night", serif="InterL", serif_file=None, serif_i=None,
  title="Longest Night · Blue Christmas service printables",
  desc="Everything for a Blue Christmas or Longest Night service: an editable program, a memorial table sign and candle-lighting cards. Faith-neutral and ready to print.",
  vars="--aura:.22;--aura3:#8a8fd0;--accent:#d9cfe0;--accent2:#3c4570;--text:#f2f1f8;--deep:#1b2140;--bgc:#141933",
  bg="""radial-gradient(70vw 40vw at 50% 110%, rgba(217,207,224,.55), transparent 65%),
  radial-gradient(40vw 30vw at 75% 20%, rgba(138,143,179,.35), transparent 60%),
  linear-gradient(180deg,#10142b,#2a3160 60%,#4a4f7a)""",
  btn="color:#1b2140;background:linear-gradient(160deg,rgba(255,255,255,.95),rgba(205,200,228,.92));border:1px solid rgba(255,255,255,.8);box-shadow:inset 0 1px 0 #fff,0 14px 44px rgba(200,195,240,.45)",
  layer=("stars", stars()), grain=0, theme="#141933", dot="#fff",
  eyebrow="Longest Night · Monday, Dec 21",
  h1="Light for<br><em>the longest night.</em>",
  lead="Everything for a Blue Christmas or Longest Night service: an editable program, a memorial table sign and candle-lighting cards. Faith-neutral, quiet, ready to print.",
  hero=[("l-sign", "Memorial table sign: On the longest night we remember", ""), ("l-card", "Candle-lighting card", ""), ("l-card", "", "")],
  h2="Everything your service needs.",
  pieces=[("l-prog1", "", "Service program", "Folds to 5.5 x 8.5 in. Names remembered, order of service, candle words, all editable."),
          ("l-sign", "", "Memorial table sign", "8 x 10 in, plus an ink-saving version. \"On the longest night we remember.\""),
          ("l-card", "", "Candle-lighting cards", "Four to a page. Each person writes a name before the candles are lit.")],
  steps_h="From download to sanctuary.", print_line="Print as many copies as your service needs.",
  alt="Longest Night Blue Christmas service set"),
]

FOOT = '''<footer class="hfoot">
  <a class="brand" href="./"><img src="brand/mark.svg" alt="">Forever Held</a>
  <p>Printable keepsakes for families saying goodbye.</p>
  <nav aria-label="Holiday sets"><a href="harvest-table.html">Harvest Table</a><a href="evergreen-candlelight.html">Evergreen &amp; Candlelight</a><a href="longest-night.html">Longest Night</a><a href="./#suite">Soft Botanical suite</a></nav>
  <nav aria-label="Help and policies"><a href="contact.html">Contact us</a><a href="about.html">About us</a><a href="terms.html">Terms of sale</a><a href="refunds.html">Refund policy</a><a href="privacy.html">Privacy policy</a><a href="accessibility.html">Accessibility</a></nav>
  <small>© 2026 Forever Held</small>
</footer>'''

def font_faces(s):
    out = ['@font-face{font-family:InterH;src:url(fonts/Inter-Regular.woff) format("woff");font-weight:400;font-display:swap}',
           '@font-face{font-family:InterH;src:url(fonts/Inter-SemiBold.woff) format("woff");font-weight:600;font-display:swap}',
           '@font-face{font-family:InterL;src:url(fonts/Inter-Light.woff) format("woff");font-weight:300;font-display:swap}']
    if s["serif_file"]:
        out.append(f'@font-face{{font-family:"{s["serif"]}";src:url(fonts/{s["serif_file"]}.woff) format("woff");font-display:swap}}')
    if s["serif_i"]:
        out.append(f'@font-face{{font-family:"{s["serif"]}";src:url(fonts/{s["serif_i"]}.woff) format("woff");font-style:italic;font-display:swap}}')
    return "\n".join(out)

CSS = """
:root{%(vars)s}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:InterH,system-ui,sans-serif;color:var(--text);background:var(--bgc);line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.bg{position:fixed;inset:0;z-index:-2;background:%(bg)s}
.grain{position:fixed;inset:0;z-index:-1;opacity:%(grain)s;pointer-events:none;background-image:url("data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%%3E%%3Cfilter id='n'%%3E%%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%%3E%%3C/filter%%3E%%3Crect width='100%%25' height='100%%25' filter='url(%%23n)'/%%3E%%3C/svg%%3E")}
.stars,.bok,.leaves{position:fixed;inset:0;z-index:-1;pointer-events:none}
.stars i{position:absolute;border-radius:50%%;background:#fff}
.bok i{position:absolute;border-radius:50%%;background:#ffd58a;filter:blur(14px)}
.leaves i{position:absolute;width:38px;height:38px;color:var(--accent2);opacity:.28;filter:blur(.5px)}
a{color:inherit}
.glass{background:linear-gradient(160deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 20px 60px rgba(0,0,0,.25)}
.wrap{max-width:1160px;margin:0 auto;padding:0 22px}
.nav{position:sticky;top:12px;z-index:5;margin:12px auto 0;max-width:1160px;width:calc(100%% - 24px);display:flex;align-items:center;justify-content:space-between;padding:10px 12px 10px 18px;border-radius:999px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:"%(serif)s",Georgia,serif;font-size:19px}
.brand img{width:26px;height:26px}
.brand{white-space:nowrap}
@media (max-width:420px){.nav .np{display:none}}
.nav .links{display:flex;gap:6px;align-items:center}
.nav .links a{text-decoration:none;font-size:14px;padding:10px 14px;border-radius:999px;min-height:40px;display:inline-flex;align-items:center}
.nav .links a.small{opacity:.8}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 26px;border-radius:999px;font-weight:600;font-size:16px;text-decoration:none;transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
.btn.amber{%(btn)s}
.btn.ghost{color:var(--text)}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center;padding:72px 0 40px}
.pill{display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;font-size:14px;letter-spacing:.02em}
.dot{width:8px;height:8px;border-radius:50%%;background:%(dot)s;box-shadow:0 0 12px %(dot)s}
h1{font-family:"%(serif)s",Georgia,serif;font-weight:%(hw)s;font-size:clamp(46px,7vw,86px);line-height:1.02;letter-spacing:-.01em;margin:22px 0 20px}
h1 em,h2 em{font-style:italic;color:var(--accent)}
.lead{font-size:clamp(17px,1.6vw,20px);opacity:.88;max-width:34em}
.ctas{display:flex;flex-wrap:wrap;gap:12px;margin:30px 0 16px}
.fine{font-size:14px;opacity:.7}
.stack{position:relative;aspect-ratio:1/1;max-width:540px;width:100%%;margin-left:auto}
.stack img{position:absolute;border-radius:6px;box-shadow:0 30px 70px rgba(0,0,0,.5),0 2px 6px rgba(0,0,0,.3)}
.stack .s1{width:62%%;left:4%%;top:4%%;transform:rotate(-4deg);z-index:2}
.stack .s2{width:40%%;right:2%%;top:14%%;transform:rotate(6deg);z-index:3}
.stack .s3{width:36%%;right:12%%;bottom:2%%;transform:rotate(-2deg);z-index:1;opacity:.92}
section{padding:56px 0}
h2{font-family:"%(serif)s",Georgia,serif;font-weight:%(hw)s;font-size:clamp(32px,4.2vw,50px);line-height:1.1;text-align:center;margin-bottom:34px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.card{border-radius:26px;padding:18px 18px 24px}
.card .frame{aspect-ratio:4/5;border-radius:18px;background:rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;padding:22px;margin-bottom:18px}
.card .frame img{max-width:100%%;max-height:100%%;border-radius:4px;box-shadow:0 16px 40px rgba(0,0,0,.45)}
.card h3{font-family:"%(serif)s",Georgia,serif;font-weight:%(hw)s;font-size:24px;margin-bottom:6px}
.card p{opacity:.82;font-size:15.5px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;counter-reset:s}
.step{border-radius:24px;padding:26px}
.step b{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);margin-bottom:14px;font-size:15px}
.step h3{font-size:18px;font-weight:600;margin-bottom:6px}
.step p{opacity:.8;font-size:15.5px}
.marq{margin:26px calc(50%% - 50vw) 0;overflow:hidden;padding:10px 0;-webkit-mask:linear-gradient(90deg,transparent,#000 12%%,#000 88%%,transparent);mask:linear-gradient(90deg,transparent,#000 12%%,#000 88%%,transparent)}
.marq>div{display:flex;align-items:center;gap:28px;width:max-content;animation:marq 38s linear infinite;font-family:"%(serif)s",Georgia,serif;font-style:italic;font-weight:%(hw)s;font-size:clamp(26px,5vw,54px);white-space:nowrap;opacity:.5}
.marq i{width:9px;height:9px;border-radius:50%%;background:var(--accent);box-shadow:0 0 14px var(--accent);flex:none}
@keyframes marq{to{transform:translateX(calc(-50%% - 14px))}}
.final{border-radius:32px;padding:46px 26px;text-align:center}
.final h2{margin-bottom:12px}
.final .ctas{justify-content:center}
.final .fine a{text-decoration:underline}
.hfoot{max-width:1160px;margin:30px auto 0;padding:40px 22px 50px;border-top:1px solid rgba(255,255,255,.14);display:grid;gap:14px;font-size:14px}
.hfoot p{opacity:.75}
.hfoot nav{display:flex;flex-wrap:wrap;gap:6px 18px}
.hfoot nav a{opacity:.85;min-height:32px;display:inline-flex;align-items:center}
.hfoot small{opacity:.55}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (max-width:860px){
 .hero{grid-template-columns:1fr;padding:40px 0 10px;gap:28px}
 .stack{margin:0 auto;max-width:420px}
 .grid,.steps{grid-template-columns:1fr}
 .card .frame{aspect-ratio:5/4}
 .nav .links a.small{display:none}
 section{padding:40px 0}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn{transition:none}}
"""

def img(name, alt, style="", cls=""):
    c = f' class="{cls}"' if cls else ""
    st = f' style="{style}"' if style else ""
    a = e(alt) if alt else ""
    hidden = '' if alt else ' aria-hidden="true"'
    return f'<img{c} src="img/holiday/pages/{name}.jpg" alt="{a}"{hidden}{st}>'

def build(s):
    c = cols[s["id"]]
    price, checkout = c["price"], c["checkout"]
    assert checkout.startswith("https://payhip.com/"), checkout
    url = f'{SITE}/{s["slug"]}.html'
    css = CSS % dict(vars=s["vars"], bg=s["bg"], grain=s["grain"], btn=s["btn"], serif=s["serif"],
                     dot=s.get("dot", "var(--accent)"), hw=300 if s["serif"] == "InterL" else 400)
    layer_cls, layer_html = s["layer"]
    hero = "".join(img(n, a, st, f"s{i+1}") for i, (n, a, st) in enumerate(s["hero"]))
    pieces = "".join(f'<article class="card glass"><div class="frame">{img(n, t + " - " + s["alt"], st)}</div><h3>{e(t)}</h3><p>{e(p)}</p></article>'
                     for n, st, t, p in s["pieces"])
    ld = {"@context": "https://schema.org", "@type": "Product", "name": f'{c["name"]} - {c["season"]} memorial printables',
          "description": s["desc"], "image": f'{SITE}/img/holiday/pages/{s["pieces"][0][0]}.jpg', "brand": {"@type": "Brand", "name": "Forever Held"},
          "offers": {"@type": "Offer", "price": price.lstrip("$"), "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": checkout}}
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(s["title"])} · Forever Held</title>
<meta name="description" content="{e(s["desc"])}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{e(s["title"])}">
<meta property="og:description" content="{e(s["desc"])}">
<meta property="og:image" content="{SITE}/img/holiday/{ {"evergreen-candlelight": "evergreen"}.get(s["slug"], s["slug"]) }-1.jpg">
<meta property="og:url" content="{url}">
<meta name="theme-color" content="{s["theme"]}">
<link rel="icon" href="brand/mark.svg" type="image/svg+xml">
<style>
{font_faces(s)}
{css}</style>
<script type="application/ld+json">{json.dumps(ld)}</script>
</head>
<body>
<div class="bg" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div><div class="{layer_cls}" aria-hidden="true">{layer_html}</div>
<nav class="nav glass" aria-label="Main">
  <div class="fh-navl">{SC.MENU_BTN}<a class="brand" href="./"><img src="brand/mark.svg" alt="">Forever Held</a></div>
  <div class="links">{SC.SEARCH_BTN}<a class="btn amber" style="min-height:40px;padding:0 18px;font-size:14px" href="{checkout}">Get it<span class="np"> · {price}</span></a></div>
</nav>
<main class="wrap">
  <header class="hero">
    <div>
      <span class="pill glass"><span class="dot"></span>{e(s["eyebrow"])}</span>
      <h1>{s["h1"]}</h1>
      <p class="lead">{e(s["lead"])}</p>
      <div class="ctas"><a class="btn amber" href="{checkout}">Get the set · {price}</a><a class="btn ghost glass" href="#inside">See what's inside</a></div>
      <p class="fine">Instant download · type in names on your phone · print tonight</p>
    </div>
    <div class="stack">{hero}</div>
  </header>
  <div class="marq" aria-hidden="true"><div>{("<span>" + "</span><i></i><span>".join(MARQ) + "</span><i></i>") * 2}</div></div>
  <section id="inside" aria-labelledby="inside-h">
    <h2 id="inside-h">{e(s["h2"])}</h2>
    <div class="grid">{pieces}</div>
  </section>
  <section aria-labelledby="how-h">
    <h2 id="how-h">{e(s["steps_h"])}</h2>
    <div class="steps">
      <div class="step glass"><b>1</b><h3>Download</h3><p>Your files arrive right after checkout, plus a Start Here guide.</p></div>
      <div class="step glass"><b>2</b><h3>Type in their name</h3><p>Open each file in the free Adobe Acrobat Reader app on your phone or computer and tap to type.</p></div>
      <div class="step glass"><b>3</b><h3>Print</h3><p>{e(s["print_line"])} Staples, Office Depot and FedEx Office all print PDFs.</p></div>
    </div>
  </section>
  <section aria-labelledby="final-h">
    <div class="final glass">
      <h2 id="final-h">{e(c["name"])}</h2>
      <p class="lead" style="margin:0 auto">{e(s["desc"].split(". Fill in")[0].split(". Faith")[0])}.</p>
      <div class="ctas"><a class="btn amber" href="{checkout}">Get the set · {price}</a></div>
      <p class="fine">Not ready yet? <a href="{CHECKLIST}">Get our free planning checklist</a>. Questions? <a href="contact.html">Message us</a> and a real person will help.</p>
    </div>
  </section>
</main>
{FOOT}
</body>
</html>
'''
    (STORE / f'{s["slug"]}.html').write_text(SC.install(html))
    print("wrote", s["slug"] + ".html", len(html) // 1024, "KB")

for s in SETS:
    build(s)
SC.thumbs()
print("search index:", SC.build_index(), "entries")
