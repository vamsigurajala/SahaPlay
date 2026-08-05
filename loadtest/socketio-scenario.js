// Artillery processor for the Socket.IO scenario: connect (authenticated via
// a pre-minted JWT, never a live login) -> join_room -> chat_message -> a
// play/pause/seek burst, mirroring one real viewer's first few seconds in a
// room. Implemented as plain Artillery "function" steps (not the socketio-v3
// engine's declarative YAML flow) so the per-VU JWT goes into the real
// socket.io-client `auth` handshake option exactly the way the frontend does
// it (server.js only reads socket.handshake.auth?.token — not a query param
// — so this has to be right or every VU silently connects unauthenticated).
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const { assertNotProduction } = require('./_guard');

const WS_BASE = process.env.WS_BASE;
if (!WS_BASE) {
  console.error('WS_BASE is required, e.g. WS_BASE=https://your-staging-backend.example.com artillery run ...');
  process.exit(1);
}
// This scenario WRITES real chat messages and room state — never point it at
// production, at any concurrency, not just at high scale.
assertNotProduction(WS_BASE, { scriptName: 'socketio-scenario.js (writes chat messages)' });

const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'loadtest-tokens.json'), 'utf8'));
const rooms = JSON.parse(fs.readFileSync(path.join(__dirname, 'loadtest-rooms.json'), 'utf8'));
if (!tokens.length || !rooms.length) {
  console.error('loadtest-tokens.json / loadtest-rooms.json are empty — run `node setup-fixtures.js` first.');
  process.exit(1);
}

// Sequential/round-robin instead of random sampling from the full 500-token
// pool — a 10-VU stage now uses loadtest_user_0..9 (not a random scatter
// across the whole range), which is what made loadtest_user_451 legitimately
// but confusingly show up during stage (b)'s 10-VU run. Room assignment is
// round-robin the same way, so a given stage's VU-to-room mapping is
// deterministic and easy to reason about in logs at a glance.
let vuCounter = 0;
function assignVirtualUser(context, events, done) {
  const idx = vuCounter % tokens.length;
  vuCounter++;
  const t = tokens[idx];
  context.vars.token = t.token;
  context.vars.username = t.username;
  context.vars.roomId = rooms[idx % rooms.length];
  return done();
}

function runSocketScenario(context, events, done) {
  const { token, username, roomId } = context.vars;
  const connectStartedAt = Date.now();
  let settled = false;

  const socket = io(WS_BASE, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 10000,
  });

  const finish = (err) => {
    if (settled) return;
    settled = true;
    clearTimeout(overallTimeout);
    try { socket.disconnect(); } catch {}
    done(err);
  };

  // A VU that never hears back (dropped connection, server hang, etc.) would
  // otherwise hang the whole test run — bound every VU's lifetime.
  const overallTimeout = setTimeout(() => {
    events.emit('counter', 'sahaplay.errors.scenario_timeout', 1);
    finish(new Error(`scenario timeout for ${username} in ${roomId}`));
  }, 20000);

  socket.on('connect_error', (err) => {
    events.emit('counter', 'sahaplay.errors.connect_error', 1);
    finish(err);
  });

  socket.on('connect', () => {
    events.emit('histogram', 'sahaplay.connect_time_ms', Date.now() - connectStartedAt);

    const joinStartedAt = Date.now();
    socket.emit('join_room', { roomId, username });

    socket.once('room_not_found', () => {
      events.emit('counter', 'sahaplay.errors.room_not_found', 1);
      finish(new Error(`room_not_found: ${roomId}`));
    });
    socket.once('join_rejected', (payload) => {
      events.emit('counter', 'sahaplay.errors.join_rejected', 1);
      finish(new Error(`join_rejected: ${JSON.stringify(payload)}`));
    });

    // room_state is what the server sends back to the *joining* socket once
    // executeFinalJoin succeeds (see server.js) — the real "you're in" signal.
    socket.once('room_state', () => {
      events.emit('histogram', 'sahaplay.join_time_ms', Date.now() - joinStartedAt);
      events.emit('counter', 'sahaplay.rooms.joined', 1);

      socket.emit('chat_message', {
        roomId,
        message: `[loadtest] hello from ${username} @ ${Date.now()}`,
      });
      events.emit('counter', 'sahaplay.chat.sent', 1);

      // A short, staggered play/pause/seek burst — like a real viewer hitting
      // play, pausing almost immediately, then scrubbing.
      setTimeout(() => {
        socket.emit('play', { roomId, currentTime: 12.5 });
        events.emit('counter', 'sahaplay.sync.play_sent', 1);
      }, 300);

      setTimeout(() => {
        socket.emit('pause', { roomId, currentTime: 18.2 });
        events.emit('counter', 'sahaplay.sync.pause_sent', 1);
      }, 900);

      setTimeout(() => {
        socket.emit('seek', { roomId, currentTime: 42.0 });
        events.emit('counter', 'sahaplay.sync.seek_sent', 1);
        // Linger briefly, like a real client would, then leave cleanly.
        setTimeout(() => finish(), 500);
      }, 1500);
    });
  });
}

module.exports = { assignVirtualUser, runSocketScenario };
