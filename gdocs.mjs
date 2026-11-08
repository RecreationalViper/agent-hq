// Writes agent updates into a Google Doc using a Google Cloud service account
// (GOOGLE_SERVICE_ACCOUNT_JSON secret). The doc must be shared with the service
// account's email as an editor. No packages needed: the JWT is signed with node:crypto.
import crypto from "node:crypto";

const DOCS = process.env.GDOCS_API_BASE || "https://docs.googleapis.com/v1";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
let cached;

export const hasGoogle = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

function credentials() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  raw = raw.trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8"); // allow base64-encoded too
  const c = JSON.parse(raw);
  if (!c.client_email || !c.private_key) throw new Error("The service account JSON is missing client_email or private_key.");
  return c;
}

async function token() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const c = credentials();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: c.client_email, scope: "https://www.googleapis.com/auth/documents", aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(c.private_key, "base64url");
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }), signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

async function docs(path, init = {}) {
  const res = await fetch(DOCS + path, { ...init, signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Docs ${res.status}: ${data.error?.message || "request failed"}`);
  return data;
}

const paraText = (p) => (p.elements || []).map((e) => e.textRun?.content || "").join("");

// Markdown report -> plain lines for the doc
export function mdToLines(md, maxChars = 3500) {
  const lines = [];
  for (let line of md.split("\n")) {
    line = line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^>\s?/, "").trimEnd();
    if (!line.trim() || /^-{3,}$/.test(line.trim())) continue;
    let m;
    if ((m = line.match(/^#{1,6}\s+(.*)/))) lines.push(m[1].trim());
    else if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) lines.push(`${m[1].length >= 2 ? "    ◦ " : "• "}${m[2]}`);
    else lines.push(line.trim());
  }
  let out = [], n = 0;
  for (const l of lines) { if (n + l.length > maxChars) { out.push("… (shortened, full report on the Agent HQ site)"); break; } out.push(l); n += l.length + 1; }
  return out;
}

// Inserts "<title>" (as a small heading) and body lines right under the heading `anchor`.
export async function addUpdate(docId, anchor, title, bodyLines) {
  const doc = await docs(`/documents/${docId}`);
  const content = doc.body?.content || [];
  const idx = content.findIndex((e) => e.paragraph && paraText(e.paragraph).trim() === anchor);
  if (idx < 0) throw new Error(`Couldn't find the "${anchor}" heading in the doc.`);
  // insert after the heading and its one-line description paragraph (if it's normal text)
  let at = content[idx].endIndex;
  const next = content[idx + 1];
  if (next?.paragraph && next.paragraph.paragraphStyle?.namedStyleType === "NORMAL_TEXT" && /automatically/i.test(paraText(next.paragraph))) at = next.endIndex;
  const head = `${title}\n`, body = bodyLines.join("\n") + "\n";
  await docs(`/documents/${docId}:batchUpdate`, { method: "POST", body: JSON.stringify({
    writeControl: { requiredRevisionId: doc.revisionId },
    requests: [
      { insertText: { location: { index: at }, text: head + body } },
      { updateParagraphStyle: { range: { startIndex: at, endIndex: at + head.length }, paragraphStyle: { namedStyleType: "HEADING_3" }, fields: "namedStyleType" } },
      { updateParagraphStyle: { range: { startIndex: at + head.length, endIndex: at + head.length + body.length }, paragraphStyle: { namedStyleType: "NORMAL_TEXT" }, fields: "namedStyleType" } },
      { updateTextStyle: { range: { startIndex: at + head.length, endIndex: at + head.length + body.length - 1 }, textStyle: { bold: false, italic: false }, fields: "bold,italic" } }
    ]
  }) });
}

// Read-only check that the key works and the doc is shared with the robot.
export async function checkAccess(docId) {
  const doc = await docs(`/documents/${docId}?fields=title`);
  return { title: doc.title, robot: credentials().client_email };
}
