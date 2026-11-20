// Asks Friday a few questions with the agents' test key (derived from PAYHIP_API_KEY) and prints the answers.
import crypto from "node:crypto";
const key = crypto.createHash("sha256").update("friday-check:" + (process.env.PAYHIP_API_KEY || "").trim()).digest("hex");
const URL_ = "https://foreverheld-sales.foreverheld.workers.dev/friday";
const bad = await fetch(URL_, { method: "POST", headers: { "x-friday-key": "wrong" }, body: "{}" });
console.log(`wrong key -> HTTP ${bad.status} (should be 401)`);
for (const q of (process.env.QUESTIONS || "Good morning Friday, what's going on with my business?|How many churches have we emailed and did anyone reply?|What's 15 percent of 9.99?").split("|")) {
  const r = await fetch(URL_, { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ q }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\nQ: ${q}\nA (${r.status}): ${j.say}${j.phone ? `\n[phone ${JSON.stringify(j.phone)}]` : ""}${j.ran ? `\n[ran ${j.ran}]` : ""}${j.why ? `\n[why ${j.why.join(" | ")}]` : ""}`);
}
