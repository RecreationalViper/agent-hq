"""Builds the Forever Held storefront's inner pages (contact, terms, refunds, privacy, about, accessibility)
and refreshes the shared nav + footer on store/index.html. Run: python3 tools/store-pages.py
Edit the CONTENT below, then re-run. Styles live in store/site.css. Rules: skills/web/SKILL.md."""
import re, pathlib, json, html as H

STORE = pathlib.Path(__file__).resolve().parent.parent / "store"
UPDATED = "November 12, 2026"
EMAIL = "foreverheld.shop@gmail.com"
KIT = "https://payhip.com/b/vqNSA"
CHECKLIST = "https://payhip.com/b/eYJqS"
CONTACT_API = "https://foreverheld-sales.foreverheld.workers.dev/contact"

GARDEN = re.search(r'<div class="garden".*?</div>\n', (STORE / "index.html").read_text(), re.S).group(0)

def nav(home=False):
    h = "" if home else "index.html"
    return f'''<nav class="nav glass" aria-label="Main">
  <a class="brand" href="{h or '#top'}"><img src="brand/mark.svg" alt="">Forever Held</a>
  <div class="navlinks"><a class="txt hide-sm" href="{h}#how">How it works</a><a class="txt" href="contact.html">Contact</a><a class="btn btn-sage" href="{h}#suite">Shop</a></div>
</nav>
'''

def footer(home=False):
    h = "" if home else "index.html"
    return f'''<footer>
  <div class="brand"><img src="brand/mark.svg" alt="">Forever Held</div>
  <p>Printable keepsakes for families saying goodbye.</p>
  <div class="foot-grid">
    <div><h3>Shop</h3><ul><li><a href="{h}#suite">Soft Botanical suite</a></li><li><a href="{CHECKLIST}">Free planning checklist</a></li><li><a href="{h}#watch-title">Watch the video</a></li></ul></div>
    <div><h3>Help</h3><ul><li><a href="{h}#how">How it works</a></li><li><a href="guides.html">Planning guides</a></li><li><a href="{h}#faq-title">Questions</a></li><li><a href="contact.html">Contact us</a></li></ul></div>
    <div><h3>Policies</h3><ul><li><a href="terms.html">Terms of sale</a></li><li><a href="refunds.html">Refund policy</a></li><li><a href="privacy.html">Privacy policy</a></li><li><a href="accessibility.html">Accessibility</a></li></ul></div>
    <div><h3>Forever Held</h3><ul><li><a href="about.html">About us</a></li><li><a href="mailto:{EMAIL}">Email us</a></li></ul></div>
  </div>
  <p class="foot-note">© 2026 Forever Held · Secure checkout by Payhip · Previews show the real files you receive.</p>
</footer>
'''


def contact_script():
    """Contact form code lives in js/contact.js (no inline scripts, so the Content-Security-Policy can block injected ones)."""
    (STORE / "js").mkdir(exist_ok=True)
    (STORE / "js" / "contact.js").write_text(f'''const f = document.querySelector("form.contact"), msg = f.querySelector(".form-msg"), btn = f.querySelector("button");
const show = (t, ok) => {{ msg.textContent = t; msg.className = "form-msg " + (ok ? "ok" : "err"); }};
f.addEventListener("submit", async (e) => {{
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  if (!d.name.trim() || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(d.email) || d.message.trim().length < 5) return show("Please add your name, a valid email and a message.", false);
  btn.disabled = true; btn.textContent = "Sending…";
  try {{
    const r = await fetch("{CONTACT_API}", {{ method: "POST", headers: {{ "content-type": "application/json" }}, body: JSON.stringify(d) }});
    const j = await r.json().catch(() => ({{}}));
    if (!r.ok || !j.ok) throw new Error(j.error || "failed");
    f.reset(); show("Thank you. Your message is on its way, and we'll reply to your email soon.", true);
  }} catch (err) {{ show("Sorry, that didn't send. Please email us at {EMAIL}.", false); }}
  btn.disabled = false; btn.textContent = "Send message";
}});
''')
    return '<script src="js/contact.js" defer></script>\n'

