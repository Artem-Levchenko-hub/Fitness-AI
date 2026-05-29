/* eslint-disable @typescript-eslint/no-require-imports -- pm2 config is CommonJS */
const fs = require('fs');
const path = require('path');

// Next `next start` НЕ грузит .env в process.env, а pm2 кэширует env первого
// старта. Поэтому грузим .env здесь и прокидываем в env-блоки приложений.
function loadEnv(p) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env-файла может не быть — это ок */
  }
}
loadEnv(path.join(__dirname, '.env.production'));
loadEnv(path.join(__dirname, '.env.local'));

module.exports = {
  apps: [
    {
      name: 'fitness-saas',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3001',
      cwd: '/opt/fitness-saas',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
      error_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-error.log',
      out_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'fitness-saas-cron',
      script: 'scripts/cron-runner.js',
      cwd: '/opt/fitness-saas',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '128M',
      env: { ...process.env, NODE_ENV: 'production' },
      error_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-cron-error.log',
      out_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-cron-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
