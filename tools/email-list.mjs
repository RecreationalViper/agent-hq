// EmailOctopus (read-only): list names, subscriber counts and recent campaigns -> email/stats.md for the team.
// Never sends or changes anything. Usage: node tools/email-list.mjs [--probe]
import fs from "node:fs/promises";
const KEY = process.env.EMAILOCTOPUS_API_KEY?.trim();
const BASES = ["https://api.emailoctopus.com", "https://emailoctopus.com/api/2.0"];
let BASE;
async function eo(path) {
  for (const b of BASE ? [BASE] : BASES) {
    const r = await fetch(b + path, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { BASE = b; return j; }
    if (BASE || b === BASES.at(-1)) throw new Error(`EmailOctopus ${r.status}: ${j.title || j.detail || j.error?.message || "error"}`);
  }
}
async function main() {
  await fs.mkdir("email", { recursive: true });
  if (!KEY) return fs.writeFile("email/stats.md", "# Email list\n\nNo EMAILOCTOPUS_API_KEY saved yet.\n");
  const lists = (await eo("/lists")).data || [];
  let md = `# Email list (EmailOctopus, ${new Date().toISOString().slice(0, 10)})\n\n`;
  for (const l of lists) {
    const c = l.counts || {};
    md += `- **${l.name}**: ${c.subscribed ?? "?"} subscribed, ${c.pending ?? 0} pending, ${c.unsubscribed ?? 0} unsubscribed\n`;
  }
  if (!lists.length) md += "- No lists yet.\n";
  try {
    const camps = (await eo("/campaigns")).data || [];
    md += `\n## Campaigns\n${camps.slice(0, 10).map((c) => `- ${c.name || c.subject} (${c.status}${c.sent_at ? `, sent ${c.sent_at.slice(0, 10)}` : ""})`).join("\n") || "- none yet"}\n`;
  } catch (e) { md += `\n(campaigns: ${e.message})\n`; }
  md += "\nThe list grows from the free Planning Checklist (https://payhip.com/b/eYJqS): every download with consent is added.\n";
  await fs.writeFile("email/stats.md", md);
  console.log(`RESULT email: base ${BASE}; ${lists.length} list(s): ${lists.map((l) => `${l.name}=${l.counts?.subscribed ?? "?"}`).join(", ")}`);
  if (process.argv.includes("--probe")) console.log("first list keys:", Object.keys(lists[0] || {}).join(","));
}
main().catch(async (e) => { console.log(`RESULT email: FAILED ${e.message}`); await fs.writeFile("email/stats.md", `# Email list\n\nUnavailable today: ${e.message}\n`); });