def page(slug, title, desc, body, script="", head_extra=""):
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · Forever Held</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#eef0e8">
<link rel="icon" href="brand/mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
<link rel="canonical" href="https://foreverheld.pages.dev/{slug}.html">
{head_extra}</head>
<body>
{GARDEN}{nav()}<main class="page" id="top">
{body}
</main>
{footer()}{script}</body>
</html>
'''
    (STORE / f"{slug}.html").write_text(html)

def legal(slug, title, desc, intro, sections):
    body = f'<header class="page-head"><h1>{title}</h1><p>{intro}</p><p class="updated">Last updated: {UPDATED}</p></header>\n<article class="panel glass legal">\n'
    body += "\n".join(f"<h2>{h}</h2>\n{c}" for h, c in sections) + "\n</article>"
    page(slug, title, desc, body)

# ---------------- Contact ----------------
page("contact", "Contact us", "Questions about your Forever Held order, editing or printing your memorial printables? Send us a message.", f'''<header class="page-head"><h1>We're here to help</h1><p>Questions about your order, editing your files or printing? Send us a message and a real person will reply, usually within one business day.</p></header>
<div class="cards">
  <a class="glass" href="#form"><b>Order or download</b><span>Your download link is in your receipt email from Payhip. Can't find it? Tell us the email you used.</span></a>
  <a class="glass" href="index.html#how"><b>Editing and printing</b><span>Fill in with the free Adobe Acrobat Reader app, then print at home or a print shop.</span></a>
  <a class="glass" href="#form"><b>Funeral homes and planners</b><span>Want to use our designs with families you serve? Ask about a professional license.</span></a>
</div>
<section class="panel glass" id="form" aria-labelledby="form-title">
  <h2 class="section-title" id="form-title" style="font-size:30px">Send a message</h2>
  <form class="contact" novalidate>
    <div class="row2">
      <div class="field"><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required maxlength="100"></div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="200"></div>
    </div>
    <div class="row2">
      <div class="field"><label for="topic">What's it about?</label><select id="topic" name="topic">
        <option>Order or download</option><option>Editing or printing help</option><option>Refund request</option><option>Funeral home or planner license</option><option>Something else</option></select></div>
      <div class="field"><label for="order">Order number <small>(optional)</small></label><input id="order" name="order" maxlength="60"></div>
    </div>
    <div class="field"><label for="message">Message</label><textarea id="message" name="message" required maxlength="3000"></textarea></div>
    <div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
    <p class="form-msg" role="status" aria-live="polite"></p>
    <div><button class="btn btn-sage" type="submit">Send message</button></div>
    <p class="field"><small>By sending, you agree we can use your details to reply. See our <a href="privacy.html">privacy policy</a>.</small></p>
  </form>
</section>
<section class="panel glass legal">
  <h2>Other ways to reach us</h2>
  <p>Email: <a href="mailto:{EMAIL}">{EMAIL}</a><br>We're an online-only shop, so there's no storefront to visit. Orders are processed securely by Payhip.</p>
  <h2>Before you write</h2>
  <ul><li><b>Didn't get your files?</b> Check your spam folder for the Payhip receipt; the download link is inside.</li>
  <li><b>Text won't change?</b> Open the file in Adobe Acrobat Reader, not your phone's built-in preview.</li>
  <li><b>Refunds:</b> see our <a href="refunds.html">refund policy</a>.</li></ul>
