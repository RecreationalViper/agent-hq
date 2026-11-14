"""Shared store "chrome" for every Forever Held page: the menu (3-line) button + side drawer, the search
button + search panel, and the assistant chat. Used by tools/store-pages.py (home + inner pages + guides)
and tools/holiday-pages.py. Styles: store/chrome.css. Behaviour: store/js/site.js.
build_index() writes store/search.json, which powers both the site search and the chat assistant's
knowledge (the Worker's POST /chat reads it). Re-run either generator after changing products or pages."""
import json, re, datetime, html as H
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "store"
CHECKLIST = "https://payhip.com/b/eYJqS"
TODAY = datetime.date.today().isoformat()

HEAD = '<link rel="stylesheet" href="chrome.css">\n<link rel="stylesheet" href="motion.css">\n<script src="js/pre.js"></script>\n<script src="js/motion.js" defer></script>\n<script src="js/site.js" defer></script>\n'

I_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
I_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
I_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
I_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4v-14z"/></svg>'
I_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'

MENU_BTN = f'<button class="fh-icon" type="button" data-fh-menu aria-label="Menu" aria-controls="fh-drawer" aria-expanded="false">{I_MENU}</button>'
SEARCH_BTN = f'<button class="fh-icon" type="button" data-fh-search aria-label="Search the store" aria-controls="fh-search" aria-expanded="false">{I_SEARCH}</button>'

# Product pages: collection id -> (page, short label, thumbnail)
PAGES = {
    "holiday-2026-C": ("harvest-table.html", "Thanksgiving", "img/thumbs/harvest-table.jpg"),
    "holiday-2026-A": ("evergreen-candlelight.html", "Christmas", "img/thumbs/evergreen.jpg"),
    "holiday-2026-B": ("longest-night.html", "Blue Christmas service", "img/thumbs/longest-night.jpg"),
}
SOFT = {"name": "Soft Botanical suite", "label": "Funeral & celebration of life", "price": "$12.99", "url": "index.html#suite", "thumb": "img/thumbs/soft-botanical.jpg"}


def collections():
    return json.loads((ROOT / "products/collections.json").read_text())["collections"]


def holiday_products():
    """Live holiday sets still in season (dropped from the menu after marketUntil), soonest holiday first."""
    out = []
    for c in collections():
        if c["id"] in PAGES and c.get("status") == "approved" and str(c.get("checkout", "")).startswith("https://payhip.com/") and TODAY <= c.get("marketUntil", "9999"):
            page, label, thumb = PAGES[c["id"]]
            out.append({"name": c["name"], "label": label, "price": c["price"], "url": page, "thumb": thumb, "until": c.get("marketUntil", ""), "c": c})
    return sorted(out, key=lambda p: p["until"])


def _item(p, h):
    url = p["url"] if h or not p["url"].startswith("index.html") else p["url"][len("index.html"):]
    return (f'<a class="fh-prod" href="{url}"><img src="{p["thumb"]}" alt="" loading="lazy" width="48" height="60">'
            f'<span><b>{H.escape(p["name"])}</b><small>{H.escape(p["label"])} · {p["price"]}</small></span></a>')


