# SahaPlay Recovery Runbook

## 1. Server Crash Recovery
- If using PM2: server auto-restarts
- If not using PM2: SSH to server, navigate to project folder, run: `node backend/server.js`
- Check `backend/.env` exists and `JWT_SECRET` is set
- Active room state is lost on restart — users must manually reload media. Chat history is preserved.

## 2. Super Admin Account Recovery
If the super_admin account is accidentally terminated or banned and cannot log in:
1. Open Supabase dashboard → SQL Editor
2. Run this SQL (replace `yourusername` with your actual username):
   ```sql
   UPDATE users
   SET terminated = FALSE,
       is_permanently_banned = FALSE,
       banned_until = NULL,
       role = 'super_admin'
   WHERE username = 'yourusername';
   ```
3. Log in normally after running this SQL.

WARNING: This bypasses all application-level checks. Only run this SQL on your own account and only when locked out.

## 3. Schema Recreation
If the database is wiped and needs to be recreated from scratch:
1. Create a new Supabase project
2. Update `backend/.env` with the new `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`
3. Start the server: `node backend/server.js`
4. All tables and indexes are created automatically on startup via the `migrationsReady` block in server.js
5. Data cannot be recovered this way — only the schema structure

## 4. Supabase Backup Restore
- Free tier: daily automated backups, 7-day retention, full-database restore only
- To restore: Supabase Dashboard → Settings → Backups → select a backup → Restore
- WARNING: Restoring overwrites ALL current data. This is a last resort.
- For a manual pg_dump backup before risky changes: use the connection string from Supabase Dashboard → Settings → Database → Connection string, then run:
  ```
  pg_dump "postgresql://..." > backup.sql
  ```

## 5. Avatar Files
- User avatars are stored in `backend/avatars/` on the server filesystem (NOT in Supabase)
- Back up this folder manually before any server migration:
  ```
  cp -r backend/avatars/ ~/avatars-backup/
  ```
- If lost, avatars cannot be recovered

## 6. Email Failure Recovery
- **Support requests**: if email fails, the request is still saved. Check admin dashboard → Support Inbox. Failed emails show `email_notification_status = 'failed'` in Supabase Table Editor → `support_requests`
- **Admin invites**: if invite email fails, delete the failed invite in the admin panel and send a new one. Do not try to recover the original token.

## 7. Support Attachment Cleanup
- Run monthly: send a POST request to `/api/admin/support-requests/cleanup-attachments` (requires super_admin auth)
- This permanently deletes attachments from resolved requests older than 90 days
- If never run, attachments accumulate in the `support-attachments` Supabase storage bucket and may hit free-tier limits

## 8. Accidental Data Deletion
- Message unsend/delete: permanent, cannot be recovered
- Account self-delete: permanent unless restored from a Supabase daily backup (restores entire database, not just one user)
- Room deletion by admin: permanent
- E2EE private keys are deleted with the user account — encrypted message history from that user cannot be decrypted after deletion
