#!/usr/bin/env node
// Mints JWTs only — no room creation, no network calls of any kind. Used for
// the production-safe cold-start run, which only needs tokens for its two
// GET-only authenticated endpoints (/api/chats/recent, /api/profile/notifications)
// and never touches rooms. Signing a token is pure local crypto; nothing is
// transmitted anywhere, so this is safe to run against the real JWT_SECRET.
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const envPath = path.join(__dirname, '..', 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/^JWT_SECRET=(.*)$/m);
if (!match || !match[1].trim()) {
  console.error('JWT_SECRET not found in backend/.env');
  process.exit(1);
}
const JWT_SECRET = match[1].trim();
const NUM_USERS = parseInt(process.env.LOADTEST_USERS || '10', 10);

const tokens = [];
for (let i = 0; i < NUM_USERS; i++) {
  const id = 9_000_000 + i; // clearly out of range of any real user id
  const username = `loadtest_user_${i}`;
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '1h' }); // short-lived, this is a one-off run
  tokens.push({ id, username, token });
}
fs.writeFileSync(path.join(__dirname, 'loadtest-tokens.json'), JSON.stringify(tokens, null, 2));
console.log(`Wrote ${tokens.length} tokens -> loadtest-tokens.json (no network calls made, no rooms created)`);
