
const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('=== WatchTogether Supabase Migration Tests ===\n');

  // 1. Login
  console.log('[1] Testing login...');
  const loginData = JSON.stringify({ username: 'vamsi@gmail.com', password: 'Vfstr#pps7' });
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);
  
  if (!loginRes.body.token) {
    console.error('❌ Login FAILED:', loginRes.body);
    return;
  }
  console.log('✅ Login OK! Username:', loginRes.body.username);
  const TOKEN = loginRes.body.token;
  const authHeaders = { Authorization: 'Bearer ' + TOKEN };

  // 2. Profile
  console.log('\n[2] Testing /api/profile...');
  const profileRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/profile', method: 'GET', headers: authHeaders });
  if (profileRes.status !== 200) {
    console.error('❌ Profile FAILED:', profileRes.body);
  } else {
    const p = profileRes.body;
    console.log(`✅ Profile OK! username=${p.username}, displayName=${p.displayName}, avatarPath=${p.avatarPath}, followers=${p.followersCount}, following=${p.followingCount}`);
  }

  // 3. Recent chats
  console.log('\n[3] Testing /api/chats/recent...');
  const chatsRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/chats/recent', method: 'GET', headers: authHeaders });
  if (chatsRes.status !== 200) {
    console.error('❌ Chats FAILED:', chatsRes.body);
  } else {
    console.log(`✅ Chats OK! Count=${chatsRes.body.length}`);
    chatsRes.body.slice(0, 3).forEach(c => console.log(`   - [${c.type}] ${c.displayName} | avatar=${c.partnerAvatar} | msg="${c.message.substring(0,30)}"`));
  }

  // 4. Public rooms
  console.log('\n[4] Testing /api/rooms/public...');
  const roomsRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/rooms/public', method: 'GET', headers: authHeaders });
  if (roomsRes.status !== 200) {
    console.error('❌ Public Rooms FAILED:', roomsRes.body);
  } else {
    console.log(`✅ Public Rooms OK! Count=${roomsRes.body.length}`);
    roomsRes.body.slice(0, 2).forEach(r => console.log(`   - [${r.roomId}] name=${r.roomName}, host=${r.hostUsername}`));
  }

  // 5. Follow requests
  console.log('\n[5] Testing /api/follow/requests...');
  const followRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/follow/requests', method: 'GET', headers: authHeaders });
  if (followRes.status !== 200) {
    console.error('❌ Follow Requests FAILED:', followRes.body);
  } else {
    console.log(`✅ Follow Requests OK! Count=${followRes.body.length}`);
  }

  // 6. User search
  console.log('\n[6] Testing /api/users/search...');
  const searchRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/users/search?q=k', method: 'GET', headers: authHeaders });
  if (searchRes.status !== 200) {
    console.error('❌ User Search FAILED:', searchRes.body);
  } else {
    console.log(`✅ User Search OK! Count=${searchRes.body.length}`);
    searchRes.body.slice(0, 2).forEach(u => console.log(`   - ${u.username} | avatar=${u.avatarPath}`));
  }

  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);
