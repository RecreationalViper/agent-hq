// Posts a message with images from the repo to a Discord channel (e.g. new collection previews to #listings).
// Usage: node tools/announce.mjs <channel> "<text>" path/one.jpg path/two.jpg
import fs from "node:fs/promises";
import path from "node:path";
import { postFiles } from "../discord.mjs";
const [channel, text, ...paths] = process.argv.slice(2);
if (!channel || !text) { console.log("usage: announce.mjs <channel> <text> [files...]"); process.exit(1); }
const files = [];
for (const p of paths.filter(Boolean)) files.push({ name: path.basename(p), data: await fs.readFile(p), type: p.endsWith(".png") ? "image/png" : "image/jpeg" });
const ok = await postFiles(channel, text, files);
console.log(ok ? `posted to #${channel}` : "post failed");
if (!ok) process.exit(1);
