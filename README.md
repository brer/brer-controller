# brer-controller

Kubernetes controller component for Brer project.

## Overview

This controller will monitor Pods' status, and sync it with Brer's Invocations through its APIs.

The API authorization is taken from Pods' env variables.

## Setup

### Dependencies

- [Node.js](https://nodejs.org/) v20.6.0 or later
- A Kubernetes cluster ([minikube](https://minikube.sigs.k8s.io/docs/) is ok)

### Envs

Create a `.env` file with the following envs:

| Name          | Description
| ------------- | -------------
| NODE_ENV      | Must be `"production"` for non-toy envs.
| LOG_LEVEL     | Pino.js standard log level. Defaults to `"debug"`.
| LOG_PRETTY    | Set to `"enable"` to pretty-print logs.
| LOG_FILE      | Optional logs file filepath.
| **API_URL**   | **Required**. Brer API server URL.
| K8S_YAML      | Raw `kubeconfig` YAML data. Has precedence over `K8S_FILE`.
| K8S_FILE      | Filepath of the `kubeconfig` file. Default to in-cluster or OS-specific.
| K8S_CONTEXT   | Expected context's name.
| K8S_CLUSTER   | Expected context's cluster.
| K8S_USER      | Expected context's user.
| K8S_NAMESPACE | Used namespace. Defaults to context, then in-cluster env, then `"default"`.

### Start

Start the server:

```
npm start --env .env
```

For development:

```
npm run watch --env .env
```

### Test

Run:

```
npm test
```

## Acknowledgements

This project is kindly sponsored by [Evologi](https://evologi.it/).
