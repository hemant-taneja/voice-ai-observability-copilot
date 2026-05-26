import { Worker, NativeConnection } from '@temporalio/worker'
import * as activities from '../activities/index'
import { config } from '../config'

async function run() {
  const connection = await NativeConnection.connect({ address: config.temporalAddress })

  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('../workflows/analyze-call.workflow'),
    activities,
    taskQueue: 'voice-ai-analysis',
    namespace: config.temporalNamespace,
  })

  console.log('Temporal worker started — listening on task queue: voice-ai-analysis')
  await worker.run()
}

run().catch((err) => {
  console.error('Worker failed to start:', err)
  process.exit(1)
})
