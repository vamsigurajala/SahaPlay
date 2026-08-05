#!/usr/bin/env node
// Mints JWTs using the REAL production JWT_SECRET, saved locally (by the
// app owner, out of band) at loadtest/.env.production-secret. Pure local
// signing — no network calls. The secret value itself is never logged,
// printed, or written anywhere other than being held in memory for signing.
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const secretPath = path.join(__dirname, '.env.production-secret');
let raw = fs.readFileSync(secretPath); // read as a Buffer first — encoding is unknown until we check the BOM
// PowerShell's `>` redirect defaults to UTF-16LE with a BOM (FF FE) in this
// environment — detect and decode accordingly rather than assuming UTF-8.
const content = (raw[0] === 0xff && raw[1] === 0xfe)
  ? raw.toString('utf16le').replace(/^﻿/, '')
  : raw.toString('utf8').replace(/^﻿/, '');

const match = content.match(/^JWT_SECRET=(.*)$/m);
if (!match || !match[1].trim()) {
  console.error('JWT_SECRET not found in loadtest/.env.production-secret');
  process.exit(1);
}
const JWT_SECRET = match[1].trim();
const NUM_USERS = parseInt(process.env.LOADTEST_USERS || '10', 10);

const tokens = [];
for (let i = 0; i < NUM_USERS; i++) {
  const id = 9_000_000 + i;
  const username = `loadtest_user_${i}`;
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '2h' });
  tokens.push({ id, username, token });
}
fs.writeFileSync(path.join(__dirname, 'loadtest-tokens.json'), JSON.stringify(tokens, null, 2));
console.log(`Wrote ${tokens.length} tokens -> loadtest-tokens.json (secret value not printed; no network calls made)`);