</section>''', script=contact_script())

# ---------------- Terms of sale ----------------
legal("terms", "Terms of sale", "Terms of sale and personal-use license for Forever Held printable downloads.",
 "The short version: you're buying digital files to fill in and print for your own family's memorial. Please don't resell or share the files.", [
 ("Who we are", f"<p>Forever Held (\"we\", \"us\") is an independent online shop selling printable, editable memorial keepsakes. You can reach us at <a href=\"mailto:{EMAIL}\">{EMAIL}</a> or through our <a href=\"contact.html\">contact page</a>. By buying from us or using this website, you agree to these terms.</p>"),
 ("What you're buying", "<p>Our products are digital files (fill-in PDFs). Nothing physical is shipped. Previews on this site show the real files; the names, dates and wording in them are samples for you to replace. Colors can look slightly different on screens and on different printers and papers.</p>"),
 ("Orders and payment", "<p>Checkout is handled by Payhip, which processes your payment securely; we never see or store your card details. Prices are in US dollars and may change, but the price you pay is the one shown at checkout. Any taxes are calculated at checkout.</p>"),
 ("Delivery", "<p>Your files are available to download right after payment, and Payhip also emails you a download link. If you don't receive it, check your spam folder or <a href=\"contact.html\">contact us</a> and we'll send it again.</p>"),
 ("Your personal-use license", """<p>When you buy, you get a personal, non-exclusive, non-transferable license. You may:</p>
<ul><li>Edit the files and print as many copies as you need for your own family's memorial, funeral or celebration of life.</li>
<li>Give printed copies to guests, and have a print shop print the files for you.</li>
<li>Share photos of the printed pieces, for example on social media.</li></ul>
<p>You may not:</p>
<ul><li>Resell, share, give away or upload the files (edited or not), or offer them as templates.</li>
<li>Use the designs to create products for sale, or claim the designs as your own.</li></ul>
<p>Funeral homes, planners and other businesses that want to use our designs with the families they serve need a professional license. <a href=\"contact.html\">Ask us</a>.</p>"""),
 ("Your edits", "<p>You're responsible for the text you add. Please proofread names, dates and spelling before printing; we can't be responsible for errors in edited files or for printing costs.</p>"),
 ("Ownership", "<p>The designs, artwork and text on this site and in our files belong to Forever Held and are protected by copyright. Buying a file gives you the license above, not ownership of the design.</p>"),
 ("Refunds", "<p>Please see our <a href=\"refunds.html\">refund policy</a>.</p>"),
 ("Limits of our responsibility", "<p>We work hard to make our files reliable, but they're provided as they are. To the extent the law allows, our total responsibility for any claim related to a purchase is limited to the amount you paid for it, and we aren't responsible for indirect losses. Nothing in these terms limits rights you have under consumer law that can't be waived.</p>"),
 ("Using this website", "<p>Please don't misuse the site, try to break it, or copy its content for commercial use. Links to other sites (like Payhip or Adobe) are provided for convenience; their own terms apply there.</p>"),
 ("Changes", "<p>We may update these terms. The version on this page when you buy is the one that applies to your order.</p>"),
 ("Governing law", "<p>These terms are governed by the laws of the State of Ohio and applicable United States law, and any dispute will be handled in the courts of Ohio, unless the consumer law where you live gives you the right to bring it elsewhere. If there's ever a problem, please contact us first; most things can be fixed with a quick email.</p>"),
])

# ---------------- Refund policy ----------------
legal("refunds", "Refund policy", "Refund policy for Forever Held digital downloads: how we help if something isn't right.",
 "Because our products are instant digital downloads, we can't take them back. But if something isn't right, we'll make it right.", [
 ("If your files don't work", "<p>If a file won't download, open, edit or print properly, <a href=\"contact.html\">contact us</a> within 30 days of purchase. We'll help you fix it or send a corrected file. If we can't solve the problem, we'll give you a full refund.</p>"),
 ("Duplicate or accidental purchases", "<p>Bought the same item twice? Tell us within 30 days and we'll refund the extra purchase.</p>"),
 ("Changed your mind?", "<p>If you haven't downloaded your files yet, contact us within 7 days of purchase for a full refund. Once files have been downloaded, we can't offer refunds for a change of mind, because the files can't be returned.</p>"),
 ("Not included", "<ul><li>Typing mistakes in edited files, or printing costs.</li><li>Differences in color caused by a particular screen, printer or paper.</li><li>Problems caused by editing in an app other than Adobe Acrobat Reader (we're still glad to help you get it working).</li></ul>"),
 ("How refunds are paid", "<p>Approved refunds go back to your original payment method through Payhip. Banks usually show them within 5 to 10 business days.</p>"),
 ("How to ask", f"<p>Use our <a href=\"contact.html\">contact form</a> (choose \"Refund request\") or email <a href=\"mailto:{EMAIL}\">{EMAIL}</a> with the email address you used and your order number if you have it. Please reach out to us before opening a dispute with your bank; we'll respond quickly.</p>"),
 ("Your rights", "<p>This policy doesn't limit any rights you have under consumer protection laws where you live.</p>"),
])

# ---------------- Privacy ----------------
legal("privacy", "Privacy policy", "How Forever Held collects, uses and protects your information.",
 "We collect as little as we can, we never sell your information, and you can ask us to delete it at any time.", [
 ("What we collect", f"""<ul><li><b>When you buy:</b> checkout happens on Payhip, which collects your name, email and payment details to process the order. We receive your name, email and order details; we never see your full card number. See <a href=\"https://payhip.com/privacy\">Payhip's privacy policy</a>.</li>
<li><b>When you contact us:</b> the name, email, order number and message you send, so we can reply.</li>
<li><b>When you get our free checklist:</b> your email address, which joins the Forever Held email list for occasional updates (new designs and seasonal remembrance ideas). Our list is managed with EmailOctopus. Every email has an unsubscribe link.</li></ul>"""),
 ("Cookies and tracking", "<p>This website doesn't use cookies, analytics or advertising trackers. Our host (GitHub Pages) may keep basic technical logs, such as IP addresses, for security, under GitHub's privacy statement. Payhip uses its own cookies during checkout.</p>"),
 ("How we use information", "<p>Only to deliver your order, answer your questions, handle refunds, send emails you signed up for, and keep basic sales records. We don't use your information for anything else.</p>"),
 ("Sharing", "<p>We don't sell or rent personal information, and we don't share it for advertising. We only use the service providers needed to run the shop (Payhip and its payment processors, EmailOctopus for email, and the secure systems that deliver contact messages to us).</p>"),
 ("How long we keep it", "<p>Contact messages are kept for up to 12 months. Order records are kept as long as needed for tax and accounting. You can unsubscribe from emails at any time.</p>"),
 ("Your choices and rights", f"<p>You can ask us to see, correct or delete your information, or to stop emailing you, by writing to <a href=\"mailto:{EMAIL}\">{EMAIL}</a>. Depending on where you live (for example California or the EU), you may have additional rights, and we'll honor them.</p>"),
 ("Our Pinterest app", "<p>The Forever Held Pinterest app connects only to the Forever Held Pinterest account. It creates and organizes our own Pins and boards and reads our own Pin statistics. It does not access, collect or store data about other Pinterest users. Access tokens are stored securely and never shared.</p>"),
 ("Children", "<p>Our shop is for adults. We don't knowingly collect information from children under 13.</p>"),
 ("Changes and contact", f"<p>If we change this policy, we'll update the date at the top. Questions? <a href=\"contact.html\">Contact us</a> or email <a href=\"mailto:{EMAIL}\">{EMAIL}</a>.</p>"),
])

# ---------------- About ----------------
page("about", "About us", "Forever Held makes gentle, printable memorial keepsakes families can fill in on a phone and print the same day.", f'''<header class="page-head"><h1>About Forever Held</h1><p>Gentle printable keepsakes for the days families need them most.</p></header>
<article class="panel glass legal">
<h2>Why we exist</h2>
<p>When someone you love dies, there are a hundred decisions and very little time. A program, a welcome sign and a place for guests to share memories shouldn't be one more thing to worry about.</p>
<p>Forever Held makes printable memorial pieces that are calm, beautiful and simple to finish: you type your loved one's details on your phone and print them the same day, at home or at a local print shop.</p>
<h2>What we believe</h2>
<ul><li><b>Simple beats fancy.</b> No design skills, accounts or subscriptions. Just fill-in files that work.</li>
<li><b>Honest previews.</b> What you see on this site is exactly what you download.</li>
<li><b>Real help.</b> If something doesn't work, a real person will help you fix it. See our <a href="refunds.html">refund policy</a>.</li></ul>
<h2>Our designs</h2>
<p>Our first collection is the Soft Botanical suite: sage leaves and cream paper, with a folded program, a welcome sign and share-a-memory cards. More designs are on the way.</p>
<p style="margin-top:22px"><a class="btn btn-sage" href="index.html#suite">See the Soft Botanical suite</a></p>
</article>''')

# ---------------- Accessibility ----------------
legal("accessibility", "Accessibility", "Forever Held's commitment to an accessible website and files.",
 "We want everyone to be able to use our site and our printables.", [
 ("Our approach", "<p>We build this site to work well on phones, with screen readers and with keyboard navigation, with readable text sizes and clear contrast. Images and videos include text descriptions.</p>"),
 ("Our files", "<p>Our printables are fill-in PDFs that work in the free Adobe Acrobat Reader app, which supports screen readers and zoom.</p>"),
 ("Need help?", f"<p>If anything on this site or in our files is hard to use, please <a href=\"contact.html\">tell us</a> or email <a href=\"mailto:{EMAIL}\">{EMAIL}</a>. We'll help you get what you need and fix the problem.</p>"),
])

# ---------------- Guides (SEO pages written by the Web Developer agent) ----------------
# Each guide is store/content/pages/<slug>.json. Edit the JSON, never the generated HTML.
SITE = "https://foreverheld.pages.dev"
guides = []
for f in sorted((STORE / "content" / "pages").glob("*.json")):
    g = json.loads(f.read_text())
    if g.get("draft"): continue
    guides.append(g)
e = H.escape
for g in guides:
    secs = ""
    for sct in g.get("sections", []):
        secs += f"<h2>{e(sct['h2'])}</h2>\n" + "".join(f"<p>{e(x)}</p>\n" for x in sct.get("paragraphs", []))
        if sct.get("bullets"): secs += "<ul>" + "".join(f"<li>{e(b)}</li>" for b in sct["bullets"]) + "</ul>\n"
    faq = g.get("faq", [])
    faq_html = ("<h2>Questions</h2>\n" + "".join(f"<h3 style=\"font:500 18px/1.3 var(--serif);margin:16px 0 4px\">{e(q['q'])}</h3><p>{e(q['a'])}</p>" for q in faq)) if faq else ""
    related = [x for x in guides if x["slug"] != g["slug"]][:3]
    rel = ("<h2>More planning guides</h2><ul>" + "".join(f'<li><a href="{x["slug"]}.html">{e(x["h1"])}</a></li>' for x in related) + "</ul>") if related else ""
    relpanel = f'<article class="panel glass legal">{rel}</article>' if rel else ""
    cta = f'''<section class="panel glass" style="text-align:center"><h2 class="section-title" style="font-size:28px">{e(g.get("cta_title") or "Everything for the service, in one gentle suite")}</h2>
