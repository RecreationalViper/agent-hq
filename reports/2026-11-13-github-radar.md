# GitHub Radar - 2026-11-13

### Adopt today

* **OrchestratorInc/agent-orchestrator** — Open-source fleet orchestrator for managing Claude Code tasks with native iPhone support. Fits our $0 / iPhone setup because it requires no paid infrastructure and provides mobile management. *First step:* Open `github.com/OrchestratorInc/agent-orchestrator`, tap **Releases**, and check the iOS setup instructions. *(Requires owner approval).*

---

### Free tokens worth checking

* **Google AI Studio (Gemini API)** (`https://aistudio.google.com`) — Free permanent tier covering Gemini 3.5/3.6 Flash models plus 500 grounded search requests daily [1, 3]. *Verify:* Check free RPD/RPM limits in Google AI Studio console. *Risk:* Low; official provider tier we already use.
* **Parallel for Startups** (`https://parallel.ai/startups`) — $250 direct-apply API credits for web data APIs with no credit card required [7, 9]. *Verify:* Confirm eligibility requirements on parallel.ai. *Risk:* 6-month expiration; pending approval.
* **AMD AI Developer Program (Token Lab)** (`https://amd.com`) — Free hosted DeepSeek V4, Qwen3.8, and Gemma 4 access [11]. *Verify:* Check point allocation upon registration. *Risk:* Unverified third-party trial with unpublished token limits.

---

### Spend less with what you already have

* **Claude Code usage reduction:** Run `/clear` or `/compact` at the end of each investigation task [12, 14]. Claude Code sends full session history with every prompt; starting fresh prevents exponential token growth.
* **Repo change 1 (`scout/scan.mjs`):** Prune system prompts and static instructions in script calls to cut daily context overhead before passing data to Gemini.
* **Repo change 2 (`.github/workflows/`):** Ensure Cloudflare AI Gateway caching headers (`cf-aig-cache: true`) are set on repeated cron API requests so identical scans consume zero model tokens.

---

### Ignore for now

* `janestreet/agent_skills`: Focused on proprietary OCaml workflows.
* `Zoom AI Launchpad`: Requires enterprise voice/video startup.
* `AgentRouter`: Third-party key proxy risk.

---

### Do this now:

Open GitHub on your phone, navigate to `scout/scan.mjs`, and trim any redundant prompt instructions to lower token usage on every scanner run.
