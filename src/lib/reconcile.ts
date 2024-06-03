import type { V1Pod } from '@kubernetes/client-node'
import type { Logger } from 'pino'
import type { Pool } from 'undici'

import type { Invocation } from './invocation.js'
import type { Kubernetes } from './kubernetes.js'
import { readInvocation, writeInvocation } from './pool.js'

export interface App {
  kubernetes: Kubernetes
  log: Logger
  pool: Pool
}

/**
 * Main controller reconciliation loop.
 * Read from Kubernetes, and write to Brer.
 */
export async function reconcile(
  app: App,
  pod: V1Pod | null,
): Promise<Invocation | null> {
  const { kubernetes, log, pool } = app

  // Fix TypeScript
  if (!pod || !pod.metadata || !pod.metadata.name) {
    log.warn('malformed pod')
    return null
  }

  // Refresh pod state
  pod = await readPod(kubernetes, pod.metadata.name)

  // Ensure Brer's Pod
  let invocationUlid: string | undefined
  if (pod?.metadata?.labels?.['app.kubernetes.io/managed-by'] === 'brer.io') {
    invocationUlid = pod.metadata.labels['brer.io/invocation-ulid']
  }
  if (!invocationUlid || !pod || !pod.metadata?.name || !pod.metadata?.labels) {
    log.trace('ignore pod')
    return null
  }

  const token = getToken(pod)

  const invocation = await readInvocation(pool, token, invocationUlid)

  // Purge useless Pods
  if (
    !invocation ||
    invocation.status === 'completed' ||
    invocation.status === 'failed' ||
    pod.metadata.name !== invocation.pod
  ) {
    await purgePod(app, pod)
    return invocation
  }

  // Handle failures
  if (!isPodRunning(pod)) {
    const reason = pod.metadata.deletionTimestamp
      ? 'pod deletion'
      : 'runtime failure'

    // Use finalizing Pod to update Invocation first
    log.debug({ invocationUlid }, reason)
    const out = await writeInvocation(pool, token, {
      ...invocation,
      status: 'failed',
      reason,
    })

    // ...and then completely purge the Pod
    await purgePod(app, pod)
    return out
  }

  // Notify Pod is initializing to Brer
  if (invocation.status === 'pending') {
    log.debug({ invocationUlid }, 'invocation is initializing')
    return writeInvocation(pool, token, {
      ...invocation,
      status: 'initializing',
    })
  }

  // Brer runtime is running
  log.trace({ invocationUlid }, 'invocation is still running')
  return invocation
}

/**
 * Read Pod by name.
 */
async function readPod(
  { api, namespace }: Kubernetes,
  podName: string,
): Promise<V1Pod | null> {
  try {
    const response = await api.readNamespacedPod(podName, namespace)
    return response.body
  } catch (err) {
    if (Object(err).statusCode === 404) {
      return null
    } else {
      return Promise.reject(err)
    }
  }
}

/**
 * Returns `true` when the Pod is still running (or in an unknown status).
 */
function isPodRunning(pod: V1Pod): boolean {
  return (
    !pod.metadata?.deletionTimestamp &&
    pod.status?.phase !== 'Succeeded' &&
    pod.status?.phase !== 'Failed'
  )
}

/**
 * Retrieves Pod's authorization token (issued by the Invoker).
 */
function getToken(pod: V1Pod): string {
  const token = pod.spec?.containers?.[0].env?.find(
    e => e.name === 'BRER_TOKEN',
  )?.value

  if (!token) {
    throw new Error('Expected authorization token')
  }

  return token
}

/**
 * Finalizer used to prevent Pod's deletion.
 */
const FINALIZER = 'brer.io/invocation-protection'

/**
 * Delete finalizer OR delete the Pod.
 *
 * Just one write action, controller will catch the edit after that.
 */
async function purgePod({ kubernetes, log }: App, pod: V1Pod) {
  const index = pod.metadata?.finalizers?.findIndex(f => f === FINALIZER) ?? -1

  if (index >= 0) {
    const path = `/metadata/finalizers/${index}`

    log.debug('pull finalizer')
    await kubernetes.api.patchNamespacedPod(
      pod.metadata!.name!,
      kubernetes.namespace,
      [
        { op: 'test', path, value: FINALIZER },
        { op: 'remove', path },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      },
    )
  } else if (!pod.metadata?.deletionTimestamp) {
    log.debug('delete pod')
    await kubernetes.api.deleteNamespacedPod(
      pod.metadata!.name!,
      kubernetes.namespace,
    )
  } else {
    log.warn('unable to delete this pod')
  }
}
