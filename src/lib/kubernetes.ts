import { CoreV1Api, KubeConfig } from '@kubernetes/client-node'

export interface Kubernetes {
  api: CoreV1Api
  config: KubeConfig
  /**
   * Active namespace.
   */
  namespace: string
}

export interface KubernetesOptions {
  file?: string
  yaml?: string
  namespace?: string
  /**
   * Required Kubeconfig context name.
   */
  context?: string
  /**
   * Required Kubeconfig context cluster.
   */
  cluster?: string
  /**
   * Required Kubeconfig context user.
   */
  user?: string
}

export function setupKubernetes(options: KubernetesOptions): Kubernetes {
  const config = new KubeConfig()

  if (options.yaml) {
    config.loadFromString(options.yaml)
  } else if (options.file) {
    config.loadFromFile(options.file)
  } else if (process.env.KUBERNETES_SERVICE_HOST) {
    config.loadFromCluster()
  } else {
    config.loadFromDefault()
  }

  const context = getContext(config, options)
  if (!context) {
    throw new Error('Empty Kubeconfig')
  }

  config.setCurrentContext(context.name)

  const namespace =
    options.namespace ||
    context.namespace ||
    process.env.KUBERNETES_NAMESPACE ||
    'default'

  return {
    api: config.makeApiClient(CoreV1Api),
    config,
    namespace,
  }
}

function getContext(config: KubeConfig, options: KubernetesOptions) {
  return config.getContexts().find(context => {
    if (options.context && context.name !== options.context) {
      return false
    }
    if (options.cluster && context.cluster !== options.cluster) {
      return false
    }
    if (options.user && context.user !== options.user) {
      return false
    }
    return true
  })
}
