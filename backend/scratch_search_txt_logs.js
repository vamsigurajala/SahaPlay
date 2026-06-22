const fs = require('fs');
const log = fs.readFileSync('backend_log.txt', 'utf8');
const lines = log.split('\n');
console.log(`Total lines in backend_log.txt: ${lines.length}`);
const matches = [];
lines.forEach((line, index) => {
  if (line.includes('executeFinalJoin') || line.includes('groupRows count')) {
    matches.push(`${index + 1}: ${line}`);
  }
});
console.log("Last 20 matches:");
console.log(matches.slice(-20).join('\n'));
