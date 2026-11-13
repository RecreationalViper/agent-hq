// Discord reporting for Agent HQ through one bot (DISCORD_BOT_TOKEN secret).
// The bot keeps an "Agent HQ" category with one channel per role, recorded in discord.json.
import fs from "node:fs/promises";

const API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
const SITE = "https://recreationalviper.github.io/agent-hq/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Channel key -> name and topic. Add a role here and run "Discord Setup" to create its channel.
export const CHANNELS = {
  sales: ["sales", "Sales, refunds, Customer Care reply drafts and the Bookkeeper's monthly statement"],
  "daily-focus": ["daily-focus", "Daily Focus: one shop task a day"],
  listings: ["listings", "Listing Writer: titles, tags and descriptions ready to paste"],
  content: ["content", "Content Planner, Content Creator, Seasonal Planner and Email Marketer: pins, stories, captions, holiday plans and emails"],
  "product-ideas": ["product-ideas", "Product Ideas and Product Builder: new products and ready-to-build specs"],
  competitors: ["competitors", "Competitor Scout and Partner Finder: who else sells memorial printables, and who could recommend us"],
  seo: ["seo", "SEO Scout: keywords, titles, tags and pins from real Google data"],
  "weekly-review": ["weekly-review", "Weekly Review: how the shop did and what to decide"],
  "trading-desk": ["trading-desk", "Trading Desk (paper money): daily trades, Head Trader reviews, backtests"],
  research: ["research", "Deep Researcher, Credit Scout and GitHub Radar"],
  inbox: ["inbox", "Email team: Junk Sweeper results and Customer Care reply drafts"],
  "studio-trends": ["studio-trends", "Studio: Trend Scout's daily clip opportunities (movies, games, anime)", "studio"],
  "tiktok-trends": ["tiktok-trends", "TikTok Sound, Format and Fandom Watchers: what's rising on TikTok right now", "studio"],
  "youtube-trends": ["youtube-trends", "YouTube Shorts Watcher: live YouTube chart data and what to clip for Shorts", "studio"],
  growth: ["growth", "Growth Coach: channel stats, monetization progress and today's top actions", "studio"],
  studio: ["studio", "Studio: Director's clip plans, Social Strategist captions, Studio Critic reviews, Producer's weekly plan", "studio"],
  "ads-studio": ["ads-studio", "Ads Studio: Ad Creative Director concepts and Ad Copywriter copy", "studio"],
  alerts: ["alerts", "Anything that failed or needs your attention"]
};
// Which channel each agent reports to
export const AGENT_CHANNEL = { "daily-task": "daily-focus", content: "content", ideas: "product-ideas", listing: "listings", review: "weekly-review", "credit-scout": "research", "github-radar": "research", researcher: "research", "trading-desk": "trading-desk", "head-trader": "trading-desk", backtest: "trading-desk", launch: "listings", seo: "seo", "competitor-scout": "competitors", "partner-finder": "competitors", "content-creator": "content", webdev: "content", seasonal: "content", "email-marketer": "content", "product-builder": "product-ideas", bookkeeper: "sales", "customer-care": "sales", "studio-scout": "studio-trends", "tiktok-sounds": "tiktok-trends", "tiktok-formats": "tiktok-trends", "tiktok-fandoms": "tiktok-trends", "youtube-watcher": "youtube-trends", "growth-coach": "growth", "studio-director": "studio", "studio-writer": "studio", "studio-critic": "studio", "studio-producer": "studio", "ads-director": "ads-studio", "ads-copywriter": "ads-studio" };

export const hasDiscord = () => Boolean(process.env.DISCORD_BOT_TOKEN);

async function api(path, init = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(20000), headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN.trim()}`, "Content-Type": "application/json", "User-Agent": "AgentHQ (https://github.com/RecreationalViper/agent-hq, 1.0)" } });
    if (res.status === 429) { const j = await res.json().catch(() => ({})); await sleep(Math.ceil((j.retry_after || 2) * 1000)); continue; }
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) throw new Error(`Discord ${res.status}: ${data.message || text.slice(0, 150)}`);
    return data;
  }
  throw new Error("Discord kept rate-limiting");
}

// Creates the category and any missing channels; saves their ids to discord.json.
export async function setupChannels() {
  const guilds = await api("/users/@me/guilds");
  const me = await api("/users/@me");
  const invite = `https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot&permissions=85008`;
  if (!guilds.length) throw new Error(`The bot isn't in any server yet. Invite it: ${invite}`);
  // Studio channels (third element "studio") live in their own server, named with "Studio"; everything else in Agent HQ.
  const studio = guilds.find((g) => /studio/i.test(g.name));
  const guild = guilds.find((g) => /agent hq/i.test(g.name)) || guilds.find((g) => g !== studio) || guilds[0];
  const ids = {}, created = [], removed = [];
  async function build(g, catName, keys) {
    const existing = await api(`/guilds/${g.id}/channels`);
    let cat = existing.find((c) => c.type === 4 && c.name.toLowerCase() === catName.toLowerCase());
    if (!cat) cat = await api(`/guilds/${g.id}/channels`, { method: "POST", body: JSON.stringify({ name: catName, type: 4 }) });
    for (const key of keys) {
      const [name, topic] = CHANNELS[key];
      let ch = existing.find((c) => c.type === 0 && c.name === name);
      if (!ch) { ch = await api(`/guilds/${g.id}/channels`, { method: "POST", body: JSON.stringify({ name, type: 0, topic, parent_id: cat.id }) }); created.push(name); }
      ids[key] = ch.id;
    }
    return existing;
  }
  const studioKeys = Object.keys(CHANNELS).filter((k) => CHANNELS[k][2] === "studio");
  const mainKeys = Object.keys(CHANNELS).filter((k) => !studioKeys.includes(k));
  const mainExisting = await build(guild, "Agent HQ", studio ? mainKeys : Object.keys(CHANNELS));
  if (studio) {
    await build(studio, "Studio", studioKeys);
    // Studio channels moved to their own server: remove the old copies from Agent HQ.
    for (const key of studioKeys) {
      const old = mainExisting.find((c) => c.type === 0 && c.name === CHANNELS[key][0]);
      if (old) { await api(`/channels/${old.id}`, { method: "DELETE" }); removed.push(old.name); }
    }
  }
  await fs.writeFile("discord.json", JSON.stringify({ server: guild.name, serverId: guild.id, ...(studio ? { studioServer: studio.name, studioServerId: studio.id } : {}), channels: ids }, null, 2) + "\n");
  return { server: guild.name, studioServer: studio?.name || null, created, removed, invite, total: Object.keys(ids).length };
}

