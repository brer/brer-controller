import { V1Pod, Watch } from '@kubernetes/client-node'
import closeWithGrace from 'close-with-grace'
import Queue from 'fastq'
import Pino from 'pino'

import { setupKubernetes } from './lib/kubernetes.js'
import { createPool, testPool } from './lib/pool.js'
import { reconcile } from './lib/reconcile.js'

const log = Pino.default({
  level: process.env.LOG_LEVEL || 'debug',
  transport:
    process.env.LOG_PRETTY === 'enable'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: true,
          },
        }
      : {
          target: 'pino/file',
          options: {
            destination: process.env.LOG_FILE || process.stdout.fd,
          },
        },
})

/**
 * Promises are supported
 */
type TeardownHandler = () => any

const teardown: TeardownHandler[] = []

async function bootstrap() {
  const pool = createPool(process.env.API_URL)
  teardown.push(() => pool.close())

  log.debug('test api pool')
  await testPool(pool)

  const kubernetes = setupKubernetes({
    cluster: process.env.K8S_CLUSTER,
    context: process.env.K8S_CONTEXT,
    file: process.env.K8S_FILE,
    namespace: process.env.K8S_NAMESPACE,
    user: process.env.K8S_USER,
    yaml: process.env.K8S_YAML,
  })

  const watcher = new Watch(kubernetes.config)

  let closed = false
  let request: any

  const worker = async (pod: V1Pod) => {
    const start = Date.now()
    const app = {
      kubernetes,
      log: log.child({ pod: pod.metadata?.name }),
      pool,
    }

    try {
      app.log.info('handle pod event')
      await reconcile(app, pod)
      app.log.info({ ms: Date.now() - start }, 'pod event handled')
    } catch (err) {
      app.log.error(
        { ms: Date.now() - start, err },
        'failed to handle pod event',
      )
      if (!closed) {
        // Retry when there was a conflict error while updating the Invocation
        await worker(pod)
      }
    }
  }

  const queue = Queue.promise(worker, 1)

  const watchPods = async (done: (err: any) => void) => {
    request = await watcher.watch(
      `/api/v1/namespaces/${kubernetes.namespace}/pods`,
      {
        labelSelector: 'app.kubernetes.io/managed-by=brer.io',
      },
      (phase: any, pod: V1Pod) => {
        if (!closed) {
          queue.push(pod)
        }
      },
      done,
    )
  }

  const keepWatching = () => {
    const callback = (err: unknown) => {
      if (!closed) {
        log.warn({ err }, 'pods watcher has been closed')
        process.nextTick(keepWatching)
      }
    }

    watchPods(callback).catch(callback)
  }

  log.debug('list-watch pods')
  await watchPods(err => {
    log.warn({ err }, 'pods watcher has been closed')
    process.nextTick(keepWatching)
  })

  teardown.push(async () => {
    // Prevent new events to be pushed
    closed = true

    // Close current watch request
    if (request) {
      request.destroy()
    }

    // Wait for queue to be drained
    await queue.drained()
  })
}

const closeListeners = closeWithGrace(
  {
    delay: 10000,
    logger: log,
  },
  async ({ err, signal }) => {
    if (err !== undefined) {
      log.error({ err }, 'closing because of error')
    } else if (signal !== undefined) {
      log.info({ signal }, 'received close signal')
    } else {
      log.info('application closed manually')
    }

    for (const fn of teardown.reverse()) {
      try {
        await fn()
      } catch (err) {
        log.warn({ err }, 'teardown failed')
      }
    }
  },
)

log.info('bootstrap application')
bootstrap().then(
  () => {
    log.info('application is running')
  },
  err => {
    log.fatal({ err }, 'bootstrap failed')
    closeListeners.close()
  },
)
