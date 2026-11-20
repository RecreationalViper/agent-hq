# FRIDAY: plan and research notes

Goal: Josiah's own JARVIS/FRIDAY — one voice that knows his businesses, his day, and (later) his health and money,
and can act for him. Built on free or near-free services; grows one capability at a time.

## How she's built (Nov 2026)

| Piece | What | Where |
| --- | --- | --- |
| Brain | `/friday` on the Cloudflare Worker (`workers/sales/worker.js`): persona + live business facts + memory + actions. Models: Groq → Gemini → OpenRouter → Workers AI | Worker |
| Ears (normal mode) | App records audio; Groq Whisper large-v3-turbo transcribes (free: 2,000 clips/day); Workers AI Whisper as backup | Worker |
| Live mode | Gemini Live (`models/gemini-3.8-live`, native audio): real-time talk, interruptions, transcripts, tool calls. Worker mints a single-use 30-min token with the whole setup locked in (`/friday/live`); tools run through `/friday/tool` | Worker + app |
| Voice | Live mode: Gemini voice (default Kore). Normal mode: iPhone voice (Ava Premium if downloaded) | Phone |
| Hands | `phone` actions → Shortcuts "Friday Hands" (text, call, reminder, event, timer, alarm, directions, note, music, Health, open) | iPhone |
| App | https://recreationalviper.github.io/agent-hq/friday/ (Add to Home Screen) | GitHub Pages |
| Siri | "Hey Siri, Friday" Shortcut → `/friday` → speaks `say`, runs `phone_json` | iPhone |
| Testing | Friday Check workflow (test key derived from a secret; covers text, voice clip, Live session) | GitHub Actions |

## Personality (from JARVIS / FRIDAY)
- JARVIS: unflappable calm, dry British wit, loyal, proactive, keeps Tony grounded, "the steady presence that makes chaos manageable".
- FRIDAY: JARVIS's successor; warmer, quicker, more urgent; calls Tony "Boss".
- Ours: calm, warm, capable, one light quip at most, calls him "boss" sometimes, proactive about things he'd want to know, honest about limits, pushes back kindly on bad ideas. Short spoken answers.

## Next steps (in order)
1. Friday Hands Shortcut walkthrough (owner) → phone actions work end to end.
2. Proactive briefings: morning summary pushed as a notification (Discord now; iPhone push later via Shortcuts automation).
3. Live voice picker (Gemini voices) + wake by Action Button straight into Live mode.
4. Calendar + email awareness (shop Gmail already connected; personal calendar via Shortcuts).
5. Health and money — only after moving those requests to a provider that doesn't train on data (paid Gemini/Groq tier or similar). Owner decides.
6. Expressive voice upgrade option: ElevenLabs (~$5/mo) or Groq Orpheus (tiny free tier; cheap paid).

## Rules
- Never invent business numbers; facts come from the Worker (sales KV, repo files, GitHub runs).
- The owner's key lives only on his phone; only its SHA-256 is in the code.
- Phone actions always go through his own Shortcuts (iPhone may ask to confirm texts).

## Connections (Nov 20)
Settings › Connections in the app lists everything (green dot = live). Worker routes: /friday/connect (Google OAuth), /friday/connections (status, set_key, disconnect).
- Google: Gmail, Calendar, Drive, Docs, Sheets (refresh token in KV friday:google). Emails: draft first, send only on a later "send it" (enforced in runGoogle).
- Shop: fridayShop: sales/orders/refunds from Payhip webhook records in KV, coupons list/create (Payhip API only covers coupons). Stripe via pasted key (friday:key:stripe).
- Second brain: fridayLookup: web (Tavily, Exa), think (Claude, $2/month cap in KV), notion/note, discord, report.
- Owner key only for private data; the agents' test key gets web/think/report only (its output lands in public logs).
- Next: PayPal, Etsy, Shopify, Spotify, bank accounts (read-only), Friday Hands Shortcut.