<p style="color:var(--ink-soft);margin:0 0 18px">Funeral program, welcome sign and memory cards you fill in on your phone and print today.</p>
<div class="hero-cta"><a class="btn btn-sage" href="{KIT}">Get the suite · $12.99</a><a class="btn glass" href="{CHECKLIST}">Free planning checklist</a></div></section>'''
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": g["h1"], "description": g["description"], "dateModified": g.get("updated", UPDATED),
         "author": {"@type": "Organization", "name": "Forever Held"}, "publisher": {"@type": "Organization", "name": "Forever Held", "logo": f"{SITE}/brand/logo-square.png"},
         "mainEntityOfPage": f"{SITE}/{g['slug']}.html"}]}
    if faq: ld["@graph"].append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in faq]})
    body = f'''<header class="page-head"><p class="updated"><a href="guides.html">Planning guides</a></p><h1>{e(g["h1"])}</h1><p>{e(g["intro"])}</p></header>
<article class="panel glass legal">
{secs}{faq_html}
</article>
{cta}
{relpanel}'''
    page(g["slug"], g["title"].replace(" · Forever Held", ""), g["description"], body, head_extra=f'<script type="application/ld+json">{json.dumps(ld)}</script>\n')
cards = "".join(f'<a class="glass" href="{g["slug"]}.html"><b>{e(g["h1"])}</b><span>{e(g["description"])}</span></a>' for g in guides)
page("guides", "Planning guides", "Gentle, practical guides for planning a funeral or celebration of life: programs, welcome signs, memory cards and more.",
     f'''<header class="page-head"><h1>Planning guides</h1><p>Gentle, practical help for planning a funeral or celebration of life.</p></header>
