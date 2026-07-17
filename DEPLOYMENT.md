# SahaPlay Deployment Guide

## Prerequisites
- Node.js 18+
- npm
- A Supabase project (free tier works)
- Gmail account with App Password enabled (for email sending)
- Hyperbeam API key (optional, for cloud browser feature)

## Local Setup
1. Clone the repo
2. Copy `backend/.env.example` to `backend/.env` and fill in all values
3. Copy `frontend/.env.example` to `frontend/.env` and fill in `VITE_GOOGLE_CLIENT_ID`
4. Generate a strong `JWT_SECRET`:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
5. Add the generated value to `backend/.env` as `JWT_SECRET=<value>`
6. Install dependencies:
   ```
   cd backend && npm install
   cd ../frontend && npm install
   ```
7. Start both servers:
   - Backend: `cd backend && node server.js`
   - Frontend: `cd frontend && npm run dev`
   - Or use `start.ps1` (Windows PowerShell)

## Production Deploy (Render + Vercel)

### Step 1: Deploy backend to Render

1. Go to render.com → New → Web Service
2. Connect your GitHub repo (SahaPlay)
3. Settings:
   - Root directory: backend
   - Build command: npm install
   - Start command: node server.js
   - Instance type: Free (or paid for no sleep)
4. Add environment variables (all required):
   - JWT_SECRET (generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - DATABASE_URL (use direct connection string)
   - FRONTEND_URL=https://sahaplay.com,https://www.sahaplay.com
   - RESEND_API_KEY
   - FROM_EMAIL=noreply@sahaplay.com
   - SUPPORT_EMAIL=support@sahaplay.com
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - CHAT_ENCRYPTION_SECRET (generate same as JWT_SECRET — NEVER change after first deploy)
   - SENTRY_DSN (optional, from sentry.io)
   - NODE_ENV=production
5. Deploy. Render gives you a URL like: https://sahaplay-backend.onrender.com
6. Verify: GET /health returns {"status":"ok"}

Note: PM2/ecosystem.config.js is for VPS deployments only. Render manages its own process supervision — do not use PM2 on Render.

### Step 2: Deploy frontend to Vercel

1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Settings:
   - Root directory: frontend
   - Build command: npm run build
   - Output directory: dist
4. Add environment variables:
   - VITE_API_URL=https://sahaplay-backend.onrender.com
   - VITE_SOCKET_URL=https://sahaplay-backend.onrender.com
   - VITE_GOOGLE_CLIENT_ID (your Google OAuth client ID)
   - VITE_SENTRY_DSN (optional)
5. Deploy. Vercel gives you a URL like: https://sahaplay.vercel.app

### Step 3: Connect sahaplay.com domain

In Vercel → your project → Settings → Domains:
Add sahaplay.com and www.sahaplay.com

In Porkbun DNS, add:
- A record: @ → 76.76.21.21 (Vercel IP)
- CNAME record: www → cname.vercel-dns.com

### Step 4: Update environment variables

In Render, update FRONTEND_URL to: https://sahaplay.com,https://www.sahaplay.com

In Vercel, VITE_API_URL stays as the Render URL.

### Step 5: Google OAuth production setup

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
- Authorized JavaScript origins: add https://sahaplay.com
- Authorized redirect URIs: add https://sahaplay.com

### Step 5b: Apple Sign-In production setup

Requires an Apple Developer Program membership ($99/yr).

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → "+"
   → App IDs → create/reuse one with "Sign in with Apple" capability enabled.
2. Identifiers → "+" → Services IDs → create one (this is your APPLE_CLIENT_ID,
   e.g. `com.sahaplay.signin`). Enable "Sign in with Apple" on it, then configure:
   - Domains and Subdomains: sahaplay.com
   - Return URLs: https://sahaplay.com/login
3. Apple verifies domain ownership via a file it gives you — download it and place
   it at `frontend/public/.well-known/apple-developer-domain-association.txt` so it's
   served at https://sahaplay.com/.well-known/apple-developer-domain-association.txt.
4. Set APPLE_CLIENT_ID (Render) and VITE_APPLE_CLIENT_ID (Vercel) to the Services ID.

No Team ID / Key ID / .p8 private key needed — the backend only verifies the
identity token's signature/audience, it doesn't do server-to-server token exchange.

### Step 6: Set up UptimeRobot (free)

Go to uptimerobot.com → Add Monitor:
- Monitor type: HTTPS
- URL: https://sahaplay-backend.onrender.com/health
- Check interval: 5 minutes
- Alert contact: your email

### Pre-deploy verification checklist

Before opening to users, verify:
- [ ] GET https://sahaplay-backend.onrender.com/health returns {"status":"ok","uptime":...}
- [ ] Open https://sahaplay.com — app loads correctly
- [ ] No CORS errors in browser DevTools console
- [ ] Socket.IO connects (check DevTools → Network → WS tab shows an active connection)
- [ ] Login with email/password works
- [ ] Google Sign-In works (tests OAuth origin config)
- [ ] Create a room, send a message — confirms Socket.IO, DB write, E2EE all working
- [ ] Send an image — confirms Supabase Storage
- [ ] Check admin dashboard loads at /admin

## Storage

Room thumbnails and avatars are uploaded to Supabase Storage (`room-thumbnails` and
`avatars` buckets, both public) — not the server filesystem. This is required for
correctness on Render and other PaaS platforms, where the filesystem is ephemeral
and wiped on every redeploy/restart.

`backend/uploads/` and `backend/avatars/` were previously committed to git and have
since been untracked (`git rm -r --cached`) and added to `.gitignore`. This stops
new user media from being committed going forward, but **pre-existing git history
still contains this user media** in old commits. Before making this repository
public, that history must be purged with `git filter-repo` (or BFG Repo-Cleaner) —
this is a destructive rewrite of history requiring a force-push and is intentionally
not done as part of routine deploys.

### Stream chunk storage
Video stream chunks uploaded via `/api/stream/*` are stored temporarily in
`uploads/streams/` on the server filesystem. These are transient by design — chunks
are deleted after the stream session ends, and are not persisted across server
restarts or redeploys. This is expected behavior and does not affect stored chat
history or media (which uses Supabase Storage).

For multi-instance deployments, stream uploads must be routed to a single instance
(sticky sessions) since chunks are not shared across instances.

## Backend process supervision

### On Render (recommended)
Render manages process supervision automatically.
Use start command: `node server.js`
Do NOT use PM2 on Render — it is not needed and may conflict with Render's process model.

### On a VPS/self-hosted server
Use PM2 for process supervision:
```
pm2 start backend/ecosystem.config.js
pm2 status
pm2 logs sahaplay-backend
pm2 restart sahaplay-backend
pm2 stop sahaplay-backend
```

PM2 auto-restart on server reboot:
```
pm2 startup
pm2 save
```

## Rolling Back a Bad Deploy
1. Find the last known-good commit:
   ```
   git log --oneline main
   ```
2. Create a rollback branch:
   ```
   git checkout -b hotfix <commit-hash>
   ```
3. Deploy the hotfix branch instead of main
4. Or use `git revert <bad-commit-hash>` to create a new commit that undoes changes

## Git Tagging (do before every production deploy)
```
git tag stable-$(date +%Y%m%d) main
git push origin --tags
```
This marks a known-good state for easy rollback.

## Environment Variables — Required
See `backend/.env.example` for the full list.

Critical variables that must be set:
- `JWT_SECRET` (required — server won't start without it)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `FRONTEND_URL` (set to your production domain)
