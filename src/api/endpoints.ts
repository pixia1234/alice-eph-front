const DEFAULT_API_BASE = (import.meta.env?.DEV ? '/api' : 'https://app.alice.ws/cli/v1')
const ENV_API_BASE = import.meta.env?.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = (ENV_API_BASE ? ENV_API_BASE : DEFAULT_API_BASE).replace(/\/$/, '')

export type ApiField = {
  key: string
  label: string
  location?: 'body' | 'path'
  helperText?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  options?: { label: string; value: string }[]
  multiline?: boolean
  transform?: 'base64'
}

export type ApiEndpoint = {
  id: string
  name: string
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  description?: string
  bodyFields?: ApiField[]
}

export const endpoints: ApiEndpoint[] = [
  {
    id: 'evo-instance-list',
    name: 'EVO Instance List',
    method: 'GET',
    path: '/evo/instances',
    description: 'Retrieve all EVO instances associated with the authenticated user.',
  },
  {
    id: 'evo-deploy',
    name: 'Deploy EVO Instance',
    method: 'POST',
    path: '/evo/instances/deploy',
    description: 'Provision a new EVO instance using a plan, OS, and duration.',
    bodyFields: [
      {
        key: 'product_id',
        label: 'Plan ID',
        helperText: 'Use an ID from the plan list endpoint.',
        required: true,
      },
      {
        key: 'os_id',
        label: 'OS ID',
        helperText: 'Use an ID obtained from the OS list for the selected plan.',
        required: true,
      },
      {
        key: 'time',
        label: 'Duration (hours)',
        helperText: 'Number of hours the instance should run.',
        defaultValue: '24',
        required: true,
      },
      {
        key: 'ssh_key_id',
        label: 'SSH Key ID',
        helperText: 'Optional SSH key ID associated with the account.',
      },
      {
        key: 'boot_script',
        label: 'Boot Script',
        helperText: 'Optional script to run on first boot. Encoded as Base64 before submission.',
        multiline: true,
        transform: 'base64',
      },
    ],
  },
  {
    id: 'evo-destroy',
    name: 'Destroy EVO Instance',
    method: 'DELETE',
    path: '/evo/instances/:id',
    description: 'Terminate a provisioned instance by its numeric ID.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        helperText: 'Instance identifier as returned by the instance list endpoint.',
        required: true,
        location: 'path',
      },
    ],
  },
  {
    id: 'evo-power',
    name: 'EVO Instance Power',
    method: 'POST',
    path: '/evo/instances/:id/power',
    description: 'Control the power state for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
        location: 'path',
      },
      {
        key: 'action',
        label: 'Action',
        helperText: 'Accepts boot, restart, shutdown, or poweroff.',
        defaultValue: 'restart',
        required: true,
        options: [
          { label: 'Restart', value: 'restart' },
          { label: 'Boot', value: 'boot' },
          { label: 'Shutdown', value: 'shutdown' },
          { label: 'Power off', value: 'poweroff' },
        ],
      },
    ],
  },
  {
    id: 'evo-rebuild',
    name: 'Rebuild EVO Instance',
    method: 'POST',
    path: '/evo/instances/:id/rebuild',
    description: 'Reinstall the operating system for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
        location: 'path',
      },
      {
        key: 'os_id',
        label: 'OS ID',
        helperText: 'Target operating system identifier.',
        required: true,
      },
      {
        key: 'ssh_key_id',
        label: 'SSH Key ID',
        helperText: 'Optional SSH key to inject during rebuild.',
      },
      {
        key: 'boot_script',
        label: 'Boot Script',
        helperText: 'Optional script to run after rebuild. Encoded as Base64 before submission.',
        multiline: true,
        transform: 'base64',
      },
    ],
  },
  {
    id: 'evo-plan-list',
    name: 'EVO Plan List',
    method: 'GET',
    path: '/evo/plans',
    description: 'List available EVO compute plans.',
  },
  {
    id: 'evo-plan-os',
    name: 'EVO Plan OS Images',
    method: 'GET',
    path: '/evo/plans/:id/os-images',
    description: 'Fetch operating systems supported by a specific plan.',
    bodyFields: [
      {
        key: 'id',
        label: 'Plan ID',
        required: true,
        location: 'path',
      },
    ],
  },
  {
    id: 'evo-renewal',
    name: 'EVO Instance Renewal',
    method: 'POST',
    path: '/evo/instances/:id/renewals',
    description: 'Extend the runtime for an existing instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
        location: 'path',
      },
      {
        key: 'time',
        label: 'Additional Hours',
        helperText: 'Number of extra hours to add to the instance lifetime.',
        defaultValue: '1',
        required: true,
      },
    ],
  },
  {
    id: 'evo-instance-state',
    name: 'EVO Instance State',
    method: 'GET',
    path: '/evo/instances/:id/state',
    description: 'Request a live status update for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
        location: 'path',
      },
    ],
  },
  {
    id: 'user-sshkeys',
    name: 'User SSH Keys',
    method: 'GET',
    path: '/account/ssh-keys',
    description: 'Retrieve SSH keys stored for the authenticated user.',
  },
  {
    id: 'user-evo-permissions',
    name: 'User EVO Permissions',
    method: 'GET',
    path: '/evo/permissions',
    description: 'Inspect the current user permissions for EVO actions.',
  },
  {
    id: 'user-info',
    name: 'User Info',
    method: 'GET',
    path: '/account/profile',
    description: 'Fetch basic account profile metadata.',
  },
  {
    id: 'command-execute-async',
    name: 'Execute Command (Async)',
    method: 'POST',
    path: '/evo/instances/:id/exec',
    description: 'Run a shell command asynchronously on the selected instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        helperText: 'Target instance identifier.',
        required: true,
        location: 'path',
      },
      {
        key: 'command',
        label: 'Command',
        helperText: 'Shell command to execute remotely. Encoded as Base64 when auto mode is enabled.',
        required: true,
        multiline: true,
        transform: 'base64',
      },
    ],
  },
  {
    id: 'command-get-result',
    name: 'Get Command Result',
    method: 'GET',
    path: '/evo/instances/:id/exec/:uid',
    description: 'Fetch the execution result for a previously queued command.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        helperText: 'Instance identifier.',
        required: true,
        location: 'path',
      },
      {
        key: 'uid',
        label: 'Command UID',
        helperText: 'Use the UID returned by Execute Command.',
        required: true,
        location: 'path',
      },
    ],
  },
]
