// Shift rules between Ploy AI and our agents (see AGENTS.md and ploy/status.md).
// ploy/state.json says whether Ploy is on shift. If it is older than 14 hours we fall back to the clock:
// Ploy's credits reset at 7 pm New York, so 7 pm-midnight counts as Ploy's shift.
import fs from "node:fs";

export function ployState() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync("ploy/state.json", "utf8")); } catch {}
  const age = Date.now() - Date.parse(s.updatedAt || 0);
  let onShift = Boolean(s.ploy?.onShift || s.ploy?.working), source = "Claude's last Ploy check";
  if (!(age < 14 * 3600e3)) {
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    onShift = h >= 19; source = "the clock (no fresh Ploy check)";
  }
  return { onShift, source, jobs: s.jobs || {}, raw: s };
}

// May our side CHANGE something in this job area right now? Prep work (research, drafts "For Ploy") is always fine.
export function mayChange(area) {
  const { onShift, jobs } = ployState();
  const j = jobs[area];
  if (!j || j.lead !== "ploy") return { ok: true, why: "not a Ploy job" };
  if (j.together) return { ok: true, why: "owner said work together on this; still never overwrite Ploy's pages" };
  if (onShift) return { ok: false, why: "Ploy is on shift and leads this job; prepare notes for Ploy instead" };
  return { ok: false, why: "Ploy leads this job; on its break we only prepare work for Ploy, we don't change its work" };
}

// Text block for agent prompts.
export async function shiftBlock() {
  const { onShift, source } = ployState();
  const board = fs.existsSync("ploy/status.md") ? fs.readFileSync("ploy/status.md", "utf8").slice(0, 9000) : "";
  return `\n\n## Ploy shift (Ploy AI leads the website, SEO, ads, leads and positioning jobs)\nRight now Ploy is ${onShift ? "ON SHIFT (working): do not duplicate or compete with its jobs; only add short notes under '## For Ploy' if truly useful" : "ON BREAK: do the shift work assigned to you on the board and write it under a heading '## For Ploy'"} (from ${source}).\nNever change, redo or contradict Ploy's work; follow ploy/brand.md; no ad spend, no outreach.\n\n${board}`;
}
