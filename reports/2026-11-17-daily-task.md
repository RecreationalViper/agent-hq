# Daily Focus - 2026-11-17

**Today’s 30‑minute task (iPhone only)**  

### ✅ Refresh the Pinterest authentication token  

| **Why this matters** | - Pinterest is the main free traffic source we’re using to seed Thanksgiving, Christmas, and Blue‑Christmas pins.  
| | - The current token is expired (see *Pinterest stats unavailable*). Until we have a valid token, no new pins can be scheduled or posted, and the weekly “Thanksgiving‑to‑Christmas” content plan will stall.  
| | - Getting a new token now lets us start queuing the Harvest Table pins (Thanksgiving) and begin seeding Evergreen & Candlelight / Longest Night pins for December, keeping the 30‑day‑ahead search window active.  

### 📋 What to do (step‑by‑step on your iPhone)

1. **Open the Pinterest developer portal**  
   - In Safari (or your preferred browser) go to **https://developers.pinterest.com/** and tap **Log In**.  
   - Use the same Pinterest account you use for the store’s business profile.

2. **Create a new App / Token**  
   - If you already have an app listed, open it and go to **“OAuth & Tokens”**.  
   - Click **“Generate Access Token”** (or “Create new token”).  
   - Choose the scopes needed for posting pins: **`pins:read-write`** (and any others you normally use).  
   - Click **Generate** – copy the long token string that appears.

3. **Save the token for the repo**  
   - Open the **Files** app → locate the repo folder (you should have the repo synced via iCloud/Files).  
   - Navigate to `pinterest/` and open (or create if missing) a file named **`TOKEN.md`**.  
   - Paste the token on a new line, e.g.:  
     ```markdown
     PINTEREST_TOKEN=your_new_long_token_here
     ```  
   - Save the file.

4. **Update the repo’s environment (if you use a .env file)**  
   - If the project uses a `.env` file, open it and replace the old line `PINTEREST_TOKEN=...` with the new token.  
   - Save.

5. **Verify the token works** *(quick test)*  
   - Open the **Shortcuts** app → create a new shortcut that makes a simple GET request to `https://api.pinterest.com/v5/me/pins` with the header `Authorization: Bearer <your_token>`.  
   - Run the shortcut; you should see a JSON response (even if empty). If you get a 401 error, double‑check the token was copied correctly.

6. **Mark the task complete**  
   - In the repo (or wherever you track tasks), add a short note:  
     ```
     [2026‑11‑17] Pinterest token refreshed – ready for scheduling Thanksgiving & holiday pins.
     ```  

### 🎯 How you’ll know it’s done  

- **Token file (`TOKEN.md` or `.env`) contains the new string** and is saved in the repo.  
- **Shortcuts test returns a 200‑OK JSON response** (no 401/403).  
- You can now run the next “Content Creator” task (e.g., schedule the Harvest Table pins) without hitting the “authentication failed” error.  

---

*Once the token is refreshed, the next day’s task can be “Schedule 3 Harvest Table pins for Thanksgiving” using the Pinterest app or a scheduling tool.*  

*All steps stay within the iPhone, cost $0, and require no owner approval beyond confirming the token was saved.*
