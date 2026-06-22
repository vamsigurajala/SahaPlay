const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'backend.log');
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total log lines: ${lines.length}`);
  console.log("Last 150 lines:");
  console.log(lines.slice(-150).join('\n'));
} else {
  console.log("Log file not found at " + logPath);
}
