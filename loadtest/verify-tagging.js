#!/usr/bin/env node
// One-off verification, NOT part of the load test itself: connects a single
// socket with a real production-signed token, joins loadtest-room-0, sends
// one chat message, and listens for the server's own real-time broadcast of
// that message back to the room (server.js: broadcastMessage() -> io.in(roomId
// ).emit('chat_message', enrichedMsg), where enrichedMsg.username is the
// exact `messages."senderName"` DB value) — confirming the tag BEFORE it
// round-trips through history, since a second reconnect for a synthetic user
// resets getOrInitFirstJoined()'s timestamp and would filter it back out of
// chat_history (confirmed while debugging this script — not a real app bug,
// just means reconnect-based verification doesn't work for fake users).
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const WS_BASE = 'https://sahaplay-backend.onrender.com';
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'loadtest-tokens.json'), 'utf8'));
const token = tokens[0].token;
const username = tokens[0].username;
const roomId = 'loadtest-room-0';

async function main() {
  const socket = io(WS_BASE, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 10000 });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timed out')), 15000);
    socket.on('connect_error', (err) => { clearTimeout(t); reject(err); });
    socket.on('connect', () => { clearTimeout(t); resolve(); });
  });
  console.log(`Connected as ${username}. Joining ${roomId}...`);

  socket.emit('join_room', { roomId, username });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('join timed out')), 15000);
    socket.once('room_not_found', () => { clearTimeout(t); reject(new Error('room_not_found')); });
    socket.once('room_state', () => { clearTimeout(t); resolve(); });
  });
  console.log('Joined. Sending one chat message and listening for the broadcast...');

  const marker = `[verify-tagging] ${Date.now()}`;
  const received = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('never saw the chat_message broadcast')), 10000);
    socket.on('chat_message', (m) => {
      if (m.message === marker) { clearTimeout(t); resolve(m); }
    });
  });
  socket.emit('chat_message', { roomId, message: marker });

  const msg = await received;
  socket.disconnect();

  console.log('\nReceived broadcast:', JSON.stringify({ username: msg.username, message: msg.message }, null, 2));
  if (msg.username === username) {
    console.log(`\nPASS: username is "${msg.username}" — tagging is correct.`);
  } else {
    console.error(`\nFAIL: username is "${msg.username}", expected "${username}".`);
    process.exit(1);
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
