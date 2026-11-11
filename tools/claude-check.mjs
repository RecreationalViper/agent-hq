// Claude Check: is CLAUDE_API_KEY valid, which models can it use, and does a tiny reply work?
// Writes the result to reports/claude-check.md (the workflow commits it). Costs well under 1 cent.
import fs from "node:fs";
import { claudeModels, claudeChat, claudeSpent, CLAUDE_MONTHLY_CAP } from "../claude-ai.mjs";

const lines = [`# Claude Check - ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, ""];
if (!(process.env.CLAUDE_API_KEY || "").trim()) lines.push("RESULT claude: no key found (secret CLAUDE_API_KEY missing or empty)");
else {
  try {
    const ms = await claudeModels();
    lines.push(`Models this key can use (tried in this order): ${ms.join(", ")}`);
    const t = await claudeChat("You are a test.", "Reply with exactly: OK", { maxTokens: 10, temperature: 0, who: "claude-check" });
    lines.push(`RESULT claude: WORKS (reply "${t.slice(0, 20)}")`);
  } catch (e) { lines.push(`RESULT claude: FAILED: ${e.message.slice(0, 300)}`); process.exitCode = 1; }
  lines.push(`Spent this month: $${claudeSpent().toFixed(4)} of the $${CLAUDE_MONTHLY_CAP} cap`);
}
console.log(lines.join("\n"));
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/claude-check.md", lines.join("\n") + "\n");