def chrome(home=False):
    """Drawer + search panel + chat, placed right after <body>. home=True on index.html (links stay on the page)."""
    h = "" if home else "index.html"
    hol = "".join(_item(p, h) for p in holiday_products())
    link = lambda href, text: f'<a href="{href}">{text}</a>'
    return f'''<!--fh-chrome-->
<div class="fh-aura" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="fh-scrim" data-fh-close hidden></div>
<aside class="fh-drawer" id="fh-drawer" aria-label="Menu" hidden>
  <div class="fh-dhead"><a class="fh-brand" href="{h or '#top'}"><img src="brand/mark.svg" alt="">Forever Held</a><button class="fh-icon" type="button" data-fh-close aria-label="Close menu">{I_CLOSE}</button></div>
  <button class="fh-dsearch" type="button" data-fh-search>{I_SEARCH}<span>Search products and help</span></button>
  <nav class="fh-dnav" aria-label="Store">
    {f'<p class="fh-label">Holiday 2026</p>{hol}' if hol else ''}
    <p class="fh-label">Memorial suites</p>{_item(SOFT, h)}
    <a class="fh-free" href="{CHECKLIST}">Free planning checklist <small>Printable, sent to your email</small></a>
    <details class="fh-acc" open><summary>Help</summary>
      {link(f"{h}#how", "How it works")}{link("guides.html", "Planning guides")}{link(f"{h}#faq-title", "Questions families ask")}<button type="button" data-fh-chat>Ask our assistant</button>{link("contact.html", "Contact us")}
    </details>
    <details class="fh-acc"><summary>About &amp; policies</summary>
      {link("about.html", "About Forever Held")}{link("terms.html", "Terms of sale")}{link("refunds.html", "Refund policy")}{link("privacy.html", "Privacy policy")}{link("accessibility.html", "Accessibility")}
    </details>
  </nav>
  <p class="fh-dfoot">Instant download · Secure checkout by Payhip</p>
</aside>
<div class="fh-search" id="fh-search" role="dialog" aria-modal="true" aria-label="Search the store" hidden>
  <div class="fh-sbox">
    <form class="fh-sform" role="search" action="#">{I_SEARCH}<input type="search" name="q" placeholder="Search programs, signs, holidays, help…" aria-label="Search" autocomplete="off" enterkeyhint="search"><button class="fh-icon" type="button" data-fh-close aria-label="Close search">{I_CLOSE}</button></form>
    <div class="fh-results" aria-live="polite"></div>
  </div>
</div>
<button class="fh-chatbtn" type="button" data-fh-chat aria-label="Ask the Forever Held assistant"><span class="fh-orb" aria-hidden="true"></span><span>Ask us</span></button>
<section class="fh-chat" id="fh-chat" role="dialog" aria-label="Forever Held assistant" hidden>
  <header><span class="fh-orb" aria-hidden="true"></span><div class="fh-who"><b>Forever Held assistant</b><small>Automated answers, any time. A real person replies via <a href="contact.html">Contact us</a>.</small></div><button class="fh-icon" type="button" data-fh-close aria-label="Close chat">{I_CLOSE}</button></header>
  <div class="fh-log" aria-live="polite"></div>
  <form class="fh-cform"><textarea name="m" rows="1" maxlength="1200" placeholder="Ask a question…" aria-label="Your question"></textarea><button type="submit" aria-label="Send">{I_SEND}</button></form>
</section>
<!--/fh-chrome-->
'''


def strip_chrome(s):
    return re.sub(r"<!--fh-chrome-->.*?<!--/fh-chrome-->\n?", "", s, flags=re.S)


def install(s, home=False):
    """Put the chrome into a full page's HTML (idempotent): head links + drawer/search/chat after <body>."""
    s = strip_chrome(s)
    s = s.replace(HEAD, "").replace('<link rel="stylesheet" href="chrome.css">\n<script src="js/site.js" defer></script>\n', "")
    s = s.replace("</head>", HEAD + "</head>", 1)
    s = re.sub(r"(<body[^>]*>\n?)", lambda m: m.group(1) + chrome(home), s, count=1)
    return s


# ---------------- search.json ----------------
def _text(html):
    html = strip_chrome(html)
    html = re.sub(r"<(script|style|nav|footer|svg|head)\b.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", H.unescape(html)).strip()


def _meta(html, name):
    m = re.search(rf'<meta name="{name}" content="([^"]*)"', html)
    return H.unescape(m.group(1)) if m else ""


def _title(html):
    m = re.search(r"<title>(.*?)</title>", html, re.S)
    return re.sub(r"\s*·\s*Forever Held\s*$", "", H.unescape(m.group(1)).strip()) if m else ""


