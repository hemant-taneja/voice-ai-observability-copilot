module.exports = {
  apps: [
    { name: 'server', script: 'dist/server.js', instances: 1 },
    { name: 'worker', script: 'dist/workers/temporal-worker.js', instances: 1 },
  ],
}
