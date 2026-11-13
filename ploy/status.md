# Ploy shift board (read this before working on the website, SEO, ads, leads or positioning)

**Ploy AI (ploy.ai) leads these jobs.** Our agents follow along, learn from Ploy's work, and pick up the
shift while Ploy is on break (out of daily credits). Claude syncs this file from Ploy and hands shift work back.

- Ploy workspace: "Forever Held". Free plan: 700 AI credits a day, resets **7 pm New York (00:00 UTC)**.
- Last sync: 2026-11-12 ~7:15 pm ET. **Ploy status: ON SHIFT** (credits reset 7 pm; one short screenshot check used). Live switch: `ploy/state.json` (see AGENTS.md "Shift lock").

## Shift rules (every agent, every AI team)
1. **While Ploy is running, hands off its jobs.** Research and notes only, under `## For Ploy`.
2. **While Ploy is on break, it's our shift: be hands-on.** Build, edit and publish on our live store (foreverheld.pages.dev),
   work leads, email capture, funnels, sales, SEO and customer care, using Ploy's methods as the frame of reference.
   Don't undo Ploy's finished work in Ploy; tell Ploy what we changed (Claude hands it over via `ploy/shift/`).
3. Match Ploy's brand guidelines (`ploy/brand.md`) and our rules (AGENTS.md): no invented reviews, stats or customer
   stories; never mention AI on public pages; buyers need no Canva.
4. **Owner decisions stay with the owner.** If a job is "waiting on owner", don't pick for him; you may add notes that help him decide.
5. **No money, no outreach**: no ad spend, no contacting companies or people on the leads list.

## Ploy's jobs
| Job (Ploy chat) | What Ploy did | Status | Our shift work while Ploy is on break |
| --- | --- | --- | --- |
| **Website move to Ploy** (site "Forever Held") | Built the design system from foreverheld.pages.dev (keep design as is); header, footer, hero/suite/steps/FAQ sections ready but **home page is still a placeholder** (Nov 12 7 pm check) | Unpublished. **foreverheld.pages.dev stays the main store** until Ploy's home page is assembled and the owner approves. Ploy paused /abm/[slug] mid-edit (one file has a syntax error); waiting on owner OK to finish. Ploy asked to confirm checkout link and checklist signup | Facts for Ploy: buy link https://payhip.com/b/vqNSA ($12.99); free checklist signup https://payhip.com/b/eYJqS (joins the EmailOctopus list) |
| **SEO & AEO audit** | Audited search + AI-answer visibility; top opportunity = a **/funeral-program-template** page (draft started) | Turn stopped when credits ran out; draft page unpublished | **SEO Scout**: keyword variants and real questions for "funeral program template" (People Also Ask, autocomplete), and short FAQ answers in our voice, for Ploy to use |
| **Hero CRO variants** | 3 hero mockups: A outcome + price up front, B reassurance + 4 steps under the buttons, C product first with one buy button | **Owner picked C** (Nov 12). Built on foreverheld.pages.dev at the owner's request; Ploy told to use it for its site and conversion tracking | Content Planner: track clicks on "Get the suite" vs the old hero in reports. Don't rebuild the hero |
| **Ad campaigns (Meta)** | Research + 3 creatives: "Printed by tonight", "Type their name", "Helping a friend". Meta Ads connected; no Meta pixel on site (checkout is Payhip) | **Waiting on owner. Owner: no paid ads for now** | Content Creator may reuse the three angles for free organic Pinterest pins. No ad work |
| **Positioning: printed vs online memorials** | Researched Forever In Our Hearts (online tribute sites, $0/$49/$99). Honest framing: printed suite for the service day vs a lasting online space; many families use both. Our trade-offs: photo only on a computer; no online space after the service. No reviews found for us | Comparison page draft not built yet (design system now ready) | Competitor Scout: keep facts fresh on Forever In Our Hearts. Content Planner: draft an honest "printed or online memorial?" outline for Ploy |
| **Find qualified leads (ABM)** | Ideal customer = online/direct cremation companies whose families plan their own service. Accounts: Meadow, After.com, Eirene (`ploy/leads.csv`); template page /abm/[slug] drafted | Drafts only; nobody has been contacted | **Partner Finder**: research more accounts in the same columns (US, sources required). Never contact anyone |

## Ploy's docs (copies)
- `ploy/brand.md`: Forever Held brand guidelines as Ploy wrote them (colors, type, voice, imagery).
- `ploy/memory.md`: Ploy's workspace memory (goals, ongoing operations).
- `ploy/leads.csv`: Ploy's ABM accounts table.

## Ploy's review of foreverheld.pages.dev (Nov 12, 7 pm)
- Works: product + price + 3 real previews + "Get the suite · $12.99" on the first phone screen (hero C); real filled-in previews; trust line, 4 steps and FAQ answer a family's worries.
- Fix 1 (Web Developer, our shift): on desktop the big candle photo pushes the buy panel below the first screen.
- Fix 2 (Web Developer, our shift): on phones the refund / secure-checkout line sits under the video; move it up next to the first buy button.
