---
name: automation
description: How Forever Held's posts reach Pinterest, Facebook and Instagram (site feeds + Make.com scenarios). Read before changing pins.mjs, ig.mjs, the feeds, or anything that posts to social media.
---

# Social posting: feeds on the site, Make.com does the posting

Meta and Pinterest developer apps were a dead end for us (Pinterest denied the app; Meta needs a
developer app + a Facebook Page that was too new to connect). So the pattern is:

1. **Our agents only write feeds** (no social logins in this repo):
   - `store/pins/feed.xml` + `pins.json`: 2:3 pins (1000x1500), written by `pins.mjs` via the Content Creator.
   - `store/ig/feed.xml` + `posts.json`: 4:5 Instagram/Facebook images (1080x1350, the pin on a blurred copy of itself),
     written by `ig.mjs`. Captions have no links (Instagram can't click them): `igCaption()` strips URLs,
     adds "Link in bio 🕊️" and hashtags.
   - Both go live with the store deploy (https://foreverheld.pages.dev/pins/feed.xml, /ig/feed.xml).
2. **Make.com (owner's free account) posts from those feeds.** Make uses its own approved Pinterest/Meta apps,
   so we never need our own developer approval. Free plan: ~1,000 operations/month — keep schedules modest.
   - Organization "My Organization" (1785953), team "My Team" (721485), zone us1.make.com.
   - Scenarios (status lives in `skills/automation/status.md`):
     - **FH Pinterest**: RSS `rss:TriggerNewArticle` v4 on pins/feed.xml → `pinterest:createPin` v2 (image URL = item link
       is the page; image = enclosure URL; title, description, link mapped from the item).
     - **FH Facebook + Instagram**: RSS on ig/feed.xml → `facebook-pages:CreatePostWithPhotos` v6 (photo URL) and
       `instagram-business:CreatePostPhoto` v1. Item `<link>` in ig/feed.xml is the image itself on purpose.
3. **Who can change Make:** Claude sessions with the Make connector (MCP). GitHub Actions agents can't reach Make;
   they change what gets posted by changing the feeds. Never post the same item twice: feed `guid` = pin/post id, and
   the RSS trigger only takes items newer than its last run.

## Rules for agents picking this up
- Add new content by improving `content-creator.mjs` / `pins.mjs` / `ig.mjs`, never by editing feed.xml by hand.
- Keep feed images public JPEGs under store/; Instagram rejects anything taller than 4:5.
- Public copy rules from AGENTS.md apply to captions (no AI mentions, no invented reviews).
- Connections (logins) are the owner's: if one expires, ask him to reconnect in Make (Credentials), with tap-by-tap steps.
