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

// May our side CHANGE something in this job area right now?
// Owner's rule (Nov 12): while Ploy is running, don't touch its jobs. While Ploy is on break, our agents are fully
// hands-on: they build, edit and publish, using Ploy's methods and brand guide as the frame of reference.
export function mayChange(area) {
  const { onShift, jobs } = ployState();
  const j = jobs[area];
  if (!j || j.lead !== "ploy") return { ok: true, why: "not a Ploy job" };
  if (j.together) return { ok: true, why: "owner said work together on this" };
  if (onShift) return { ok: false, why: "Ploy is running right now; hands off until its break" };
  return { ok: true, why: "Ploy is on break: our shift, hands-on" };
}

// Text block for agent prompts.
export async function shiftBlock() {
  const { onShift, source } = ployState();
  const board = fs.existsSync("ploy/status.md") ? fs.readFileSync("ploy/status.md", "utf8").slice(0, 9000) : "";
  return `\n\n## Ploy shift (Ploy AI leads the website, SEO, ads, leads and positioning jobs)\nRight now Ploy is ${onShift ? "RUNNING: hands off its jobs (website, SEO pages, ads, leads, positioning). Do research and plans only; put anything for Ploy under '## For Ploy'" : "ON BREAK: it's our shift. Work hands-on on everything (leads, email capture and funnels, sales, SEO, website improvements, customer care), using Ploy's methods and brand guide as the frame of reference. Give concrete, ready-to-use output, not just ideas"} (from ${source}).\nDon't undo Ploy's finished work; follow ploy/brand.md; never spend money; first contact with any business or person needs the owner's Discord approval.\n\n${board}`;
}
