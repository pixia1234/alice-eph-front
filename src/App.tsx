import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { API_BASE_URL, endpoints, type ApiEndpoint } from './api/endpoints'
import { callEndpoint, type ApiCallPayload, type ApiCallResult, type Credentials } from './api/client'
import { useLocalStorage } from './hooks/useLocalStorage'

/** -------------------- 简化的类型 -------------------- */
type FormValues = Record<string, string>

type HistoryEntry = {
  id: number
  kind: 'success' | 'error'
  endpointId: ApiEndpoint['id']
  endpointName: string
  endpointMethod: ApiEndpoint['method']
  endpointPath: string
  createdAt: number
  result?: ApiCallResult
  error?: { message: string; status?: number; rawBody?: string }
}

type OptionItem = { value: string; label: string; raw?: Record<string, unknown> }

type CatalogData = {
  plans: OptionItem[]
  instances: OptionItem[]
  sshKeys: OptionItem[]
  osByPlan: Record<string, OptionItem[]>
  userInfo?: unknown
  lastUpdated?: number
}

const defaultCatalog: CatalogData = { plans: [], instances: [], sshKeys: [], osByPlan: {} }
const defaultCredentials: Credentials = { clientId: '', clientSecret: '' }

/** -------------------- 小工具函数（保留最小集合） -------------------- */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const unwrapList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (isRecord(payload)) {
    for (const k of ['data','datas','result','results','payload','list','items','instances','plans','entries','sshKeys']) {
      const arr = payload[k as keyof typeof payload]
      if (Array.isArray(arr)) return arr
    }
  }
  return []
}

const uniqueOptions = (options: OptionItem[]) => {
  const seen = new Set<string>()
  return options.filter(o => (seen.has(o.value) ? false : (seen.add(o.value), true)))
}

