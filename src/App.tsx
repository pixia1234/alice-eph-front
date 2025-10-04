import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { API_BASE_URL, endpoints, type ApiEndpoint } from './api/endpoints'
import {
  callEndpoint,
  type ApiCallPayload,
  type ApiCallResult,
  type Credentials,
} from './api/client'
import { useLocalStorage } from './hooks/useLocalStorage'

type FormValues = Record<string, string>

type ErrorDetails = {
  message: string
  status?: number
  rawBody?: string
  headers?: Record<string, string>
  durationMs?: number
}

type HistoryEntry = {
  id: number
  kind: 'success' | 'error'
  endpointId: ApiEndpoint['id']
  endpointName: string
  endpointMethod: ApiEndpoint['method']
  endpointPath: string
  createdAt: number
  result?: ApiCallResult
  error?: ErrorDetails
}

const HISTORY_LIMIT = 5
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const DOC_BASE_URL = 'https://api.aliceinit.io/'

const endpointDocHints: Record<string, string> = {
  'evo-instance-list': '#/EVO/Instance',
  'evo-deploy': '#/EVO/Deploy',
  'evo-destroy': '#/EVO/Destroy',
  'evo-power': '#/EVO/Power',
  'evo-rebuild': '#/EVO/Rebuild',
  'evo-plan-list': '#/EVO/Plan',
  'evo-plan-os': '#/EVO/getOSByPlan',
  'evo-renewal': '#/EVO/Renewal',
  'evo-instance-state': '#/EVO/State',
  'user-sshkeys': '#/User/SSHKey',
  'user-evo-permissions': '#/User/EVOPermissions',
  'user-info': '#/User/Info',
}

type PreviewBlock =
  | { type: 'keyValue'; title?: string; entries: { label: string; value: string }[] }
  | { type: 'chips'; title?: string; items: string[] }
  | {
      type: 'entityList'
      title?: string
      items: PreviewEntity[]
      remainder?: number
    }
  | { type: 'text'; title?: string; body: string }

type PreviewEntity = {
  heading?: string
  subheading?: string
  accent?: string
  details: { label: string; value: string }[]
}

type PreviewMeta = {
  success?: boolean
  message?: string
  code?: number
  metrics?: { label: string; value: string }[]
}

const defaultCredentials: Credentials = {
  clientId: '',
  clientSecret: '',
}

function getInitialValues(endpoint: ApiEndpoint): FormValues {
  return (
    endpoint.bodyFields?.reduce<FormValues>((acc, field) => {
      acc[field.key] = field.defaultValue ?? field.options?.[0]?.value ?? ''
      return acc
    }, {}) ?? {}
  )
}

