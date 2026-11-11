// Pinterest stats for the team (read-only: PINTEREST_TOKEN with pins:read, boards:read, user_accounts:read).
// Writes pinterest/stats.md (read by the Content Planner, Content Creator, SEO Scout and Weekly Review)
// and pinterest/stats.json. Never posts anything. Never fails the workflow: problems are written into the file.
// Usage: node tools/pinterest-stats.mjs
import fs from "node:fs/promises";

const TOKEN = process.env.PINTEREST_TOKEN?.trim();
const API = "https://api.pinterest.com/v5";
const day = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const METRICS = ["IMPRESSION", "SAVE", "PIN_CLICK", "OUTBOUND_CLICK"];

async function pin(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`Pinterest ${r.status}: ${j.message || j.code || "error"}`); e.status = r.status; throw e; }
  return j;
}

async function main() {
  await fs.mkdir("pinterest", { recursive: true });
  if (!TOKEN) return write("No PINTEREST_TOKEN saved yet.", {});
  const start = day(30), end = day(0);
  const account = await pin("/user_account");
  const boards = (await pin("/boards?page_size=50")).items || [];
  const pins = [];
  let bookmark;
  do {
    const page = await pin(`/pins?page_size=100${bookmark ? `&bookmark=${bookmark}` : ""}`);
    pins.push(...(page.items || []));
    bookmark = page.bookmark;
  } while (bookmark && pins.length < 300);

  // Per-pin totals for the last 30 days (newer pins may show 0 until Pinterest processes them)
  const rows = [];
  for (const p of pins.slice(0, 60)) {
    const row = { id: p.id, title: p.title || p.description?.slice(0, 60) || "(untitled)", board: boards.find((b) => b.id === p.board_id)?.name || "", created: (p.created_at || "").slice(0, 10), link: p.link || "", video: p.media?.media_type === "video" };
    try {
      const a = await pin(`/pins/${p.id}/analytics?start_date=${start}&end_date=${end}&metric_types=${METRICS.join(",")}`);
      const tot = a.all?.lifetime_metrics || a.all?.summary_metrics || {};
      for (const m of METRICS) row[m.toLowerCase()] = Number(tot[m] ?? 0);
    } catch (e) { row.note = e.message; }
    rows.push(row);
  }
  rows.sort((a, b) => (b.impression || 0) - (a.impression || 0));

  let acct = {};
  try {
    const a = await pin(`/user_account/analytics?start_date=${start}&end_date=${end}&metric_types=${METRICS.join(",")}`);
    acct = a.all?.summary_metrics || {};
  } catch (e) { acct = { note: e.message }; }

  const n = (v) => (v == null ? "-" : Number(v).toLocaleString("en-US"));
  let md = `# Pinterest stats (${end}, last 30 days)\n\nAccount: ${account.username || "?"} (${account.account_type || "?"}), ${n(account.follower_count)} followers, ${boards.length} boards, ${pins.length} pins.\n`;
  md += `\n## Account totals\nImpressions ${n(acct.IMPRESSION)} · Saves ${n(acct.SAVE)} · Pin clicks ${n(acct.PIN_CLICK)} · Outbound clicks (to the shop) ${n(acct.OUTBOUND_CLICK)}${acct.note ? `\n(${acct.note})` : ""}\n`;
  md += `\n## Boards\n${boards.map((b) => `- ${b.name}: ${n(b.pin_count)} pins`).join("\n") || "- none"}\n`;
  md += `\n## Pins, best first\n| Pin | Board | Posted | Views | Saves | Clicks | To shop |\n|---|---|---|---|---|---|---|\n`;
  md += rows.map((r) => `| ${r.title.replace(/\|/g, "/").slice(0, 70)}${r.video ? " (video)" : ""} | ${r.board} | ${r.created} | ${n(r.impression)} | ${n(r.save)} | ${n(r.pin_click)} | ${n(r.outbound_click)} |`).join("\n") || "| (no pins yet) |||||||";
  md += `\n\nNotes for the team: new pins can take 1-2 days to show numbers. Saves and outbound clicks matter most (they lead to sales).\n`;
  await write(md, { account: { username: account.username, followers: account.follower_count }, totals: acct, boards: boards.map((b) => ({ name: b.name, pins: b.pin_count })), pins: rows });
  console.log(`RESULT pinterest: ${pins.length} pins, ${boards.length} boards; top pin views ${rows[0]?.impression ?? 0}`);
}

async function write(md, data) {
  await fs.writeFile("pinterest/stats.md", md.startsWith("#") ? md : `# Pinterest stats\n\n${md}\n`);
  await fs.writeFile("pinterest/stats.json", JSON.stringify({ updated: new Date().toISOString(), ...data }, null, 2));
}

main().catch(async (e) => {
  console.log(`RESULT pinterest: FAILED ${e.message}`);
  await write(`Pinterest stats unavailable today: ${e.message}${/consumer type/i.test(e.message) ? " (the Pinterest app is still waiting for approval; stats start once it's approved)" : e.status === 401 ? " (the token expired or was revoked; the owner needs to generate a new one and save it as PINTEREST_TOKEN)" : ""}`, { error: e.message });
});
