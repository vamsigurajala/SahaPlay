const http = require('http');

console.log("Starting login request...");
const data = JSON.stringify({ username: 'vamsi@gmail.com', password: 'Vfstr#pps7' });
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(body);
    const token = parsed.token;
    console.log("Got token! Fetching chats...");
    
    const chatsOpt = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/chats/recent',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const cReq = http.request(chatsOpt, (cRes) => {
      let cBody = '';
      cRes.on('data', chunk => cBody += chunk);
      cRes.on('end', () => {
        console.log("Chats Response:", cRes.statusCode);
        console.log(cBody.substring(0, 500) + "...");
        process.exit(0);
      });
    });
    cReq.on('error', err => { console.error("Chats Error:", err); process.exit(1); });
    cReq.end();
  });
});
req.on('error', err => { console.error("Login Error:", err); process.exit(1); });
req.write(data);
req.end();
