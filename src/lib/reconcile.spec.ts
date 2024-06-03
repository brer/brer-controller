import type { V1Pod } from '@kubernetes/client-node'
import test from 'ava'
import Pino from 'pino'

import { reconcile } from './reconcile.js'

test('noop when running', async t => {
  t.plan(4)

  const pod: V1Pod = {
    metadata: {
      name: 'my_test_pod',
      labels: {
        'app.kubernetes.io/managed-by': 'brer.io',
        'brer.io/invocation-ulid': 'my_test_invocation',
      },
    },
    spec: {
      containers: [
        {
          name: 'test',
          env: [
            {
              name: 'BRER_TOKEN',
              value: 'my_test_token',
            },
          ],
        },
      ],
    },
  }

  const app: any = {
    kubernetes: {
      api: {
        async readNamespacedPod(podName: unknown, namespace: unknown) {
          t.is(podName, pod.metadata?.name)
          t.is(namespace, 'my_namespace')
          return { body: pod }
        },
      },
      namespace: 'my_namespace',
    },
    log: Pino.default({
      level: 'silent',
    }),
    pool: {
      async request(options: any) {
        t.like(options, {
          method: 'GET',
          path: '/api/v1/invocations/my_test_invocation',
          headers: {
            authorization: `Bearer my_test_token`,
          },
        })

        return {
          statusCode: 200,
          body: {
            async json() {
              return {
                invocation: {
                  ulid: 'my_test_invocation',
                  status: 'running',
                  pod: pod.metadata?.name,
                },
              }
            },
          },
        }
      },
    },
  }

  const invocation = await reconcile(app, pod)
  t.like(invocation, {
    ulid: 'my_test_invocation',
  })
})