const pick = (rec: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = rec[k]
    if (v == null) continue
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

const buildGenericOptions = (payload: unknown, idKeys: string[], labelKeys: string[]): OptionItem[] => {
  const items = unwrapList(payload)
  const options: OptionItem[] = []
  items.forEach(it => {
    if (!isRecord(it)) return
    const id = pick(it, idKeys)
    if (!id) return
    const label = pick(it, labelKeys) ?? id
    options.push({ value: id, label, raw: it })
  })
  return uniqueOptions(options)
}

/** 计划：更宽松地从常见键提取 id 与 label */
const extractPlanOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','product_id','plan_id','code'], ['name','planName','label'])

const deriveInstanceOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','instance_id','instanceId'], ['name','label','hostname','product','plan','status'])

const deriveSshKeyOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','key_id','sshKey','value'], ['name','label','fingerprint'])

const deriveOsOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','os_id','code','value'], ['name','label','title','description'])

const findEndpointById = (id: string) => endpoints.find(e => e.id === id)

/** -------------------- 组件 -------------------- */
function App() {
  const [credentials, setCredentials] = useLocalStorage<Credentials>('alice.credentials', defaultCredentials)
  const sanitizedCredentials = useMemo<Credentials>(() => ({
    clientId: credentials.clientId.trim(),
    clientSecret: credentials.clientSecret.trim()
  }), [credentials])
  const hasCredentials = !!(sanitizedCredentials.clientId && sanitizedCredentials.clientSecret)

  const [catalog, setCatalog] = useLocalStorage<CatalogData>('alice.catalog', defaultCatalog)
  const [prefetchState, setPrefetchState] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpoints[0].id)
  const selectedEndpoint = useMemo(
    () => endpoints.find(e => e.id === selectedEndpointId) ?? endpoints[0],
    [selectedEndpointId]
  )
  const [formValues, setFormValues] = useState<FormValues>(() => {
    const ep = endpoints[0]
    const o: FormValues = {}
    ep.bodyFields?.forEach(f => o[f.key] = f.defaultValue ?? f.options?.[0]?.value ?? '')
    return o
  })
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const counter = useRef(0)

  /** 切换端点时重置该端点的默认表单值 */
  const handleEndpointChange = (id: string) => {
    setSelectedEndpointId(id)
    const ep = endpoints.find(e => e.id === id) ?? endpoints[0]
    const o: FormValues = {}
    ep.bodyFields?.forEach(f => (o[f.key] = f.defaultValue ?? f.options?.[0]?.value ?? ''))
    setFormValues(o)
  }

  const handleFormChange = (k: string, v: string) => setFormValues(p => ({ ...p, [k]: v }))

  const appendHistory = (entry: Omit<HistoryEntry, 'id'|'createdAt'>) => {
    setHistory(prev => [
      { id: counter.current++, createdAt: Date.now(), ...entry },
      ...prev
    ].slice(0, 5))
  }

  /** 一次性预取参考数据（plans / instances / sshKeys / userInfo），更简单的状态机 */
  useEffect(() => {
    if (!hasCredentials) return
    if (prefetchState === 'loading' || prefetchState === 'done') return

    let cancelled = false
    setPrefetchState('loading')

    const targets = [
      { key: 'plans' as const, endpointId: 'evo-plan-list', parser: extractPlanOptions },
      { key: 'instances' as const, endpointId: 'evo-instance-list', parser: deriveInstanceOptions },
      { key: 'sshKeys' as const, endpointId: 'user-sshkeys', parser: deriveSshKeyOptions },
      { key: 'userInfo' as const, endpointId: 'user-info', parser: null },
    ]

    ;(async () => {
      try {
        const results = await Promise.allSettled(
          targets.map(async t => {
            const ep = findEndpointById(t.endpointId)!
            const res = await callEndpoint(ep, sanitizedCredentials, {} as ApiCallPayload)
            return { t, res }
          })
        )
        if (cancelled) return

        let next: CatalogData = { ...catalog, osByPlan: { ...catalog.osByPlan } }
        let ok = 0

        results.forEach(r => {
          if (r.status !== 'fulfilled') return
          const { t, res } = r.value
          const is2xx = typeof res.status === 'number' && res.status >= 200 && res.status < 300
          if (!is2xx) return
          ok++

          if (t.key === 'userInfo') {
            next.userInfo = res.data ?? res.rawBody
            return
          }
          const parsed = t.parser ? t.parser(res.data) : []
          if (t.key === 'plans' && parsed.length > 0) next.plans = parsed
          if (t.key === 'instances' && parsed.length > 0) next.instances = parsed
          if (t.key === 'sshKeys' && parsed.length > 0) next.sshKeys = parsed
        })

        next.lastUpdated = Date.now()
        setCatalog(next)
        setPrefetchState(ok > 0 ? 'done' : 'error')
      } catch {
        if (!cancelled) setPrefetchState('error')
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCredentials])

  /** OS 选项按需拉取（基于 plan_id/product_id） */
  const planIdForOs = formValues.product_id || formValues.plan_id
  useEffect(() => {
    if (!hasCredentials || !planIdForOs) return
    if (catalog.osByPlan[planIdForOs]) return

    const osEp = findEndpointById('evo-plan-os')
    if (!osEp) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await callEndpoint(osEp, sanitizedCredentials, { plan_id: planIdForOs })
        if (cancelled) return
        const osOpts = deriveOsOptions(res.data)
        setCatalog(prev => ({ ...prev, osByPlan: { ...prev.osByPlan, [planIdForOs]: osOpts } }))
      } catch {
        if (!cancelled) {
          setCatalog(prev => ({ ...prev, osByPlan: { ...prev.osByPlan, [planIdForOs]: [] } }))
        }
      }
    })()

    return () => { cancelled = true }
  }, [catalog.osByPlan, hasCredentials, planIdForOs, sanitizedCredentials, setCatalog])

  /** 动态选项：仅保留最常用映射（Plan/Instance/SSH/OS） */
  const dynamicOptions = useMemo<Record<string, OptionItem[]>>(() => {
    const map: Record<string, OptionItem[]> = {}
    const fields = selectedEndpoint.bodyFields ?? []
    fields.forEach(f => {
      const label = f.label.toLowerCase()
      if (f.key === 'product_id' || f.key === 'plan_id' || label.includes('plan id')) {
        map[f.key] = catalog.plans
        return
      }
      if (label.includes('instance id')) {
        map[f.key] = catalog.instances
        return
      }
      if (label.includes('ssh key')) {
        map[f.key] = catalog.sshKeys
        return
      }
      if (label.includes('os') && planIdForOs) {
        map[f.key] = catalog.osByPlan[planIdForOs] ?? []
      }
    })
    return map
  }, [catalog, planIdForOs, selectedEndpoint])

  /** 若动态选项可用而当前值为空，则自动填充第一个选项 */
  useEffect(() => {
    const fields = selectedEndpoint.bodyFields ?? []
    const updates: Record<string, string> = {}
    fields.forEach(f => {
      const opts = dynamicOptions[f.key]
      if (!opts?.length) return
      const v = formValues[f.key]
      if (!v || !opts.some(o => o.value === v)) updates[f.key] = opts[0].value
    })
    if (Object.keys(updates).length) setFormValues(prev => ({ ...prev, ...updates }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicOptions, selectedEndpoint.id])

  /** 提交：只发送“有值”的字段，避免把空字符串当成业务值 */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!hasCredentials) {
      appendHistory({
        kind: 'error',
        endpointId: selectedEndpoint.id,
        endpointName: selectedEndpoint.name,
        endpointMethod: selectedEndpoint.method,
        endpointPath: selectedEndpoint.path,
        error: { message: '请先填写 Client ID 与 Client Secret。' }
      })
      return
    }

    const payload: ApiCallPayload = {}
    selectedEndpoint.bodyFields?.forEach(f => {
      const v = formValues[f.key]
      if (v != null && v !== '') payload[f.key] = v
    })

    setIsLoading(true)
    const snapshot = selectedEndpoint
    try {
      const res = await callEndpoint(snapshot, sanitizedCredentials, payload)
      appendHistory({
        kind: 'success',
        endpointId: snapshot.id,
        endpointName: snapshot.name,
        endpointMethod: snapshot.method,
        endpointPath: snapshot.path,
        result: res
      })
    } catch (err: any) {
      appendHistory({
        kind: 'error',
        endpointId: snapshot.id,
        endpointName: snapshot.name,
        endpointMethod: snapshot.method,
        endpointPath: snapshot.path,
        error: { message: err?.message ?? 'Unexpected error', status: err?.status, rawBody: err?.rawBody }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const requestUrl = `${API_BASE_URL}${selectedEndpoint.path}`
  const baseDisplay = API_BASE_URL.startsWith('http')
    ? API_BASE_URL.replace(/^https?:\/\//, '')
    : API_BASE_URL

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__badge">Alice EVO Toolkit</div>
        <h1 className="hero__title">Ephemera API Console (Lite)</h1>
        <p className="hero__subtitle">最小可用：凭证、端点、动态表单、发送与原始响应。</p>
        <div className="hero__meta">
          <div className="hero__stat"><span className="hero__stat-label">Endpoints</span><span className="hero__stat-value">{endpoints.length}</span></div>
          <div className={`hero__stat ${hasCredentials ? 'hero__stat--positive':'hero__stat--warning'}`}>
            <span className="hero__stat-label">Credentials</span>
            <span className="hero__stat-value">{hasCredentials ? 'Ready':'Missing'}</span>
          </div>
          <span className="hero__pill" title={API_BASE_URL}>Base: {baseDisplay}</span>
        </div>
      </header>

      <section className="panel">
        <div className="panel__header"><h2>Credentials</h2></div>
        <div className="panel__content">
          <div className="field-group">
            <label htmlFor="client-id">Client ID</label>
            <input id="client-id" value={credentials.clientId}
              onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
              placeholder="cli_xxx" autoComplete="off" />
          </div>
          <div className="field-group">
            <label htmlFor="client-secret">Client Secret</label>
            <input id="client-secret" type="password" value={credentials.clientSecret}
              onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
              placeholder="secret" autoComplete="off" />
          </div>
          <p className="panel__hint">凭证仅存于此浏览器的 localStorage。请注意安全风险。</p>
          <div style={{ display:'flex', gap:8 }}>
            <button className="ghost-button" onClick={() => { setCatalog(defaultCatalog); setPrefetchState('idle') }} disabled={!hasCredentials}>
              Refresh data
            </button>
            <button className="ghost-button" onClick={() => { setCredentials(defaultCredentials); setCatalog(defaultCatalog); setPrefetchState('idle') }}>
              Clear
            </button>
          </div>
          {hasCredentials && (
            <p className="panel__hint panel__hint--status">
              {prefetchState === 'loading' ? '正在同步基础数据…'
                : prefetchState === 'error' ? '同步失败（将使用缓存或空列表）。'
                : catalog.lastUpdated ? `基础数据同步于 ${new Date(catalog.lastUpdated).toLocaleTimeString()}`
                : '基础数据未同步或为空。'}
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header"><h2>Endpoint</h2></div>
        <div className="panel__content">
          <div className="field-group">
            <label>Select endpoint</label>
            <div className="endpoint-snapshots" role="listbox" aria-label="Available endpoints">
              {endpoints.map(ep => {
                const isActive = ep.id === selectedEndpointId
                return (
                  <div
                    key={ep.id}
                    role="option"
                    tabIndex={0}
                    aria-selected={isActive}
                    className={`endpoint-card ${isActive ? 'endpoint-card--active' : ''}`}
                    onClick={() => handleEndpointChange(ep.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleEndpointChange(ep.id)
                      }
                    }}
                  >
                    <span className="endpoint-card__method">{ep.method}</span>
                    <span className="endpoint-card__title">{ep.name}</span>
                    {ep.description && <span className="endpoint-card__description">{ep.description}</span>}
                    <span className="endpoint-card__path">{ep.path}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {selectedEndpoint.description && <p className="panel__hint">{selectedEndpoint.description}</p>}
          <p className="panel__meta">
            <span className="tag">{selectedEndpoint.method}</span>
            <code>{requestUrl}</code>
          </p>

          <form className="form" onSubmit={handleSubmit}>
            {selectedEndpoint.bodyFields?.length ? (
              <fieldset className="form__fields">
                {selectedEndpoint.bodyFields.map(field => {
                  const opts = dynamicOptions[field.key] ?? field.options
                  const hasOpts = Array.isArray(opts) && opts.length > 0
                  const optionList = hasOpts
                    ? (opts as (OptionItem | { value: string; label: string })[])
                        .map((option) => ({
                          value: option.value,
                          label: option.label ?? option.value,
                        }))
                    : []
                  const currentValue = hasOpts
                    ? (formValues[field.key] ?? optionList[0]?.value ?? '')
                    : (formValues[field.key] ?? '')
                  const labelId = `label-${field.key}`
                  return (
                    <div className="field-group" key={field.key}>
                      <label
                        id={labelId}
                        htmlFor={!hasOpts ? `f-${field.key}` : undefined}
                      >
                        {field.label}{field.required && <span className="required">*</span>}
                      </label>
                      {hasOpts ? (
                        <div
                          id={`f-${field.key}`}
                          className="option-grid"
                          role="radiogroup"
                          aria-required={field.required}
                          aria-label={field.label}
                          aria-labelledby={labelId}
                        >
                          {optionList.map((option) => {
                            const isSelected = currentValue === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                className={`option-card ${isSelected ? 'option-card--active' : ''}`}
                                onClick={() => handleFormChange(field.key, option.value)}
                                title={option.label !== option.value ? `${option.label} (${option.value})` : option.label}
                              >
                                <span className="option-card__label">{option.label}</span>
                                {option.value !== option.label && (
                                  <span className="option-card__value">{option.value}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <input id={`f-${field.key}`} value={currentValue}
                          onChange={(e) => handleFormChange(field.key, e.target.value)}
                          placeholder={field.placeholder} required={field.required}
                        />
                      )}
                      {field.helperText && <p className="field-group__hint">{field.helperText}</p>}
                    </div>
                  )
                })}
              </fieldset>
            ) : null}
            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header"><h2>Response</h2></div>
        <div className="panel__content">
          {history.length === 0 ? (
            <p className="panel__hint">Responses will appear here after you send a request.</p>
          ) : (
            <div className="response-list">
              {history.map(h => {
                const isError = h.kind === 'error'
                const status = isError ? (h.error?.status ?? 'Error') : (h.result?.status ?? 'OK')
                const raw = isError
                  ? (h.error?.rawBody ?? h.error?.message ?? 'Unexpected error.')
                  : (typeof h.result?.data === 'string'
                      ? h.result?.data
                      : (() => { try { return JSON.stringify(h.result?.data, null, 2) } catch { return h.result?.rawBody } })())
                return (
                  <article key={h.id} className={`response ${isError ? 'response--error':''}`}>
                    <header className="response__header">
                      <div className="response__headline">
                        <span className={`tag ${isError ? 'tag--error':'tag--success'}`}>{status}</span>
                        <span className="response__meta-pill response__meta-pill--method">{h.endpointMethod}</span>
                        <span className="response__meta-pill response__meta-pill--name">{h.endpointName}</span>
                        <span className="response__meta-pill">{new Date(h.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </header>
                    <pre className="code-block">{raw}</pre>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
