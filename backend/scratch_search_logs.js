const fs = require('fs');
const content = fs.readFileSync('backend.log', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(-60).join('\n'));
