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

type OsVariant = {
  id: string
  name: string
  username?: string
  port?: number
}

type OsGroupDetail = {
  id: string
  name: string
  logo?: string
  variants: OsVariant[]
}

type PlanDetail = {
  id: string
  name: string
  description?: string
  stock?: number
  cpu?: number
  cpuName?: string
  memoryMb?: number
  diskGb?: number
  diskType?: string
  gpu?: string | null
  networkSpeed?: string
  regionId?: number
  regionName?: string
  osGroups: OsGroupDetail[]
}

type InstanceSummary = {
  id: string
  hostname?: string
  ipv4?: string
  ipv6?: string
  plan?: string
  status?: string
  region?: string
  expiresAt?: string
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
  | { type: 'planGrid'; title?: string; plans: PlanDetail[] }
  | { type: 'instanceList'; title?: string; items: InstanceSummary[] }
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

type OptionItem = {
  value: string
  label: string
  raw?: Record<string, unknown>
}

type CatalogData = {
  plans: OptionItem[]
  planDetails: PlanDetail[]
  instances: OptionItem[]
  sshKeys: OptionItem[]
  osByPlan: Record<string, OptionItem[]>
  userInfo?: unknown
  lastUpdated?: number
}

const defaultCatalog: CatalogData = {
  plans: [],
  planDetails: [],
  instances: [],
  sshKeys: [],
  osByPlan: {},
  userInfo: undefined,
  lastUpdated: undefined,
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

  const planDetails = extractPlanDetailsFromArray(array)
  if (planDetails.length > 0) {
    return [
      {
        type: 'planGrid',
        title: keyHint ? toLabel(keyHint) : undefined,
        plans: planDetails.slice(0, 6),
      },
    ]
  }

  const instanceSummaries = extractInstanceSummaries(array)
  if (instanceSummaries.length > 0) {
    return [
      {
        type: 'instanceList',
        title: keyHint ? toLabel(keyHint) : undefined,
        items: instanceSummaries.slice(0, 6),
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

function findEndpointById(id: string) {
  return endpoints.find((endpoint) => endpoint.id === id)
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (isRecord(payload)) {
    const keys = [
      'data',
      'datas',
      'result',
      'results',
      'payload',
      'list',
      'items',
      'instances',
      'plans',
      'entries',
      'sshKeys',
    ]
    for (const key of keys) {
      const candidate = payload[key]
      if (Array.isArray(candidate)) {
        return candidate
      }
    }
  }
  return []
}

function uniqueOptions(options: OptionItem[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

function formatCpu(count?: number) {
  if (count === undefined || count === null) return null
  return `${count} vCPU`
}

function formatMemory(memoryMb?: number) {
  if (memoryMb === undefined || memoryMb === null || Number.isNaN(memoryMb)) return null
  if (memoryMb >= 1024) {
    const gb = memoryMb / 1024
    const formatted = gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)
    return `${formatted} GB`
  }
  return `${memoryMb} MB`
}

function formatDisk(diskGb?: number, diskType?: string) {
  if (diskGb === undefined || diskGb === null || Number.isNaN(diskGb)) return null
  const diskLabel = diskGb % 1 === 0 ? diskGb.toFixed(0) : diskGb.toFixed(1)
  return `${diskLabel} GB${diskType ? ` ${diskType}` : ''}`.trim()
}

const ALICE_ASSET_BASE = 'https://app.alice.ws'

function resolveAssetPath(path: unknown) {
  if (typeof path !== 'string' || path.trim().length === 0) return undefined
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path
  if (path.startsWith('//')) return `https:${path}`
  if (path.startsWith('/')) return `${ALICE_ASSET_BASE}${path}`
  return `${ALICE_ASSET_BASE}/${path}`
}

function toPlanDetail(record: Record<string, unknown>): PlanDetail | null {
  const rawId = record.id ?? record.product_id ?? record.plan_id ?? record.code
  if (rawId === undefined || rawId === null) return null
  const id = String(rawId)
  const name = String(record.name ?? record.planName ?? record.label ?? `Plan ${id}`)
  const description = typeof record.description === 'string' ? record.description : undefined
  const stock = typeof record.stock === 'number' ? record.stock : undefined
  const cpu = typeof record.cpu === 'number' ? record.cpu : undefined
  const cpuName = typeof record.cpu_name === 'string' ? record.cpu_name : undefined
  const memoryMb = typeof record.memory === 'number' ? record.memory : undefined
  const diskGb = typeof record.disk === 'number' ? record.disk : undefined
  const diskType = typeof record.disk_type === 'string' ? record.disk_type : undefined
  const gpu = record.gpu ?? null
  const networkSpeed = typeof record.network_speed === 'string' ? record.network_speed : undefined
  const regionId = typeof record.region_id === 'number' ? record.region_id : undefined
  const regionName = typeof record.region === 'string' ? record.region : undefined
  const osGroupsRaw = Array.isArray(record.os) ? record.os : []

  const osGroups: OsGroupDetail[] = []

  osGroupsRaw.forEach((group) => {
    if (!isRecord(group)) return
    const rawGroupId = group.group_id ?? group.id ?? group.code
    if (rawGroupId === undefined || rawGroupId === null) return
    const groupId = String(rawGroupId)
    const groupName = String(group.group_name ?? group.name ?? `Group ${groupId}`)
    const logoUrl = resolveAssetPath(group.logo)
    const variantsRaw = Array.isArray(group.os_list) ? group.os_list : Array.isArray(group.items) ? group.items : []
    const variants: OsVariant[] = []

    variantsRaw.forEach((variant) => {
      if (!isRecord(variant)) return
      const rawVariantId = variant.id ?? variant.os_id ?? variant.code
      if (rawVariantId === undefined || rawVariantId === null) return
      const variantId = String(rawVariantId)
      const variantName = String(variant.name ?? variant.label ?? `OS ${variantId}`)
      variants.push({
        id: variantId,
        name: variantName,
        username: typeof variant.username === 'string' ? variant.username : undefined,
        port: typeof variant.port === 'number' ? variant.port : undefined,
      })
    })

    osGroups.push({
      id: groupId,
      name: groupName,
      logo: logoUrl,
      variants,
    })
  })

  return {
    id,
    name,
    description,
    stock,
    cpu,
    cpuName,
    memoryMb,
    diskGb,
    diskType,
    gpu: gpu as string | null,
    networkSpeed,
    regionId,
    regionName,
    osGroups,
  }
}

function buildPlanOptionLabel(plan: PlanDetail) {
  const parts: string[] = []
  const cpuLabel = formatCpu(plan.cpu)
  if (cpuLabel) parts.push(cpuLabel)
  const memoryLabel = formatMemory(plan.memoryMb)
  if (memoryLabel) parts.push(memoryLabel)
  const diskLabel = formatDisk(plan.diskGb, plan.diskType)
  if (diskLabel) parts.push(diskLabel)
  if (plan.networkSpeed) parts.push(plan.networkSpeed)
  return parts.length > 0 ? `${plan.name} · ${parts.join(' · ')}` : plan.name
}

function extractPlanCatalog(payload: unknown) {
  const items = unwrapList(payload)
  const details: PlanDetail[] = []
  const options: OptionItem[] = []
  const osByPlan: Record<string, OptionItem[]> = {}

  items.forEach((item) => {
    if (!isRecord(item)) return
    const detail = toPlanDetail(item)
    if (!detail) return
    details.push(detail)
    options.push({ value: detail.id, label: buildPlanOptionLabel(detail), raw: item })

    const osOptions: OptionItem[] = []
    detail.osGroups.forEach((group) => {
      group.variants.forEach((variant) => {
        osOptions.push({
          value: variant.id,
          label: `${group.name} · ${variant.name}`,
          raw: {
            group: group.name,
            logo: group.logo,
            username: variant.username,
            port: variant.port,
          },
        })
      })
    })
    if (osOptions.length > 0) {
      osByPlan[detail.id] = uniqueOptions(osOptions)
    }
  })

  return {
    options: uniqueOptions(options),
    details,
    osByPlan,
  }
}

function looksLikePlanRecord(record: Record<string, unknown>) {
  return (
    'cpu' in record ||
    'memory' in record ||
    'disk' in record ||
    'os' in record ||
    'network_speed' in record
  )
}

function extractPlanDetailsFromArray(array: unknown[]): PlanDetail[] {
  const details: PlanDetail[] = []
  array.forEach((item) => {
    if (!isRecord(item)) return
    if (!looksLikePlanRecord(item)) return
    const detail = toPlanDetail(item)
    if (detail) {
      details.push(detail)
    }
  })
  return details
}

function looksLikeInstanceRecord(record: Record<string, unknown>) {
  return (
    ('hostname' in record && 'status' in record) ||
    ('ipv4' in record && 'plan' in record) ||
    ('plan_id' in record && 'region' in record)
  )
}

function toInstanceSummary(record: Record<string, unknown>): InstanceSummary | null {
  const rawId = record.id ?? record.instance_id ?? record.uid
  if (rawId === undefined || rawId === null) return null
  const id = String(rawId)
  const hostname = typeof record.hostname === 'string' ? record.hostname : undefined
  const ipv4 = typeof record.ipv4 === 'string' ? record.ipv4 : undefined
  const ipv6 = typeof record.ipv6 === 'string' ? record.ipv6 : undefined
  const plan = typeof record.plan === 'string' ? record.plan : undefined
  const status = typeof record.status === 'string' ? record.status : undefined
  const region = typeof record.region === 'string' ? record.region : undefined
  const expiresAt = typeof record.expiration_at === 'string' ? record.expiration_at : undefined

  return {
    id,
    hostname,
    ipv4,
    ipv6,
    plan,
    status,
    region,
    expiresAt,
  }
}

function extractInstanceSummaries(payload: unknown): InstanceSummary[] {
  const items = unwrapList(payload)
  const instances: InstanceSummary[] = []
  items.forEach((item) => {
    if (!isRecord(item)) return
    if (!looksLikeInstanceRecord(item)) return
    const detail = toInstanceSummary(item)
    if (detail) instances.push(detail)
  })
  return instances
}

function deriveInstanceOptions(payload: unknown): OptionItem[] {
  const items = unwrapList(payload)
  const options: OptionItem[] = []

  items.forEach((item) => {
    if (!isRecord(item)) return
    const idCandidate = pickValue(item, ['id', 'instance_id', 'instanceId'])
    if (!idCandidate) return
    const nameCandidate =
      pickValue(item, ['name', 'label', 'hostname']) ??
      pickValue(item, ['product', 'plan'])
    const statusCandidate = pickValue(item, ['status', 'state', 'power'])

    const labelParts = [nameCandidate?.value ?? `Instance ${idCandidate.value}`]
    if (statusCandidate?.value) {
      labelParts.push(statusCandidate.value)
    }

    options.push({ value: idCandidate.value, label: labelParts.join(' · '), raw: item })
  })

  return uniqueOptions(options)
}

function deriveOsOptions(payload: unknown): OptionItem[] {
  const items = unwrapList(payload)
  const options: OptionItem[] = []

  items.forEach((item) => {
    if (!isRecord(item)) return
    const idCandidate = pickValue(item, ['id', 'os_id', 'code', 'value'])
    if (!idCandidate) return
    const labelCandidate =
      pickValue(item, ['name', 'label', 'title', 'display', 'description']) ?? idCandidate

    options.push({ value: idCandidate.value, label: labelCandidate.value, raw: item })
  })

  return uniqueOptions(options)
}

function deriveSshKeyOptions(payload: unknown): OptionItem[] {
  const items = unwrapList(payload)
  const options: OptionItem[] = []

  items.forEach((item) => {
    if (!isRecord(item)) return
    const idCandidate = pickValue(item, ['id', 'key_id', 'sshKey', 'value'])
    if (!idCandidate) return
    const labelCandidate = pickValue(item, ['name', 'label', 'fingerprint']) ?? idCandidate

    options.push({ value: idCandidate.value, label: labelCandidate.value, raw: item })
  })

  return uniqueOptions(options)
}

type ResponseCardProps = {
  entry: HistoryEntry
}

type PlanCardProps = {
  plan: PlanDetail
  onSelect?: (planId: string, osId?: string) => void
  selected?: boolean
  selectedOsId?: string
  compact?: boolean
}

function PlanCard({ plan, onSelect, selected, selectedOsId, compact = false }: PlanCardProps) {
  const specChips = useMemo(() => {
    const chips: string[] = []
    const cpuLabel = formatCpu(plan.cpu)
    if (cpuLabel) chips.push(cpuLabel)
    const memoryLabel = formatMemory(plan.memoryMb)
    if (memoryLabel) chips.push(memoryLabel)
    const diskLabel = formatDisk(plan.diskGb, plan.diskType)
    if (diskLabel) chips.push(diskLabel)
    if (plan.networkSpeed) chips.push(plan.networkSpeed)
    if (plan.regionName) chips.push(plan.regionName)
    if (plan.gpu && typeof plan.gpu === 'string') chips.push(plan.gpu)
    return chips
  }, [plan])

  const osGroups = plan.osGroups
  const hasAction = typeof onSelect === 'function' && !compact

  return (
    <div className={`plan-card ${compact ? 'plan-card--compact' : ''} ${selected ? 'plan-card--selected' : ''}`}>
      <div className="plan-card__header">
        <div>
          <h4>{plan.name}</h4>
          {plan.cpuName && !compact && <p className="plan-card__sub">{plan.cpuName}</p>}
        </div>
        {plan.stock !== undefined && plan.stock !== null && (
          <span className="plan-card__badge">库存 {plan.stock}</span>
        )}
      </div>
      {specChips.length > 0 && (
        <div className="plan-card__specs">
          {specChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      )}
      {plan.description && !compact && plan.description.trim().length > 0 && (
        <p className="plan-card__description">{plan.description}</p>
      )}
      {osGroups.length > 0 && (
        <div className="plan-card__os">
          {osGroups.map((group) => {
            const primaryVariant = group.variants[0]
            if (!primaryVariant) return null
            const key = `${plan.id}-${group.id}`
            const content = (
              <>
                {group.logo && <img src={group.logo} alt={group.name} loading="lazy" />}
                <span>{group.name}</span>
                {group.variants.length > 1 && (
                  <span className="plan-card__os-more">+{group.variants.length - 1}</span>
                )}
              </>
            )
            if (hasAction) {
              const isActive = selected && selectedOsId === primaryVariant.id
              return (
                <button
                  type="button"
                  key={key}
                  className={`plan-card__os-button ${isActive ? 'plan-card__os-button--active' : ''}`}
                  onClick={() => onSelect?.(plan.id, primaryVariant.id)}
                  title={primaryVariant.name}
                >
                  {content}
                </button>
              )
            }
            return (
              <span key={key} className="plan-card__os-chip" title={primaryVariant.name}>
                {content}
              </span>
            )
          })}
        </div>
      )}
      {hasAction && (
        <div className="plan-card__actions">
          <button type="button" onClick={() => onSelect?.(plan.id)} className="plan-card__action">
            使用此规格
          </button>
        </div>
      )}
    </div>
  )
}

function ResponseCard({ entry }: ResponseCardProps) {
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
            if (block.type === 'planGrid') {
              return (
                <section className="preview__block plan-preview" key={`plans-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <div className="plan-preview__grid">
                    {block.plans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} compact />
                    ))}
                  </div>
                </section>
              )
            }

            if (block.type === 'instanceList') {
              return (
                <section className="preview__block instance-preview" key={`instances-${index}`}>
                  {block.title && <h3>{block.title}</h3>}
                  <div className="instance-preview__list">
                    {block.items.map((instance) => (
                      <div className="instance-preview__item" key={instance.id}>
                        {(() => {
                          const statusLabel = instance.status
                          const statusClass = statusLabel
                            ? statusLabel.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                            : ''
                          return (
                            <div className="instance-preview__heading">
                              <h4>{instance.hostname ?? `实例 ${instance.id}`}</h4>
                              {statusLabel && (
                                <span
                                  className={`instance-preview__status instance-preview__status--${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                        <dl>
                          <div>
                            <dt>ID</dt>
                            <dd>{instance.id}</dd>
                          </div>
                          {instance.plan && (
                            <div>
                              <dt>Plan</dt>
                              <dd>{instance.plan}</dd>
                            </div>
                          )}
                          {instance.region && (
                            <div>
                              <dt>Region</dt>
                              <dd>{instance.region}</dd>
                            </div>
                          )}
                          {instance.ipv4 && (
                            <div>
                              <dt>IPv4</dt>
                              <dd>{instance.ipv4}</dd>
                            </div>
                          )}
                          {instance.ipv6 && (
                            <div>
                              <dt>IPv6</dt>
                              <dd>{instance.ipv6}</dd>
                            </div>
                          )}
                          {instance.expiresAt && (
                            <div>
                              <dt>Expires</dt>
                              <dd>{instance.expiresAt}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>
                </section>
              )
            }

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
  const [storedCatalog, setCatalog] = useLocalStorage<CatalogData>('alice.catalog', defaultCatalog)
  const [prefetchState, setPrefetchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [prefetchError, setPrefetchError] = useState<string | null>(null)
  const [pendingOsPlan, setPendingOsPlan] = useState<string | null>(null)
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpoints[0].id)
  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? endpoints[0],
    [selectedEndpointId],
  )
  const [formValues, setFormValues] = useState<FormValues>(() => getInitialValues(endpoints[0]))
  const [isLoading, setIsLoading] = useState(false)
  const historyCounter = useRef(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const catalog = useMemo(() => {
    const planDetails = storedCatalog.planDetails ?? defaultCatalog.planDetails
    const osByPlan: Record<string, OptionItem[]> = {
      ...defaultCatalog.osByPlan,
      ...(storedCatalog.osByPlan ?? defaultCatalog.osByPlan),
    }

    planDetails.forEach((plan) => {
      if (!plan) return
      if (!osByPlan[plan.id] || osByPlan[plan.id].length === 0) {
        const osOptions: OptionItem[] = []
        plan.osGroups.forEach((group) => {
          group.variants.forEach((variant) => {
            osOptions.push({
              value: variant.id,
              label: `${group.name} · ${variant.name}`,
              raw: {
                group: group.name,
                logo: group.logo,
                username: variant.username,
                port: variant.port,
              },
            })
          })
        })
        if (osOptions.length > 0) {
          osByPlan[plan.id] = uniqueOptions(osOptions)
        }
      }
    })

    return {
      ...defaultCatalog,
      ...storedCatalog,
      plans: storedCatalog.plans ?? defaultCatalog.plans,
      planDetails,
      instances: storedCatalog.instances ?? defaultCatalog.instances,
      sshKeys: storedCatalog.sshKeys ?? defaultCatalog.sshKeys,
      osByPlan,
      userInfo: storedCatalog.userInfo,
      lastUpdated: storedCatalog.lastUpdated,
    }
  }, [storedCatalog])

  const sanitizedCredentials = useMemo<Credentials>(
    () => ({
      clientId: credentials.clientId.trim(),
      clientSecret: credentials.clientSecret.trim(),
    }),
    [credentials],
  )
  const hasCredentials =
    sanitizedCredentials.clientId.length > 0 && sanitizedCredentials.clientSecret.length > 0
  const credentialsFingerprint = `${sanitizedCredentials.clientId}|${sanitizedCredentials.clientSecret}`
  const previousFingerprint = useRef<string>('')

  useEffect(() => {
    const isEmpty = !sanitizedCredentials.clientId && !sanitizedCredentials.clientSecret
    if (isEmpty) {
      previousFingerprint.current = ''
      return
    }

    if (
      previousFingerprint.current &&
      previousFingerprint.current !== credentialsFingerprint
    ) {
      setCatalog({ ...defaultCatalog, osByPlan: {} })
      setPrefetchState('idle')
      setPrefetchError(null)
    }

    previousFingerprint.current = credentialsFingerprint
  }, [credentialsFingerprint, sanitizedCredentials.clientId, sanitizedCredentials.clientSecret, setCatalog, setPrefetchError, setPrefetchState])

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

  const handlePlanQuickSelect = (planId: string, osId?: string) => {
    const deployEndpoint = findEndpointById('evo-deploy') ?? endpoints[0]
    setSelectedEndpointId(deployEndpoint.id)

    setFormValues((prev) => {
      const base = selectedEndpointId === deployEndpoint.id ? prev : getInitialValues(deployEndpoint)
      const next: FormValues = { ...base }
      next.product_id = planId
      if ('plan_id' in base) {
        next.plan_id = planId
      }
      if (osId) {
        next.os_id = osId
      } else if (!next.os_id && catalog.osByPlan[planId]?.length) {
        next.os_id = catalog.osByPlan[planId][0]?.value ?? ''
      }
      if (!next.time) {
        next.time = '24'
      }
      return next
    })
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

  useEffect(() => {
    if (!hasCredentials) return
    if (prefetchState === 'loading') return

    const needsPlans = catalog.plans.length === 0
    const needsInstances = catalog.instances.length === 0
    const needsSshKeys = catalog.sshKeys.length === 0
    const needsUser = !catalog.userInfo
    const isStale =
      typeof catalog.lastUpdated !== 'number' || Date.now() - catalog.lastUpdated > 1000 * 60 * 5

    if (!(needsPlans || needsInstances || needsSshKeys || needsUser || isStale)) {
      return
    }

    if (prefetchState === 'error' && !isStale) {
      return
    }

    let cancelled = false

    async function prefetchReferenceData() {
      setPrefetchState('loading')
      setPrefetchError(null)

      const targets = [
        { key: 'plans' as const, endpointId: 'evo-plan-list' },
        { key: 'instances' as const, endpointId: 'evo-instance-list' },
        { key: 'sshKeys' as const, endpointId: 'user-sshkeys' },
        { key: 'userInfo' as const, endpointId: 'user-info' },
      ]

      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const endpoint = findEndpointById(target.endpointId)
          if (!endpoint) {
            throw new Error(`Missing endpoint definition for ${target.endpointId}`)
          }
          const response = await callEndpoint(endpoint, sanitizedCredentials, {} as ApiCallPayload)
          return { target, response }
        }),
      )

      if (cancelled) return

      let successCount = 0
      let planCatalogUpdate: ReturnType<typeof extractPlanCatalog> | undefined
      let instanceUpdate: OptionItem[] | undefined
      let sshUpdate: OptionItem[] | undefined
      let userUpdate: unknown | undefined

      results.forEach((result) => {
        if (result.status !== 'fulfilled') {
          console.warn('Prefetch request failed.', result.reason)
          return
        }

        successCount += 1
        const { target, response } = result.value

        if (target.key === 'plans') {
          const catalogData = extractPlanCatalog(response.data)
          if (catalogData.details.length > 0 || catalogData.options.length > 0) {
            planCatalogUpdate = catalogData
          }
          return
        }

        if (target.key === 'instances') {
          const options = deriveInstanceOptions(response.data)
          if (options.length > 0) {
            instanceUpdate = options
          }
          return
        }

        if (target.key === 'sshKeys') {
          const options = deriveSshKeyOptions(response.data)
          if (options.length >= 0) {
            sshUpdate = options
          }
          return
        }

        if (target.key === 'userInfo') {
          userUpdate = response.data ?? response.rawBody
        }
      })

      const effectivePlans = planCatalogUpdate?.options ?? catalog.plans
      const essentialsReady = effectivePlans.length > 0

      setCatalog((prev) => {
        const next: CatalogData = {
          ...prev,
          osByPlan: { ...prev.osByPlan },
          planDetails: [...prev.planDetails],
        }

        if (planCatalogUpdate) {
          next.plans = planCatalogUpdate.options
          next.planDetails = planCatalogUpdate.details
          next.osByPlan = {
            ...next.osByPlan,
            ...planCatalogUpdate.osByPlan,
          }
        }
        if (instanceUpdate) {
          next.instances = instanceUpdate
        }
        if (sshUpdate) {
          next.sshKeys = sshUpdate
        }
        if (userUpdate !== undefined) {
          next.userInfo = userUpdate
        }
        next.lastUpdated = Date.now()
        return next
      })

      if (successCount > 0 && essentialsReady) {
        setPrefetchState('done')
      } else {
        setPrefetchState('error')
        setPrefetchError('自动加载参考数据失败，请稍后重试。')
      }
    }

    prefetchReferenceData()

    return () => {
      cancelled = true
    }
  }, [catalog, hasCredentials, sanitizedCredentials, prefetchState, setCatalog])

  const planIdForOs = formValues.product_id || formValues.plan_id

  const dynamicOptions = useMemo<Record<string, OptionItem[]>>(() => {
    const map: Record<string, OptionItem[]> = {}
    const fields = selectedEndpoint.bodyFields ?? []

    fields.forEach((field) => {
      const labelLower = field.label.toLowerCase()

      if (field.key === 'product_id' || field.key === 'plan_id' || labelLower.includes('plan id')) {
        map[field.key] = catalog.plans
        return
      }

      if (field.key === 'id' || labelLower.includes('instance id')) {
        map[field.key] = catalog.instances
        return
      }

      if (labelLower.includes('ssh key')) {
        map[field.key] = catalog.sshKeys
        return
      }

      if (labelLower.includes('os') && planIdForOs) {
        map[field.key] = catalog.osByPlan[planIdForOs] ?? []
      }
    })

    return map
  }, [catalog.instances, catalog.osByPlan, catalog.plans, catalog.sshKeys, planIdForOs, selectedEndpoint])

  const accountLabel = useMemo(() => {
    const info = catalog.userInfo
    if (!info) return null
    if (typeof info === 'string') {
      const trimmed = info.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    if (isRecord(info)) {
      const primary =
        pickValue(info, ['name', 'username', 'email', 'account', 'account_name']) ??
        pickValue(info, ['id'])
      return primary?.value ?? null
    }
    return null
  }, [catalog.userInfo])

  useEffect(() => {
    const fields = selectedEndpoint.bodyFields ?? []
    const updates: Record<string, string> = {}

    fields.forEach((field) => {
      const options = dynamicOptions[field.key]
      if (!options || options.length === 0) return
      const currentValue = formValues[field.key]
      if (!currentValue || !options.some((option) => option.value === currentValue)) {
        updates[field.key] = options[0]?.value ?? ''
      }
    })

    if (Object.keys(updates).length > 0) {
      setFormValues((prev) => ({ ...prev, ...updates }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicOptions, selectedEndpoint.id])

  useEffect(() => {
    if (!planIdForOs || !hasCredentials) return
    if (catalog.osByPlan[planIdForOs]) return
    if (pendingOsPlan === planIdForOs) return

    const osEndpoint = findEndpointById('evo-plan-os')
    if (!osEndpoint) return

    let cancelled = false
    setPendingOsPlan(planIdForOs)

    ;(async () => {
      try {
        const response = await callEndpoint(osEndpoint, sanitizedCredentials, {
          plan_id: planIdForOs,
        })
        if (cancelled) return
        const osOptions = deriveOsOptions(response.data)
        setCatalog((prev) => ({
          ...prev,
          osByPlan: {
            ...prev.osByPlan,
            [planIdForOs]: osOptions,
          },
        }))
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load OS list for plan', planIdForOs, error)
          setCatalog((prev) => ({
            ...prev,
            osByPlan: {
              ...prev.osByPlan,
              [planIdForOs]: [],
            },
          }))
        }
      } finally {
        if (!cancelled) {
          setPendingOsPlan((current) => (current === planIdForOs ? null : current))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [catalog.osByPlan, hasCredentials, planIdForOs, pendingOsPlan, sanitizedCredentials, setCatalog])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedEndpoint) return

    const trimmedId = sanitizedCredentials.clientId
    const trimmedSecret = sanitizedCredentials.clientSecret
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
      const response = await callEndpoint(endpointSnapshot, sanitizedCredentials, payload)
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

  const handleRefreshCatalog = () => {
    setCatalog({ ...defaultCatalog, osByPlan: {} })
    setPrefetchState('idle')
    setPrefetchError(null)
  }

  const handleClearCredentials = () => {
    setCredentials(defaultCredentials)
    handleRefreshCatalog()
  }

  const requestUrl = useMemo(() => `${API_BASE_URL}${selectedEndpoint.path}`, [selectedEndpoint])
  const totalEndpoints = endpoints.length
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
          {accountLabel && (
            <div className="hero__stat" title={accountLabel}>
              <span className="hero__stat-label">Account</span>
              <span className="hero__stat-value hero__stat-value--sm">{accountLabel}</span>
            </div>
          )}
          <span className="hero__pill" title={API_BASE_URL}>
            Base: {baseDisplay}
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="panel__header">
          <h2>Credentials</h2>
          <div className="panel__actions">
            <button
              type="button"
              onClick={handleRefreshCatalog}
              className="ghost-button"
              disabled={!hasCredentials}
            >
              Refresh data
            </button>
            <button type="button" onClick={handleClearCredentials} className="ghost-button">
              Clear
            </button>
          </div>
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
          {hasCredentials && (
            <p className="panel__hint panel__hint--status">
              {prefetchState === 'loading'
                ? '正在同步 plan、实例等基础数据…'
                : prefetchState === 'error'
                  ? prefetchError ?? '自动同步失败，请稍后重试。'
                  : catalog.lastUpdated
                    ? `基础数据同步于 ${new Date(catalog.lastUpdated).toLocaleTimeString()}`
                    : '基础数据同步完毕。'}
            </p>
          )}
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
          {catalog.planDetails.length > 0 && (
            <div className="quick-create" role="region" aria-label="快速创建">
              <div className="quick-create__header">
                <h3>快速创建</h3>
                {prefetchState === 'loading' && <span className="quick-create__status">同步中…</span>}
              </div>
              <div className="quick-create__grid">
                {catalog.planDetails.slice(0, 4).map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSelect={handlePlanQuickSelect}
                    selected={selectedEndpointId === 'evo-deploy' && formValues.product_id === plan.id}
                    selectedOsId={selectedEndpointId === 'evo-deploy' ? formValues.os_id : undefined}
                  />
                ))}
              </div>
            </div>
          )}
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
                      {(() => {
                        const dynamicList = dynamicOptions[field.key]
                        const labelLower = field.label.toLowerCase()
                        const isOsField = labelLower.includes('os')
                        const isPlanField =
                          field.key === 'product_id' || field.key === 'plan_id' || labelLower.includes('plan id')
                        const isInstanceField = field.key === 'id' || labelLower.includes('instance id')
                        const isSshField = labelLower.includes('ssh key')
                        const loadingOs = isOsField && pendingOsPlan === planIdForOs
                        const isLoadingDynamic =
                          (!isOsField && prefetchState === 'loading' && (isPlanField || isInstanceField || isSshField)) ||
                          loadingOs

                        if (dynamicList) {
                          const hasOptions = dynamicList.length > 0
                          const shouldFallbackToInput = !hasOptions && prefetchState === 'error'
                          if (!shouldFallbackToInput) {
                            const selectValue = hasOptions ? formValues[field.key] ?? dynamicList[0]?.value ?? '' : ''
                            const disableSelect = (!hasOptions && field.required) || (loadingOs && !hasOptions)
                            return (
                              <select
                                id={`field-${field.key}`}
                                value={selectValue}
                                onChange={(event) => handleFormValueChange(field.key, event.target.value)}
                                required={field.required && hasOptions}
                                disabled={disableSelect}
                              >
                                {hasOptions ? (
                                  dynamicList.map((option) => (
                                    <option key={option.value} value={option.value} title={option.label}>
                                      {option.label}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">
                                    {isLoadingDynamic ? '正在加载选项…' : '暂无可选项'}
                                  </option>
                                )}
                              </select>
                            )
                          }
                        }

                        if (field.options) {
                          return (
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
                          )
                        }

                        return (
                          <input
                            id={`field-${field.key}`}
                            value={formValues[field.key] ?? ''}
                            onChange={(event) => handleFormValueChange(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            required={field.required}
                          />
                        )
                      })()}
                      {field.helperText && <p className="field-group__hint">{field.helperText}</p>}
                      {dynamicOptions[field.key] &&
                        dynamicOptions[field.key].length === 0 &&
                        prefetchState === 'done' && (
                          <p className="field-group__hint">暂无可用数据</p>
                        )}
                      {dynamicOptions[field.key] && prefetchState === 'loading' && (
                        <p className="field-group__hint">正在同步基础数据…</p>
                      )}
                      {dynamicOptions[field.key] && prefetchState === 'error' && (
                        <p className="field-group__hint">
                          {!dynamicOptions[field.key].length
                            ? '自动同步失败，可手动输入或稍后重试。'
                            : '数据来自上次可用的缓存，若有疑问请刷新。'}
                        </p>
                      )}
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
                return <ResponseCard key={entry.id} entry={entry} />
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
