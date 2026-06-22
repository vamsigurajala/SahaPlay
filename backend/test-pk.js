const http = require('http');

http.get('http://127.0.0.1:3001/api/auth/public-key/krish', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
