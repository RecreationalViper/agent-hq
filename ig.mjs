// Instagram without a Meta developer app: store/ig/feed.xml is an RSS feed of 4:5 images with full captions.
// A free Make.com scenario (RSS "Watch items" -> Instagram for Business "Create a photo post") posts each new item.
import fs from "node:fs/promises";

const SITE = "https://foreverheld.pages.dev";
const DIR = "store/ig";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

// Instagram captions can't hold links: drop URLs, point to the bio, add hashtags.
export function igCaption(text, hashtags = []) {
  const body = String(text || "").replace(/https?:\/\/\S+/g, "").replace(/\s+([.,!?])/g, "$1").replace(/[ \t]+/g, " ").replace(/:\s*$/, ".").trim();
  const tags = [...new Set(hashtags.map((t) => "#" + String(t).replace(/^#/, "").replace(/[^\p{L}\p{N}]/gu, "")).filter((t) => t.length > 2))].slice(0, 12);
  return `${body}\n\nEditable printable, instant download. Link in bio 🕊️${tags.length ? "\n\n" + tags.join(" ") : ""}`.slice(0, 2200);
}

// items: [{ id, title, caption, data (4:5 jpeg Buffer) }]
export async function addIgPosts(items) {
  await fs.mkdir(DIR, { recursive: true });
  const all = JSON.parse(await fs.readFile(`${DIR}/posts.json`, "utf8").catch(() => "[]"));
  for (const it of items) {
    if (all.some((p) => p.id === it.id)) continue;
    await fs.writeFile(`${DIR}/${it.id}.jpg`, it.data);
    all.push({ id: it.id, title: String(it.title).slice(0, 100), caption: it.caption, image: `${SITE}/ig/${it.id}.jpg`, created: new Date().toISOString() });
  }
  await fs.writeFile(`${DIR}/posts.json`, JSON.stringify(all, null, 2) + "\n");
  const items30 = [...all].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 30);
  await fs.writeFile(`${DIR}/feed.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>Forever Held · Instagram</title>
<link>${SITE}/</link>
<description>Daily Instagram posts from Forever Held.</description>
${items30.map((p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${SITE}/ig/${esc(p.id)}.jpg</link>
  <guid isPermaLink="false">${esc(p.id)}</guid>
  <pubDate>${new Date(p.created).toUTCString()}</pubDate>
  <description>${esc(p.caption)}</description>
  <enclosure url="${esc(p.image)}" type="image/jpeg" length="0"/>
  <media:content url="${esc(p.image)}" medium="image" type="image/jpeg"/>
</item>`).join("\n")}
</channel>
</rss>
`);
  return all.length;
}
