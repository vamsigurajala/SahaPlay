# SahaPlay Load Testing Plan

> **Status:** Planning complete — awaiting staging environment before executing medium/large tests.
> **Baseline Lighthouse runs:** completed against local dev server (see Section P).
> **Safe to run now:** Small local smoke tests only (no staging, no email, no Supabase storage writes).

---

## A. Environment Safety Rules

**Current environment state:**
- No staging environment exists. One Supabase project (production).
- No separate staging DB, storage bucket, or email sandbox.
- SMTP is live Gmail — any triggered email goes to a real address.
- Supabase storage buckets (`encrypted-media`, `support-attachments`) are production.

**Rules — never violate:**
1. Never load test the production database or production Supabase project.
2. Never send bulk requests that trigger real emails to the production SMTP endpoint.
3. Never upload test files to the production `encrypted-media` or `support-attachments` buckets.
4. Never seed fake users, messages, or reports into production tables.
5. Never run `TRUNCATE` or mass-DELETE against production.
6. Never run `EXPLAIN ANALYZE` on heavy queries against production under live traffic.
7. Never trigger the `cleanup-attachments` job against production storage during tests.
8. Never use real user passwords or JWT tokens in test scripts.
9. Never log or print E2EE `message`, `nonce`, or `ephemeralPublicKey` field values.
10. Always use a staging Supabase project with a separate `.env.staging` for medium/large runs.

**What is safe right now (local dev only, small scale):**
- Lighthouse frontend performance baselines (no backend writes)
- Manual Socket.IO smoke tests with 2–5 real browser tabs
- Rate limiter verification (10–20 requests, no email triggers)
- `EXPLAIN ANALYZE` on local DB with small seed data

---

## B. Recommended Tools

| Purpose | Tool | Reason |
|---|---|---|
| API load testing | k6 | JS test scripts natural for this Node stack; free; detailed percentile output |
| Socket.IO load testing | Artillery + `artillery-plugin-socketio` | Native Socket.IO support: handshake, emit, response assertions |
| Frontend performance | Lighthouse CLI (`npx lighthouse`) | Zero install; measures LCP/TTI/bundle size against local dev server |
| Database query analysis | `EXPLAIN ANALYZE` via Supabase SQL Editor or `psql` | Free; reveals index usage and plan cost |
| Storage upload testing | Custom Node script (`node-fetch` + `FormData`) | Direct HTTP control; avoids SDK abstractions |
| Admin data volume | Seed script (Node + `pg`) | Direct DB inserts; safe to truncate after |

Do not install k6 or Artillery until staging exists.

---

## C. Test Data Plan

### Dataset sizes

| Dataset | Users | Rooms | Messages | Support Requests | Reports | Audit Logs |
|---|---|---|---|---|---|---|
| **Small (local smoke)** | 50 | 10 | 500 | 20 | 20 | 200 |
| **Medium (local stress)** | 500 | 100 | 50,000 | 500 | 500 | 5,000 |
| **Large (staging only)** | 10,000 | 1,000 | 1,000,000 | 10,000 | 10,000 | 100,000 |

Large dataset: **staging only, never production.**

### Tables involved
`users`, `messages`, `reports`, `support_requests`, `admin_audit_logs`, `bans`, `admin_invites`, `room_names`, `message_seen`

### E2EE-safe fake message approach
Generate random base64 strings for `message`, `nonce`, and `ephemeralPublicKey`. All three fields must be non-null and non-empty to pass the backend's E2EE presence check. Values are cryptographically meaningless. Never use real keys or real decrypted content. Never log these values even during tests.

---

## D. Rate Limiter Reference

Existing limiters to verify during load tests:

