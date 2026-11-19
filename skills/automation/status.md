# Automation status (update when it changes)

| Channel | How | Status (2026-11-18) |
| --- | --- | --- |
| Pinterest | site RSS feed (Pinterest auto-publish) | running daily |
| Pinterest (direct) | Make "FH Pinterest" | waiting for owner to approve the Pinterest login in Make |
| Facebook Page | Make scenario "FH Facebook posts (from site feed)" (id 5054001): RSS ig/feed.xml every 4 h, max 2 items -> facebook-pages:CreatePostWithPhotos (photo = item link, caption = description) on Page "Forever Held (Solon)" 1412708698596140, connection 4902818 | live since 2026-11-18 (first run set the starting point; new feed items post automatically) |
| Instagram @foreverheldshop | add instagram-business:CreatePostPhoto to scenario 5054001 | blocked: account must be linked to the Forever Held Page first (possible suspension, appeal pending) |
| Instagram feed | store/ig/feed.xml | live, filled daily by the Content Creator |
