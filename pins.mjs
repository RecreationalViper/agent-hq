// Pinterest without the API (owner's app is stuck in "trial access pending"):
//  1. store/pins/feed.xml: RSS feed Pinterest auto-publishes from (needs the claimed website + feed connected once)
//  2. store/pins/upcoming.csv: Pinterest "Bulk create Pins" file (up to 100 pins, scheduled over the next 14 days)
// Images live in store/pins/ so they have public URLs on foreverheld.pages.dev (the claimed domain).
import fs from "node:fs/promises";

const SITE = "https://foreverheld.pages.dev";
const DIR = "store/pins";
export const BOARD = process.env.PINTEREST_BOARD || "Celebration of Life Ideas";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

async function manifest() { return JSON.parse(await fs.readFile(`${DIR}/pins.json`, "utf8").catch(() => "[]")); }

// items: [{ id, title, description, data (jpeg Buffer), link?, keywords? }]
export async function addPins(items) {
  await fs.mkdir(DIR, { recursive: true });
  const all = await manifest();
  for (const it of items) {
    if (all.some((p) => p.id === it.id)) continue;
    await fs.writeFile(`${DIR}/${it.id}.jpg`, it.data);
    const link = new URL(it.link || `${SITE}/`);
    link.searchParams.set("utm_source", "pinterest"); link.searchParams.set("utm_medium", "pin"); link.searchParams.set("utm_campaign", it.id);
    all.push({ id: it.id, title: String(it.title).slice(0, 100), description: String(it.description).slice(0, 500), link: link.href,
      image: `${SITE}/pins/${it.id}.jpg`, keywords: (it.keywords || []).slice(0, 10), created: new Date().toISOString() });
  }
  await fs.writeFile(`${DIR}/pins.json`, JSON.stringify(all, null, 2) + "\n");
  await buildFeeds(all);
  return all.length;
}

export async function buildFeeds(all) {
  all ??= await manifest();
  const items = [...all].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 60);
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>Forever Held · Memorial printables</title>
<link>${SITE}/</link>
<description>Gentle memorial printables and planning ideas from Forever Held.</description>
<language>en-us</language>
${items.map((p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${esc(p.link)}</link>
  <guid isPermaLink="false">${esc(p.id)}</guid>
  <pubDate>${new Date(p.created).toUTCString()}</pubDate>
  <description>${esc(p.description)}</description>
  <enclosure url="${esc(p.image)}" type="image/jpeg" length="0"/>
  <media:content url="${esc(p.image)}" medium="image" type="image/jpeg"/>
</item>`).join("\n")}
</channel>
</rss>
`;
  await fs.writeFile(`${DIR}/feed.xml`, rss);
  // CSV: pins not yet scheduled, 2 a day (11 am and 8 pm Eastern), first slot tomorrow, within Pinterest's 14-day window
  const todo = all.filter((p) => !p.csv).slice(0, 28);
  const start = new Date(Date.now() + 86400e3);
  const rows = todo.map((p, i) => {
    const d = new Date(start.getTime() + Math.floor(i / 2) * 86400e3);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
    return [p.title, p.image, BOARD, "", p.description, p.link, `${day}T${i % 2 ? "20" : "11"}:00:00`, p.keywords.join(", ")].map(csvCell).join(",");
  });
  await fs.writeFile(`${DIR}/upcoming.csv`, ["Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords", ...rows].join("\n") + "\n");
  return { feed: items.length, csv: rows.length };
}

// After the owner uploads upcoming.csv: node pins.mjs --uploaded  (marks those pins as scheduled)
if (process.argv[1]?.endsWith("pins.mjs") && process.argv.includes("--uploaded")) {
  const all = await manifest();
  let n = 0; for (const p of all) if (!p.csv && n < 28) { p.csv = new Date().toISOString(); n++; }
  await fs.writeFile(`${DIR}/pins.json`, JSON.stringify(all, null, 2) + "\n");
  console.log(await buildFeeds(all), `${n} marked uploaded`);
}
