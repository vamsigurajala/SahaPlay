const http = require('http');

const body = JSON.stringify({ username: 'vamsi', password: 'Supabase123!' });

const req = http.request('http://localhost:3001/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const { token } = JSON.parse(data);
    if (!token) return console.log('Login failed', data);
    
    http.get('http://localhost:3001/api/chats/history?type=private&partner=krish', {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log(JSON.stringify(JSON.parse(data2).slice(-3), null, 2));
      });
    });
  });
});
req.write(body);
req.end();
