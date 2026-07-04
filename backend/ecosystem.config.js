// PM2 process manager config for SahaPlay backend.
// Run: npm install -g pm2 && pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sahaplay-backend',
    script: 'server.js',
    cwd: './backend',
    restart_delay: 2000,
    max_restarts: 10,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
