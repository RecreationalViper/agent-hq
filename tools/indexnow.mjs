// Tells Bing, Yandex, Seznam and other IndexNow search engines about every page in the sitemap, right after a publish.
// Free, no account. The key file store/b8191d4600986fa2bba7e5e582278aaa.txt proves we own the site.
import fs from "node:fs/promises";
const KEY = "b8191d4600986fa2bba7e5e582278aaa", HOST = "foreverheld.pages.dev";
const xml = await fs.readFile("store/sitemap.xml", "utf8");
const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }) });
console.log(`RESULT indexnow: HTTP ${r.status} for ${urlList.length} URLs`);
