# GitHub Radar - 2026-11-09

**Adopt today**  
1. **modelcontextprotocol/python‑sdk** – lets you query a model’s token limits & context window *without any extra server*; perfect for trimming prompts on the iPhone.  
   *5‑min step*: Open the repo, tap **Code → Download ZIP**, unzip in the Files app, open `example.py` and run the shown `python3 example.py` (the repo includes a tiny script that prints your current model’s max tokens).  

2. **obra/superpowers** – a collection of tiny CLI “powers” (e.g., `grep‑ai`, `summarize‑ai`) that work with any local or hosted model via a single command line call; they run inside the existing GitHub Action workflow you already have.  
   *5‑min step*: In the repo, tap **Code → Add file → Create new file**, name it `superpowers.sh` and paste the one‑line install command from the README (`curl -fsSL https://raw.githubusercontent.com/obra/superpowers/main/install.sh | sh`). Commit; the next Action run will have the new commands available.  

3. **google/skills** – ready‑made “skill” snippets (e.g., “extract‑JSON”, “list‑tasks”) that you can drop into your prompts; they’re pure text, no extra cost.  
   *5‑min step*: Open the repo, tap **Code → Go to file → skills/extract_json.md**, copy the whole block, and paste it at the top of your existing prompt template in `.github/workflows/ai.yml`.  

**Free tokens worth checking** – *none* this scan. (All previous offers are either expired or unverified.)

**Spend less with what you already have**  
1. **Reduce prompt size** – edit `.github/workflows/ai.yml` and replace the long “system‑message” block with the `google/skills` snippet for “concise‑system”.  
2. **Enable caching** – add `cache: true` to the `gemini` step in `action.yml` (line 22) so identical requests reuse the previous response.  
3. **Batch calls** – combine any two consecutive “summarize” jobs into one step by merging their inputs in `summarize_batch.py`.  

**Ignore for now** –  
- anthropics/claude‑plugins‑official – *requires paid API*  
- github/awesome‑copilot – *mostly UI demos*  
- google/adk‑recipes – *Android‑only tooling*  

**Do this now:**  
Open the repo on your iPhone, add the `superpowers.sh` install file (step 2 above), commit, and trigger the next GitHub Action run (tap **Actions → Run workflow**). This takes under 30 minutes and immediately gives you reusable AI CLI shortcuts.