<div class="cards">{cards or '<div class="glass"><b>Coming soon</b><span>Our first guides are on the way.</span></div>'}</div>''')

# ---------------- sitemap + robots ----------------
urls = ["", "guides.html", "contact.html", "about.html", "terms.html", "refunds.html", "privacy.html", "accessibility.html", "harvest-table.html", "evergreen-candlelight.html", "longest-night.html"] + [f'{g["slug"]}.html' for g in guides]
(STORE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{SITE}/{u}</loc></url>\n" for u in urls) + "</urlset>\n")
(STORE / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /landing/\nSitemap: {SITE}/sitemap.xml\n")

# ---------------- Home page: shared nav + footer + trust line ----------------
p = STORE / "index.html"
s = p.read_text()
s = re.sub(r'<nav class="nav glass".*?</nav>\n', nav(home=True), s, flags=re.S)
s = re.sub(r'<footer>.*?</footer>\n', footer(home=True), s, flags=re.S)
if 'class="trust"' not in s:
    s = s.replace('<section aria-labelledby="faq-title">', '<p class="trust"><span>Instant download</span><span>Secure checkout by Payhip</span><span>Help from a real person</span><span><a href="refunds.html">Fair refund policy</a></span></p>\n\n  <section aria-labelledby="faq-title">', 1)
p.write_text(s)
print("built:", ", ".join(sorted(x.name for x in STORE.glob("*.html"))))
