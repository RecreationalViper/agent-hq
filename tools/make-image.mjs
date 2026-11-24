// Shared free image maker for any agent (studio or shop).
//   import { makeImage } from "./tools/make-image.mjs";
//   await makeImage("cinematic thumbnail of ...", "out/thumb.jpg", { width: 1080, height: 1920 });
// CLI: node tools/make-image.mjs "prompt" out.jpg [width] [height]
// Tries Pollinations (POLLINATIONS_API_KEY, Flux) first, then Cloudflare Workers AI FLUX.1 schnell
// (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID). Both are free tiers; nothing here bills a card.
import fs from "node:fs/promises";
import path from "node:path";

export async function makeImage(prompt, outFile, { width = 1080, height = 1920, model = "flux", seed } = {}) {
  const errors = [];
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (key) {
    try {
      const q = new URLSearchParams({ model, width: String(width), height: String(height), nologo: "true", private: "true", ...(seed ? { seed: String(seed) } : {}) });
      const res = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      return save(outFile, Buffer.from(await res.arrayBuffer()), "Pollinations");
    } catch (e) { errors.push(`Pollinations ${e.message}`); }
  }
  const tok = process.env.CLOUDFLARE_API_TOKEN?.trim(), acct = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (tok && acct) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 8, ...(seed ? { seed } : {}) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.result?.image) throw new Error(`${res.status}: ${JSON.stringify(data.errors || data).slice(0, 160)}`);
      return save(outFile, Buffer.from(data.result.image, "base64"), "Cloudflare FLUX");
    } catch (e) { errors.push(`Cloudflare ${e.message}`); }
  }
  throw new Error(errors.length ? `No image made: ${errors.join(" | ")}` : "No image provider key set (POLLINATIONS_API_KEY or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)");
}

async function save(outFile, buf, via) {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, buf);
  console.log(`Image saved to ${outFile} via ${via} (${Math.round(buf.length / 1024)} KB)`);
  return { file: outFile, via };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [prompt, out = "out/image.jpg", w, h] = process.argv.slice(2);
  if (!prompt) { console.log('Usage: node tools/make-image.mjs "prompt" out.jpg [width] [height]'); process.exit(1); }
  await makeImage(prompt, out, { width: Number(w) || 1080, height: Number(h) || 1920 });
}
