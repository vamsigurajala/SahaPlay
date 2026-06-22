const autocannon = require('autocannon');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile);

async function setupTestUser() {
  return new Promise((resolve, reject) => {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('testpassword', salt);
    
    // We set isVerified to 1 so it passes the verification check
    db.run('INSERT OR IGNORE INTO users (username, email, password, isVerified) VALUES (?, ?, ?, 1)', 
      ['benchmarkuser', 'bench@example.com', hashedPassword], 
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function runBenchmark() {
  console.log('Setting up test user...');
  await setupTestUser();
  console.log('Test user ready. Running autocannon against POST /api/login...');
  
  const instance = autocannon({
    url: 'http://localhost:3001/api/login',
    method: 'POST',
    body: JSON.stringify({ username: 'benchmarkuser', password: 'wrongpassword' }), // wrongpassword so it always fails after fully hashing
    headers: { 'Content-Type': 'application/json' },
    connections: 100,
    pipelining: 1,
    duration: 10
  });
  
  autocannon.track(instance, {renderProgressBar: true});
  
  instance.on('done', (result) => {
    console.log(`\n--- BENCHMARK RESULTS ---`);
    console.log(`Requests/sec: ${result.requests.average}`);
    console.log(`Latency average (ms): ${result.latency.average}`);
    console.log(`Latency p99 (ms): ${result.latency.p99}`);
    console.log(`Total Requests: ${result.requests.total}`);
  });
}

runBenchmark().catch(console.error);
