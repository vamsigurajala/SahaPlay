// PM2 process manager config for SahaPlay backend.
// Run: npm install -g pm2 && pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sahaplay-backend',
    script: 'server.js',
    cwd: './backend',
    instances: 1,
    restart_delay: 2000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    }
  }]
};