| Limiter | Route | Window | Max |
|---|---|---|---|
| `globalLimiter` | All routes (with exceptions) | 15 min | 15,000 |
| `loginLimiter` | `POST /api/login` | 15 min | 10 |
| `uploadLimiter` | Avatar/thumbnail/chat upload | 5 min | 20 (per user) |
| `roomCreateLimiter` | `POST /api/rooms/create` | 60 min | 10 |
| `contactLimiter` | `POST /api/contact` | 60 min | 3 |
| `bugReportLimiter` | `POST /api/report-bug` | 60 min | 5 |
| `dmRestLimiter` | `POST /api/chats/send` | 60 sec | 60 |
| `chatRateBuckets` | Socket `chat_message` event | Per socket | In-memory bucket |
| `mediaControlBuckets` | Socket `play/pause/seek` | Per socket | In-memory bucket |
| `joinRateBuckets` | Socket `join_room` | Per socket | In-memory bucket |

---

## E. API Load Test Scenarios (F-Series)

### F-1: Public room listing

| Field | Value |
|---|---|
| Endpoint | `GET /api/rooms/public` |
| Concurrency | 50 VUs (small); 200 VUs (medium staging) |
| Duration | 60s |
| Metrics | p50, p95, p99 response time; error rate |
| Pass threshold | p95 < 500ms; error rate < 1% |
| Safety note | Read-only. Safe on local dev. |

### F-2: Room creation burst

| Field | Value |
|---|---|
| Endpoint | `POST /api/rooms/create` |
| Concurrency | 20 VUs |
| Duration | 30s |
| Metrics | 429 rate; room creation count; response time |
| Pass threshold | Rate limiter fires after 10 creates/hr per IP; no bypass |
| Safety note | Creates real room records — truncate `room_names` after test. |

### F-3: Login under load

| Field | Value |
|---|---|
| Endpoint | `POST /api/login` |
| Concurrency | 20 VUs |
| Duration | 30s |
| Metrics | 429 rate; successful login latency; bcrypt cost under concurrency |
| Pass threshold | Limiter fires at 10/15min; successful logins p95 < 800ms |
| Safety note | Use one seeded test user only. No email triggered. |

### F-4: Chat history pagination (Socket.IO)

| Field | Value |
|---|---|
| Event | `chat:request_history` |
| Concurrency | 50 sockets each requesting 200-message pages |
| Duration | 60s |
| Metrics | Event round-trip latency; DB query time; memory growth |
| Pass threshold | p95 < 300ms; no OOM growth trend; `idx_messages_roomid_timestamp` confirmed in use |
| Safety note | Read-only after seed data exists. |

### F-5: Support request submission

| Field | Value |
|---|---|
| Endpoint | `POST /api/contact` |
| Concurrency | 10 VUs |
| Duration | 30s |
| Metrics | 429 rate; successful submission latency |
| Pass threshold | `contactLimiter` fires at 3/hr; no real email sent |
| Safety note | Disable SMTP locally (`SMTP_HOST=` empty in `.env`) before testing. |

### F-6: Admin overview stats

| Field | Value |
|---|---|
| Endpoint | `GET /api/admin/stats` |
| Concurrency | 10 VUs (admin accounts only) |
| Duration | 30s |
| Metrics | Response time; `requireAdmin` cache hit behavior; DB query cost |
| Pass threshold | p95 < 1000ms; cache reduces DB hits after first request per user (5-min TTL) |
| Safety note | Read-only. Requires seeded admin accounts. |

### F-7: Report submission

| Field | Value |
|---|---|
| Endpoints | `POST /api/report-user`, `POST /api/report-message` |
| Concurrency | 15 VUs |
| Duration | 30s |
| Metrics | Rate limiter activation; insertion latency |
| Pass threshold | Rate limiter fires correctly; inserts succeed within 500ms |
| Safety note | Creates real report rows — truncate `reports` after test. |

### F-8: File upload (chat)

| Field | Value |
|---|---|
| Endpoint | `POST /api/upload/chat` |
| Concurrency | 10 VUs |
| Duration | 60s |
| Metrics | Upload latency; 429 rate; Supabase storage write success rate |
| Pass threshold | Limiter fires at 20/5min; successful uploads < 2s p95 |
| Safety note | **Staging storage only.** Never run against production `encrypted-media` bucket. |

