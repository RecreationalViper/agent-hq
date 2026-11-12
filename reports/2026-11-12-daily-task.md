# Daily Focus - 2026-11-12

## 🎯 Today’s Quick 30‑Minute Task  
**Refresh the Pinterest authentication token** (the one that’s now expired) and save it as `PINTEREST_TOKEN` in the repo.

### Why this matters
- **Pinterest is our highest‑traffic channel for holiday‑season leads.**  
- The token expired → we can’t schedule or publish pins for Thanksgiving, Veterans Day, or the upcoming Black‑Friday / Christmas campaigns.  
- Getting a fresh token now lets us start posting **today** (the “Veterans Day” remembrance pin should go live immediately) and keeps the 30‑day lead‑generation window open.

### How to do it (iPhone‑only)

| Step | What to do (tap & type) | Time |
|------|--------------------------|------|
| 1️⃣ Open the Pinterest app → tap **Profile** → tap the **gear icon** (Settings) | 1 min |
| 2️⃣ Scroll to **“Security”** → tap **“Developer access”** (or “Apps & Websites”) | 1 min |
| 3️⃣ Tap **“Create new token”** (you may need to log in again) | 2 min |
| 4️⃣ Give the token a name like **“ForeverHeld‑AutoPin”** and grant **read + write** scopes. | 1 min |
| 5️⃣ Tap **“Generate”** → copy the long string that appears. | 1 min |
| 6️⃣ Open the **Files** app (or any code‑editor app you use on iPhone, e.g., Textastic, iA Writer). Navigate to the repo root and open **`config/.env`** (or create it if missing). | 3 min |
| 7️⃣ Add a line (or replace the existing one) exactly:  

```
PINTEREST_TOKEN=your‑new‑token‑here
```  

*No spaces before/after the `=`.* | 2 min |
| 8️⃣ Save the file. | 1 min |
| 9️⃣ Verify the token works: open Safari, go to `https://api.pinterest.com/v5/me` (you’ll need the token in the `Authorization: Bearer …` header – you can use a quick “REST Client” app like *HTTPBot*). If you get a JSON response with your profile info, the token is valid. | 5 min |
| **✅ Done!** | — |

### How to know it’s finished
- The file **`config/.env`** (or wherever you store env vars) now contains a line `PINTEREST_TOKEN=…` with the fresh token.  
- A quick API call returns your Pinterest profile JSON (no 401 error).  
- You can now resume the scheduled pin creation (e.g., the “Honoring Fallen Heroes this Veterans Day” pin) without further delay.

---

**Next step (once the token is saved):**  
*When you have a moment later this week, draft the Veterans‑Day pin copy and image brief and ask for my approval before scheduling it.*  

*All set—thanks for keeping the shop’s holiday‑season pipeline moving!*
