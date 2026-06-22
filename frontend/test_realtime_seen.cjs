const io = require('socket.io-client');

async function getTokens() {
  const users = ['krish', 'vamsi'];
  const tokens = {};
  for (const username of users) {
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'Vfstr#pps7' })
      });
      const data = await response.json();
      if (data.token) {
        tokens[username] = data.token;
      } else {
        console.error(`Failed to login ${username}:`, data);
      }
    } catch (e) {
      console.error(`Login error for ${username}:`, e.message);
    }
  }
  return tokens;
}

async function run() {
  const tokens = await getTokens();
  if (!tokens.krish || !tokens.vamsi) {
    console.error("Missing tokens, cannot run E2E socket test");
    process.exit(1);
  }

  console.log("Tokens fetched successfully. Connecting sockets...");

  const socketA = io('http://localhost:3001', { auth: { token: tokens.krish }, transports: ['websocket'] });
  const socketB = io('http://localhost:3001', { auth: { token: tokens.vamsi }, transports: ['websocket'] });

  socketA.on('connect', () => console.log("krish connected"));
  socketB.on('connect', () => console.log("vamsi connected"));

  socketB.on('private_message', (msg) => {
    console.log("vamsi received private_message:", msg.id, msg.message);
    // Simulate vamsi marking it read immediately
    console.log("vamsi emitting chat:mark_read for krish");
    socketB.emit('chat:mark_read', { chatId: 'krish', timestamp: msg.timestamp, isDm: true });
  });

  socketA.on('chat:messages_seen', (data) => {
    console.log("krish received chat:messages_seen:", data);
    console.log("SUCCESS! Test finished.");
    socketA.disconnect();
    socketB.disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    console.log("krish sending private message to vamsi...");
    socketA.emit('private_message', {
      targetName: 'vamsi',
      message: 'test-message-realtime-seen',
      msgId: `test-${Date.now()}`
    });
  }, 1000);

  setTimeout(() => {
    console.error("Timeout waiting for messages_seen event!");
    socketA.disconnect();
    socketB.disconnect();
    process.exit(1);
  }, 10000);
}

run();