---

## F. Socket.IO Load Test Scenarios (G-Series)

### G-1: Single room — concurrent joins

| Field | Value |
|---|---|
| Events | `join_room` → `chat_message` → `leave_room` |
| Concurrent sockets | 10 (local); 50 (medium local); 100 (staging) |
| Duration | 120s |
| Metrics | Connection success rate; join latency; `rooms` Map growth; disconnect cleanup |
| Pass threshold | All sockets connect; participant list accurate; no stale entries after leave |
| Safety note | `rooms` Map is in-memory — resets on server restart. |

### G-2: Multiple rooms — distributed load

| Field | Value |
|---|---|
| Events | `join_room`, `chat_message`, `leave_room` across 20 rooms |
| Concurrent sockets | 100 total (5 per room) |
| Duration | 120s |
| Metrics | Memory footprint; event delivery latency per room; cross-room isolation |
| Pass threshold | No cross-room message delivery; memory growth < 50MB for 100 sockets |
| Safety note | Watch `backend_out.txt` for uncaught errors during churn. |

### G-3: Chat burst

| Field | Value |
|---|---|
| Events | `chat_message` at high frequency (test `chatRateBuckets`) |
| Concurrent sockets | 5 VUs per room at 10 msg/sec |
| Duration | 30s |
| Metrics | Throttle activation; dropped message count; CPU spike |
| Pass threshold | `chatRateBuckets` fires; no server crash; no stale bucket entries after disconnect |
| Safety note | Messages written to DB — truncate `messages` after test. |

### G-4: Media sync events

| Field | Value |
|---|---|
| Events | `play`, `pause`, `seek` |
| Concurrent sockets | 20 in one room |
| Duration | 60s |
| Metrics | Sync event delivery latency; `mediaControlBuckets` throttle behavior |
| Pass threshold | All clients receive sync within 200ms; bucket throttle fires on abuse |
| Safety note | No DB writes. In-memory only. |

### G-5: Join/leave churn

| Field | Value |
|---|---|
| Events | Rapid `join_room` → `leave_room` cycles (every 5s) |
| Concurrent sockets | 30 |
| Duration | 120s |
| Metrics | `rooms` Map size stabilizes; no stale participant entries; `joinRateBuckets` behavior |
| Pass threshold | Participant count accurate after each cycle; no memory growth trend |
| Safety note | Verify `joinRateBuckets` doesn't block normal users at legitimate join rates. |

### G-6: Private messaging under load

| Field | Value |
|---|---|
| Events | `private_message` between paired sockets |
| Concurrent socket pairs | 20 pairs (40 total sockets) |
| Duration | 60s |
| Metrics | DM delivery latency; `connectedSockets` Map accuracy; server does not log message content |
| Pass threshold | All DMs delivered to correct recipient only; no cross-recipient delivery |
| Safety note | Use fake E2EE payloads (random base64). Do not use real keys. |

---

## G. Frontend Performance Test Scenarios (H-Series)

### H-1: Landing / Login page

| Field | Value |
|---|---|
| Test | `npx lighthouse http://localhost:5173 --only-categories=performance` |
| Metrics | LCP, TTI, TBT, FCP, Performance score |
| Pass threshold | Performance score ≥ 70; LCP < 2.5s; TTI < 3s |

### H-2: Public rooms listing

| Field | Value |
|---|---|
| Test | Playwright — navigate to rooms list; measure API wait + first card render |
| Metrics | Time to first room card visible; API response time |
| Pass threshold | Rooms visible < 1s after navigation |

### H-3: Room page — small participant count

| Field | Value |
|---|---|
| Test | 2 browser tabs in same room; 50 pre-loaded messages |
| Metrics | Chat render time; video tile render; memory after 5 minutes |
| Pass threshold | Chat visible < 500ms; no visible freeze; memory stable |

### H-4: Room page — large chat history

