// Usage: node tools/discord-alert.mjs "message"   (used by workflows when a run fails)
import { alert } from "../discord.mjs";
const run = process.env.GITHUB_RUN_ID ? ` Details: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
await alert(`⚠️ ${process.argv.slice(2).join(" ")}.${run}`);
