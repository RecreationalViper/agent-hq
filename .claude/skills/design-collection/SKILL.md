---
name: design-collection
description: Create a new Forever Held design collection (holiday or seasonal set, new style, colorway, or a "makeover" of the line) from research to owner-approved concepts to finished fill-in PDFs handed to the agents. Use whenever the owner asks for new designs, a holiday/seasonal set, new collection options, a different look, or new memorial printables, even if he doesn't say "collection".
---

# Design Collection

Forever Held sells printable memorial suites as fill-in PDFs (repo RecreationalViper/agent-hq, `products/fillable/`).
A collection is one visual style applied to a set of pieces. This skill takes a new collection from idea to
something the agents can sell, with the **owner approving the look before anything is built or marketed**.
He works from an iPhone, so every check-in is images plus a few short lines, never files to download.

## The two approval gates

Nothing reaches the agents, the store or Pinterest until the owner says yes. There are two stops:

1. **Concept gate:** show 3 clearly different concepts as preview images; he picks one (or mixes, or asks for more).
2. **Final gate:** show the finished pieces filled with sample text; he approves or lists fixes.

Record each decision in `products/collections.json` (see Hand-off) so agents can tell approved work from drafts.
Agents treat anything not `"approved"` as off-limits for listings, pins and emails. Why: he has been burned by
things going live early (a Payhip bundle published before its links worked), and the brand is about trust.

## Step 1: Research (quiet, quick)

Read before designing, so concepts answer real demand rather than taste alone:
- `reports/` newest Seasonal Planner, Product Ideas, Product Builder, SEO Scout and Competitor Scout reports:
  dates, search phrases, pieces families ask for, price gaps.
- What already exists, so the new work is genuinely different: `products/fillable/out/` (Soft Botanical:
  sage watercolor eucalyptus on cream; Classic Elegance: navy/ivory/gold laurels, Cormorant + Cinzel) and
  `products/collections.json` if present. "Makeover" means a new palette, new motif, new type pairing and
  new composition, not a recolor.
- `ploy/brand.md` for brand voice. Copy is warm and plain, never mentions AI or Canva, never names the owner.

## Step 2: Concepts (gate 1)

Make 3 directions that differ in mood and audience, not just color. For a holiday set, cover the calendar the
research shows (e.g. one Christmas-warm, one quiet/faith-neutral for Hanukkah, Blue Christmas and the solstice,
one Thanksgiving/autumn), unless the owner narrowed it.

For each concept write: name, one-line mood, palette (4-5 hex), type pairing, motif, and the piece list.
Render one preview image per concept showing 2-3 hero pieces with real sample text (a sample name like
"Margaret Anne Ellis", real dates, a short verse), then one side-by-side comparison image.

Rendering: HTML/CSS + inline SVG ornaments drawn in code, screenshotted with Playwright
(see `scripts/render.mjs` pattern). Code-drawn art is free, sharp at any print size, and avoids licensing
questions. Use only fonts available locally or under the SIL Open Font License; if the ideal font is missing,
preview with the closest local one and note the final font.

Send the images with SendUserFile and ask one question: "Which one should I build: A, B or C? (Or mix them.)"
Then stop and wait. Don't build pieces for a concept he hasn't picked.

## Step 3: Build (after gate 1)

Follow the existing pipeline so delivery matches what customers already get:
- One `products/fillable/<collection>.mjs` that draws the vector backgrounds into `bg/` (pattern: `classic.mjs`).
- Fill-in fields in `fields.json` (Times/Helvetica fields, sized for real names and verses), built by `build.py`.
- Outputs in `products/fillable/out/<Collection Name>/`, numbered like the others, plus a
  `00 Start Here` guide and a preview PNG.
- Sizes: US Letter sheets; signs 8x10 and 24x36; cards 4.25x5.5 (4-up or 2-up with trim marks);
  programs 11x8.5 folding to 5.5x8.5.

Check every piece before showing it: open the PDF, render page images, look for clipped text, fields that
overflow with a long name, low contrast, and anything that would print badly on a home printer
(full-bleed dark backgrounds use a lot of ink, so offer a light variant where it matters).

## Step 4: Final gate

Send the filled sample previews. List the pieces and a suggested price in 3-4 lines. Ask: "Approve, or tell me
what to change." Apply fixes and re-show until he says approve.

## Step 5: Hand-off to the agents (after gate 2)

1. `products/collections.json`: add the collection with `status: "approved"`, approval date, pieces, palette,
   fonts, price, seasonal window (start marketing / stop marketing dates) and preview paths.
2. Add the collection's facts to the shop agents' context in `agents.json` (listing, content, seo, seasonal,
   email-marketer, product-builder) and `store/media.json` previews, so they write about the real files.
3. Post previews to Discord #listings and add a dated line to the "Agent HQ – Updates" Google Doc.
4. Tell the owner the one manual step: upload the files to a new Payhip product (Payhip's API can't create
   products). Give him the title, price and description ready to paste.

Respect the Ploy shift lock (`ploy-state.mjs`): website changes for a new collection go to `ploy/shift/` while
Ploy leads the website job.