| Field | Value |
|---|---|
| Test | Seed 500+ messages; open room; paginate chat |
| Metrics | Initial load time (200 messages); pagination load time; scroll behavior |
| Pass threshold | First 200 messages render < 1s; pagination page < 500ms |

### H-5: Admin dashboard — Users tab

| Field | Value |
|---|---|
| Test | Seed 500 users; open admin → Users tab |
| Metrics | Tab load time; pagination response; search input latency |
| Pass threshold | Tab loads < 1s; pagination < 500ms; search results < 300ms after debounce |

### H-6: Admin dashboard — Reports and Audit Logs

| Field | Value |
|---|---|
| Test | Seed 500 reports, 5,000 audit entries; open each admin tab |
| Metrics | Load time per tab; scroll performance |
| Pass threshold | Each tab < 1s; no UI freeze during scroll |

### H-7: Mobile viewport

| Field | Value |
|---|---|
| Test | Lighthouse mobile preset (`--emulated-form-factor=mobile`) or Playwright 390×844 |
| Metrics | Mobile LCP, CLS, touch responsiveness |
| Pass threshold | LCP < 3s; no horizontal scroll overflow; CLS < 0.1 |

---

## H. Database Performance Test Scenarios (I-Series)

### I-1: Message history by room

| Field | Value |
|---|---|
| Query | `SELECT ... FROM messages WHERE "roomId" = ? ORDER BY timestamp DESC LIMIT 200` |
| Dataset | 1,000,000 messages across 1,000 rooms (staging) |
| Expected index | `idx_messages_roomid_timestamp` |
| Pass threshold | < 50ms with index; verify via `EXPLAIN ANALYZE` |

### I-2: Private message history

| Field | Value |
|---|---|
| Query | `SELECT ... WHERE type='private' AND senderName/targetName = ? ORDER BY timestamp DESC LIMIT 200` |
| Dataset | 50,000 DMs across 500 user pairs |
| Expected index | `idx_messages_dm` |
| Pass threshold | < 50ms; composite index covers both name lookups |

### I-3: Users list with search

| Field | Value |
|---|---|
| Query | `SELECT ... FROM users WHERE LOWER(username) LIKE ? ORDER BY created_at DESC LIMIT 50` |
| Dataset | 10,000 users |
| Expected index | `idx_users_lower_username`, `idx_users_username_trgm` (trigram for LIKE) |
| Pass threshold | < 100ms |

### I-4: Admin reports by status

| Field | Value |
|---|---|
| Query | `SELECT ... FROM reports WHERE status = ? ORDER BY "createdAt" DESC LIMIT 50` |
| Dataset | 10,000 reports |
| Expected index | `idx_reports_createdat` |
| Pass threshold | < 100ms |

### I-5: Audit logs pagination

| Field | Value |
|---|---|
| Query | `SELECT ... FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50 OFFSET ?` |
| Dataset | 100,000 log entries |
| Expected index | `idx_audit_logs_created_at` |
| Pass threshold | < 200ms; flag if > 500ms past OFFSET 10,000 (OFFSET degrades at scale) |

### I-6: Ban status check on join

| Field | Value |
|---|---|
| Query | `SELECT ... FROM bans WHERE userId = ? AND isActive = TRUE` |
| Dataset | 500 banned users out of 10,000 |
| Expected index | `idx_bans_user_active` |
| Pass threshold | < 10ms (runs on every room join) |

---

## I. Storage Test Scenarios (J-Series)

### J-1: Chat file upload (image)

| Field | Value |
|---|---|
| Upload type | JPEG/PNG to `encrypted-media` bucket |
| Test files | 1MB, 4.9MB (under limit), 5.1MB (over limit) |
| Metrics | Upload success rate; latency; rejection of oversized file |
| Pass threshold | ≤5MB uploads succeed < 3s; >5MB returns 400 |
| Safety note | **Staging bucket only.** |

### J-2: Avatar upload

| Field | Value |
|---|---|
| Upload type | JPEG/PNG to `backend/avatars/` (local filesystem) |
| Test files | Valid image; oversized (>5MB); invalid type (PDF) |
| Metrics | Success rate; rejection behavior |
| Pass threshold | Valid images save; oversized and invalid type return 400 |
| Safety note | Local filesystem — safe on dev machine. |

