/**
 * API Invocation schema.
 */
export interface Invocation {
  /**
   * ETag.
   */
  _rev: string
  /**
   * Lowercased ULID.
   *
   * @see https://github.com/ulid/spec
   */
  ulid: string
  /**
   * Current status.
   * See `InvocationStatus` type for more info.
   */
  status: InvocationStatus
  /**
   * Completition result value.
   * Available when status is "completed".
   */
  result?: any
  /**
   * Failure reason.
   * Available when status is "failed".
   */
  reason?: any
  /**
   * List of past statuses.
   */
  phases: InvocationPhase[]
  /**
   * Source Function's name.
   */
  functionName: string
  /**
   *
   */
  image: InvocationImage
  /**
   * Test runs are flagged here.
   */
  env: InvocationEnv[]
  /**
   * Authorization group name.
   */
  project: string
  /**
   * Allowed resources.
   */
  resources?: InvocationResources
  /**
   * Active Pod's name.
   */
  pod: string
  /**
   * Number of retries after a failure.
   * This value will be decreased.
   *
   * @default 0
   */
  retries?: number
  /**
   * ISO date string.
   */
  createdAt: string
  /**
   * ISO date string.
   */
  updatedAt: string
}

/**
 * Possible Invocation statuses.
 *
 * - `"pending"` The Invocation is queued to be started.
 * - `"initializing"` The Invocation code is running (waiting for ack).
 * - `"running"` The Invocation has started to process its task.
 * - `"completed"` The Invocation has completed its task successfully.
 * - `"failed"` The Invocation has failed its task.
 */
export type InvocationStatus =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'completed'
  | 'failed'

export interface InvocationPhase {
  /**
   * Phase status.
   */
  status: InvocationStatus | 'progress'
  /**
   * ISO 8601 date string.
   */
  date: string
  pod: string
  reason?: any
}

export interface InvocationImage {
  /**
   * Host (no protocol, no auth, no path).
   * https://nodejs.org/api/url.html#url-strings-and-url-objects
   */
  host: string
  /**
   * The name of the Docker image.
   * The maximum length is 4096 characters.
   * Valid values: Any alphanumeric characters from 0 to 9, A to Z, a to z,
   * and the _ and - characters.
   */
  name: string
  /**
   * The tag must be valid ASCII and can contain lowercase and uppercase
   * letters, digits, underscores, periods, and hyphens.
   * It cannot start with a period or hyphen and must be no longer than
   * 128 characters.
   */
  tag: string
}

export interface InvocationEnv {
  name: string
  value?: string
  secretName?: string
  secretKey?: string
}

export interface InvocationResources {
  requests?: {
    cpu?: string
    memory?: string
  }
  limits?: {
    cpu?: string
    memory?: string
  }
}
