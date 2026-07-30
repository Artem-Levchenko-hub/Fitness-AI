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

const appName = process.env.PM2_APP_NAME || 'fitness-saas';
const cronName = process.env.PM2_CRON_NAME || 'fitness-saas-cron';
const appPort = process.env.PORT || '3001';
const pm2LogDir =
  process.env.PM2_LOG_DIR || '/home/i48ptgvnis/.pm2/logs';

module.exports = {
  apps: [
    {
      name: appName,
      script: 'node_modules/next/dist/bin/next',
      args: `start --port ${appPort}`,
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { ...process.env, NODE_ENV: 'production', PORT: appPort },
      error_file: path.join(pm2LogDir, `${appName}-error.log`),
      out_file: path.join(pm2LogDir, `${appName}-out.log`),
      merge_logs: true,
      time: true,
    },
    {
      name: cronName,
      script: 'scripts/cron-runner.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '128M',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CRON_TARGET_PORT: process.env.CRON_TARGET_PORT || appPort,
      },
      error_file: path.join(pm2LogDir, `${cronName}-error.log`),
      out_file: path.join(pm2LogDir, `${cronName}-out.log`),
      merge_logs: true,
      time: true,
    },
  ],
};
