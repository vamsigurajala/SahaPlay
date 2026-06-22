const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Find the first instance of process.on('uncaughtException'
const splitPoint = code.indexOf("process.on('unhandledRejection'");
const endOfSplitPoint = code.indexOf("});", splitPoint) + 3;

if (splitPoint !== -1 && endOfSplitPoint !== -1) {
    code = code.substring(0, endOfSplitPoint);
    fs.writeFileSync('server.js', code);
    console.log("Severed the duplicate tail successfully!");
} else {
    console.log("Could not find split point");
}
