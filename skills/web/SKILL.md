---
name: forever-held-web
description: How to change the Forever Held website (storefront) and its media. Read before any agent, Claude or Arena edits store/, adds a video or image, or builds a landing page.
---

# Forever Held website: how we build it

**Live site:** https://recreationalviper.github.io/agent-hq/store/ (GitHub Pages, branch main, folder `store/`). Every push to main publishes within a minute or two.

## Files
- `store/index.html`: the whole storefront, one file (inline CSS, tiny inline JS for the gallery). No build step, no frameworks.
- `store/media.json`: **the list of every video and image on the site**, with public URLs, shapes and where each is used. Update it whenever media is added, moved or reused.
- `store/video/`: videos and posters made by `tools/make-film.mjs` (Make Product Film workflow: `format=film` 16:9, `format=pin` 2:3).
- `store/img/`: product previews. `store/brand/`: logo files. `store/landing/`: latest landing page PDF + preview made by `landing.mjs`.
- `store/privacy.html`: privacy policy (Pinterest app uses the Payhip copy).

## Look and voice (keep it consistent)
- "Liquid Glass" style: frosted `.glass` panels on a cream background, sage buttons (`.btn-sage`, #6D7F5F), serif headings (Lora/Cormorant), Cinzel only for small caps labels.
- Mobile first: the owner and most buyers are on iPhones. Check 390px width. Tap targets at least 40px.
- Calm, practical, reassuring copy. No urgency tricks, no invented reviews or numbers.
- Never mention AI, AI tools, agents or automation anywhere on the public site (owner's rule).
- Product facts: fill-in PDFs opened in the free Adobe Acrobat Reader app; print at home or Staples / Office Depot / FedEx Office. **Never say buyers need Canva.**

## Buttons and links
- Buy: https://payhip.com/b/vqNSA ($12.99)
- Free Planning Checklist (adds to the email list for seasonal updates): https://payhip.com/b/eYJqS
- Every page section that asks for action should offer both: buy, or get the free checklist.

## Video rules
- Videos are muted; use `muted playsinline`. Autoplay only the hero film (`autoplay loop`); others use `controls preload="none"` and a poster so phones don't download them until tapped.
- Keep files under ~12 MB each (GitHub Pages serves them directly).
- Always give a `poster` and an `aria-label` describing what the video shows.
- Add the video to `store/media.json` with `used_on`.

## Checklist before pushing
1. Open the page at phone width and desktop width (Playwright screenshot is fine).
2. All links work and point to the URLs above.
3. `store/media.json` is valid JSON and up to date.
4. Add a dated line to the "Agent HQ – Updates" Google Doc.
