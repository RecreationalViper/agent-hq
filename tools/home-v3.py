"""Builds the v3 "candlelit night" home page. Styles: store/v3.css, code: store/js/v3.js.
Usage: python3 tools/home-v3.py [file]     -> store/index.html (the live home page); store-pages.py runs this
Uses the shared menu/search/assistant from tools/site_chrome.py and prices from products/collections.json."""
import sys, html as H
from pathlib import Path
import site_chrome as SC

STORE = SC.STORE
SOFT_BUY = "https://payhip.com/b/vqNSA"
# The featured (hero) product: A Life, read from products/collections.json so price/link stay true.
_ev = {p["c"]["id"]: p["c"] for p in SC.evergreen_products()}
LIFE, TONIGHT = _ev.get("a-life"), _ev.get("a-life-tonight")
MAIN_BUY = LIFE["checkout"] if LIFE else SOFT_BUY
MAIN_CTA = f'Get A Life · {LIFE["price"]}' if LIFE else "Get the suite · $12.99"
A = "img/a-life/pieces/"
hol = {p["url"]: p for p in SC.holiday_products()}
price = lambda page, fallback: hol[page]["price"] if page in hol else fallback
P = "img/holiday/pages/"

SETS = [  # name, label, kinds, tint, link, price, (back-left, back-right, front), alt
    *([("A Life", "Funeral & celebration of life", "funeral", "#3a2f2a", "try-a-life.html", LIFE["price"], (A + "sign.jpg", A + "card.jpg", A + "cover.jpg"), "A Life magazine-style memorial suite: program cover, welcome sign and memory card")] if LIFE else []),
    *([("A Life Tonight Kit", "Program, sign & card tonight", "funeral", "#2e2a26", "try-a-life.html#tonight", TONIGHT["price"], (A + "sign8x10.jpg", A + "card.jpg", A + "onepage.jpg"), "A Life Tonight Kit: one-page program, 8 x 10 welcome sign and memory card")] if TONIGHT else []),
    ("Soft Botanical", "Funeral & celebration of life", "funeral", "#414c39", SOFT_BUY, "$12.99", ("img/welcome-sign.png", "img/memory-card.png", "img/program-cover.png"), "Soft Botanical suite: funeral program, welcome sign and memory card"),
    ("Harvest Table", "Thanksgiving", "holiday", "#5e3718", "harvest-table.html", price("harvest-table.html", "$7.99"), (P + "h-card.jpg", P + "h-place.jpg", P + "h-sign.jpg"), "Harvest Table Thanksgiving set: empty-chair sign, thankful cards, place cards"),
    ("Evergreen & Candlelight", "Christmas", "holiday", "#1f3d2c", "evergreen-candlelight.html", price("evergreen-candlelight.html", "$8.99"), (P + "e-card.jpg", P + "e-orn.jpg", P + "e-sign.jpg"), "Evergreen and Candlelight Christmas set: candle sign, memory cards, ornament cards"),
    ("Longest Night", "Blue Christmas service", "holiday church", "#2c3366", "longest-night.html", price("longest-night.html", "$9.99"), (P + "l-card.jpg", P + "l-prog1.jpg", P + "l-sign.jpg"), "Longest Night service set: program, table sign, candle-lighting cards"),
]
LOOKS = [  # key, name, dot color, stage color, link, price, (sign, pages, keepsake)
    *([("life", "A Life", "#8e2f25", "#2a2320", "try-a-life.html", LIFE["price"], (A + "sign.jpg", A + "story.jpg", A + "card.jpg"))] if LIFE else []),
    ("sage", "Soft Botanical", "#b9cba7", "#2c3527", SOFT_BUY, "$12.99", ("img/welcome-sign.png", "img/program-cover.png", "img/memory-card.png")),
    ("harvest", "Harvest Table", "#d8914f", "#3d2514", "harvest-table.html", price("harvest-table.html", "$7.99"), (P + "h-sign.jpg", P + "h-cards.jpg", P + "h-place.jpg")),
    ("pine", "Evergreen & Candlelight", "#3f7d5c", "#14281e", "evergreen-candlelight.html", price("evergreen-candlelight.html", "$8.99"), (P + "e-sign.jpg", P + "e-card.jpg", P + "e-orn.jpg")),
    ("dusk", "Longest Night", "#8a8fd0", "#1c2244", "longest-night.html", price("longest-night.html", "$9.99"), (P + "l-sign.jpg", P + "l-prog1.jpg", P + "l-card.jpg")),
]
ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

