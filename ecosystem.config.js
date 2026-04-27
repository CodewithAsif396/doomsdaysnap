module.exports = {
  apps: [
    {
      name: 'snap-main',
      script: './server.js',
      cron_restart: '*/45 * * * *',
      max_memory_restart: '800M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'snap-yt-engine',
      script: 'uvicorn',
      args: 'youtube_server:app --port 5002 --host 127.0.0.1',
      interpreter: 'none',
      cron_restart: '*/45 * * * *',
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'snap-adpanel',
      cwd: './ads-backend',
      script: './server.js',
      cron_restart: '*/45 * * * *',
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