### J-3: Support attachment upload

| Field | Value |
|---|---|
| Upload type | Image/PDF to `support-attachments` bucket |
| Test scenarios | Valid file; oversized; unsupported type |
| Metrics | Success; rejection; signed URL generation and expiry |
| Pass threshold | Valid uploads succeed; invalid rejected cleanly |
| Safety note | **Staging bucket only.** |

### J-4: Storage cleanup job

| Field | Value |
|---|---|
| Endpoint | `POST /api/admin/support-requests/cleanup-attachments` |
| Test setup | Seed 20 resolved support requests > 90 days old with staged attachments |
| Metrics | Attachments deleted from bucket; DB records updated |
| Pass threshold | All expired attachments removed; no active attachments touched |
| Safety note | **Staging only.** Never run against production bucket. |

---

## J. Failure / Resilience Test Scenarios (K-Series)

### K-1: Backend 500 (DB query fails)

| Field | Value |
|---|---|
| Failure | Temporarily disconnect DB pool or throw in a route handler |
| Expected behavior | 500 response; no stack trace or SQL in response body; error logged server-side only |
| Pass threshold | User sees generic error message; no secrets exposed |

### K-2: Supabase storage upload fails

| Field | Value |
|---|---|
| Failure | Set `SUPABASE_URL` to invalid host in local `.env` |
| Expected behavior | Upload route returns 500 or meaningful error; frontend shows upload-failed toast |
| Pass threshold | No server crash; error logged; `backend_out.txt` entry present |

### K-3: Email provider fails (SMTP unreachable)

| Field | Value |
|---|---|
| Failure | Set `SMTP_HOST=invalid.host` locally |
| Expected behavior | Contact/support submission saved to DB; `email_notification_status = 'failed'` logged; admin can still see it |
| Pass threshold | DB row exists; no crash; admin sees request in Support Inbox |

### K-4: Socket.IO disconnect mid-room

| Field | Value |
|---|---|
| Failure | Kill socket client mid-session |
| Expected behavior | Room participant list updates; no stale entry in `rooms` Map; other participants notified |
| Pass threshold | `rooms` Map accurate within 1 broadcast cycle; no ghost participant |

### K-5: Duplicate socket connection (same user)

| Field | Value |
|---|---|
| Failure | Same user opens two tabs; both join same room |
| Expected behavior | Both tracked in `connectedSockets` Set; one disconnect doesn't kill the other |
| Pass threshold | No crash; both sockets receive events; disconnect of one is isolated |

### K-6: Admin invite email fails

| Field | Value |
|---|---|
| Failure | SMTP disabled; send admin invite |
| Expected behavior | Invite token saved to `admin_invites`; admin panel shows warning; resend button works |
| Pass threshold | `admin_invites` row exists; resend functional; no orphaned invite state |

---

## K. Success Criteria / Pass-Fail Thresholds

### Frontend

| Metric | Target |
|---|---|
| Initial app load | < 2–3s on normal connection |
| Room page usable | < 2s after route load |
| Admin dashboard tab | < 1s with pagination |
| No major UI freeze | During chat/camera use |
| Lighthouse Performance score | ≥ 70 (desktop); ≥ 50 (mobile) |
| LCP | < 2.5s desktop; < 4s mobile |
| CLS | < 0.1 |

### API

| Metric | Target |
|---|---|
| Normal API responses | < 300–800ms p95 |
| Admin stats/heavy queries | < 1–2s p95 |
| Error rate under load | < 1% |

### Socket.IO

| Metric | Target |
|---|---|
| Message delivery | < 200–500ms in normal conditions |
| Connections during test duration | Stable (no unexpected disconnects) |
| Duplicate events | None |
| Memory leak trend | None (stable growth) |

### Database