SETS = [x for x in SETS if not x[4].endswith(".html") or x[4].startswith("try-a-life") or x[4] in hol]

def cards():
    out = []
    for i, (name, label, kinds, tint, link, pr, (a, b, c), alt) in enumerate(SETS):
        out.append(f'''<a class="project-card" data-kind="{kinds}" data-reveal="{i % 2}" href="{link}">
  <div class="project-art" style="--tint:{tint}"><img class="project-sculpture a" src="{a}" alt="" loading="lazy"><img class="project-sculpture b" src="{b}" alt="" loading="lazy"><img class="project-sculpture c" src="{c}" alt="{H.escape(alt)}" loading="lazy"></div>
  <div class="project-meta"><div><small>{H.escape(label)} · 0{i + 1}</small><h3>{H.escape(name)}</h3></div><span class="go">{pr}<i>{ARROW}</i></span></div>
</a>''')
    return "\n".join(out)

def looks():
    imgs = "".join(f'<img data-look="{k}" data-step="{s}" src="{src}" alt="" loading="lazy">' for k, *_r, pieces in LOOKS for s, src in enumerate(pieces))
    btns = "".join(f'<button type="button" aria-pressed="false" data-look="{k}" data-name="{H.escape(n)}" data-bg="{bg}" data-href="{href}" data-price="{pr}" style="--c:{dot}" aria-label="{H.escape(n)}"><i></i><span>{H.escape(n if n == "A Life" else n.split(" ")[0])}</span></button>' for k, n, dot, bg, href, pr, _p in LOOKS)
    return imgs, btns

# isometric sheet figures: P(u,v) = O + u*U + v*V
O, U, V = (10, 62), (90, -42), (90, 42)
pt = lambda u, v: (O[0] + u * U[0] + v * V[0], O[1] + u * U[1] + v * V[1])
SHEET = "M%s %s L%s %s L%s %s L%s %sZ" % (*pt(0, 0), *pt(1, 0), *pt(1, 1), *pt(0, 1))
line = lambda u1, u2, v, cls="": '<path %sd="M%.1f %.1f L%.1f %.1f"/>' % (f'class="{cls}" ' if cls else "", *pt(u1, v), *pt(u2, v))
def ring(u, v, r, cls=""):
    import math
    pts = [pt(u + math.cos(a / 12 * math.pi) * r, v + math.sin(a / 12 * math.pi) * r) for a in range(24)]
    return '<path %sd="M%sZ"/>' % (f'class="{cls}" ' if cls else "", " L".join("%.1f %.1f" % p for p in pts))
def fig(layers):
    n = len(layers)
    return '<svg viewBox="0 -14 200 150" aria-hidden="true">' + "".join(f'<g class="figure-layer"><g transform="translate(0 {(n - 1 - i) * 13})"><path class="sheet" d="{SHEET}"/>{body}</g></g>' for i, body in enumerate(layers)) + "</svg>"
FIG1 = fig(["", line(.2, .8, .3) + line(.2, .8, .45) + line(.2, .6, .6), line(.2, .62, .3, "hot") + '<circle class="hotf" cx="%.1f" cy="%.1f" r="2.4"/>' % pt(.66, .3) + line(.2, .8, .5) + line(.2, .5, .68)])
FIG2 = fig([line(.15, .85, .5), line(.15, .85, .35) + line(.15, .85, .65), '<path class="hot" d="M%s %s L%s %s L%s %s L%s %sZ"/>' % (*pt(.1, .1), *pt(.9, .1), *pt(.9, .9), *pt(.1, .9)) + line(.25, .75, .5)])
FIG3 = fig(["", ring(.5, .5, .3), ring(.5, .42, .2, "hot") + line(.3, .7, .78) + '<circle class="hotf" cx="%.1f" cy="%.1f" r="2.4"/>' % pt(.5, .42)])

