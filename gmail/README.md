# Email team

Agents that work your Gmail from GitHub Actions. All of them share one Google sign-in
(the three `GMAIL_*` secrets below), so later agents need no new setup.

| Agent | What it does | Status |
| --- | --- | --- |
| **Junk Sweeper** (`sweep.mjs`) | Once a day, in bulk: trashes junk, sends phishing to Spam, leaves anything from a person alone | live |
| Inbox Organizer | Labels and sorts what's left (customers, orders, money, personal) | planned |
| Customer Desk | Drafts replies to customer inquiries and posts a summary to Discord for your OK | planned |
| Email Marketing | Drafts newsletters and promos for the shop for your approval | planned |

## How the sweeper decides

Rules first, which costs nothing: Gmail's own Promotions tab, the sender checks Gmail already ran
(SPF/DKIM/DMARC), sender domains, and subject patterns in [`rules.json`](rules.json). Only bulk
mail the rules can't place goes to the free AI, and the AI sees just the sender's domain and the
subject. It never sees the email body. When unsure, it **keeps** the email.

- Never touches: threads you replied to, starred mail, personal mail, receipts/orders/shipping,
  security codes, bank/credit/payment alerts, anything from Etsy, Canva, Google, GitHub, Payhip.
- Phishing needs **two** warning signs (e.g. addressed to someone else + "verify your e-deposit").
- Junk goes to **Trash** (30 days to undo); phishing goes to **Spam**. Both get the label
  **Junk Sweeper**, so you can see everything it moved.
- This repo is public, so the Actions log shows **counts only**. Senders and subjects go to the
  private Discord **#inbox** channel (run *Discord Setup* once to create it).

Wrong call? Add the sender's domain to the `GMAIL_KEEP_DOMAINS` or `GMAIL_JUNK_DOMAINS` secret
(comma-separated). Using secrets keeps your bank and contacts out of this public repo.

## One-time setup (≈10 minutes, free)

1. **Google Cloud project.** Go to console.cloud.google.com, create a project (e.g. "agent-hq"),
   then go to *APIs & Services → Library → Gmail API* and click **Enable**.
2. **Consent screen.** Go to *APIs & Services → OAuth consent screen* and pick **External**. Add
   your Gmail as a test user, then click **Publish app** so it shows *In production*. While it's
   in "Testing", the sign-in stops working every 7 days. You'll see an "unverified app" warning,
   which is normal for an app only you use.
3. **Client.** Go to *Credentials → Create credentials → OAuth client ID* and choose **Web
   application**. Under *Authorized redirect URIs*, add
   `https://developers.google.com/oauthplayground`. Copy the **Client ID** and **Client secret**.
4. **Refresh token.** Open developers.google.com/oauthplayground. Tap the ⚙️ gear, tick *Use your
   own OAuth credentials*, and paste the ID and secret. In the scope box, type
   `https://www.googleapis.com/auth/gmail.modify` and tap **Authorize APIs**. Sign in with the Gmail to clean and tap
   Allow (Advanced → continue past the warning). Then tap **Exchange authorization code for
   tokens** and copy the **Refresh token**. This scope lets the planned reply and customer
   agents draft and send too, so you won't redo this. It can't permanently delete anything.
5. **GitHub secrets.** In the repo, go to *Settings → Secrets and variables → Actions* and add
   `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN`.
   More Gmail accounts: repeat step 4 signed in as each one and save the tokens as
   `GMAIL_REFRESH_TOKEN_2` … `_5`.
6. **Test.** Go to *Actions → Gmail Junk Sweeper → Run workflow* and tick **Dry run**. You'll see
   counts and nothing changes. Then run it for real, or just wait for the next daily run.

```bash
node gmail/sweep.mjs --selftest   # rules vs. sample emails, no network
node gmail/sweep.mjs --dry-run    # locally, with the secrets exported: lists what it would move
```
