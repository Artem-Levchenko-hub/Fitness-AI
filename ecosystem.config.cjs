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
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
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
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-cron-error.log',
      out_file: '/home/i48ptgvnis/.pm2/logs/fitness-saas-cron-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