NUMW = {2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven"}
IMGS, BTNS = looks()
PAGE = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="p:domain_verify" content="8acdd87413202b93720b2631d7974500"/>
<link rel="canonical" href="https://foreverheld.pages.dev/">
<meta property="og:title" content="Forever Held · Memorial printables">
<meta property="og:description" content="Funeral programs, welcome signs, memory cards and holiday remembrance sets you fill in on your phone and print today.">
<meta property="og:image" content="https://foreverheld.pages.dev/video/forever-held-poster.jpg">
<meta property="og:url" content="https://foreverheld.pages.dev/">
<title>Forever Held · Memorial printables</title>
<meta name="description" content="Gentle memorial printables you type into on your phone and print today: funeral programs, welcome signs, memory cards and holiday remembrance sets.">
<meta name="theme-color" content="#10110f">
<link rel="icon" href="brand/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="v3.css">
<script src="js/v3.js" defer></script>
</head>
<body class="v3">
<div class="veil" aria-hidden="true"><div><img src="brand/mark.svg" alt="">Forever Held<i></i></div></div>
<div class="grain" aria-hidden="true"></div><div class="vignette" aria-hidden="true"></div>
<nav class="nav" aria-label="Main">
  <div class="fh-navl">{SC.MENU_BTN}<a class="brand" href="#top"><img src="brand/mark.svg" alt="">Forever Held</a></div>
  <div class="navr">{SC.SEARCH_BTN}<span class="kbd" aria-hidden="true">⌘ K</span><a class="btn amber sm" href="#collections">Shop</a></div>
</nav>
<nav class="chapter-nav" aria-label="Sections"><a href="#top"><span>Welcome</span>01</a><a href="#promise"><span>Our promise</span>02</a><a href="#how"><span>How it works</span>03</a><a href="#collections"><span>Collections</span>04</a><a href="#looks"><span>Every look</span>05</a><a href="#details"><span>Details</span>06</a><a href="#faq"><span>Questions</span>07</a></nav>
<button class="motion-toggle" type="button" aria-pressed="true" aria-label="Turn animation on or off"><i></i><span>Motion on</span></button>

<main>
<header class="hero" id="top">
  <div class="hero-grid" aria-hidden="true"></div><canvas id="sculpture" aria-hidden="true"></canvas><div class="hero-shade" aria-hidden="true"></div>
  <div class="hero-content">
    <p class="crumb"><b>✳</b> Forever Held / 01 <span>Memorial printables</span></p>
    <h1>Everything for the service, <em>ready tonight.</em></h1>
    <p class="lead">Funeral programs, welcome signs and memory cards you fill in on your phone and print today. Nothing to ship. Nothing to learn.</p>
    <div class="ctas"><a class="btn amber" href="{MAIN_BUY}">{MAIN_CTA}</a><a class="btn" href="try-a-life.html">Try it free with their name</a></div>
    {f'<p class="lead" style="font-size:15px;margin-top:14px">New: <a href="try-a-life.html" style="color:inherit">A Life</a>, the memorial program made like a magazine. Need it tonight? <a href="try-a-life.html#tonight" style="color:inherit">Tonight Kit · {TONIGHT["price"]}</a></p>' if LIFE and TONIGHT else ''}
    <div class="composer">
      <p class="tag"><span class="fh-orb" aria-hidden="true"></span>Ask our assistant anything</p>
      <form><textarea rows="1" maxlength="600" aria-label="Ask our assistant a question" placeholder="Ask a question…"></textarea><button type="submit" aria-label="Ask">{ARROW}</button></form>
      <div class="hints"><button type="button">What goes in a funeral program?</button><button type="button">Help me write a short eulogy</button><button type="button">Burial or cremation?</button><button type="button">What is a Blue Christmas service?</button></div>
    </div>
  </div>
  <span class="scrollcue" aria-hidden="true">Scroll</span>
</header>

<section class="manifesto" id="promise"><div class="wrap">
  <p class="crumb"><b>✳</b> Forever Held / 02 <span>Our promise</span></p>
  <p class="big">When someone you love dies, there is so much to do and so little time. We make the paper part <em>simple and beautiful:</em> keepsakes you fill in on your phone and print tonight, so you can be with the people who need you.</p>
</div></section>

<section class="assembly" id="how" aria-labelledby="how-h"><div class="assembly-sticky">
  <div class="assembly-top"><div class="wrap"><p class="crumb"><b>✳</b> Forever Held / 03 <span>How it works</span></p><h2 id="how-h">From checkout to printed <em>in an evening.</em></h2></div></div>
  <div class="assembly-scene">
    <canvas id="assembly-canvas" aria-hidden="true"></canvas>
    <img class="assembly-side l" src="img/program-cover.png" alt="" loading="lazy"><img class="assembly-side r" src="img/memory-card.png" alt="" loading="lazy">
    <div class="assembly-page"><img src="img/welcome-sign.png" alt="Soft Botanical welcome sign"></div>
    <p class="assembly-type" aria-hidden="true"><small>Tap, then type</small><span data-text="Eleanor Grace Whitmore"></span></p>
  </div>
  <div class="assembly-footer"><div class="wrap"><div class="chapters">
    <div class="on"><b>01</b><strong>Download</strong><p>Your files arrive the moment you check out, with a short Start Here guide.</p></div>
    <div><b>02</b><strong>Make it theirs</strong><p>Open each file in the free Adobe Acrobat Reader app and type their name, dates and story.</p></div>
    <div><b>03</b><strong>Print</strong><p>At home on cardstock, or the same day at Staples, Office Depot or FedEx Office.</p></div>
  </div></div></div>
</div></section>

<section class="block" id="collections" aria-labelledby="col-h"><span id="suite"></span><span id="holiday"></span><div class="wrap">
  <div class="sec-head"><p class="crumb"><b>✳</b> Forever Held / 04 <span>Collections</span></p><h2 id="col-h">Made for the days <em>that matter most.</em></h2>
    <div class="filters" role="group" aria-label="Filter collections"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="funeral" aria-pressed="false">Funeral</button><button type="button" data-filter="holiday" aria-pressed="false">Holiday</button><button type="button" data-filter="church" aria-pressed="false">Church service</button></div></div>
  <div class="projects">
{cards()}
  </div>
</div></section>

<section class="block" id="looks" aria-labelledby="looks-h"><div class="wrap">
  <div class="sec-head"><p class="crumb"><b>✳</b> Forever Held / 05 <span>Every look</span></p><h2 id="looks-h">Three kinds of keepsake, <em>{NUMW.get(len(LOOKS), str(len(LOOKS)))} looks.</em></h2></div>
  <div class="story">
    <div class="story-steps">
      <div class="on"><b>01 / SIGN</b><h3>A sign that says their name</h3><p>Welcome signs and table signs, from 8 × 10 in up to 24 × 36 in. Type the name, the dates and your own words.</p></div>
      <div><b>02 / PAGES</b><h3>Pages that carry the day</h3><p>Programs and cards for the order of service, the story of their life, and what everyone wants to say.</p></div>
      <div><b>03 / KEEPSAKE</b><h3>Something small to keep</h3><p>Memory cards, place cards and ornaments that guests take home or leave with the family.</p></div>
    </div>
    <div class="editor-wrap"><div class="editor-bar"><span></span><a href="#"></a></div><div class="editor-stage">{IMGS}</div><div class="palette" role="group" aria-label="Choose a look">{BTNS}</div></div>
  </div>
</div></section>

<section class="block" id="details" aria-labelledby="det-h"><div class="wrap">
  <div class="sec-head"><p class="crumb"><b>✳</b> Forever Held / 06 <span>Details</span></p><h2 id="det-h">Simple on purpose.</h2></div>
  <div class="features">
    <article class="feature" data-reveal="0"><p class="fig"><span>FIG 01</span><span>FILL IN</span></p>{FIG1}<h3>Type on your phone</h3><p>Fill-in PDFs open in the free Adobe Acrobat Reader app. No design skills, no account, no subscription.</p></article>
    <article class="feature" data-reveal="1"><p class="fig"><span>FIG 02</span><span>PRINT</span></p>{FIG2}<h3>Print anywhere</h3><p>US Letter at home, or any print shop the same day. Multi-copy sheets and fold lines are already set up.</p></article>
    <article class="feature" data-reveal="2"><p class="fig"><span>FIG 03</span><span>KEEP</span></p>{FIG3}<h3>Yours to keep</h3><p>Print as many copies as your family needs. A real person answers if you get stuck.</p></article>
  </div>
  <div class="film" data-reveal="0" style="margin-top:18px"><video src="video/forever-held-film.mp4" poster="video/forever-held-poster.jpg" autoplay muted loop playsinline preload="metadata" aria-label="A 20-second film showing the Soft Botanical program, welcome sign and memory cards"></video></div>
</div></section>

<section class="block" id="faq" aria-labelledby="faq-title"><div class="wrap">
  <div class="sec-head"><p class="crumb"><b>✳</b> Forever Held / 07 <span>Questions</span></p><h2 id="faq-title">Questions families ask.</h2></div>
  <div class="faq">
    <details class="glass"><summary>Do I need any special software?</summary><p>No. The files are fill-in PDFs. Open them in the free Adobe Acrobat Reader app on a phone or computer and type over the sample wording.</p></details>
    <details class="glass"><summary>Can I add a photo?</summary><p>Yes, on a computer: open the program or sign in Adobe Acrobat Reader and click the circle in the tree to choose a photo. Without one, the circle prints as a soft sage frame.</p></details>
    <details class="glass"><summary>How quickly can I have it ready?</summary><p>Right away. You download the files at checkout, and most families finish editing in under an hour.</p></details>
    <details class="glass"><summary>Will anything be mailed to me?</summary><p>No. This is a digital download, so there's no shipping to wait for. You print it yourself or at a local print shop.</p></details>
    <details class="glass"><summary>Can a print shop print the welcome sign?</summary><p>Yes. Save your filled-in sign and ask for it to be printed at 24 × 36, 16 × 24 or 12 × 18 in and mounted on foam board, usually the same day.</p></details>
  </div>
  <p class="trust"><span>Instant download</span><span>Secure checkout by Payhip</span><span>Help from a real person</span><span><a href="refunds.html">Fair refund policy</a></span></p>
</div></section>

<section class="final" aria-labelledby="final-h"><div class="wrap">
  <h2 id="final-h">For the day <em>you say goodbye.</em></h2>
  <p class="lead">Not ready yet? Our free planning checklist walks you through it, one gentle step at a time.</p>
  <div class="ctas"><a class="btn amber" href="{MAIN_BUY}">{MAIN_CTA}</a><a class="btn" href="{SC.CHECKLIST}">Free planning checklist</a></div>
</div></section>
</main>

<footer class="v3f"><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="#top" style="color:var(--ink)"><img src="brand/mark.svg" alt="">Forever Held</a><p style="margin-top:12px;max-width:24em">Printable keepsakes for families saying goodbye. Previews show the real files you receive.</p></div>
    <div><h4>Shop</h4>{'<a href="try-a-life.html">A Life</a><a href="try-a-life.html#tonight">A Life Tonight Kit</a>' if LIFE else ''}<a href="{SOFT_BUY}">Soft Botanical suite</a><a href="harvest-table.html">Harvest Table</a><a href="evergreen-candlelight.html">Evergreen &amp; Candlelight</a><a href="longest-night.html">Longest Night</a><a href="{SC.CHECKLIST}">Free planning checklist</a></div>
    <div><h4>Help</h4><a href="guides.html">Planning guides</a><a href="contact.html">Contact us</a><a href="about.html">About us</a><a href="terms.html">Terms of sale</a><a href="refunds.html">Refund policy</a><a href="privacy.html">Privacy policy</a><a href="accessibility.html">Accessibility</a></div>
  </div>
  <p class="legal"><span>© 2026 Forever Held</span><span>Secure checkout by Payhip</span></p>
</div></footer>
</body>
</html>
'''
out = STORE / (sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = SC.install(PAGE, home=True)
# v3.css must come after the shared chrome styles so its dark-glass overrides win
html = html.replace('<link rel="stylesheet" href="v3.css">\n', "").replace('<link rel="stylesheet" href="motion.css">\n', '<link rel="stylesheet" href="motion.css">\n<link rel="stylesheet" href="v3.css">\n')
out.write_text(html)
print("wrote", out.name, len(html) // 1024, "KB")