def build_index():
    items = []
    # products
    for p in holiday_products():
        c = p["c"]
        text = (f'{c["name"]} ({c["season"]}), {c["price"]}, instant download. Pieces: ' + "; ".join(c.get("pieces", [])) +
                f'. {c.get("delivery", "")}. Buy: {c["checkout"]}. Who it is for: {c.get("audience", "")}. Look: {c.get("look", "")}.')
        items.append({"group": "Products", "title": f'{c["name"]} · {p["label"]} set', "url": p["url"], "desc": f'{p["label"]} memorial printables · {c["price"]}', "img": p["thumb"], "text": text})
    idx = strip_chrome((STORE / "index.html").read_text())
    suite = re.search(r'<section class="suite.*?</section>', idx, re.S)
    items.append({"group": "Products", "title": "Soft Botanical Celebration of Life Suite", "url": "index.html#suite", "desc": "Funeral program, welcome sign and memory cards · $12.99", "img": SOFT["thumb"],
                  "text": "Soft Botanical Celebration of Life Suite, $12.99, instant download, buy: https://payhip.com/b/vqNSA. " + (_text(suite.group(0)) if suite else "")})
    items.append({"group": "Products", "title": "Free planning checklist", "url": CHECKLIST, "desc": "Free printable checklist, sent to your email", "img": "",
                  "text": "A free printable funeral and celebration of life planning checklist. Get it at https://payhip.com/b/eYJqS; it also signs you up for gentle seasonal updates."})
    # FAQ on the home page
    for q, a in re.findall(r'<details class="glass"><summary>([^<]*)</summary><p>(.*?)</p></details>', idx, re.S):
        items.append({"group": "Questions", "title": H.unescape(re.sub(r"<[^>]+>", "", q)), "url": "index.html#faq-title", "desc": H.unescape(re.sub(r"<[^>]+>", "", a))[:140], "text": H.unescape(re.sub(r"<[^>]+>", "", a))})
    for anchor, title, desc in [("how", "How it works", "From checkout to printed in an evening"), ("holiday", "Holiday sets", "For the first holidays without them")]:
        sec = re.search(rf'<section[^>]*id="{anchor}".*?</section>', idx, re.S)
        items.append({"group": "Pages", "title": title, "url": f"index.html#{anchor}", "desc": desc, "text": _text(sec.group(0)) if sec else ""})
    # guides + pages
    guides = {json.loads(f.read_text())["slug"] for f in (STORE / "content/pages").glob("*.json")}
    skip = {"index", "harvest-table", "evergreen-candlelight", "longest-night"}
    for f in sorted(STORE.glob("*.html")):
        if f.stem in skip or f.stem.startswith("google"):
            continue
        html = f.read_text()
        items.append({"group": "Guides" if f.stem in guides else "Pages", "title": _title(html), "url": f.name, "desc": _meta(html, "description"), "text": _text(html)[:5000]})
    (STORE / "search.json").write_text(json.dumps({"updated": TODAY, "items": items}, ensure_ascii=False, separators=(",", ":")))
    return len(items)


def thumbs():
    """Small product thumbnails for the menu and search (48x60 shown, 2x for sharp phones)."""
    out = STORE / "img/thumbs"
    out.mkdir(exist_ok=True)
    for src, name in [("img/holiday/pages/h-sign.jpg", "harvest-table"), ("img/holiday/pages/e-sign.jpg", "evergreen"), ("img/holiday/pages/l-sign.jpg", "longest-night"), ("img/program-cover.png", "soft-botanical")]:
        dst = out / f"{name}.jpg"
        if dst.exists():
            continue
        from PIL import Image  # only needed when a thumbnail is missing
        im = Image.open(STORE / src).convert("RGB")
        w, h = im.size
        tw = min(w, int(h * 0.8))  # crop to 4:5
        im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, int(tw * 1.25) if int(tw * 1.25) <= h else h)).resize((96, 120), Image.LANCZOS)
        im.save(dst, quality=85, optimize=True)
