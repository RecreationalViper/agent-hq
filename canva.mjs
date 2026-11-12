// Canva for the agents (Connect API). The owner connects Canva once (link in Discord #alerts after Deploy
// Sales Feed); the sales-feed Worker keeps the tokens and hands agents a fresh access token.
// importDesign(): Canva turns a PDF into an editable Canva design (text stays editable) - works on a free Canva plan.
import fs from "node:fs/promises";
import crypto from "node:crypto";

const API = "https://api.canva.com/rest/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function canvaToken() {
  const key = (process.env.PAYHIP_API_KEY || "").trim();
  const feed = JSON.parse(await fs.readFile("sales-feed.json", "utf8").catch(() => "{}"));
  if (!key || !feed.url) throw new Error("Canva: needs PAYHIP_API_KEY and sales-feed.json (the Worker keeps the Canva sign-in)");
  const r = await fetch(`${feed.url}/canva/token`, { method: "POST", headers: { "x-read-token": crypto.createHash("sha256").update("read:" + key).digest("hex") }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (j.error === "not_connected") throw new Error("Canva isn't connected yet: tap the Connect Canva link in Discord #alerts");
  if (!j.ok) throw new Error(`Canva token: ${j.error || `HTTP ${r.status}`} ${j.message || ""}`.trim());
  return j.access_token;
}

async function call(token, path, init = {}) {
  const r = await fetch(API + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Canva ${path.split("?")[0]} HTTP ${r.status}: ${j.message || j.code || "failed"}`);
  return j;
}

// PDF (Buffer) -> editable Canva design. Returns { id, title, edit_url, view_url, thumbnail }
export async function importDesign(pdf, title, mime = "application/pdf") {
  const token = await canvaToken();
  const meta = { title_base64: Buffer.from(title.slice(0, 50)).toString("base64"), mime_type: mime };
  let job = (await call(token, "/imports", { method: "POST", headers: { "Content-Type": "application/octet-stream", "Import-Metadata": JSON.stringify(meta) }, body: pdf })).job;
  for (let i = 0; i < 60 && job.status === "in_progress"; i++) { await sleep(3000); job = (await call(token, `/imports/${job.id}`)).job; }
  if (job.status !== "success") throw new Error(`Canva import ${job.status}: ${job.error?.message || job.error?.code || "timed out"}`);
  const d = job.result.designs[0];
  return { id: d.id, title: d.title, edit_url: d.urls?.edit_url, view_url: d.urls?.view_url, thumbnail: d.thumbnail?.url };
}

export async function canvaMe() {
  const token = await canvaToken();
  return call(token, "/users/me");
}
