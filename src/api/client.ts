import { API_BASE_URL, type ApiEndpoint } from './endpoints'

export type Credentials = {
  clientId: string
  clientSecret: string
}

export type ApiCallPayload = Record<string, string>

export type ApiCallResult = {
  ok: boolean
  status: number
  durationMs: number
  data: unknown
  rawBody: string
  headers: Record<string, string>
}

function ensureCredentials(credentials: Credentials) {
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error('Client ID and secret are required.')
  }
}

function buildAuthorization(credentials: Credentials) {
  return `Bearer ${credentials.clientId}:${credentials.clientSecret}`
}

function toRecord(headers: Headers) {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

function maybeParseJson(payload: string) {
  const trimmed = payload.trim()
  if (!trimmed) return null
  const first = trimmed[0]
  if (first !== '{' && first !== '[') return null
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    console.warn('Failed to parse JSON response.', error)
    return null
  }
}

export async function callEndpoint(
  endpoint: ApiEndpoint,
  credentials: Credentials,
  payload: ApiCallPayload,
): Promise<ApiCallResult> {
  ensureCredentials(credentials)

  const url = `${API_BASE_URL}${endpoint.path}`
  const requestInit: RequestInit = {
    method: endpoint.method,
    headers: {
      Authorization: buildAuthorization(credentials),
    },
  }

  if (endpoint.method !== 'GET') {
    const formData = new FormData()
    endpoint.bodyFields?.forEach((field) => {
      const value = payload[field.key]
      if (value !== undefined && value !== null) {
        formData.append(field.key, value)
      }
    })
    requestInit.body = formData
  }

  const start = performance.now()
  const response = await fetch(url, requestInit)
  const rawBody = await response.text()
  const durationMs = performance.now() - start

  const parsed = maybeParseJson(rawBody)

  if (!response.ok) {
    throw Object.assign(new Error('HTTP request failed'), {
      response,
      rawBody,
      status: response.status,
      headers: toRecord(response.headers),
      durationMs,
    })
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    data: parsed ?? rawBody,
    rawBody,
    headers: toRecord(response.headers),
  }
}
