#!/usr/bin/env node
// One-time setup, run once before either load test: mints JWTs locally
// (using the same JWT_SECRET your staging backend verifies against — no
// live /api/login calls, so this never touches loginLimiter) and creates a
// small fixed pool of rooms for virtual users to join.
//
// Why a fixed pool instead of "every VU creates its own room": roomCreateLimiter
// caps /api/rooms/create at 10/hour/IP (see backend/server.js) — that alone
// rules out per-VU room creation past 10 VUs. It's also the more realistic
// shape of the scenario you're testing: a spike is "many people piling into a
// few active rooms," not everyone spinning up a fresh one.
//
// Usage:
//   API_BASE=https://your-staging-backend.example.com \
//   JWT_SECRET=<same value as staging backend's .env.staging> \
//   node setup-fixtures.js
//
// Optional env vars: LOADTEST_USERS (default 500), LOADTEST_ROOMS (default 5)

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { assertNotProduction } = require('./_guard');

const JWT_SECRET = process.env.JWT_SECRET;
const API_BASE = process.env.API_BASE;
const NUM_USERS = parseInt(process.env.LOADTEST_USERS || '500', 10);
const NUM_ROOMS = parseInt(process.env.LOADTEST_ROOMS || '5', 10);

if (!JWT_SECRET) {
  console.error('JWT_SECRET is required — must be the exact value your staging backend (.env.staging) verifies against. Tokens minted with any other secret will fail auth.');
  process.exit(1);
}
if (!API_BASE) {
  console.error('API_BASE is required, e.g. API_BASE=https://your-staging-backend.example.com node setup-fixtures.js');
  process.exit(1);
}

assertNotProduction(API_BASE, { scriptName: 'setup-fixtures.js (creates real rooms)' });

async function main() {
  // 1. Mint tokens for synthetic load-test users. No corresponding row needs
  //    to exist in the `users` table — server.js's authenticateToken
  //    middleware and the Socket.IO auth middleware (io.use(...)) both only
  //    verify the JWT signature/shape; the socket middleware's DB lookup is
  //    solely a ban-check that no-ops when the id doesn't match any row.
  const tokens = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const id = 9_000_000 + i; // clearly out of range of any real user id
    const username = `loadtest_user_${i}`;
    const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '1d' });
    tokens.push({ id, username, token });
  }
  const tokensPath = path.join(__dirname, 'loadtest-tokens.json');
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  console.log(`Wrote ${tokens.length} tokens -> ${tokensPath}`);

  // 2. Create the fixed room pool using the first token as "host".
  const hostToken = tokens[0].token;
  const roomIds = [];
  for (let i = 0; i < NUM_ROOMS; i++) {
    const roomId = `loadtest-room-${i}`;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
        body: JSON.stringify({ roomId, roomName: `Load Test Room ${i}`, category: 'other', isPublic: false }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        roomIds.push(roomId);
        console.log(`Created room: ${roomId}`);
      } else {
        console.error(`Failed to create room ${roomId}: HTTP ${res.status}`, body);
      }
    } catch (err) {
      console.error(`Failed to create room ${roomId}:`, err.message);
    }
  }
  if (roomIds.length === 0) {
    console.error('No rooms were created — check API_BASE is reachable and JWT_SECRET matches the target backend. Aborting without writing loadtest-rooms.json.');
    process.exit(1);
  }
  const roomsPath = path.join(__dirname, 'loadtest-rooms.json');
  fs.writeFileSync(roomsPath, JSON.stringify(roomIds, null, 2));
  console.log(`Wrote ${roomIds.length} room ids -> ${roomsPath}`);
  console.log('\nDone. Re-run this script any time to mint a fresh token/room pool (room creation upserts, so it is safe to run again).');
}

main().catch(err => { console.error(err); process.exit(1); });
