import { Pool } from 'undici'

import type { Invocation } from './invocation.js'

export function createPool(url: string | undefined) {
  if (!url) {
    throw new Error('Expected API server URL')
  }

  return new Pool(url, {
    connections: 32,
    headersTimeout: 10000,
    pipelining: 1,
  })
}

export async function testPool(pool: Pool) {
  const response = await pool.request({
    method: 'GET',
    path: '/api/v1/invocations',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  })

  await response.body.json()

  if (response.statusCode !== 401) {
    throw new Error('Pool connection test failed')
  }
}

/**
 * Read Invocation by ULID.
 */
export async function readInvocation(
  pool: Pool,
  token: string,
  invocationUlid: string,
): Promise<Invocation | null> {
  const response = await pool.request({
    method: 'GET',
    path: `/api/v1/invocations/${invocationUlid}`,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })

  const data: any = await response.body.json()

  if (response.statusCode === 404) {
    return null
  } else if (response.statusCode === 200) {
    return data.invocation
  } else {
    throw new Error(
      `Invocation ${invocationUlid} read returned status code ${response.statusCode}`,
    )
  }
}

/**
 * Update whole Invocation.
 */
export async function writeInvocation(
  pool: Pool,
  token: string,
  invocation: Invocation,
): Promise<Invocation> {
  const response = await pool.request({
    method: 'PUT',
    path: `/api/v1/invocations/${invocation.ulid}`,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'if-match': invocation._rev || 'invalid_rev',
    },
    body: JSON.stringify(invocation),
  })

  const data: any = await response.body.json()

  if (response.statusCode === 200) {
    return data.invocation
  } else {
    throw new Error(
      `Invocation ${invocation.ulid} update returned status code ${response.statusCode}`,
    )
  }
}

export async function pushLogPage(
  pool: Pool,
  token: string,
  invocationUlid: string,
  invocationRev: string,
  pageIndex: number,
  pageContent: string | Buffer,
): Promise<string> {
  const response = await pool.request({
    method: 'PUT',
    path: `/api/v1/invocations/${invocationUlid}/log/${pageIndex}`,
    headers: {
      accept: '*/*',
      authorization: `Bearer ${token}`,
      'content-type': 'text/plain; charset=utf-8',
      'if-match': invocationRev,
    },
    body: pageContent,
  })

  if (response.statusCode !== 204) {
    await response.body.text()
    throw new Error(
      `Invocation ${invocationUlid} update returned status code ${response.statusCode}`,
    )
  }

  return response.headers.etag + ''
}
