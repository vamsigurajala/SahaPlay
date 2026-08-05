// Shared safety guard for every script in this folder.
//
// LOAD_TEST_PLAN.md (repo root) says plainly: no staging environment exists
// yet, one Supabase project (production), and its rules forbid load-testing
// the production DB or seeding fake rooms/messages into production tables.
// The only pre-approved production-safe scenario is a small, read-only
// "is it awake" probe (health/public-rooms style GETs, ~10-20 requests).
//
// This guard hard-stops any script mode that WRITES data (room creation,
// chat messages, socket join/sync) the moment it detects the target looks
// like the real production backend, so a mistyped API_BASE can't silently
// seed load-test junk into production. Read-only cold-start checks are
// exempt — pass allowReadOnlyProd: true for those.
const KNOWN_PROD_HOSTS = [
  'sahaplay-backend.onrender.com',
  'sahaplay.com',
];

function assertNotProduction(targetUrl, { allowReadOnlyProd = false, scriptName = 'this script' } = {}) {
  if (allowReadOnlyProd) return;
  // Explicit, per-run override — the app owner can knowingly accept the risk
  // of writing load-test data to production. Deliberately NOT a permanent
  // deletion of this check: every future run still defaults to blocked
  // unless this exact env var is set for that specific invocation.
  if (process.env.LOADTEST_ALLOW_PRODUCTION_WRITE === 'yes-i-am-sure') {
    console.warn(`\n[SAFETY GUARD BYPASSED] LOADTEST_ALLOW_PRODUCTION_WRITE is set — ${scriptName} will run against production. This was explicitly authorized.\n`);
    return;
  }
  let host;
  try {
    host = new URL(targetUrl.replace(/^wss?:/, 'https:').replace(/^ws:/, 'http:')).hostname;
  } catch {
    return; // unparsable target — let it fail naturally downstream rather than guessing
  }
  const looksLikeProd = KNOWN_PROD_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  if (looksLikeProd) {
    console.error(
      `\n[SAFETY GUARD] Refusing to run ${scriptName} against "${host}".\n` +
      `This host looks like production. This script writes data (rooms/messages/socket\n` +
      `joins) and LOAD_TEST_PLAN.md forbids that against production. Point API_BASE /\n` +
      `TARGET at your staging Supabase-backed backend instead. If you are ABSOLUTELY\n` +
      `sure this is not production, rename the host or edit KNOWN_PROD_HOSTS in\n` +
      `loadtest/_guard.js — don't just delete the check.\n`
    );
    process.exit(1);
  }
}

module.exports = { assertNotProduction, KNOWN_PROD_HOSTS };
