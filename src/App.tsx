import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { API_BASE_URL, endpoints, type ApiEndpoint } from './api/endpoints'
import { callEndpoint, type ApiCallPayload, type ApiCallResult, type Credentials } from './api/client'
import { useLocalStorage } from './hooks/useLocalStorage'

/** -------------------- 简化的类型 -------------------- */
type FormValues = Record<string, string>
type TransformMode = 'auto' | 'raw'
type TransformModes = Record<string, TransformMode>

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
type DisplayOption = { value: string; label: string; raw?: Record<string, unknown> }

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

const PRIMARY_ENDPOINT_IDS = ['evo-deploy', 'evo-power', 'evo-rebuild'] as const
const PRIMARY_ENDPOINT_ID_SET = new Set<string>(PRIMARY_ENDPOINT_IDS)

const defaultEndpoint = (() => {
  for (const id of PRIMARY_ENDPOINT_IDS) {
    const found = endpoints.find(ep => ep.id === id)
    if (found) return found
  }
  return endpoints[0]
})()

const buildDefaultFormValues = (endpoint?: ApiEndpoint): FormValues => {
  const defaults: FormValues = {}
  endpoint?.bodyFields?.forEach(field => {
    defaults[field.key] = field.defaultValue ?? field.options?.[0]?.value ?? ''
  })
  return defaults
}

const buildDefaultTransformModes = (endpoint?: ApiEndpoint): TransformModes => {
  const modes: TransformModes = {}
  endpoint?.bodyFields?.forEach(field => {
    if (field.transform) {
      modes[field.key] = 'auto'
    }
  })
  return modes
}

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

const encodeToBase64 = (value: string): string => {
  if (!value) return ''
  if (typeof TextEncoder === 'function' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  const globalBuffer = (globalThis as typeof globalThis & { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer
  if (globalBuffer) {
    return globalBuffer.from(value, 'utf-8').toString('base64')
  }
  throw new Error('Base64 encoding is not supported in this environment.')
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

const coerceJsonValue = (value: string): string | number | boolean => {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isFinite(num)) return num
  }
  return value
}

const safeParseJson = (raw: string): any | null => {
  try {
    const cleaned = raw.startsWith('\ufeff') ? raw.slice(1) : raw
    return JSON.parse(cleaned)
  } catch {
    return null
  }
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

type OsGraphic = { type: 'svg' | 'img'; content: string }

const OS_ICON_KEYS = ['svg','icon','logo','image','img','icon_svg','iconSvg','logo_svg','logoSvg','iconUrl','logoUrl','icon_url','logo_url']
const OS_ICON_SOURCE_KEYS = ['url','href','src','data']

const readString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return undefined
}

let assetOriginCache: string | undefined
const getAssetOrigin = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  if (assetOriginCache) return assetOriginCache
  try {
    const baseUrl = new URL(API_BASE_URL, window.location.origin)
    assetOriginCache = baseUrl.origin
  } catch {
    assetOriginCache = window.location.origin
  }
  return assetOriginCache
}

const normalizeOsGraphicValue = (value: string): OsGraphic | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<svg')) return { type: 'svg', content: trimmed }
  if (/^data:image/i.test(trimmed)) return { type: 'img', content: trimmed }
  if (/^https?:/i.test(trimmed)) return { type: 'img', content: trimmed }

  if (trimmed.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
    return { type: 'img', content: `${protocol}${trimmed}` }
  }

  const withoutMarker = trimmed.startsWith('*/') ? trimmed.slice(2) : trimmed
  const assetOrigin = 'https://app.alice.ws'
  const origin = getAssetOrigin() ?? assetOrigin
  const isAssetPath = withoutMarker.startsWith('/assets') || withoutMarker.includes('/assets/')

  if (isAssetPath && assetOrigin) {
    return { type: 'img', content: `${assetOrigin}${withoutMarker}` }
  }

  if (origin) {
    try {
      const absolute = new URL(withoutMarker, `${origin}/`).toString()
      return { type: 'img', content: absolute }
    } catch {
      const normalizedPath = withoutMarker.startsWith('/') ? withoutMarker : `/${withoutMarker}`
      return { type: 'img', content: `${origin}${normalizedPath}` }
    }
  }

  return { type: 'img', content: withoutMarker }
}

