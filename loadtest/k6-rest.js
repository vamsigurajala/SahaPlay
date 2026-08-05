// k6 REST load test: GET /health, /api/rooms/public (both unauthenticated,
// both read-only), and GET /api/chats/recent + /api/profile/notifications
// (authenticated via a pre-minted JWT from loadtest-tokens.json — run
// setup-fixtures.js first).
//
// Note on endpoints: /api/rooms/list and a bare GET / were NOT included —
// neither exists on this backend. /api/rooms/list only shows up in
// server.js's rate-limiter skip-list, there's no route registered for it
// (confirmed by grep — would just 404 every time). GET / is served by the
// separate Vercel-hosted frontend, not this Express/Render backend at all,
// so it doesn't exercise the thing you're actually testing (Render's
// cold-start behavior) and Vercel's static hosting doesn't cold-start the
// same way regardless.
//
// Usage:
//   k6 run -e API_BASE=https://sahaplay-backend.onrender.com -e MODE=cold_start k6-rest.js
//   k6 run -e API_BASE=https://your-staging-backend.example.com -e MODE=spike_conservative k6-rest.js
//   k6 run -e API_BASE=https://your-staging-backend.example.com -e MODE=spike_full k6-rest.js
//
// MODE defaults to cold_start (the safest option) if not passed.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const API_BASE = __ENV.API_BASE;
const MODE = __ENV.MODE || 'cold_start';

if (!API_BASE) {
  throw new Error('API_BASE is required, e.g. k6 run -e API_BASE=https://... -e MODE=cold_start k6-rest.js');
}

// ── Safety guard ────────────────────────────────────────────────────────
// LOAD_TEST_PLAN.md (repo root): no staging exists yet, one Supabase project
// (production), and its rules forbid load-testing production. Its "safe
// right now" tier explicitly allows small-scale (10-20 request) read-only
// checks against production, which is exactly what cold_start is — all four
// endpoints here are GETs, and the two authenticated ones are called with a
// synthetic loadtest_user_* id that doesn't exist in the `users` table, so
// they resolve to an empty result set with zero writes. The two spike modes
// run far more volume and are NOT pre-approved for production — point
// API_BASE at staging for those.
const KNOWN_PROD_HOSTS = ['sahaplay-backend.onrender.com', 'sahaplay.com'];
function looksLikeProd(url) {
  return KNOWN_PROD_HOSTS.some(h => url.indexOf(h) !== -1);
}
const PROD_BYPASS = 'yes-i-am-sure';
if (MODE !== 'cold_start' && looksLikeProd(API_BASE) && __ENV.LOADTEST_ALLOW_PRODUCTION_WRITE !== PROD_BYPASS) {
  throw new Error(
    `[SAFETY GUARD] Refusing to run MODE="${MODE}" against "${API_BASE}" — this looks like ` +
    `production. Only MODE=cold_start (small, read-only) is pre-approved against production ` +
    `per LOAD_TEST_PLAN.md. Point API_BASE at your staging backend for spike tests, or pass ` +
    `-e LOADTEST_ALLOW_PRODUCTION_WRITE=${PROD_BYPASS} to explicitly override (same opt-in used ` +
    `for the Artillery scenario).`
  );
}
if (MODE !== 'cold_start' && looksLikeProd(API_BASE)) {
  console.warn(`[SAFETY GUARD BYPASSED] LOADTEST_ALLOW_PRODUCTION_WRITE is set — MODE="${MODE}" will run against production. This was explicitly authorized.`);
}

const tokens = new SharedArray('tokens', function () {
  return JSON.parse(open('./loadtest-tokens.json'));
});

function buildScenarios(mode) {
  switch (mode) {
    case 'cold_start':
      // A small burst against a backend that may have spun down — do
      // requests queue and succeed once it wakes, or 502/timeout?
      return {
        cold_start: { executor: 'shared-iterations', vus: 10, iterations: 10, maxDuration: '60s' },
      };
    case 'spike_conservative':
      // Start here. 0 -> 50 over 30s, then hold — conservative on purpose
      // while real traffic is still low.
      return {
        spike_conservative: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '30s', target: 50 },
            { duration: '30s', target: 50 },
          ],
        },
      };
    case 'spike_full':
      // Only run after spike_conservative looks healthy. Two-stage ramp to
      // 300 so you can see where things start to bend, not just the jump.
      return {
        spike_full: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '30s', target: 100 },
            { duration: '30s', target: 300 },
            { duration: '30s', target: 300 },
          ],
        },
      };
    default:
      throw new Error(`Unknown MODE "${mode}" — use cold_start | spike_conservative | spike_full`);
  }
}

// Cold-start latency is EXPECTED to be high for the first request(s) while
// Render wakes the instance up — that's not a failure, it's the thing being
// measured. Its thresholds care about eventual success, not fast p95.
// The spike modes assume an already-warm backend and hold REST endpoints to
// the plan's own targets (p95 300-800ms normal, error rate < 1%).
const THRESHOLDS_BY_MODE = {
  cold_start: {
    http_req_failed: ['rate<0.10'],       // allow some early failures while waking, not systemic failure
    'http_req_duration{name:health}': ['p(99)<60000'],
    'http_req_duration{name:rooms_public}': ['p(99)<60000'],
    'http_req_duration{name:chats_recent}': ['p(99)<60000'],
    'http_req_duration{name:profile_notifications}': ['p(99)<60000'],
  },
  spike_conservative: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:health}': ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:rooms_public}': ['p(50)<300', 'p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:chats_recent}': ['p(50)<300', 'p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:profile_notifications}': ['p(50)<300', 'p(95)<800', 'p(99)<1500'],
  },
  spike_full: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:health}': ['p(50)<300', 'p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:rooms_public}': ['p(50)<400', 'p(95)<1000', 'p(99)<2000'],
    'http_req_duration{name:chats_recent}': ['p(50)<400', 'p(95)<1000', 'p(99)<2000'],
    'http_req_duration{name:profile_notifications}': ['p(50)<400', 'p(95)<1000', 'p(99)<2000'],
  },
};

export const options = {
  scenarios: buildScenarios(MODE),
  thresholds: THRESHOLDS_BY_MODE[MODE],
};

export default function () {
  const token = tokens[Math.floor(Math.random() * tokens.length)].token;

  let res = http.get(`${API_BASE}/health`, { tags: { name: 'health' } });
  check(res, { 'health: status 200': (r) => r.status === 200 });

  res = http.get(`${API_BASE}/api/rooms/public`, { tags: { name: 'rooms_public' } });
  check(res, { 'rooms_public: status 200': (r) => r.status === 200 });

  res = http.get(`${API_BASE}/api/chats/recent`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'chats_recent' },
  });
  check(res, { 'chats_recent: status 200': (r) => r.status === 200 });

  res = http.get(`${API_BASE}/api/profile/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'profile_notifications' },
  });
  check(res, { 'profile_notifications: status 200': (r) => r.status === 200 });

  sleep(1);
}