| Metric | Target |
|---|---|
| Indexed queries with large data | Fast (< 50–100ms) |
| Unbounded queries | None on large tables |
| Pagination | Correct across all admin tabs |

### Storage

| Metric | Target |
|---|---|
| Allowed files | Upload successfully < 3s |
| Blocked files | Fail cleanly with 400 |
| Production storage during tests | Zero writes |

### Security

| Check | Expected |
|---|---|
| E2EE content logged | Never |
| Secrets in API responses | Never |
| Rate limits | Fire at configured thresholds |
| Admin APIs without auth | Return 401/403 |

---

## L. Recommended Implementation Order

1. **Create staging Supabase project** — new project, separate URL and service role key. Copy `.env` to `.env.staging`, update credentials. Point local backend at staging for all medium/large test runs.
2. **Write seed data script** (`scripts/seed-staging.js`) — inserts small/medium fake datasets into staging DB only. Uses fake E2EE payloads (random base64). Includes teardown function.
3. **Install k6** and write API load test scripts for F-series scenarios (start with F-1 public rooms, F-3 login limiter).
4. **Install Artillery** with `artillery-plugin-socketio` and write Socket.IO scripts for G-1 (room join) and G-3 (chat burst).
5. **Run Lighthouse** against local dev server for frontend performance baselines (H-1 through H-3). No install required.
6. **Run storage upload tests** using a Node script against staging bucket only (J-1 through J-3).
7. **Run failure/resilience tests** locally with SMTP/storage disabled (K-1 through K-6).
8. **Document all results** — record p50/p95/p99 baselines; flag threshold failures before go-live.

---

## M. Proposed Scripts (Not Yet Created)

These scripts should only be written once staging exists:

| Script | Purpose |
|---|---|
| `scripts/seed-staging.js` | Insert fake data into staging DB; includes teardown; E2EE-safe |
| `scripts/k6-api-tests.js` | k6 API load test covering F-1 through F-8 |
| `scripts/artillery-socketio.yml` | Artillery Socket.IO test covering G-1 through G-6 |

Frontend performance checks (H-series) use `npx lighthouse` directly — no script file needed.

---

## P. Lighthouse Baselines (Local Dev — recorded at Area 13)

Measured against local Vite dev server (`http://localhost:5173`).
Raw reports: `lighthouse-report.json` (landing) and `lighthouse-room-report.json` (room) at repo root.

| Page | Performance | LCP | TTI | TBT | FCP | CLS |
|---|---|---|---|---|---|---|
| Landing / Login (`/`) | 56 | 19.3s | 19.3s | 40ms | 10.4s | 0 |
| Room page (`/room/3g5jkv`) | 28 | 148.1s | 148.1s | 1,690ms | 7.8s | 0 |

**Important caveats — read before comparing these numbers to production targets:**

- **These are Vite dev server numbers, not production build numbers.** Vite dev mode serves unbundled, unminified modules. A production build (`npm run build`) with tree-shaking, minification, and code-splitting will score significantly higher. Re-run Lighthouse against the production preview server before treating any number as a real baseline.
- **Room page numbers are invalid for performance comparison.** Lighthouse's headless Chrome has no JWT auth token in localStorage. The room page waits indefinitely for a Socket.IO connection and room data that never arrives — causing LCP/TTI to be measured at the Lighthouse timeout (~148s) rather than actual render time. To get a valid room page score, Lighthouse would need to run with a pre-authenticated session (set localStorage token before navigation), which requires a custom Lighthouse plugin or Playwright-based measurement instead.
- **TBT of 1,690ms on the room page** is driven by the same auth-wait issue — the page is blocked on async initialization rather than heavy JS execution. Dismiss this number until a proper authenticated run is available.
- **Landing page TBT of 40ms is the only reliable number here** — the landing page renders without auth, so FCP and TBT reflect actual JS weight.

**Action before go-live:** Run `npm run build && npm run preview` in the frontend, then run Lighthouse against `http://localhost:4173`. That gives a production-representative score. For the room page, use Playwright with a seeded auth token.