const resolveOsGraphic = (raw?: Record<string, unknown>): OsGraphic | null => {
  if (!raw) return null
  for (const key of OS_ICON_KEYS) {
    const candidate = readString(raw[key])
    if (!candidate) continue
    const normalized = normalizeOsGraphicValue(candidate)
    if (normalized) return normalized
  }
  for (const key of OS_ICON_KEYS) {
    const nested = raw[key]
    if (!isRecord(nested)) continue
    for (const sourceKey of OS_ICON_SOURCE_KEYS) {
      const candidate = readString(nested[sourceKey])
      if (!candidate) continue
      const normalized = normalizeOsGraphicValue(candidate)
      if (normalized) return normalized
    }
  }
  return null
}

const gatherOsMeta = (raw: Record<string, unknown> | undefined, label: string, value: string) => {
  if (!raw) return value !== label ? value : undefined
  const parts = new Set<string>()
  const version = pick(raw, ['version','version_name','ver','release'])
  if (version) parts.add(version)
  const arch = pick(raw, ['arch','architecture','bits'])
  if (arch) parts.add(arch)
  const edition = pick(raw, ['edition','variant','type'])
  if (edition) parts.add(edition)
  const description = pick(raw, ['description','short_description','detail'])
  if (description) parts.add(description)
  const user = pick(raw, ['username'])
  if (user) parts.add(`user: ${user}`)
  const port = pick(raw, ['port'])
  if (port) parts.add(`port: ${port}`)
  if (parts.size > 0) return Array.from(parts).join(' · ')
  return value !== label ? value : undefined
}

/** 计划：更宽松地从常见键提取 id 与 label */
const extractPlanOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','product_id','plan_id','code'], ['name','planName','label'])

const deriveInstanceOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','instance_id','instanceId'], ['name','label','hostname','product','plan','status'])

const deriveSshKeyOptions = (payload: unknown) =>
  buildGenericOptions(payload, ['id','key_id','sshKey','value'], ['name','label','fingerprint'])

/** 兼容两种返回：
 * 1) 扁平列表 [{id,name,...}]
 * 2) 计划内嵌结构 { os: [{ group_name, logo, os_list:[{id,name,...}]}] }
 */
const deriveOsOptions = (payload: unknown) => {
  // 先尝试扁平
  const flat = buildGenericOptions(payload, ['id','os_id','code','value'], ['name','label','title','description'])
  if (flat.length > 0) return flat

  if (isRecord(payload) && Array.isArray((payload as any).data)) {
    const dataArr = (payload as any).data
    if (dataArr.length && isRecord(dataArr[0]) && 'os_list' in (dataArr[0] as any)) {
      return flattenPlanOs({ os: dataArr } as any)
    }
  }
  if (isRecord(payload) && isRecord((payload as any).data) && Array.isArray((payload as any).data.data)) {
    const dataArr = (payload as any).data.data
    if (dataArr.length && isRecord(dataArr[0]) && 'os_list' in (dataArr[0] as any)) {
      return flattenPlanOs({ os: dataArr } as any)
    }
  }

  // 尝试兼容 { os: groups[] }
  if (isRecord(payload) && Array.isArray((payload as any).os)) {
    return flattenPlanOs(payload as any)
  }
  // 直接是 groups[]
  if (Array.isArray(payload) && payload.length && isRecord(payload[0]) && 'os_list' in (payload[0] as any)) {
    return flattenPlanOs({ os: payload } as any)
  }
  return []
}

const findEndpointById = (id: string) => endpoints.find(e => e.id === id)

