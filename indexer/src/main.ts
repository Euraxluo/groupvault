import { loadConfig } from "./config.js"
import { NearRpcClient } from "./rpc.js"
import { createIndexerServer } from "./server.js"
import { MessageStore } from "./store.js"
import { IndexerWorker } from "./worker.js"

const config = loadConfig()
const store = new MessageStore(config.dbPath)
const rpc = new NearRpcClient(config.rpcUrl, config.contractId)
const worker = new IndexerWorker(store, rpc, {
  contractId: config.contractId,
  startBlock: config.startBlock,
  initialBackfillBlocks: config.initialBackfillBlocks,
})
const server = createIndexerServer(store, worker)
const controller = new AbortController()

server.listen(config.port, "127.0.0.1", () => {
  console.log(`[indexer] listening on http://127.0.0.1:${config.port}`)
})

void worker.start(config.pollIntervalMs, controller.signal)

function shutdown(): void {
  controller.abort()
  server.close(() => {
    store.close()
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
