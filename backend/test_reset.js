
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); }});
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Test 1: forgot-password with username "krish"');
  const r1 = await post('/api/forgot-password', { email: 'krish' });
  console.log(' Status:', r1.status);
  console.log(' Message:', r1.body.message);
  console.log(' resetLink:', r1.body.resetLink || '(none)');
  console.log(' previewUrl:', r1.body.previewUrl || '(none)');
  
  console.log('\nTest 2: forgot-password with "krishna@gmail.com" (does not exist)');
  const r2 = await post('/api/forgot-password', { email: 'krishna@gmail.com' });
  console.log(' Status:', r2.status);
  console.log(' Message:', r2.body.message);
  console.log(' resetLink:', r2.body.resetLink || '(none)');
}

run().catch(console.error);