/** 把 plan.os 扁平化成 OptionItem[]，并把 group/logo 合并到 raw */
const flattenPlanOs = (planRaw: Record<string, unknown>): OptionItem[] => {
  const groups = Array.isArray((planRaw as any)?.os) ? (planRaw as any).os : []
  const out: OptionItem[] = []
  for (const g of groups) {
    const groupName = readString(g?.group_name) ?? readString(g?.groupName) ?? ''
    const logo = readString(g?.logo) ?? ''
    const list = Array.isArray(g?.os_list) ? g.os_list : []
    for (const os of list) {
      const id = readString(os?.id) ?? ''
      if (!id) continue
      const name = readString(os?.name) ?? `OS ${id}`
      out.push({
        value: id,
        label: name,
        raw: { ...(os as any), group_name: groupName, logo }
      })
    }
  }
  return uniqueOptions(out)
}

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
  const [catalogRefreshTick, bumpCatalogRefreshTick] = useState(0)
  const [osFetchStatus, setOsFetchStatus] = useState<Record<string, 'idle'|'loading'|'success'|'error'>>({})
  const [osFetchError, setOsFetchError] = useState<Record<string, string>>({})
  const initialEndpoint = defaultEndpoint ?? endpoints[0]
  const [selectedEndpointId, setSelectedEndpointId] = useState(initialEndpoint?.id ?? '')
  const selectedEndpoint = useMemo(
    () => endpoints.find(e => e.id === selectedEndpointId) ?? initialEndpoint ?? endpoints[0],
    [selectedEndpointId, initialEndpoint]
  )
  const primaryEndpoints = useMemo(
    () => endpoints.filter(ep => PRIMARY_ENDPOINT_ID_SET.has(ep.id)),
    []
  )
  const secondaryEndpoints = useMemo(
    () => endpoints.filter(ep => !PRIMARY_ENDPOINT_ID_SET.has(ep.id)),
    []
  )
  const selectedSecondaryEndpointId = secondaryEndpoints.some(ep => ep.id === selectedEndpointId)
    ? selectedEndpointId
    : ''
  const [formValues, setFormValues] = useState<FormValues>(() => {
    const ep = initialEndpoint ?? endpoints[0]
    return buildDefaultFormValues(ep)
  })
  const [transformModes, setTransformModes] = useState<TransformModes>(() => {
    const ep = initialEndpoint ?? endpoints[0]
    return buildDefaultTransformModes(ep)
  })
  const [transformCopyStatus, setTransformCopyStatus] = useState<{ key: string; status: 'copied' | 'error' } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const counter = useRef(0)

  useEffect(() => {
    if (!transformCopyStatus) return
    const timeout = setTimeout(() => setTransformCopyStatus(null), 2000)
    return () => clearTimeout(timeout)
  }, [transformCopyStatus])

  // 确保在有计划列表时自动填充 deploy 的 Plan ID，避免 OS 拉取卡在空值
  useEffect(() => {
    if (selectedEndpoint.id !== 'evo-deploy') return
    if (!catalog.plans.length) return
    if (formValues.product_id) return
    setFormValues(prev => ({ ...prev, product_id: catalog.plans[0].value }))
  }, [catalog.plans, formValues.product_id, selectedEndpoint.id])

  /** 切换端点时重置该端点的默认表单值 */
  const handleEndpointChange = (id: string) => {
    setSelectedEndpointId(id)
    const ep = endpoints.find(e => e.id === id) ?? initialEndpoint ?? endpoints[0]
    setFormValues(buildDefaultFormValues(ep))
    setTransformModes(buildDefaultTransformModes(ep))
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

        let ok = 0
        let planOptionsUpdate: OptionItem[] | null = null
        const planOsUpdates: Record<string, OptionItem[]> = {}
        let instancesUpdate: OptionItem[] | null = null
        let sshKeysUpdate: OptionItem[] | null = null
        let userInfoUpdate: unknown = undefined
        let hasUserInfoUpdate = false

        results.forEach(r => {
          if (r.status !== 'fulfilled') return
          const { t, res } = r.value
          const is2xx = typeof res.status === 'number' && res.status >= 200 && res.status < 300
          if (!is2xx) return
          ok++

          if (t.key === 'userInfo') {
            userInfoUpdate = res.data ?? res.rawBody
            hasUserInfoUpdate = true
            return
          }

          const parsed = t.parser ? t.parser(res.data) : []
          if (t.key === 'plans' && parsed.length > 0) {
            planOptionsUpdate = parsed
            for (const p of parsed) {
              const planIdKey = String(p.value)
              const flattened = flattenPlanOs(p.raw ?? {})
              if (flattened.length > 0 && !planOsUpdates[planIdKey]) {
                planOsUpdates[planIdKey] = flattened
              }
            }
          }
          if (t.key === 'instances' && parsed.length > 0) {
            instancesUpdate = parsed
          }
          if (t.key === 'sshKeys' && parsed.length > 0) {
            sshKeysUpdate = parsed
          }
        })

        // 如果计划列表没有带 OS 详情，这里预取一次以免后续界面卡在等待状态
        if (planOptionsUpdate && planOptionsUpdate.length > 0) {
          const osEp = findEndpointById('evo-plan-os')
          if (osEp) {
            await Promise.allSettled(
              planOptionsUpdate.map(async p => {
                const planIdKey = String(p.value)
                try {
                  const resOs = await callEndpoint(osEp, sanitizedCredentials, { id: planIdKey })
                  let osOpts = deriveOsOptions(resOs.data)
                  if (!osOpts.length && typeof resOs.rawBody === 'string') {
                    const parsed = safeParseJson(resOs.rawBody)
                    if (parsed) {
                      osOpts = deriveOsOptions(parsed)
                    }
                  }
                  if (!osOpts.length && isRecord(resOs.data)) {
                    const nested = (resOs.data as any).data
                    if (nested) {
                      osOpts = deriveOsOptions(nested)
                    }
                  }
                  if (osOpts.length > 0) {
                    planOsUpdates[planIdKey] = osOpts
                  }
                } catch {
                  // 单个计划的 OS 预取失败不致命，后续按需再拉取
                }
              })
            )
          }
        }

        if (cancelled) return

        setCatalog(prev => {
          const next: CatalogData = { ...prev, osByPlan: { ...prev.osByPlan } }
          if (planOptionsUpdate && planOptionsUpdate.length > 0) {
            next.plans = planOptionsUpdate
            for (const [planId, osOptions] of Object.entries(planOsUpdates)) {
              const existing = next.osByPlan[planId]
              if (!existing || existing.length === 0) {
                next.osByPlan[planId] = osOptions
              }
            }
          }
          if (instancesUpdate && instancesUpdate.length > 0) {
            next.instances = instancesUpdate
          }
          if (sshKeysUpdate && sshKeysUpdate.length > 0) {
            next.sshKeys = sshKeysUpdate
          }
          if (hasUserInfoUpdate) {
            next.userInfo = userInfoUpdate
          }
          next.lastUpdated = Date.now()
          return next
        })

        setPrefetchState(ok > 0 ? 'done' : 'error')
      } catch {
        if (!cancelled) setPrefetchState('error')
      }
    })()

    return () => { cancelled = true }
  }, [catalogRefreshTick, hasCredentials, sanitizedCredentials, setCatalog])

  const selectedInstanceOption = useMemo(() => {
    if (!formValues.id) return undefined
    return catalog.instances.find(inst => inst.value === formValues.id)
  }, [catalog.instances, formValues.id])

  /** OS 选项按需拉取（基于 plan_id/product_id 或实例所属计划） */
  const planIdForOs = useMemo(() => {
    const directPlan =
      formValues.product_id ||
      formValues.plan_id ||
      formValues['productId'] ||
      formValues['planId'] ||
      formValues['productID'] ||
      formValues['planID']
    if (directPlan) return String(directPlan)

    // Deploy 场景下，如果还没填 Plan，则默认取计划列表的第一个，确保 OS 能拉取
    if (selectedEndpoint.id === 'evo-deploy' && catalog.plans.length > 0) {
      return String(catalog.plans[0].value)
    }

    const raw = selectedInstanceOption?.raw
    if (raw && isRecord(raw)) {
      return (
        pick(raw, ['plan_id','product_id','planId','productId','plan_code','planCode','planID','productID']) ??
        undefined
      )
    }
    return undefined
  }, [formValues, selectedInstanceOption])

  useEffect(() => {
    if (!planIdForOs) return
    const cached = catalog.osByPlan[planIdForOs]
    if (cached && cached.length > 0) return  // 已经有缓存，直接用
    const status = osFetchStatus[planIdForOs]
    if (status === 'loading' || status === 'success') return

    const osEp = findEndpointById('evo-plan-os')
    if (!osEp) return
    let cancelled = false

    setOsFetchStatus(prev => ({ ...prev, [planIdForOs]: 'loading' }))
    ;(async () => {
      try {
        const res = await callEndpoint(osEp, sanitizedCredentials, { id: planIdForOs })
        if (cancelled) return
        let osOpts = deriveOsOptions(res.data)
        if (!osOpts.length && typeof res.rawBody === 'string') {
          const parsed = safeParseJson(res.rawBody)
          if (parsed) {
            osOpts = deriveOsOptions(parsed)
          }
        }
        if (!osOpts.length && isRecord(res.data)) {
          const nested = (res.data as any).data
          if (nested) {
            osOpts = deriveOsOptions(nested)
          }
        }
        setCatalog(prev => ({ ...prev, osByPlan: { ...prev.osByPlan, [planIdForOs]: osOpts } }))
        const isEmpty = osOpts.length === 0
        setOsFetchStatus(prev => ({ ...prev, [planIdForOs]: isEmpty ? 'error' : 'success' }))
        setOsFetchError(prev => {
          const next = { ...prev }
          if (isEmpty) {
            const rawSnippet = typeof res.rawBody === 'string' ? res.rawBody.slice(0, 200) : ''
            next[planIdForOs] = `接口返回为空，响应片段: ${rawSnippet || '无'}`
          } else {
            delete next[planIdForOs]
          }
          return next
        })
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.status ? `HTTP ${err.status}` : (err?.message ?? '请求失败')
          setOsFetchStatus(prev => ({ ...prev, [planIdForOs]: 'error' }))
          setOsFetchError(prev => ({ ...prev, [planIdForOs]: msg }))
        }
      }
    })()

    return () => { cancelled = true }
  }, [catalog.osByPlan, osFetchStatus, planIdForOs, sanitizedCredentials, setCatalog])

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
      const isOsField =
        f.key === 'os_id' ||
        f.key === 'os' ||
        /\bos\b/.test(label) ||
        label.includes('os id')
      if (isOsField) {
        map[f.key] = planIdForOs ? (catalog.osByPlan[planIdForOs] ?? []) : []
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
    try {
      selectedEndpoint.bodyFields?.forEach(field => {
        const rawValue = formValues[field.key]
        if (rawValue == null || rawValue === '') return
        const mode = transformModes[field.key] ?? (field.transform ? 'auto' : 'raw')
        let finalValue = rawValue
        if (field.transform === 'base64' && mode === 'auto') {
          finalValue = encodeToBase64(rawValue)
        }
        if (finalValue !== '') {
          payload[field.key] = coerceJsonValue(finalValue)
        }
      })
    } catch (error: any) {
      appendHistory({
        kind: 'error',
        endpointId: selectedEndpoint.id,
        endpointName: selectedEndpoint.name,
        endpointMethod: selectedEndpoint.method,
        endpointPath: selectedEndpoint.path,
        error: { message: error?.message ?? '无法编码脚本。' }
      })
      return
    }

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
        <h1 className="hero__title">Ephemera API Console</h1>
        <p className="hero__subtitle">By: Pixia1234</p>
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
            <button
              className="ghost-button"
              onClick={() => {
                setCatalog(defaultCatalog)
                setPrefetchState('idle')
                setOsFetchStatus({})
                setOsFetchError({})
                bumpCatalogRefreshTick(t => t + 1)
              }}
              disabled={!hasCredentials}
            >
              Refresh data
            </button>
            <button className="ghost-button" onClick={() => { setCredentials(defaultCredentials); setCatalog(defaultCatalog); setPrefetchState('idle'); setOsFetchStatus({}); setOsFetchError({}) }}>
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
            <label>核心操作</label>
            <div className="endpoint-snapshots" role="listbox" aria-label="Primary endpoints">
              {(primaryEndpoints.length ? primaryEndpoints : endpoints).map(ep => {
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
          {secondaryEndpoints.length > 0 && (
            <div className="field-group">
              <label htmlFor="endpoint-more">其他接口</label>
              <select
                id="endpoint-more"
                value={selectedSecondaryEndpointId}
                onChange={(e) => {
                  const next = e.target.value
                  if (!next) return
                  handleEndpointChange(next)
                }}
              >
                <option value="">选择其他接口…</option>
                {secondaryEndpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
              <p className="field-group__hint">完整接口列表保留在此，下拉选择即可切换。</p>
            </div>
          )}
          {selectedEndpoint.description && <p className="panel__hint">{selectedEndpoint.description}</p>}
          <p className="panel__meta">
            <span className="tag">{selectedEndpoint.method}</span>
            <code>{requestUrl}</code>
          </p>

          <form className="form" onSubmit={handleSubmit}>
            {selectedEndpoint.bodyFields?.length ? (
              <fieldset className="form__fields">
                {selectedEndpoint.bodyFields.map(field => {
                  const optionsSource = dynamicOptions[field.key] ?? field.options ?? []
                  const optionList: DisplayOption[] = Array.isArray(optionsSource)
                    ? (optionsSource as (OptionItem | { value: string; label: string })[]).map((option) => {
                        if ('raw' in option) {
                          const item = option as OptionItem
                          return { value: item.value, label: item.label, raw: item.raw }
                        }
                        return { value: option.value, label: option.label ?? option.value }
                      })
                    : []
                  const hasOptions = optionList.length > 0
                  const currentValue = hasOptions
                    ? (formValues[field.key] ?? optionList[0]?.value ?? '')
                    : (formValues[field.key] ?? '')
                  const labelId = `label-${field.key}`
                  const labelText = field.label ?? field.key
                  const normalizedLabel = labelText.toLowerCase()
                  const isOsField =
                    field.key === 'os_id' ||
                    field.key === 'os' ||
                    /\bos\b/.test(normalizedLabel) ||
                    normalizedLabel.includes('os id')
                  const isTransformField = field.transform === 'base64'
                  const transformMode = transformModes[field.key] ?? (isTransformField ? 'auto' : 'raw')
                  let encodedPreview = ''
                  let encodePreviewError: string | null = null
                  if (isTransformField && transformMode === 'auto') {
                    if (currentValue) {
                      try {
                        encodedPreview = encodeToBase64(currentValue)
                      } catch (error: any) {
                        encodePreviewError = error?.message ?? '无法生成 Base64 预览。'
                      }
                    } else {
                      encodedPreview = ''
                    }
                  }
                  const canCopyEncoded =
                    typeof navigator !== 'undefined' &&
                    !!navigator.clipboard &&
                    typeof navigator.clipboard.writeText === 'function'
                  const copyStatus = transformCopyStatus?.key === field.key ? transformCopyStatus.status : null

                  const renderTextInput = () =>
                    field.multiline ? (
                      <textarea
                        id={`f-${field.key}`}
                        value={currentValue}
                        onChange={(e) => handleFormChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={6}
                        className="field-group__textarea"
                      />
                    ) : (
                      <input
                        id={`f-${field.key}`}
                        value={currentValue}
                        onChange={(e) => handleFormChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    )

                  const renderOsCards = () => {
                    const osStatus = osFetchStatus[planIdForOs ?? '']
                    const osError = osFetchError[planIdForOs ?? '']
                    if (!hasOptions) {
                      const emptyHint =
                        osStatus === 'success'
                          ? '接口返回为空，请确认该 Plan 支持的 OS。'
                          : osStatus === 'error'
                            ? `OS 列表加载失败（${osError || 'Unknown error'}），请检查凭证或点击 Refresh data 后重试。`
                            : selectedEndpoint.id === 'evo-deploy'
                              ? '请选择 Plan 以加载可用的 OS 列表。'
                              : selectedEndpoint.id === 'evo-rebuild'
                                ? '请选择实例以加载可用的 OS 列表。'
                                : '暂无可用的操作系统选项。'
                      return (
                        <div className="option-card option-card--os option-card--disabled" aria-disabled="true">
                          <span className="option-card__icon option-card__icon--placeholder" aria-hidden="true">?</span>
                          <span className="option-card__content">
                            <span className="option-card__label">
                              {osStatus === 'success' ? '未获取到可用 OS' : '等待操作系统列表'}
                            </span>
                            <span className="option-card__meta">{emptyHint}</span>
                          </span>
                        </div>
                      )
                    }

                    return optionList.map(option => {
                      const isSelected = currentValue === option.value
                      const graphic = resolveOsGraphic(option.raw)
                      const meta = gatherOsMeta(option.raw, option.label, option.value)
                      const initials = (option.label || option.value || '?').slice(0, 2).toUpperCase()
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`option-card option-card--os ${isSelected ? 'option-card--active' : ''}`}
                          onClick={() => handleFormChange(field.key, option.value)}
                          title={meta && meta !== option.label ? `${option.label} · ${meta}` : option.label}
                        >
                          <span className={`option-card__icon ${graphic ? '' : 'option-card__icon--placeholder'}`} aria-hidden="true">
                            {graphic?.type === 'img' && (
                              <img src={graphic.content} alt="" />
                            )}
                            {graphic?.type === 'svg' && (
                              <span className="option-card__icon-svg" dangerouslySetInnerHTML={{ __html: graphic.content }} />
                            )}
                            {!graphic && <span>{initials}</span>}
                          </span>
                          <span className="option-card__content">
                            <span className="option-card__label">{option.label}</span>
                            {meta && <span className="option-card__meta">{meta}</span>}
                          </span>
                        </button>
                      )
                    })
                  }

                  let control: ReactNode
                  if (isOsField) {
                    control = (
                      <div
                        id={`f-${field.key}`}
                        className="option-grid option-grid--os"
                        role="radiogroup"
                        aria-required={field.required}
                        aria-labelledby={labelId}
                      >
                        {renderOsCards()}
                      </div>
                    )
                  } else if (hasOptions) {
                    control = (
                      <div
                        id={`f-${field.key}`}
                        className="option-grid"
                        role="radiogroup"
                        aria-required={field.required}
                        aria-label={labelText}
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
                    )
                  } else {
                    control = (
                      <>
                        {renderTextInput()}
                        {isTransformField && (
                          <div className="transform-controls" role="group" aria-label="Base64 options">
                            <label className="transform-controls__mode">
                              <input
                                type="checkbox"
                                checked={transformMode === 'auto'}
                                onChange={() => {
                                  setTransformModes(prev => ({
                                    ...prev,
                                    [field.key]: transformMode === 'auto' ? 'raw' : 'auto',
                                  }))
                                }}
                              />
                              自动 Base64 编码
                            </label>
                            <button
                              type="button"
                              className="ghost-button ghost-button--inline"
                              onClick={async () => {
                                if (
                                  !encodedPreview ||
                                  !canCopyEncoded ||
                                  typeof navigator === 'undefined' ||
                                  !navigator.clipboard ||
                                  typeof navigator.clipboard.writeText !== 'function'
                                ) {
                                  return
                                }
                                try {
                                  await navigator.clipboard.writeText(encodedPreview)
                                  setTransformCopyStatus({ key: field.key, status: 'copied' })
                                } catch {
                                  setTransformCopyStatus({ key: field.key, status: 'error' })
                                }
                              }}
                              disabled={!encodedPreview || !canCopyEncoded}
                              title={canCopyEncoded ? '复制 Base64 编码后的脚本' : '当前环境不支持快速复制'}
                            >
                              Copy Base64
                            </button>
                            {copyStatus && (
                              <span className={`transform-controls__status ${copyStatus === 'error' ? 'transform-controls__status--error' : ''}`}>
                                {copyStatus === 'copied' ? '已复制' : '复制失败'}
                              </span>
                            )}
                          </div>
                        )}
                        {isTransformField && transformMode === 'auto' && (
                          encodePreviewError ? (
                            <p className="field-group__hint field-group__hint--error">{encodePreviewError}</p>
                          ) : (
                            <div className="transform-preview">
                              <div className="transform-preview__meta">
                                <span>Base64 预览</span>
                                {encodedPreview && (
                                  <span className="transform-preview__length">{encodedPreview.length} chars</span>
                                )}
                              </div>
                              <textarea
                                readOnly
                                value={encodedPreview}
                                className="transform-preview__textarea"
                                rows={encodedPreview ? Math.min(8, Math.max(3, Math.ceil(encodedPreview.length / 80))) : 3}
                              />
                            </div>
                          )
                        )}
                      </>
                    )
                  }

                  return (
                    <div className="field-group" key={field.key}>
                      <label
                        id={labelId}
                        htmlFor={!hasOptions && !isOsField ? `f-${field.key}` : undefined}
                      >
                        {field.label}{field.required && <span className="required">*</span>}
                      </label>
                      {control}
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