async function channelId(key) {
  try { return JSON.parse(await fs.readFile("discord.json", "utf8")).channels?.[key] || null; } catch { return null; }
}

// Turns a Markdown report into a Discord-friendly summary (Discord shows **bold**, bullets and links).
function forDiscord(md, max = 3800) {
  let t = md.replace(/^# .*\n+/, "").replace(/^>\s?/gm, "").replace(/^#{2,6}\s+(.*)$/gm, "**$1**").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > max) t = t.slice(0, t.lastIndexOf("\n", max) > max * 0.6 ? t.lastIndexOf("\n", max) : max) + "\n\n…";
  return t;
}

// Posts a report to the agent's channel. Never throws (reporting must not break agents).
export async function report(agentKey, title, markdown, { color = 0x6d7f5f, file } = {}) {
  if (!hasDiscord()) return false;
  try {
    const key = CHANNELS[agentKey] ? agentKey : AGENT_CHANNEL[agentKey] || "alerts";
    const id = await channelId(key);
    if (!id) { console.log("  Discord not set up yet (run the Discord Setup workflow)"); return false; }
    await api(`/channels/${id}/messages`, { method: "POST", body: JSON.stringify({ embeds: [{ title: title.slice(0, 250), description: forDiscord(markdown), color, url: SITE + (file ? `#${file}` : ""), footer: { text: "Agent HQ · full report on the site" }, timestamp: new Date().toISOString() }] }) });
    console.log(`  posted to Discord #${CHANNELS[key][0]}`);
    return true;
  } catch (e) { console.log(`  couldn't post to Discord: ${e.message}`); return false; }
}

// Posts any message (embeds + buttons) to an agent's channel. Never throws.
export async function postMessage(agentKey, payload) {
  if (!hasDiscord()) return false;
  try {
    const key = CHANNELS[agentKey] ? agentKey : AGENT_CHANNEL[agentKey] || "alerts";
    const id = await channelId(key);
    if (!id) return false;
    await api(`/channels/${id}/messages`, { method: "POST", body: JSON.stringify(payload) });
    return true;
  } catch (e) { console.log(`  couldn't post to Discord: ${e.message}`); return false; }
}

export async function alert(text) {
  if (!hasDiscord()) return false;
  try {
    const id = await channelId("alerts");
    if (!id) return false;
    await api(`/channels/${id}/messages`, { method: "POST", body: JSON.stringify({ content: text.slice(0, 1900) }) });
    return true;
  } catch (e) { console.log(`  couldn't post to Discord: ${e.message}`); return false; }
}

// Posts a message with image/file attachments (up to 10 per message) so they can be saved from the Discord app.
// files: [{ name, data: Buffer, type }]. Never throws.
export async function postFiles(agentKey, text, files = []) {
  if (!hasDiscord()) return false;
  try {
    const key = CHANNELS[agentKey] ? agentKey : AGENT_CHANNEL[agentKey] || "alerts";
    const id = await channelId(key);
    if (!id) { console.log("  Discord not set up yet (run the Discord Setup workflow)"); return false; }
    for (let attempt = 0; attempt < 4; attempt++) {
      const form = new FormData();
      form.append("payload_json", JSON.stringify({ content: text.slice(0, 1990), attachments: files.slice(0, 10).map((f, i) => ({ id: i, filename: f.name })) }));
      files.slice(0, 10).forEach((f, i) => form.append(`files[${i}]`, new Blob([f.data], { type: f.type || "image/jpeg" }), f.name));
      const res = await fetch(`${API}/channels/${id}/messages`, { method: "POST", body: form, signal: AbortSignal.timeout(60000), headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN.trim()}`, "User-Agent": "AgentHQ (https://github.com/RecreationalViper/agent-hq, 1.0)" } });
      if (res.status === 429) { const j = await res.json().catch(() => ({})); await sleep(Math.ceil((j.retry_after || 2) * 1000)); continue; }
      if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return true;
    }
    throw new Error("Discord kept rate-limiting");
  } catch (e) { console.log(`  couldn't post files to Discord: ${e.message}`); return false; }
}
