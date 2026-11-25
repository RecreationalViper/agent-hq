# Automation status (update when it changes)

| Channel | How | Status (2026-11-25) |
| --- | --- | --- |
| Pinterest | site RSS feed https://foreverheld.pages.dev/pins/feed.xml via Pinterest auto-publish, board "Celebration of Life Ideas" | live (connected 2026-11-23); this is the Pinterest route, nothing else needed |
| Pinterest (direct) | Make "FH Pinterest" | retired, not needed (auto-publish above replaced it) |
| Facebook Page | Make scenario "FH Facebook posts (from site feed)" (id 5054001): RSS ig/feed.xml every 4 h, max 2 items -> facebook-pages:CreatePostWithPhotos (photo = item link, caption = description) on Page "Forever Held (Solon)" 1412708698596140, connection 4903367 (Facebook Pages, has pages_manage_posts) | live; first posts went up 2026-11-19 |
| Instagram @foreverheldshop | add instagram-business:CreatePostPhoto to scenario 5054001 | blocked: account must be linked to the Forever Held Page first (possible suspension, appeal pending) |
| Instagram feed | store/ig/feed.xml | live, filled daily by the Content Creator |
