// Creates the Agent HQ channels in Discord (safe to run again) and posts a hello.
import { setupChannels, report, hasDiscord } from "../discord.mjs";
if (!hasDiscord()) { console.log("RESULT: DISCORD_BOT_TOKEN secret is missing."); process.exit(1); }
const r = await setupChannels();
console.log(`RESULT: server "${r.server}", ${r.total} channels ready${r.created.length ? `, created: ${r.created.join(", ")}` : ""}${r.removed.length ? `, removed from Agent HQ: ${r.removed.join(", ")}` : ""}`);
console.log(r.studioServer ? `STUDIO: using server "${r.studioServer}"` : `STUDIO: no server with "Studio" in its name yet; studio channels stay in Agent HQ. Invite the bot: ${r.invite}`);
if (r.studioServer && r.created.includes("studio")) await report("studio", "Studio team connected", "This server is the studio's home:\n- **#studio-trends**: Trend Scout\n- **#studio**: Director, Social Strategist, Studio Critic, Producer\n- **#ads-studio**: Ad Creative Director, Ad Copywriter");
await report("alerts", "Agent HQ is connected", "Each agent now reports to its own channel here:\n- **#sales**: every sale and refund\n- **#daily-focus, #listings, #content, #product-ideas, #weekly-review**: the shop team\n- **#trading-desk**: paper trading, Head Trader and backtests\n- **#research**: Deep Researcher, Credit Scout, GitHub Radar\n- **#alerts**: anything that fails or needs you\n\nAsk Claude in the Agent HQ project anytime for more.");
