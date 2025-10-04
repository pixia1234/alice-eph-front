import { type FormEvent, useMemo, useState } from 'react'
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

const defaultCredentials: Credentials = {
  clientId: '',
  clientSecret: '',
}

function getInitialValues(endpoint: ApiEndpoint): FormValues {
  return (
    endpoint.bodyFields?.reduce<FormValues>((acc, field) => {
      acc[field.key] = field.defaultValue ?? ''
      return acc
    }, {}) ?? {}
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
  const [result, setResult] = useState<ApiCallResult | null>(null)
  const [error, setError] = useState<ErrorDetails | null>(null)

  const handleCredentialChange = (key: keyof Credentials, value: string) => {
    setCredentials({ ...credentials, [key]: value })
  }

  const handleEndpointChange = (nextEndpointId: string) => {
    setSelectedEndpointId(nextEndpointId)
    const nextEndpoint = endpoints.find((endpoint) => endpoint.id === nextEndpointId) ?? endpoints[0]
    setFormValues(getInitialValues(nextEndpoint))
    setResult(null)
    setError(null)
  }

  const handleFormValueChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedEndpoint) return

    if (!credentials.clientId || !credentials.clientSecret) {
      setError({ message: 'Please provide both client ID and secret before sending a request.' })
      return
    }

    const payload: ApiCallPayload = {}
    selectedEndpoint.bodyFields?.forEach((field) => {
      payload[field.key] = formValues[field.key] ?? ''
    })

    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await callEndpoint(selectedEndpoint, credentials, payload)
      setResult(response)
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        const { message } = unknownError
        const extra = unknownError as ErrorDetails
        setError({
          message,
          status: extra.status,
          rawBody: extra.rawBody,
          headers: extra.headers,
          durationMs: extra.durationMs,
        })
      } else {
        setError({ message: 'Unexpected error occurred.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearCredentials = () => {
    setCredentials(defaultCredentials)
  }

  const requestUrl = useMemo(() => `${API_BASE_URL}${selectedEndpoint.path}`, [selectedEndpoint])
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
                    <input
                      id={`field-${field.key}`}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => handleFormValueChange(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
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
          {result && (
            <div className="response">
              <p className="response__meta">
                <span className="tag tag--success">{result.status}</span>
                <span>{result.durationMs.toFixed(1)} ms</span>
              </p>
              <pre className="code-block">
                {typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data, null, 2)}
              </pre>
              {Object.keys(result.headers).length > 0 && (
                <details className="response__details">
                  <summary>Response headers</summary>
                  <ul>
                    {Object.entries(result.headers).map(([key, value]) => (
                      <li key={key}>
                        <span className="header-key">{key}</span>
                        <span className="header-value">{value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {error && (
            <div className="response response--error">
              <p className="response__meta">
                <span className="tag tag--error">{error.status ?? 'Error'}</span>
                {typeof error.durationMs === 'number' && <span>{error.durationMs.toFixed(1)} ms</span>}
              </p>
              <p className="response__message">{error.message}</p>
              {error.rawBody && <pre className="code-block">{error.rawBody}</pre>}
              {error.headers && Object.keys(error.headers).length > 0 && (
                <details className="response__details">
                  <summary>Response headers</summary>
                  <ul>
                    {Object.entries(error.headers).map(([key, value]) => (
                      <li key={key}>
                        <span className="header-key">{key}</span>
                        <span className="header-value">{value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {!result && !error && <p className="panel__hint">Responses will appear here after you send a request.</p>}
        </div>
      </section>
    </div>
  )
}

export default App