function getDocUrl(endpoint: { id: string; path: string }) {
  const hint = endpointDocHints[endpoint.id]
  if (hint) {
    return `${DOC_BASE_URL}${hint}`
  }
  const sanitized = endpoint.path.replace(/^\//, '').replace(/\//g, '-')
  return `${DOC_BASE_URL}#${sanitized}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toLabel(key: string) {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : '—'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    const preview = value.slice(0, 4).map((item) => formatScalar(item)).filter(Boolean)
    if (preview.length === 0) return '—'
    const joined = preview.join(', ')
    return value.length > 4 ? `${joined} …` : joined
  }
  if (isRecord(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return '—'
    return keys.slice(0, 4).map(toLabel).join(', ')
  }
  return String(value)
}

function preparePreview(payload: unknown): { meta?: PreviewMeta; blocks: PreviewBlock[] } {
  if (payload === undefined || payload === null) {
    return { blocks: [] }
  }

  const meta: PreviewMeta = {}
  let root: unknown = payload

  if (isRecord(payload)) {
    if (typeof payload.message === 'string') {
      meta.message = payload.message
    } else if (typeof payload.msg === 'string') {
      meta.message = payload.msg
    }

    if (typeof payload.code === 'number') {
      meta.code = payload.code
    }

    if (typeof payload.success === 'boolean') {
      meta.success = payload.success
    } else if (typeof payload.status === 'boolean') {
      meta.success = payload.status
    }

    const metricKeys = ['total', 'count', 'size', 'duration', 'quota', 'balance', 'remaining']
    const metrics: { label: string; value: string }[] = []
    metricKeys.forEach((key) => {
      const value = payload[key as keyof typeof payload]
      if (typeof value === 'number') {
        metrics.push({ label: toLabel(key), value: value.toLocaleString() })
      }
    })
    if (metrics.length > 0) {
      meta.metrics = metrics
    }

    const preferredKeys = [
      'data',
      'datas',
      'result',
      'results',
      'payload',
      'list',
      'items',
      'instances',
      'plans',
      'sshKeys',
      'info',
    ]
    for (const key of preferredKeys) {
      if (key in payload) {
        root = payload[key]
        break
      }
    }
  }

  const blocks = buildPreviewBlocks(root)
  const hasMeta =
    meta.success !== undefined || Boolean(meta.message) || meta.code !== undefined || Boolean(meta.metrics?.length)

  return {
    meta: hasMeta ? meta : undefined,
    blocks,
  }
}

function buildPreviewBlocks(value: unknown, keyHint?: string): PreviewBlock[] {
  if (value === null || value === undefined) return []

  if (Array.isArray(value)) {
    return buildBlocksFromArray(value, keyHint)
  }

  if (isRecord(value)) {
    return buildBlocksFromRecord(value, keyHint)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    return [
      {
        type: 'text',
        title: keyHint ? toLabel(keyHint) : undefined,
        body: trimmed,
      },
    ]
  }

  return [
    {
      type: 'text',
      title: keyHint ? toLabel(keyHint) : undefined,
      body: String(value),
    },
  ]
}

function buildBlocksFromRecord(record: Record<string, unknown>, keyHint?: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = []

  const scalarEntries: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value) || isRecord(value)) continue
    const formatted = formatScalar(value)
    if (!formatted || formatted === '—') continue
    scalarEntries.push({ label: toLabel(key), value: formatted })
    if (scalarEntries.length >= 8) break
  }

  if (scalarEntries.length > 0) {
    blocks.push({
      type: 'keyValue',
      title: keyHint ? toLabel(keyHint) : undefined,
      entries: scalarEntries,
    })
  }

  for (const [key, value] of Object.entries(record)) {
    if (!Array.isArray(value) && !isRecord(value)) continue
    const childBlocks = buildPreviewBlocks(value, key)
    blocks.push(...childBlocks)
  }

  return blocks
}

function buildBlocksFromArray(array: unknown[], keyHint?: string): PreviewBlock[] {
  if (array.length === 0) {
    return [
      {
        type: 'text',
        title: keyHint ? toLabel(keyHint) : undefined,
        body: 'No items returned for this section.',
      },
    ]
  }

  if (array.every((item) => !isRecord(item))) {
    return [
      {
        type: 'chips',
        title: keyHint ? toLabel(keyHint) : undefined,
        items: array.slice(0, 12).map((item) => formatScalar(item)),
      },
    ]
  }

  const records = array.filter((item): item is Record<string, unknown> => isRecord(item))
  if (records.length === 0) {
    return [
      {
        type: 'text',
        title: keyHint ? toLabel(keyHint) : undefined,
        body: formatScalar(array),
      },
    ]
  }

  const limit = 6
  const items = records.slice(0, limit).map((record) => buildEntity(record))
  const remainder = array.length > limit ? array.length - limit : undefined

  return [
    {
      type: 'entityList',
      title: keyHint ? toLabel(keyHint) : undefined,
      items,
      remainder,
    },
  ]
}

function buildEntity(record: Record<string, unknown>): PreviewEntity {
  const headingCandidate = pickValue(record, [
    'name',
    'label',
    'hostname',
    'instance',
    'instance_name',
    'plan',
    'planName',
    'title',
    'product_id',
  ])

  const subheadingCandidate = pickValue(record, [
    'id',
    'instance_id',
    'product_id',
    'os_id',
    'region',
    'location',
  ])

  const accentCandidate = pickValue(record, ['status', 'state', 'power', 'action'])

  const skipKeys = new Set<string>()
  if (headingCandidate?.key) skipKeys.add(headingCandidate.key)
  if (subheadingCandidate?.key) skipKeys.add(subheadingCandidate.key)
  if (accentCandidate?.key) skipKeys.add(accentCandidate.key)

  const details: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(record)) {
    if (skipKeys.has(key)) continue
    if (isRecord(value)) continue
    if (Array.isArray(value) && value.some((item) => isRecord(item))) continue
    const formatted = formatScalar(value)
    if (!formatted || formatted === '—') continue
    details.push({ label: toLabel(key), value: formatted })
    if (details.length >= 6) break
  }

  return {
    heading: headingCandidate?.value,
    subheading:
      subheadingCandidate?.value && subheadingCandidate.value !== headingCandidate?.value
        ? subheadingCandidate.value
        : undefined,
    accent:
      accentCandidate?.value && accentCandidate.value !== subheadingCandidate?.value
        ? accentCandidate.value
        : undefined,
    details,
  }
}

function pickValue(record: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const value = record[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        return { key, value: trimmed }
      }
      continue
    }
    if (typeof value === 'number') {
      return { key, value: String(value) }
    }
  }
  return undefined
}

type ResponseCardProps = {
  entry: HistoryEntry
  docUrl: string
}

function ResponseCard({ entry, docUrl }: ResponseCardProps) {
  const isError = entry.kind === 'error'
  const statusLabel = isError ? entry.error?.status ?? 'Error' : entry.result?.status ?? 'OK'
  const duration = isError ? entry.error?.durationMs : entry.result?.durationMs
  const headers = isError ? entry.error?.headers : entry.result?.headers

  const preview = useMemo(() => {
    if (isError) {
      return { meta: undefined, blocks: [] }
    }
    return preparePreview(entry.result?.data)
  }, [entry.result?.data, isError])

  const hasPreview = !isError && preview.blocks.length > 0
  const [viewMode, setViewMode] = useState<'preview' | 'json'>(hasPreview ? 'preview' : 'json')

  useEffect(() => {
    setViewMode(hasPreview ? 'preview' : 'json')
  }, [hasPreview])

  const rawContent = useMemo(() => {
    if (isError) {
      if (entry.error?.rawBody) return entry.error.rawBody
      if (entry.error?.message) return entry.error.message
      return 'Unexpected error occurred.'
    }
    if (!entry.result) return ''
    if (typeof entry.result.data === 'string') {
      return entry.result.data
    }
    try {
      return JSON.stringify(entry.result.data, null, 2)
    } catch (serializationError) {
      console.warn('Failed to serialize response data', serializationError)
      return entry.result.rawBody
    }
  }, [entry.error, entry.result, isError])

  return (
    <article className={`response ${isError ? 'response--error' : ''}`}>
      <header className="response__header">
        <div className="response__headline">
          <span className={`tag ${isError ? 'tag--error' : 'tag--success'}`}>{statusLabel}</span>
          <span className="response__meta-pill response__meta-pill--method">{entry.endpointMethod}</span>
          <span className="response__meta-pill response__meta-pill--name">{entry.endpointName}</span>
          {typeof duration === 'number' && (
            <span className="response__meta-pill">{duration.toFixed(1)} ms</span>
          )}
          <span className="response__meta-pill">{timeFormatter.format(entry.createdAt)}</span>
        </div>
        <a className="response__doc-link" href={docUrl} target="_blank" rel="noreferrer">
          Docs ↗
        </a>
      </header>

      {!isError && preview.meta && (
        <div className="response__meta-card">
          {preview.meta.success !== undefined && (
            <span className={`response__badge ${preview.meta.success ? 'response__badge--success' : 'response__badge--warning'}`}>
              {preview.meta.success ? 'Success' : 'Failed'}
            </span>
          )}
          {preview.meta.message && <p className="response__meta-text">{preview.meta.message}</p>}
          {preview.meta.metrics && preview.meta.metrics.length > 0 && (
            <ul className="response__metrics">
              {preview.meta.metrics.map((metric) => (
                <li key={metric.label}>
                  <span className="response__metric-label">{metric.label}</span>
                  <span className="response__metric-value">{metric.value}</span>
                </li>
              ))}
            </ul>
          )}
          {preview.meta.code !== undefined && (
            <span className="response__meta-pill">Code {preview.meta.code}</span>
          )}
        </div>
      )}

      {!isError && hasPreview && (
        <div className="response__view-toggle" role="tablist" aria-label="Response view">
          <button
            type="button"
            className={`response__view-button ${viewMode === 'preview' ? 'response__view-button--active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`response__view-button ${viewMode === 'json' ? 'response__view-button--active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            Raw JSON
          </button>
        </div>
      )}

      {!isError && hasPreview && viewMode === 'preview' && (
        <div className="preview">
          {preview.blocks.map((block, index) => {
            if (block.type === 'keyValue') {
              return (
                <section className="preview__block" key={`kv-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <dl className="preview__grid">
                    {block.entries.map((entryItem) => (
                      <div className="preview__cell" key={entryItem.label}>
                        <dt>{entryItem.label}</dt>
                        <dd>{entryItem.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )
            }

            if (block.type === 'chips') {
              return (
                <section className="preview__block" key={`chips-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <div className="preview__chips">
                    {block.items.map((item, chipIndex) => (
                      <span className="preview__chip" key={`${item}-${chipIndex}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              )
            }

            if (block.type === 'entityList') {
              return (
                <section className="preview__block" key={`entities-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <div className="preview__list">
                    {block.items.map((item, entityIndex) => (
                      <div className="preview__item" key={`${item.heading ?? 'entity'}-${entityIndex}`}>
                        <div className="preview__item-head">
                          {item.heading && <h4>{item.heading}</h4>}
                          {item.subheading && <span className="preview__item-sub">{item.subheading}</span>}
                          {item.accent && <span className="preview__item-accent">{item.accent}</span>}
                        </div>
                        {item.details.length > 0 && (
                          <dl>
                            {item.details.map((detail) => (
                              <div className="preview__item-row" key={detail.label}>
                                <dt>{detail.label}</dt>
                                <dd>{detail.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    ))}
                  </div>
                  {block.remainder && block.remainder > 0 && (
                    <p className="preview__more">+{block.remainder} more item(s) not shown</p>
                  )}
                </section>
              )
            }

            if (block.type === 'text') {
              return (
                <section className="preview__block" key={`text-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <p className="preview__text">{block.body}</p>
                </section>
              )
            }

            return null
          })}
        </div>
      )}

      {(isError || !hasPreview || viewMode === 'json') && rawContent && (
        <pre className="code-block">{rawContent}</pre>
      )}

      {isError && entry.error?.message && (
        <p className="response__message">{entry.error.message}</p>
      )}

      {headers && Object.keys(headers).length > 0 && (
        <details className="response__details">
          <summary>Response headers</summary>
          <ul>
            {Object.entries(headers).map(([key, value]) => (
              <li key={key}>
                <span className="header-key">{key}</span>
                <span className="header-value">{value}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}

function App() {
  const [credentials, setCredentials] = useLocalStorage<Credentials>('alice.credentials', defaultCredentials)
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpoints[0].id)
  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? endpoints[0],
    [selectedEndpointId],
  )
  const [formValues, setFormValues] = useState<FormValues>(() => getInitialValues(endpoints[0]))
  const [isLoading, setIsLoading] = useState(false)
  const historyCounter = useRef(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const handleCredentialChange = (key: keyof Credentials, value: string) => {
    setCredentials({ ...credentials, [key]: value })
  }

  const handleEndpointChange = (nextEndpointId: string) => {
    setSelectedEndpointId(nextEndpointId)
    const nextEndpoint = endpoints.find((endpoint) => endpoint.id === nextEndpointId) ?? endpoints[0]
    setFormValues(getInitialValues(nextEndpoint))
  }

  const handleFormValueChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const appendHistory = (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    setHistory((prev) => {
      const nextEntry: HistoryEntry = {
        id: historyCounter.current++,
        createdAt: Date.now(),
        ...entry,
      }
      return [nextEntry, ...prev].slice(0, HISTORY_LIMIT)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedEndpoint) return

    const trimmedId = credentials.clientId.trim()
    const trimmedSecret = credentials.clientSecret.trim()
    if (!trimmedId || !trimmedSecret) {
      appendHistory({
        kind: 'error',
        endpointId: selectedEndpoint.id,
        endpointName: selectedEndpoint.name,
        endpointMethod: selectedEndpoint.method,
        endpointPath: selectedEndpoint.path,
        error: { message: 'Please provide both client ID and secret before sending a request.' },
      })
      return
    }

    const payload: ApiCallPayload = {}
    selectedEndpoint.bodyFields?.forEach((field) => {
      payload[field.key] = formValues[field.key] ?? ''
    })

    setIsLoading(true)

    const endpointSnapshot = selectedEndpoint

    try {
      const response = await callEndpoint(endpointSnapshot, credentials, payload)
      appendHistory({
        kind: 'success',
        endpointId: endpointSnapshot.id,
        endpointName: endpointSnapshot.name,
        endpointMethod: endpointSnapshot.method,
        endpointPath: endpointSnapshot.path,
        result: response,
      })
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        const { message } = unknownError
        const extra = unknownError as ErrorDetails
        const details: ErrorDetails = {
          message,
          status: extra.status,
          rawBody: extra.rawBody,
          headers: extra.headers,
          durationMs: extra.durationMs,
        }
        appendHistory({
          kind: 'error',
          endpointId: endpointSnapshot.id,
          endpointName: endpointSnapshot.name,
          endpointMethod: endpointSnapshot.method,
          endpointPath: endpointSnapshot.path,
          error: details,
        })
      } else {
        appendHistory({
          kind: 'error',
          endpointId: endpointSnapshot.id,
          endpointName: endpointSnapshot.name,
          endpointMethod: endpointSnapshot.method,
          endpointPath: endpointSnapshot.path,
          error: { message: 'Unexpected error occurred.' },
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearCredentials = () => {
    setCredentials(defaultCredentials)
  }

  const requestUrl = useMemo(() => `${API_BASE_URL}${selectedEndpoint.path}`, [selectedEndpoint])
  const selectedDocUrl = useMemo(() => getDocUrl(selectedEndpoint), [selectedEndpoint])
  const totalEndpoints = endpoints.length
  const hasCredentials =
    credentials.clientId.trim().length > 0 && credentials.clientSecret.trim().length > 0
  const credentialStatus = hasCredentials ? 'Ready' : 'Missing'
  const credentialTone = hasCredentials ? 'hero__stat--positive' : 'hero__stat--warning'
  const baseDisplay = API_BASE_URL.startsWith('http')
    ? API_BASE_URL.replace(/^https?:\/\//, '')
    : API_BASE_URL

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__badge">Alice EVO Toolkit</div>
        <h1 className="hero__title">Ephemera API Console</h1>
        <p className="hero__subtitle">
          Store your credentials locally, explore live endpoints, and inspect responses without
          leaving the browser.
        </p>
        <div className="hero__meta">
          <div className="hero__stat">
            <span className="hero__stat-label">Endpoints</span>
            <span className="hero__stat-value">{totalEndpoints}</span>
          </div>
          <div className={`hero__stat ${credentialTone}`}>
            <span className="hero__stat-label">Credentials</span>
            <span className="hero__stat-value">{credentialStatus}</span>
          </div>
          <span className="hero__pill" title={API_BASE_URL}>
            Base: {baseDisplay}
          </span>
        </div>
        <div className="hero__cta">
          <a className="link-button" href={selectedDocUrl} target="_blank" rel="noreferrer">
            Official API docs
          </a>
          <span className="hero__cta-note">
            Previews adapt to the fixed JSON schema published by Alice to feel less like raw API
            traffic.
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="panel__header">
          <h2>Credentials</h2>
          <button type="button" onClick={handleClearCredentials} className="ghost-button">
            Clear
          </button>
        </div>
        <div className="panel__content">
          <div className="field-group">
            <label htmlFor="client-id">Client ID</label>
            <input
              id="client-id"
              value={credentials.clientId}
              onChange={(event) => handleCredentialChange('clientId', event.target.value)}
              placeholder="cli_xxx"
              autoComplete="off"
            />
          </div>
          <div className="field-group">
            <label htmlFor="client-secret">Client Secret</label>
            <input
              id="client-secret"
              value={credentials.clientSecret}
              onChange={(event) => handleCredentialChange('clientSecret', event.target.value)}
              placeholder="secret"
              autoComplete="off"
              type="password"
            />
          </div>
          <p className="panel__hint">Credentials are stored only in this browser via localStorage.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Endpoint</h2>
        </div>
        <div className="panel__content">
          <div className="endpoint-snapshots" role="list" aria-label="Highlighted endpoints">
            {endpoints.slice(0, 3).map((endpoint) => (
              <button
                type="button"
                key={endpoint.id}
                className={`endpoint-card ${endpoint.id === selectedEndpointId ? 'endpoint-card--active' : ''}`}
                onClick={() => handleEndpointChange(endpoint.id)}
                aria-pressed={endpoint.id === selectedEndpointId}
              >
                <span className="endpoint-card__method">{endpoint.method}</span>
                <span className="endpoint-card__title">{endpoint.name}</span>
                {endpoint.description && (
                  <span className="endpoint-card__description">{endpoint.description}</span>
                )}
                <span className="endpoint-card__path">{endpoint.path}</span>
              </button>
            ))}
          </div>
          <div className="field-group">
            <label htmlFor="endpoint">Select endpoint</label>
            <select
              id="endpoint"
              value={selectedEndpointId}
              onChange={(event) => handleEndpointChange(event.target.value)}
            >
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
                </option>
              ))}
            </select>
          </div>
          {selectedEndpoint.description && (
            <p className="panel__hint">{selectedEndpoint.description}</p>
          )}
          <p className="panel__meta">
            <span className="tag">{selectedEndpoint.method}</span>
            <code>{requestUrl}</code>
            <a className="doc-link" href={selectedDocUrl} target="_blank" rel="noreferrer">
              Docs ↗
            </a>
          </p>
          <form className="form" onSubmit={handleSubmit}>
              {selectedEndpoint.bodyFields && selectedEndpoint.bodyFields.length > 0 && (
                <fieldset className="form__fields">
                  {selectedEndpoint.bodyFields.map((field) => (
                    <div className="field-group" key={field.key}>
                      <label htmlFor={`field-${field.key}`}>
                        {field.label}
                        {field.required && <span className="required">*</span>}
                      </label>
                      {field.options ? (
                        <select
                          id={`field-${field.key}`}
                          value={formValues[field.key] ?? field.options[0]?.value ?? ''}
                          onChange={(event) => handleFormValueChange(field.key, event.target.value)}
                          required={field.required}
                        >
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`field-${field.key}`}
                          value={formValues[field.key] ?? ''}
                          onChange={(event) => handleFormValueChange(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      )}
                      {field.helperText && <p className="field-group__hint">{field.helperText}</p>}
                    </div>
                  ))}
                </fieldset>
              )}
            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Response</h2>
        </div>
        <div className="panel__content">
          {history.length > 0 ? (
            <div className="response-list">
              {history.map((entry) => {
                const endpointReference =
                  endpoints.find((candidate) => candidate.id === entry.endpointId) ?? {
                    id: entry.endpointId,
                    path: entry.endpointPath,
                  }
                const docUrl = getDocUrl(endpointReference)
                return <ResponseCard key={entry.id} entry={entry} docUrl={docUrl} />
              })}
            </div>
          ) : (
            <p className="panel__hint">Responses will appear here after you send a request.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
