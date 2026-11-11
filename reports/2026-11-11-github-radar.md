# GitHub Radar - 2026-11-11

# GitHub Radar Report — 2026-11-11

### 1. Adopt today
- **obsidianmd/obsidian-skills** — Standardized agent skill definitions (`SKILL.md`) for Markdown, JSON Canvas, and file workflows. Fits your $0 setup because it provides clean prompt structures for reading/writing markdown without needing hosted servers or extra software.
  - **First step:** Open Safari on your iPhone -> navigate to `github.com/obsidianmd/obsidian-skills` -> tap into any `SKILL.md` file -> check if the prompt structure can be adapted for your repo's markdown agents.

### 2. Free tokens worth checking
- No new verified free token, credit, or tier offers detected in today's scan.

### 3. Spend less with what you already have
- **Filter unchanged watchlist items before calling AI**: Edit `scout/scan.mjs` (or your workflow script) to strip static watchlist items out of the prompt context before calling the Gemini API to cut down daily input token size.
- **Trim system prompts in workflows**: In `.github/workflows/`, shorten repetitive instructions in the prompt step by referencing key rules directly, reducing token costs on every automated run.
- **Cache historical reports**: Rely on committed markdown reports in the repo for past context instead of passing historical radar outputs back into fresh daily API runs.

### 4. Ignore for now
- **modelcontextprotocol/python-sdk** — Requires server runtime on iPhone.
- **google/adk-recipes** — Too generic for simple setup.

### Do this now:
Open GitHub in your iPhone browser, view `obsidianmd/obsidian-skills`, and check `SKILL.md` to see if any prompt templates can be copied directly into your repo's agent prompts.
