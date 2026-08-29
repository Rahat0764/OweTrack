# Ledger — Who Owes Whom

Track who owes you money, and who you owe — a private, per-account ledger built with Supabase + Vercel, reusing the auth/PIN/admin architecture from the Vault project with an entirely new visual identity.

## What it does
- Google & GitHub login (Supabase Auth) — each person gets their own private ledger.
- Add people ("contacts") with name + optional phone number (editable anytime). On Android Chrome you can also **pick directly from your phone's contacts**.
- For each person, log **"Gave"** (money you gave them) and **"Took"** (money you took from them) entries with an amount and an optional note/reason.
- Automatic balance calculation per person: "Owes you ৳X" / "You owe ৳X" / "Settled".
- Dashboard with total receivable, total payable, and net balance.
- Full entry history (filter, search, sort) plus per-person history.
- 6-digit security PIN: required on first login, required again to delete any entry/contact, and required **twice** to reset all data or delete your account (same flow as Vault).
- Profile photo upload with an in-browser crop tool.
- Bilingual UI — English by default, switchable to Bengali from Profile.
- CSV export of your full ledger.
- Developer credit bar at the top (same links/style as Vault).
- **Feedback (must-have):** every user can send in-app feedback (with an optional star rating) or reach you on WhatsApp, via a small draggable floating button. Replies from you show up under "My Feedback" on their Profile tab, with an unread badge.
- **Hidden admin system:** tap the Ledger logo **5 times** while logged in with the `SUPER_ADMIN_EMAIL` account to open a Master Key prompt. Once unlocked you get a **Manage** tab with:
  - **Users** — see every user's contact count, total gave/took, and entry count; **Suspend** (locks them out with a reason, reversible), **Unsuspend**, or **Ban & Erase** (permanently deletes the account, requires PIN entered twice).
  - **Feedback** — read/reply to every user's feedback, mark read/unread (single or bulk), delete entries.
  - The admin session itself is a short-lived signed token (6 hours), separate from the Master Key.

## 1. Supabase setup
1. Create a new Supabase project.
2. Open the SQL editor and run `supabase-schema.sql` from this repo.
3. Go to **Storage** → create a public bucket named `avatars`.
4. Go to **Authentication → Providers** and enable **Google** and **GitHub**, adding their client ID/secret and the redirect URL Supabase gives you.
5. Copy your **Project URL**, **anon public key**, and **service_role key** (Settings → API) — you'll need them below.

## 2. Deploy to Vercel
1. Push this folder to a GitHub repo and import it into Vercel (zero-config — it auto-detects the `/api` folder as serverless functions and `/public` as the static site).
2. Add these Environment Variables in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role key (server-side only, never exposed to the browser) |
| `SESSION_SECRET` | ✅ | Any long random string — used to sign the temporary admin session token |
| `MASTER_KEY` | ✅ (for admin) | The secret key you type in after the 5x logo tap to open the admin panel |
| `SUPER_ADMIN_EMAIL` | ✅ (for admin) | The exact email of the account allowed to use the Master Key / see the logo-tap trigger at all |
| `DEVELOPER_WHATSAPP_LINK` | optional | Used by the feedback button's "WhatsApp" option and the suspended-account screen |
| `DEVELOPER_GITHUB_LINK` | optional | Defaults to `https://github.com/Rahat0764` |
| `DEVELOPER_LINKEDIN_LINK` | optional | Defaults to `https://linkedin.com/in/RahatAhmedX` |
| `TG_BOT_TOKEN` | optional | Telegram bot token, for activity notifications |
| `TG_CHAT_ID` | optional | Telegram chat ID to receive notifications |
| `APK_URL` | optional | Link to the Android app, once built |

3. Deploy. Once live, set the Supabase Auth redirect URL (and Google/GitHub OAuth redirect URLs) to your Vercel domain.

## Notes
- The PIN is hashed with scrypt + a random salt (never stored in plain text).
- Row Level Security (`supabase-schema.sql`) makes sure every user can only ever see and edit their own contacts and entries.
- The mobile app version can be built later the same way Vault's was (wrapping this same site).
