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

## Production Deploy
1. Set up a Linux server (VPS, Render, Railway, etc.)
2. Copy all files except `.env` files
3. Create `backend/.env` on the server with production values
4. Install PM2: `npm install -g pm2`
5. Start backend: `pm2 start backend/ecosystem.config.js`
6. Build frontend: `cd frontend && npm run build`
7. Serve the `frontend/dist` folder via nginx or your hosting platform
8. Update `FRONTEND_URL` in `backend/.env` to your production domain

## Starting the backend in production

Do NOT use: `node backend/server.js`
DO use: `pm2 start backend/ecosystem.config.js`

Commands:
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
