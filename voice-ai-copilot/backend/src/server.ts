import { app } from './app'
import { config } from './config'

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port} [${config.nodeEnv}]`)
})

// Graceful shutdown — releases the port before process exits so ts-node-dev
// can immediately rebind on the next restart (prevents EADDRINUSE crash loops)
function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
